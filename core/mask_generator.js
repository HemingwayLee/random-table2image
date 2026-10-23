// Random-rectangle mask rasterization for LaMa image/mask pairs. White (255) =
// region to remove/inpaint, black (0) = keep. Shared by generate_dataset.js
// (Node) and index.html (browser).

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// rectCount is always >= MIN_RECTS so masks are never a single rectangle.
const MIN_RECTS = 2;
const MAX_RECTS = 5;

function randomRectCount() {
  return randomInt(MIN_RECTS, MAX_RECTS);
}

// A 1px gap is enough to keep rectangles as separate 4-connected components.
const GAP = 1;

function overlaps(a, b) {
  return a.x0 < b.x1 + GAP && a.x1 + GAP > b.x0 &&
         a.y0 < b.y1 + GAP && a.y1 + GAP > b.y0;
}

// Picks `rectCount` axis-aligned rectangles that don't touch/overlap each other,
// so they always render as visually and topologically distinct shapes (never a
// merged blob). Shrinks a candidate on repeated placement failure so it still
// fits once free space gets tight late in the loop.
function placeRects(width, height, rectCount) {
  const placed = [];
  for (let i = 0; i < rectCount; i++) {
    let maxW = Math.round(width * 0.35);
    let maxH = Math.round(height * 0.35);
    let rect = null;

    for (let attempt = 0; attempt < 400 && !rect; attempt++) {
      if (attempt > 0 && attempt % 100 === 0) {
        maxW = Math.max(4, Math.round(maxW * 0.6));
        maxH = Math.max(4, Math.round(maxH * 0.6));
      }
      const minW = Math.min(Math.round(width * 0.05), maxW);
      const minH = Math.min(Math.round(height * 0.05), maxH);
      const rw = randomInt(Math.max(1, minW), Math.max(1, maxW));
      const rh = randomInt(Math.max(1, minH), Math.max(1, maxH));
      if (rw >= width || rh >= height) continue;
      const x0 = randomInt(0, width - rw);
      const y0 = randomInt(0, height - rh);
      const candidate = { x0, y0, x1: x0 + rw, y1: y0 + rh };
      if (!placed.some(p => overlaps(candidate, p))) rect = candidate;
    }

    if (rect) placed.push(rect);
    // If we truly can't fit another disjoint rectangle, stop rather than
    // overlap -- the already-placed ones (>= MIN_RECTS in any image large
    // enough for this to matter) still satisfy the "always multiple" contract.
  }
  return placed;
}

// Returns a raw RGBA buffer: { width, height, data: Uint8Array }, black background
// with `rectCount` random, mutually non-overlapping white axis-aligned
// rectangles (never fewer than MIN_RECTS requested, though see placeRects()
// for the rare case placement itself has to give up early).
function generateMaskRGBA(width, height, rectCount = randomRectCount()) {
  rectCount = Math.max(MIN_RECTS, rectCount);
  const data = new Uint8Array(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255; // opaque, black elsewhere

  const rects = placeRects(width, height, rectCount);
  for (const { x0, y0, x1, y1 } of rects) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (width * y + x) << 2;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      }
    }
  }

  return { width, height, data, rectCount: rects.length };
}

// In the browser (loaded via <script>) the functions above are page globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { randomInt, randomRectCount, generateMaskRGBA, MIN_RECTS, MAX_RECTS };
}
