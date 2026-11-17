"""Generation runs: each one is a `generate.sh <N> <folder> [seed]` process writing into its own folder.

A run's record is a JSON file in <output_dir>/.runs/<id>.json, so runs survive backend restarts. The images are in
<output_dir>/<id>/, exactly as generate.sh writes them (table_00000.png + table_00000_mask001.png, ...).
"""

import asyncio
import json
import logging
import os
import re
import secrets
import shutil
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

RUN_ID_RE = re.compile(r"^[0-9]{8}-[0-9]{6}-[0-9a-f]{4}$")
SEED_RE = re.compile(r"\(seed (\d+)\)")
MASK_SUFFIX = "_mask001.png"
LOG_LIMIT = 20_000

_semaphore = asyncio.Semaphore(settings.max_concurrent_runs)
_processes: dict[str, asyncio.subprocess.Process] = {}
_tasks: dict[str, asyncio.Task] = {}
_live: dict[str, dict] = {}  # records of queued and running runs


def output_root() -> Path:
    return Path(settings.output_dir)


def _records_dir() -> Path:
    path = output_root() / ".runs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def run_dir(run_id: str) -> Path:
    return output_root() / run_id


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _save(record: dict) -> None:
    path = _records_dir() / f"{record['id']}.json"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(record, indent=2))
    tmp.replace(path)


def load(run_id: str) -> dict | None:
    if not RUN_ID_RE.match(run_id):
        return None
    path = _records_dir() / f"{run_id}.json"
    return json.loads(path.read_text()) if path.exists() else None


def completed_pairs(run_id: str) -> int:
    """Pairs written so far. generate.sh writes each image before its mask, so a mask means a finished pair."""
    folder = run_dir(run_id)
    if not folder.is_dir():
        return 0
    return sum(1 for entry in folder.iterdir() if entry.name.endswith(MASK_SUFFIX))


def with_progress(record: dict) -> dict:
    return {**record, "completed": completed_pairs(record["id"])}


def list_all() -> list[dict]:
    records = []
    for path in _records_dir().glob("*.json"):
        try:
            records.append(json.loads(path.read_text()))
        except (OSError, json.JSONDecodeError):
            logger.warning("Skipping unreadable run record %s", path)
    records.sort(key=lambda r: r["created_at"], reverse=True)
    return [with_progress(r) for r in records]


def pair_names(run_id: str) -> list[str]:
    """Base names (e.g. table_00000) of the finished pairs, in order."""
    folder = run_dir(run_id)
    if not folder.is_dir():
        return []
    return sorted(e.name[: -len(MASK_SUFFIX)] for e in folder.iterdir() if e.name.endswith(MASK_SUFFIX))


def create(count: int, seed: int | None) -> dict:
    run_id = f"{datetime.now(timezone.utc):%Y%m%d-%H%M%S}-{secrets.token_hex(2)}"
    record = {
        "id": run_id,
        "count": count,
        "seed": seed,
        "seed_given": seed is not None,
        "status": "queued",
        "created_at": _now(),
        "started_at": None,
        "finished_at": None,
        "returncode": None,
        "log": "",
    }
    _save(record)
    _live[run_id] = record
    _tasks[run_id] = asyncio.create_task(_execute(record))
    return with_progress(record)


async def _execute(record: dict) -> None:
    run_id = record["id"]
    try:
        async with _semaphore:
            if record["status"] == "cancelled" or record.get("deleted"):
                return
            record.update(status="running", started_at=_now())
            _save(record)
            args = ["bash", settings.generate_script, str(record["count"]), str(run_dir(run_id))]
            if record["seed"] is not None:
                args.append(str(record["seed"]))
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                # Own process group, so cancelling also stops the `node` process generate.sh starts.
                start_new_session=True,
            )
            _processes[run_id] = proc
            if record["status"] == "cancelled":  # cancelled while the process was starting
                _kill(proc)
            output, _ = await proc.communicate()
            log = output.decode(errors="replace")
            record["log"] = log[-LOG_LIMIT:]
            record["returncode"] = proc.returncode
            # Without a given seed, generate.sh picks one and prints it: keep it so the run can be reproduced.
            if record["seed"] is None and (match := SEED_RE.search(log)):
                record["seed"] = int(match.group(1))
            if record["status"] != "cancelled":
                record["status"] = "done" if proc.returncode == 0 else "error"
    except Exception as exc:  # noqa: BLE001 - recorded on the run instead of lost in a background task
        logger.exception("Run %s failed", run_id)
        record.update(status="error", log=f"{record['log']}\n{exc}".strip())
    finally:
        _processes.pop(run_id, None)
        _tasks.pop(run_id, None)
        _live.pop(run_id, None)
        if not record.get("deleted"):
            record["finished_at"] = record["finished_at"] or _now()
            _save(record)


def cancel(run_id: str) -> dict | None:
    # An active run's record is shared with its background task, so the task sees the cancellation.
    record = _live.get(run_id) or load(run_id)
    if record is None:
        return None
    if record["status"] in ("queued", "running"):
        record.update(status="cancelled", finished_at=_now())
        _save(record)
        if (proc := _processes.get(run_id)) is not None:
            _kill(proc)
    return with_progress(record)


def _kill(proc: asyncio.subprocess.Process) -> None:
    if proc.returncode is None:
        try:
            os.killpg(proc.pid, 9)
        except ProcessLookupError:
            pass


def delete(run_id: str) -> bool:
    record = _live.get(run_id) or load(run_id)
    if record is None:
        return False
    cancel(run_id)
    record["deleted"] = True  # so a still-finishing task doesn't write the record back
    shutil.rmtree(run_dir(run_id), ignore_errors=True)
    (_records_dir() / f"{run_id}.json").unlink(missing_ok=True)
    return True


def recover_interrupted() -> int:
    """Runs still queued or running when the backend stopped never finish: mark them as errors."""
    count = 0
    for record in list_all():
        if record["status"] in ("queued", "running"):
            record.pop("completed", None)
            record.update(status="error", finished_at=_now(), log=f"{record['log']}\nInterrupted by a restart.".strip())
            _save(record)
            count += 1
    return count


async def cancel_all() -> None:
    """On shutdown: stop every queued or running run and wait for its record to be saved."""
    tasks = list(_tasks.values())
    for run_id in list(_live):
        cancel(run_id)
    await asyncio.gather(*tasks, return_exceptions=True)
