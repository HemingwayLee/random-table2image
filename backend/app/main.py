import logging
import os
import re
import tempfile
import zipfile
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app import runs
from app.config import settings

logger = logging.getLogger(__name__)

FILE_RE = re.compile(r"^table_[0-9]+(_mask001)?\.png$")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if count := runs.recover_interrupted():
        logger.warning("Marked %d runs interrupted by a restart as errors", count)
    yield
    await runs.cancel_all()


app = FastAPI(title="random-table2image", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunCreate(BaseModel):
    count: int = Field(ge=1, description="Number of image + mask pairs (generate.sh's N).")
    seed: int | None = Field(default=None, ge=0, description="Same seed and count give the same images; omit for random.")


def _get(run_id: str) -> dict:
    record = runs.load(run_id)
    if record is None:
        raise HTTPException(404, "Run not found")
    return record


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/config")
def config():
    return {"max_count": settings.max_count, "max_concurrent_runs": settings.max_concurrent_runs}


@app.get("/api/runs")
def list_runs():
    return [_summary(r) for r in runs.list_all()]


@app.post("/api/runs", status_code=201)
async def create_run(body: RunCreate):
    if body.count > settings.max_count:
        raise HTTPException(422, f"count must be at most {settings.max_count}")
    return _summary(runs.create(body.count, body.seed))


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    return {k: v for k, v in runs.with_progress(_get(run_id)).items() if k != "deleted"}


@app.post("/api/runs/{run_id}/cancel")
def cancel_run(run_id: str):
    _get(run_id)
    return _summary(runs.cancel(run_id))


@app.delete("/api/runs/{run_id}", status_code=204)
def delete_run(run_id: str):
    _get(run_id)
    runs.delete(run_id)


@app.get("/api/runs/{run_id}/pairs")
def list_pairs(run_id: str, offset: int = Query(0, ge=0), limit: int = Query(24, ge=1, le=500)):
    """Finished image + mask pairs, by base name: the image is <name>.png and its mask <name>_mask001.png."""
    _get(run_id)
    names = runs.pair_names(run_id)
    return {"total": len(names), "items": names[offset : offset + limit]}


@app.get("/api/runs/{run_id}/files/{name}")
def get_file(run_id: str, name: str):
    _get(run_id)
    path = runs.run_dir(run_id) / name
    if not FILE_RE.match(name) or not path.is_file():
        raise HTTPException(404, "File not found")
    return FileResponse(path, media_type="image/png")


@app.get("/api/runs/{run_id}/zip")
def download_zip(run_id: str, background: BackgroundTasks):
    """The run's folder as a zip, ready to unpack as a LaMa val/ or visual_test/ set."""
    record = _get(run_id)
    folder = runs.run_dir(run_id)
    if not folder.is_dir():
        raise HTTPException(404, "This run has no files")
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    # PNGs are already compressed: store them as they are.
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as archive:
        for path in sorted(folder.iterdir()):
            if FILE_RE.match(path.name):
                archive.write(path, f"{run_id}/{path.name}")
    tmp.close()
    background.add_task(os.unlink, tmp.name)
    seed = f"-seed{record['seed']}" if record["seed"] is not None else ""
    return FileResponse(tmp.name, media_type="application/zip", filename=f"tables-{run_id}{seed}.zip")


def _summary(record: dict) -> dict:
    """A run without its log, for lists."""
    return {k: v for k, v in record.items() if k not in ("log", "deleted")}
