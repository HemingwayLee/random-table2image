#!/usr/bin/env node
// Generates N synthetic table images (same algorithm as index.html's Generate
// button) plus a matching random-rectangle mask for each, using LaMa's naming
// convention: <outdir>/table_00000.png + <outdir>/table_00000_mask001.png.
// LaMa pairs them by globbing *mask*.png and stripping the `_mask` suffix.
// An optional seed makes the whole run reproducible.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { mulberry32, generateTableRGBA } = require('./table_generator');
const { generateMaskRGBA } = require('./mask_generator');

function writePng(outPath, { width, height, data }) {
  const png = new PNG({ width, height });
  png.data.set(data);
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

function main() {
  const [countArg, outdir, seedArg] = process.argv.slice(2);
  const count = parseInt(countArg, 10);
  if (!outdir || !Number.isInteger(count) || count < 1 ||
      (seedArg !== undefined && !/^[0-9]+$/.test(seedArg))) {
    console.error('Usage: node generate_dataset.js <N> <outdir> [seed]');
    process.exit(1);
  }

  // table_generator and mask_generator draw all randomness from Math.random,
  // so swapping it for a seeded PRNG makes every image and mask reproducible.
  // Seeds are taken mod 2^32 (the PRNG's state size).
  const seed = seedArg !== undefined
    ? Number(BigInt(seedArg) % 4294967296n)
    : Math.floor(Math.random() * 4294967296);
  Math.random = mulberry32(seed);

  fs.mkdirSync(outdir, { recursive: true });
  const pad = Math.max(5, String(count - 1).length);
  for (let i = 0; i < count; i++) {
    const base = `table_${String(i).padStart(pad, '0')}`;
    const image = generateTableRGBA();
    writePng(path.join(outdir, `${base}.png`), image);
    writePng(path.join(outdir, `${base}_mask001.png`), generateMaskRGBA(image.width, image.height));
  }
  console.log(`Wrote ${count} image+mask pairs to ${outdir} (seed ${seed})`);
}

main();
