// The site's icons, drawn from the client's own mark and nothing else.
//
//   node scripts/brand/icons.mjs            (from apps/public)
//
// THE MARK IS NOT TOUCHED (components/site/Logo.tsx has the standing order):
// this renders the supplied artwork — public/brand/qhr-mark.svg, and the flat
// cut under 32 px where the roof's gradient has three pixels to run in — on
// the ivory plate the header stands it on, at each size a browser or a phone
// asks for, and writes the pixels down. The plate is there for the same
// reason as in the header: cobalt cannot be seen on a dark tab or a dark home
// screen, and a phone paints black behind an icon with no ground of its own.
//
//   src/app/favicon.ico      16, 32 and 48 px (what /favicon.ico answers)
//   src/app/apple-icon.png   180 px (a phone's home screen)
//   public/icons/icon-192.png, icon-512.png   (the manifest's: src/app/manifest.ts)
//
// The forensic audit of 2026-10-09, #95: "/favicon.ico and
// /apple-touch-icon.png answer 404".
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');

const PLATE = '#F2EDE4'; // the header's plate (Logo.tsx)
const CLEAR = 0.34; // the clear space round the mark, as Logo.tsx keeps it
const full = fs.readFileSync('public/brand/qhr-mark.svg', 'utf8');
const flat = fs.readFileSync('public/brand/qhr-mark-flat.svg', 'utf8');
const uri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const browser = await chromium.launch();
async function draw(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const mark = Math.round(size / (1 + CLEAR));
  await page.setContent(
    `<body style="margin:0;background:${PLATE};width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">` +
      `<img src="${uri(size < 64 ? flat : full)}" style="width:${mark}px;height:${mark}px;display:block"></body>`,
  );
  await page.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
  const png = await page.screenshot({ type: 'png' });
  await page.close();
  return png;
}

// An .ico is a directory of pictures; each here is a PNG, which every browser
// that reads an .ico reads.
function ico(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(entries.length, 4);
  let at = 6 + 16 * entries.length;
  const dir = entries.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(at, 12);
    at += png.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...entries.map((e) => e.png)]);
}

const small = [];
for (const size of [16, 32, 48]) small.push({ size, png: await draw(size) });
fs.writeFileSync('src/app/favicon.ico', ico(small));
fs.writeFileSync('src/app/apple-icon.png', await draw(180));
fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon-192.png', await draw(192));
fs.writeFileSync('public/icons/icon-512.png', await draw(512));
await browser.close();
for (const f of ['src/app/favicon.ico', 'src/app/apple-icon.png', 'public/icons/icon-192.png', 'public/icons/icon-512.png']) {
  console.log(f, fs.statSync(f).size, 'bytes');
}
