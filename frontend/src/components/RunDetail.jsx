import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import StopIcon from "@mui/icons-material/Stop";
import { api, zipUrl } from "../api";
import PairGallery from "./PairGallery";
import { formatTime } from "./RunList";
import StatusChip from "./StatusChip";

const ACTIVE = ["queued", "running"];

export default function RunDetail({ run, onChanged }) {
  const [log, setLog] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const active = ACTIVE.includes(run.status);

  // The run list has no logs: load this run's once it has finished.
  useEffect(() => {
    setLog("");
    setError("");
    if (active) return;
    api.getRun(run.id).then((r) => setLog(r.log)).catch(() => {});
  }, [run.id, active]);

  const act = async (fn) => {
    setError("");
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const command = `./generate.sh ${run.count} <folder>${run.seed !== null ? ` ${run.seed}` : ""}`;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        <Typography variant="h6">{run.count.toLocaleString()} pairs</Typography>
        <StatusChip status={run.status} />
        <Box sx={{ flex: 1 }} />
        {active && (
          <Button size="small" startIcon={<StopIcon />} onClick={() => act(() => api.cancelRun(run.id))}>
            Cancel
          </Button>
        )}
        <Button
          size="small"
          variant="contained"
          startIcon={<DownloadIcon />}
          href={zipUrl(run.id)}
          disabled={run.completed === 0}
        >
          Download zip
        </Button>
        <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </Stack>

      <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
        Run {run.id} · started {formatTime(run.created_at)}
        {run.finished_at && ` · finished ${formatTime(run.finished_at)}`}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Seed: {run.seed ?? (active ? "random, shown when the run finishes" : "unknown")}
        {run.seed !== null && !run.seed_given && " (picked at random)"} · reproduce with{" "}
        <Box component="code" sx={{ fontSize: "0.85em" }}>
          {command}
        </Box>
      </Typography>

      {active && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant={run.status === "queued" ? "indeterminate" : "determinate"}
            value={(100 * run.completed) / run.count}
          />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {run.status === "queued"
              ? "Waiting for another run to finish"
              : `${run.completed.toLocaleString()} / ${run.count.toLocaleString()} pairs`}
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {log && (
        <Box
          component="pre"
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: "action.hover",
            borderRadius: 1,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {log}
        </Box>
      )}

      <PairGallery runId={run.id} completed={run.completed} />

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete this run?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Its {run.completed.toLocaleString()} image + mask pairs are deleted from the output folder.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Keep</Button>
          <Button
            color="error"
            onClick={() => {
              setConfirmDelete(false);
              act(() => api.deleteRun(run.id));
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
