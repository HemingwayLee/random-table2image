import { useCallback, useEffect, useState } from "react";
import { Alert, AppBar, Box, Toolbar, Typography } from "@mui/material";
import { api } from "./api";
import ThemeToggle from "./components/ThemeToggle";
import NewRunForm from "./components/NewRunForm";
import RunList from "./components/RunList";
import RunDetail from "./components/RunDetail";

const ACTIVE = ["queued", "running"];

export default function App() {
  const [runs, setRuns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const list = await api.listRuns();
      setRuns(list);
      setError("");
      setSelectedId((id) => (id && list.some((r) => r.id === id) ? id : list[0]?.id ?? null));
    } catch (e) {
      setError(`Can't reach the backend: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    refresh();
    api.config().then(setConfig).catch(() => {});
  }, [refresh]);

  // Poll while something is generating, so progress and status stay current.
  const anyActive = runs.some((r) => ACTIVE.includes(r.status));
  useEffect(() => {
    if (!anyActive) return;
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [anyActive, refresh]);

  const handleCreate = async (count, seed) => {
    const run = await api.createRun(count, seed);
    setSelectedId(run.id);
    await refresh();
  };

  const selected = runs.find((r) => r.id === selectedId) ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
            random-table2image
          </Typography>
          <ThemeToggle />
        </Toolbar>
      </AppBar>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", flex: 1, minHeight: 0, flexDirection: { xs: "column", md: "row" } }}>
        <Box
          sx={{
            width: { xs: "100%", md: 340 },
            flexShrink: 0,
            borderRight: { md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            maxHeight: { xs: "45dvh", md: "none" },
          }}
        >
          <NewRunForm maxCount={config?.max_count} onCreate={handleCreate} />
          <RunList runs={runs} selectedId={selectedId} onSelect={setSelectedId} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto" }}>
          {selected ? (
            <RunDetail run={selected} onChanged={refresh} />
          ) : (
            <Box sx={{ p: 4, color: "text.secondary" }}>
              <Typography>No runs yet. Choose how many image + mask pairs to generate and press Generate.</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
