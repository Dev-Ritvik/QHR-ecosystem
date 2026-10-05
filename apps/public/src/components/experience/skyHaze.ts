// apps/public/src/components/experience/skyHaze.ts
//
// The land's air takes the colour of the sky it is seen against.
//
// The estate's haze was one colour, sampled from the painted sky's horizon on
// the SUN'S bearing: a warm cream. Toward the sun that is the sky's own foot,
// and the far trees dissolve into it. Away from the sun the photographed sky's
// foot is a slate grey-blue a stop darker, and against it the same cream made
// the far belt of trees print LIGHTER than the sky behind them: a row of white
// cumulus where a line of trees should be (seen on the paid audit's cover
// frame, 2026-10-04, once a long lens stacked that belt up behind the house).
// Air has no colour of its own. Seen from the side it is lit by the sky beyond
// it, so a tree a hundred and fifty metres off goes to the colour of the
// horizon it stands against, whichever way the camera looks.
//
// So the haze is read from the plate: the band of sky just above its horizon,
// by bearing, once, when the panorama loads. Each frame the fog takes the mean
// of that band across the camera's view, at the sky's own strength for the
// hour (WorldCanvas, SKY_HOURS). The land's far edge and the sky's foot are
// then the same value by construction, at every bearing and every hour.

import * as THREE from 'three';

const BINS = 72;
const table = new Float32Array(BINS * 3);
let ready = false;

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** The band read, in degrees above the plate's horizon. */
export const HAZE_BAND_DEG = [0.5, 4] as const;

/**
 * Read the sky's foot from the equirectangular plate (its image, as loaded).
 * Returns false where there is no canvas to read it with; the fog then keeps
 * its authored colours.
 */
export function readSkyHaze(image: CanvasImageSource): boolean {
  if (typeof document === 'undefined') return false;
  const W = 288;
  const H = 144;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return false;
  try {
    g.drawImage(image, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    // v = 0.5 is the horizon; an image row counts down from the zenith.
    const y0 = Math.floor(H * (0.5 - HAZE_BAND_DEG[1] / 180));
    const y1 = Math.max(y0 + 1, Math.floor(H * (0.5 - HAZE_BAND_DEG[0] / 180)));
    const per = W / BINS;
    for (let b = 0; b < BINS; b += 1) {
      let r = 0;
      let gr = 0;
      let bl = 0;
      let n = 0;
      for (let x = Math.floor(b * per); x < Math.floor((b + 1) * per); x += 1) {
        for (let y = y0; y < y1; y += 1) {
          const i = (y * W + x) * 4;
          r += toLinear(px[i]);
          gr += toLinear(px[i + 1]);
          bl += toLinear(px[i + 2]);
          n += 1;
        }
      }
      table[b * 3] = r / n;
      table[b * 3 + 1] = gr / n;
      table[b * 3 + 2] = bl / n;
    }
    ready = true;
  } catch {
    ready = false;
  }
  return ready;
}

/** For tests: set the table directly (linear RGB per bin). */
export function setSkyHaze(colours: ArrayLike<number> | null): void {
  if (!colours) {
    ready = false;
    return;
  }
  for (let i = 0; i < BINS * 3; i += 1) table[i] = colours[i % colours.length];
  ready = true;
}

export function skyHazeReady(): boolean {
  return ready;
}

export const SKY_HAZE_BINS = BINS;

/**
 * The sky's foot toward the horizontal direction (x, z), averaged `spread`
 * radians either side of it: scene-linear, written to `out`. three reads an
 * equirectangular panorama at u = atan2(z, x) / 2pi + 0.5.
 */
export function skyHazeToward(x: number, z: number, spread: number, out: THREE.Color): THREE.Color {
  const u = Math.atan2(z, x) / (2 * Math.PI) + 0.5;
  const half = Math.max(0, Math.min(0.5, spread / (2 * Math.PI)));
  const from = Math.floor((u - half) * BINS);
  const to = Math.ceil((u + half) * BINS);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = from; i <= to; i += 1) {
    const k = ((i % BINS) + BINS) % BINS;
    r += table[k * 3];
    g += table[k * 3 + 1];
    b += table[k * 3 + 2];
    n += 1;
  }
  return out.setRGB(r / n, g / n, b / n);
}
