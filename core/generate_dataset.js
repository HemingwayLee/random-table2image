#!/usr/bin/env node
// Generates N synthetic table images (same algorithm as index.html's Generate
// button) plus a matching random-rectangle mask for each, using LaMa's naming
// convention: <outdir>/table_00000.png + <outdir>/table_00000_mask001.png.
// LaMa pairs them by globbing *mask*.png and stripping the `_mask` suffix.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { generateTableRGBA } = require('./table_generator');
const { generateMaskRGBA } = require('./mask_generator');

function writePng(outPath, { width, height, data }) {
  const png = new PNG({ width, height });
  data.copy(png.data);
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

function main() {
  const [countArg, outdir] = process.argv.slice(2);
  const count = parseInt(countArg, 10);
  if (!outdir || !Number.isInteger(count) || count < 1) {
    console.error('Usage: node generate_dataset.js <N> <outdir>');
    process.exit(1);
  }

  fs.mkdirSync(outdir, { recursive: true });
  const pad = Math.max(5, String(count - 1).length);
  for (let i = 0; i < count; i++) {
    const base = `table_${String(i).padStart(pad, '0')}`;
    const image = generateTableRGBA();
    writePng(path.join(outdir, `${base}.png`), image);
    writePng(path.join(outdir, `${base}_mask001.png`), generateMaskRGBA(image.width, image.height));
  }
  console.log(`Wrote ${count} image+mask pairs to ${outdir}`);
}

main();
