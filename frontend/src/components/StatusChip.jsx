import { Chip } from "@mui/material";

const COLORS = { queued: "default", running: "info", done: "success", error: "error", cancelled: "warning" };

export default function StatusChip({ status }) {
  return <Chip size="small" label={status} color={COLORS[status] ?? "default"} variant="outlined" />;
}
