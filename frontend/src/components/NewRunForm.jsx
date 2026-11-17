import { useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

// The options of generate.sh <N> <folder> [seed]; the backend picks the folder.
export default function NewRunForm({ maxCount, onCreate }) {
  const [count, setCount] = useState("100");
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const countValid = /^[1-9][0-9]*$/.test(count) && (!maxCount || Number(count) <= maxCount);
  const seedValid = seed === "" || /^[0-9]+$/.test(seed);

  const submit = async (e) => {
    e.preventDefault();
    if (!countValid || !seedValid) return;
    setBusy(true);
    setError("");
    try {
      await onCreate(Number(count), seed === "" ? null : Number(seed));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        New run
      </Typography>
      <Stack spacing={1.5}>
        <TextField
          label="Pairs (N)"
          size="small"
          value={count}
          onChange={(e) => setCount(e.target.value.trim())}
          error={!countValid}
          helperText={
            countValid ? "Image + mask pairs to generate" : `A whole number from 1${maxCount ? ` to ${maxCount}` : ""}`
          }
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
        />
        <TextField
          label="Seed (optional)"
          size="small"
          value={seed}
          onChange={(e) => setSeed(e.target.value.trim())}
          error={!seedValid}
          helperText={seedValid ? "Same seed and N give the same images. Empty: random" : "A non-negative whole number"}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          type="submit"
          variant="contained"
          startIcon={<PlayArrowIcon />}
          disabled={busy || !countValid || !seedValid}
        >
          Generate
        </Button>
      </Stack>
    </Box>
  );
}
