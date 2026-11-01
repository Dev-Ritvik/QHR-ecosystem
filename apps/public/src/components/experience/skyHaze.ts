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

/**
 * THE SAME BAND AS A TEXTURE, one texel a bin, for the haze to be read PER
 * PIXEL (exteriorHaze.ts). The fog's one colour a frame is the band's mean
 * across the camera's view, and a view is sixty degrees wide: at sunset the
 * sky's foot runs from orange at one edge of the frame to slate at the other,
 * and a tree line fogged to their mean is a grey band against both — darker
 * than the sky behind it on the sun's side, lighter on the other (the audit of
 * 2026-10-05, P2: "a hard fog band ... done when the horizon dissolves into
 * air"). Each far thing takes the foot of the sky on ITS OWN bearing.
 *
 * sRGB bytes: every device filters them, and the card decodes them to the
 * linear values the table holds. Wraps round the compass.
 */
const ringData = new Uint8Array(BINS * 4);
let ring: THREE.DataTexture | null = null;

const toSRGB = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
};

function writeRing(): void {
  for (let b = 0; b < BINS; b += 1) {
    ringData[b * 4] = toSRGB(table[b * 3]);
    ringData[b * 4 + 1] = toSRGB(table[b * 3 + 1]);
    ringData[b * 4 + 2] = toSRGB(table[b * 3 + 2]);
    ringData[b * 4 + 3] = 255;
  }
  if (ring) ring.needsUpdate = true;
}

/**
 * AND THE WHOLE SKY, SMALL (exteriorHaze.ts): the plate at two and a half
 * degrees a texel, for the air to be read along a line of sight that ends
 * ABOVE the horizon — the top of a far tree stands against sky five degrees
 * up. A copy of its own rather than the plate's mips: three binds the plate
 * for its background with a plain linear sampler, so a lookup down its mip
 * chain reads the full-size image (seen: the horizon as a curtain of
 * hair-fine vertical streaks, one row of a 4,096-pixel photograph stretched
 * up the frame).
 */
const DOME_W = 144;
const DOME_H = 72;
const domeData = new Uint8Array(DOME_W * DOME_H * 4);
let dome: THREE.DataTexture | null = null;
let domeReady = false;

/** The small sky, or null until the plate has been read. Rows run up from the
 *  nadir, as three reads an equirectangular image (v = asin(y) / pi + 0.5). */
export function skyHazeDome(): THREE.DataTexture | null {
  if (!domeReady) return null;
  if (!dome) {
    dome = new THREE.DataTexture(domeData, DOME_W, DOME_H, THREE.RGBAFormat, THREE.UnsignedByteType);
    dome.colorSpace = THREE.SRGBColorSpace;
    dome.wrapS = THREE.RepeatWrapping;
    dome.wrapT = THREE.ClampToEdgeWrapping;
    dome.magFilter = THREE.LinearFilter;
    dome.minFilter = THREE.LinearFilter;
    dome.generateMipmaps = false;
  }
  dome.needsUpdate = true;
  return dome;
}

/** The sky's foot by bearing, u = atan2(z, x) / 2pi + 0.5 as the plate is read. */
export function skyHazeRing(): THREE.DataTexture {
  if (!ring) {
    ring = new THREE.DataTexture(ringData, BINS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    ring.colorSpace = THREE.SRGBColorSpace;
    ring.wrapS = THREE.RepeatWrapping;
    ring.wrapT = THREE.ClampToEdgeWrapping;
    ring.magFilter = THREE.LinearFilter;
    ring.minFilter = THREE.LinearFilter;
    ring.generateMipmaps = false;
    ring.needsUpdate = true;
  }
  return ring;
}

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** The band read, in degrees above the plate's horizon. Since v11 (the hills,
 *  2026-10-27) it straddles the horizon: from half a degree up the plate is the
 *  hills' lower slopes, and the air in front of them is the valley's mist, which
 *  is what the band just under the hills' feet holds. */
export const HAZE_BAND_DEG = [-1.2, 0.8] as const;

/** A plate as the air reads it: its small sky, and its foot by bearing. */
type HourAir = { dome: Uint8Array; table: Float32Array };

/** Read a plate's image into its small sky and its foot's table. */
function readAir(image: CanvasImageSource): HourAir | null {
  if (typeof document === 'undefined') return null;
  const W = 288;
  const H = 144;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  try {
    // (a fourteenth of the plate's size: averaged, not point-sampled)
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const air: HourAir = { dome: new Uint8Array(domeData.length), table: new Float32Array(table.length) };
    // The small sky: each texel the mean of a 2 x 2 block, in linear light;
    // the canvas's rows run down from the zenith, the texture's up.
    for (let y = 0; y < DOME_H; y += 1) {
      for (let x = 0; x < DOME_W; x += 1) {
        let r = 0;
        let gr = 0;
        let bl = 0;
        for (let dy = 0; dy < 2; dy += 1) {
          for (let dx = 0; dx < 2; dx += 1) {
            const i = ((y * 2 + dy) * W + x * 2 + dx) * 4;
            r += toLinear(px[i]);
            gr += toLinear(px[i + 1]);
            bl += toLinear(px[i + 2]);
          }
        }
        const o = ((DOME_H - 1 - y) * DOME_W + x) * 4;
        air.dome[o] = toSRGB(r / 4);
        air.dome[o + 1] = toSRGB(gr / 4);
        air.dome[o + 2] = toSRGB(bl / 4);
        air.dome[o + 3] = 255;
      }
    }
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
      air.table[b * 3] = r / n;
      air.table[b * 3 + 1] = gr / n;
      air.table[b * 3 + 2] = bl / n;
    }
    return air;
  } catch {
    return null;
  }
}

/**
 * THE AIR GOES WITH THE SKY (filmHours.ts). Each plate is read once as it
 * arrives, and the air the estate is hazed with is the three mixed, each time
 * the hour moves: the far land keeps going into the sky behind it, whichever
 * sky that is, at every point of the way from one to the next.
 */
const hourAir: { day: HourAir | null; twilight: HourAir | null; night: HourAir | null; noon: HourAir | null } = {
  day: null,
  twilight: null,
  night: null,
  noon: null,
};
let airAt = { e: 0, n: 0, noon: 0 };

/**
 * Read the sky's foot from the equirectangular plate (its image, as loaded).
 * Returns false where there is no canvas to read it with; the fog then keeps
 * its authored colours.
 */
export function readSkyHaze(image: CanvasImageSource): boolean {
  const air = readAir(image);
  if (!air) {
    ready = false;
    return false;
  }
  hourAir.day = air;
  domeReady = true;
  ready = true;
  airAt = { e: -1, n: -1, noon: -1 };
  followSkyHour(0, 0);
  return true;
}

/** And the other hours' plates, as they arrive (SkyHours.tsx). */
export function readSkyHour(hour: 'twilight' | 'night' | 'noon', image: CanvasImageSource): boolean {
  const air = readAir(image);
  if (!air) return false;
  hourAir[hour] = air;
  airAt = { e: -1, n: -1, noon: -1 };
  return true;
}

/**
 * The air at this hour: the plates mixed, into the small sky and the foot's
 * table. Only when the hour has moved: forty kilobytes of texture to send.
 */
export function followSkyHour(e: number, n: number, noon = 0): void {
  const { day, twilight, night, noon: high } = hourAir;
  if (!day) return;
  if (Math.abs(e - airAt.e) < 0.002 && Math.abs(n - airAt.n) < 0.002 && Math.abs(noon - airAt.noon) < 0.002) return;
  airAt = { e, n, noon };
  const tw = twilight && night ? e * (1 - n) : 0;
  const ni = twilight && night ? e * n : 0;
  const hi = high ? noon * (1 - e) : 0;
  const d = 1 - tw - ni - hi;
  const dd = day.dome;
  const td = twilight?.dome ?? dd;
  const nd = night?.dome ?? dd;
  const hd = high?.dome ?? dd;
  for (let i = 0; i < domeData.length; i += 1) domeData[i] = d * dd[i] + tw * td[i] + ni * nd[i] + hi * hd[i] + 0.5;
  const dt = day.table;
  const tt = twilight?.table ?? dt;
  const nt = night?.table ?? dt;
  const ht = high?.table ?? dt;
  for (let i = 0; i < table.length; i += 1) table[i] = d * dt[i] + tw * tt[i] + ni * nt[i] + hi * ht[i];
  writeRing();
  if (dome) dome.needsUpdate = true;
}

/** For tests: set the table directly (linear RGB per bin). */
export function setSkyHaze(colours: ArrayLike<number> | null): void {
  if (!colours) {
    ready = false;
    return;
  }
  for (let i = 0; i < BINS * 3; i += 1) table[i] = colours[i % colours.length];
  writeRing();
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
