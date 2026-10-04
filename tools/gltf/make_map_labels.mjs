// tools/gltf/make_map_labels.mjs
//
// The map table's lettering, set in the site's own face.
//
//   node make_map_labels.mjs <top_meta.json> <playfair.woff2> <out.png>
//
// Run from apps/public (it borrows that package's Playwright). The engraving on
// the relief is set in Playfair, the site's one family, at a cap height of
// about 2 cm on the table, tracked open — the way an engraver sets a district
// name on a map — so the lettering in the film and the lettering on the page
// are one voice. Rendered by Chromium from the same webfont the site serves
// (OFL), into a transparent 2048 square on the texture's own plan (row 0
// north), which make_map_table.py cuts into the plaster and gilds in the sea.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');

const [META, FONT, OUT] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const font = fs.readFileSync(FONT).toString('base64');
const N = meta.size;
const PX_PER_M = N / (2 * meta.half);

const browser = await chromium.launch();
const page = await browser.newPage();
const png = await page.evaluate(
  async ({ font, N, PX_PER_M, labels }) => {
    const face = new FontFace('Map', `url(data:font/woff2;base64,${font})`, { weight: '300 900' });
    await face.load();
    document.fonts.add(face);
    const c = document.createElement('canvas');
    c.width = N;
    c.height = N;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Cap height ~2 cm: Playfair's capitals stand at ~0.71 em.
    const size = (0.02 / 0.71) * PX_PER_M;
    const set = (text, x, y, angle, scale, track) => {
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      g.font = `500 ${size * scale}px Map`;
      g.letterSpacing = `${size * scale * track}px`;
      g.fillText(text, 0, 0);
      g.restore();
    };
    for (const [text, at] of Object.entries(labels)) {
      if (text === 'BAY OF BENGAL') set(text, at[0], at[1], -0.72, 1.1, 0.42);
      else set(text, at[0], at[1], 0, 1, 0.34);
    }
    return c.toDataURL('image/png');
  },
  { font, N, PX_PER_M, labels: meta.labels },
);
fs.writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', OUT);
