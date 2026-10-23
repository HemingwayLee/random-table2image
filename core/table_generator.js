// Random table generator shared by generate_dataset.js (Node) and index.html
// (browser): builds a random table structure and rasterizes it straight to an
// RGBA buffer (no DOM/canvas), so both produce pixel-identical images.

const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double'];
const PATTERN_TYPES = ['dots', 'stripes', 'grid'];

// mulberry32: small, fast 32-bit seeded PRNG returning floats in [0, 1).
// Assign the result to Math.random to make generation reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Mirrors CSS hsl(h, s%, l%) -> {r,g,b} in [0,255].
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  };
}

function randomColorHsl() {
  return { h: randomInt(0, 359), s: randomInt(40, 80), l: randomInt(55, 85) };
}

function randomBorderColor() {
  return hslToRgb(randomInt(0, 359), randomInt(40, 80), randomInt(25, 50));
}

// Same hue/saturation, lightness moved by `delta` percentage points (clamped to 0-100).
function shiftLightness(hsl, delta) {
  return { h: hsl.h, s: hsl.s, l: Math.min(100, Math.max(0, hsl.l + delta)) };
}

// A solid color, or (50% chance) a repeating dot/stripe/grid pattern rendered
// with a darker accent shade of the same base color. Colors are resolved to RGB
// up front since the renderer paints pixels directly, not through a DOM.
function randomBackgroundSpec(baseHsl) {
  const baseRgb = hslToRgb(baseHsl.h, baseHsl.s, baseHsl.l);
  if (Math.random() >= 0.5) return { kind: 'solid', color: baseRgb };

  const accentHsl = shiftLightness(baseHsl, -25);
  const accentRgb = hslToRgb(accentHsl.h, accentHsl.s, accentHsl.l);
  const pattern = PATTERN_TYPES[randomInt(0, PATTERN_TYPES.length - 1)];
  const size = randomInt(8, 16);
  return { kind: 'pattern', pattern, base: baseRgb, accent: accentRgb, size };
}

// Builds the random cell/grid structure (sizes, spans, colors, padding).
function buildTable() {
  const rowCount = randomInt(5, 20);
  const colCount = randomInt(2, 8);
  const colorByRow = Math.random() < 0.5;
  let hasBorderColor = Math.random() < 0.7;
  let hasCellColor = Math.random() < 0.7;
  // Never let both be false at once -- that combination renders as an
  // all-white table indistinguishable from an empty/blank image.
  if (!hasBorderColor && !hasCellColor) {
    if (Math.random() < 0.5) hasBorderColor = true;
    else hasCellColor = true;
  }

  const borderColor = hasBorderColor ? randomBorderColor() : null;
  BORDER_STYLES[randomInt(0, BORDER_STYLES.length - 1)]; // style is cosmetic only, not rasterized
  const borderWidth = randomInt(1, 6);

  const lineBackgrounds = [];
  if (hasCellColor) {
    const lineCount = colorByRow ? rowCount : colCount;
    for (let i = 0; i < lineCount; i++) lineBackgrounds.push(randomBackgroundSpec(randomColorHsl()));
  }

  const occupied = Array.from({ length: rowCount }, () => Array(colCount).fill(-1));
  const cells = [];

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      if (occupied[r][c] !== -1) continue;

      let colSpan = 1;
      let rowSpan = 1;
      if (Math.random() < 0.15) {
        const wantColSpan = Math.random() < 0.5 ? Math.min(randomInt(2, 3), colCount - c) : 1;
        const wantRowSpan = Math.random() < 0.5 ? Math.min(randomInt(2, 3), rowCount - r) : 1;
        let fits = true;
        for (let rr = r; rr < r + wantRowSpan && fits; rr++) {
          for (let cc = c; cc < c + wantColSpan; cc++) {
            if (occupied[rr][cc] !== -1) { fits = false; break; }
          }
        }
        if (fits) { colSpan = wantColSpan; rowSpan = wantRowSpan; }
      }

      const cellIndex = cells.length;
      for (let rr = r; rr < r + rowSpan; rr++) {
        for (let cc = c; cc < c + colSpan; cc++) {
          occupied[rr][cc] = cellIndex;
        }
      }

      cells.push({
        r, c, colSpan, rowSpan,
        width: randomInt(20, 100),
        height: randomInt(20, 80),
        background: hasCellColor ? (colorByRow ? lineBackgrounds[r] : lineBackgrounds[c]) : null,
      });
    }
  }

  const padding = {
    top: randomInt(10, 60),
    right: randomInt(10, 60),
    bottom: randomInt(10, 60),
    left: randomInt(10, 60),
  };

  return { rowCount, colCount, cells, occupied, borderColor, borderWidth, padding };
}

// Approximates HTML auto table-layout: each column/row width/height is the max
// declared size among the 1x1 cells anchored there (spanning cells don't define
// a single column's width in real table layout either).
function layoutTable({ rowCount, colCount, cells }) {
  const colWidths = Array(colCount).fill(0);
  const rowHeights = Array(rowCount).fill(0);

  for (const cell of cells) {
    if (cell.colSpan === 1) colWidths[cell.c] = Math.max(colWidths[cell.c], cell.width);
    if (cell.rowSpan === 1) rowHeights[cell.r] = Math.max(rowHeights[cell.r], cell.height);
  }
  for (let c = 0; c < colCount; c++) if (colWidths[c] === 0) colWidths[c] = 60;
  for (let r = 0; r < rowCount; r++) if (rowHeights[r] === 0) rowHeights[r] = 50;

  const colX = [0];
  for (let c = 0; c < colCount; c++) colX.push(colX[c] + colWidths[c]);
  const rowY = [0];
  for (let r = 0; r < rowCount; r++) rowY.push(rowY[r] + rowHeights[r]);

  return { colWidths, rowHeights, colX, rowY, tableWidth: colX[colCount], tableHeight: rowY[rowCount] };
}

// Rasterizes a table into a raw RGBA buffer: { width, height, data: Uint8Array }.
// data is top-to-bottom, left-to-right, 4 bytes/pixel (R,G,B,A), fully opaque.
function rasterizeToRGBA(table) {
  const { rowCount, colCount, cells, occupied, borderColor, borderWidth, padding } = table;
  const { colX, rowY, tableWidth, tableHeight } = layoutTable(table);

  const width = padding.left + tableWidth + padding.right;
  const height = padding.top + tableHeight + padding.bottom;
  const data = new Uint8Array(width * height * 4).fill(255); // opaque white background

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = (width * y + x) << 2;
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
    data[idx + 3] = 255;
  }

  function fillRect(x0, y0, x1, y1, color) {
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
        setPixel(x, y, color);
      }
    }
  }

  // Background patterns tile relative to the cell's own top-left corner, mirroring
  // CSS's default background-position ("0 0") being relative to each element's own
  // padding box, not the page/canvas origin.
  function paintPattern(x0, y0, x1, y1, spec) {
    const { pattern, base, accent, size } = spec;
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
      const ly = y - y0;
      for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
        const lx = x - x0;
        let useAccent;
        if (pattern === 'dots') {
          const tx = (lx % size) - size / 2;
          const ty = (ly % size) - size / 2;
          useAccent = Math.sqrt(tx * tx + ty * ty) <= size * 0.3;
        } else if (pattern === 'stripes') {
          useAccent = (lx + ly) % size < 3;
        } else { // grid
          useAccent = (lx % size === 0) || (ly % size === 0);
        }
        setPixel(x, y, useAccent ? accent : base);
      }
    }
  }

  function paintBackground(x0, y0, x1, y1, spec) {
    if (spec.kind === 'solid') fillRect(x0, y0, x1, y1, spec.color);
    else paintPattern(x0, y0, x1, y1, spec);
  }

  for (const cell of cells) {
    if (!cell.background) continue;
    const x0 = padding.left + colX[cell.c];
    const y0 = padding.top + rowY[cell.r];
    const x1 = padding.left + colX[cell.c + cell.colSpan];
    const y1 = padding.top + rowY[cell.r + cell.rowSpan];
    paintBackground(x0, y0, x1, y1, cell.background);
  }

  if (borderColor) {
    const half = Math.floor(borderWidth / 2);
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c <= colCount; c++) {
        const left = c > 0 ? occupied[r][c - 1] : -2;
        const right = c < colCount ? occupied[r][c] : -2;
        if (left !== right) {
          const bx = padding.left + colX[c];
          fillRect(bx - half, padding.top + rowY[r], bx + (borderWidth - half), padding.top + rowY[r + 1], borderColor);
        }
      }
    }
    for (let c = 0; c < colCount; c++) {
      for (let r = 0; r <= rowCount; r++) {
        const top = r > 0 ? occupied[r - 1][c] : -2;
        const bottom = r < rowCount ? occupied[r][c] : -2;
        if (top !== bottom) {
          const by = padding.top + rowY[r];
          fillRect(padding.left + colX[c], by - half, padding.left + colX[c + 1], by + (borderWidth - half), borderColor);
        }
      }
    }
  }

  return { width, height, data };
}

function generateTableRGBA() {
  const table = buildTable();
  return rasterizeToRGBA(table);
}

// In the browser (loaded via <script>) the functions above are page globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mulberry32, buildTable, layoutTable, rasterizeToRGBA, generateTableRGBA };
}
