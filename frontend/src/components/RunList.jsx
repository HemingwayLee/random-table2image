import { LinearProgress, List, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import StatusChip from "./StatusChip";

export function formatTime(iso) {
  return iso ? new Date(iso).toLocaleString() : "";
}

export default function RunList({ runs, selectedId, onSelect }) {
  return (
    <List dense sx={{ flex: 1, overflow: "auto", py: 0 }}>
      {runs.map((run) => (
        <ListItemButton
          key={run.id}
          selected={run.id === selectedId}
          onClick={() => onSelect(run.id)}
          sx={{ borderBottom: 1, borderColor: "divider", display: "block" }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <ListItemText
              primary={`${run.count.toLocaleString()} pairs${run.seed !== null ? ` · seed ${run.seed}` : ""}`}
              secondary={formatTime(run.created_at)}
            />
            <StatusChip status={run.status} />
          </Stack>
          {run.status === "running" && (
            <LinearProgress variant="determinate" value={(100 * run.completed) / run.count} sx={{ mt: 0.5 }} />
          )}
        </ListItemButton>
      ))}
      {runs.length === 0 && (
        <Typography variant="body2" sx={{ p: 2, color: "text.secondary" }}>
          No runs yet.
        </Typography>
      )}
    </List>
  );
}
