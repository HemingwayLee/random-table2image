import { useEffect, useState } from "react";
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import { api, fileUrl } from "../api";

const PAGE = 24;

// Finished image + mask pairs of a run, a page at a time.
export default function PairGallery({ runId, completed }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [overlay, setOverlay] = useState(false);

  // Reload the first page for a new run, and as pairs appear while the first page isn't full yet.
  const firstPageFull = items.length >= PAGE;
  useEffect(() => {
    if (firstPageFull) return;
    let stale = false;
    api
      .listPairs(runId, 0, PAGE)
      .then((page) => {
        if (stale) return;
        setItems(page.items);
        setTotal(page.total);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [runId, completed, firstPageFull]);

  useEffect(() => {
    setItems([]);
    setTotal(0);
  }, [runId]);

  useEffect(() => setTotal((t) => Math.max(t, completed)), [completed]);

  const loadMore = async () => {
    const page = await api.listPairs(runId, items.length, PAGE);
    setItems((prev) => [...prev, ...page.items]);
    setTotal(page.total);
  };

  if (total === 0) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" sx={{ alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Showing {items.length.toLocaleString()} of {total.toLocaleString()} pairs
        </Typography>
        <FormControlLabel
          control={<Switch size="small" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />}
          label="Overlay mask"
          slotProps={{ typography: { variant: "body2" } }}
        />
      </Stack>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fill, minmax(420px, 1fr))" },
        }}
      >
        {items.map((name) => (
          <Pair key={name} runId={runId} name={name} overlay={overlay} />
        ))}
      </Box>
      {items.length < total && (
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Button onClick={loadMore}>Show more</Button>
        </Box>
      )}
    </Box>
  );
}

function Pair({ runId, name, overlay }) {
  const image = fileUrl(runId, `${name}.png`);
  const mask = fileUrl(runId, `${name}_mask001.png`);
  const imgSx = { width: "100%", display: "block", border: 1, borderColor: "divider", bgcolor: "#fff" };

  return (
    <Box>
      {overlay ? (
        <Box sx={{ position: "relative" }}>
          <Box component="img" src={image} alt={name} loading="lazy" sx={imgSx} />
          {/* screen blend: white mask areas turn white, black areas leave the image as it is */}
          <Box
            component="img"
            src={mask}
            alt=""
            loading="lazy"
            sx={{ ...imgSx, position: "absolute", inset: 0, height: "100%", mixBlendMode: "screen", opacity: 0.85 }}
          />
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <a href={image} target="_blank" rel="noreferrer">
            <Box component="img" src={image} alt={name} loading="lazy" sx={imgSx} />
          </a>
          <a href={mask} target="_blank" rel="noreferrer">
            <Box component="img" src={mask} alt={`${name} mask`} loading="lazy" sx={imgSx} />
          </a>
        </Box>
      )}
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {name}
      </Typography>
    </Box>
  );
}
