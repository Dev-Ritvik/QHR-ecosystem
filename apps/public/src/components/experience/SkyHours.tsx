'use client';

// apps/public/src/components/experience/SkyHours.tsx
//
// THE SKY GOES FROM ONE HOUR TO THE NEXT, ON THE FILM (filmHours.ts).
//
// The golden hour's sky is scene.background, as it has always been: a page, the
// cover and the revolution draw it and nothing else, and this costs them
// nothing. As the twilight comes on, a dome over it dissolves to the twilight's
// plate and from there to the midnight's. All three are the same render of the
// same hills (tools/gltf/grade_sky_hours_v12.py), so the ridges stand still and
// only the light goes: the difference between a sky darkening and a slide
// changing.
//
// A DRAW OF ITS OWN, AND THE LAST OF THE OPAQUE PICTURE. The dome stands on the
// far plane and is blended over the plate behind it, after everything opaque
// and before anything transparent, so a pixel with a tree on it never runs its
// shader. Its blend leaves the frame's alpha alone: that is the scene's depth
// for the lens (LensFocus.tsx, keepDepthAlpha).
//
// THE STARS ARE DRAWN HERE, not on a plate, which is magnified six times on the
// door's lens and would make each a soft blot: a star is a pixel or two at any
// lens. Each is hidden by the hills by the plate's own skyline (the ridge's
// table), and thinned toward them by the air.
//
// The plates are decoded off the main thread and uploaded as they arrive, while
// the visitor is at the cover at the latest. Uploaded on first use, a 4K plate
// was a long frame at the very moment the light begins to turn. No mips: both
// are magnified at every lens the film has.

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { filmState } from './FilmGrade';
import { hourChoice, onHourChoice } from './filmHours';
import { keepDepthAlpha } from './LensFocus';
import { ld } from './lookdev';
import { followSkyHour, readSkyHour } from './skyHaze';

export const SKY_TWILIGHT_URL = '/textures/sky_estate_v12_twilight_4k.jpg';
export const SKY_NIGHT_URL = '/textures/sky_estate_v12_night_4k.jpg';
export const SKY_RIDGE_URL = '/textures/sky_estate_v12_ridge.png';
/** The visitor's Day (HourChoice.tsx): asked for only when it is pressed. */
export const SKY_NOON_URL = '/textures/sky_estate_v13_day_4k.jpg';

/**
 * A small screen or a small machine takes the plates at half the size: 8 MB of
 * video memory each against 33, on a frame whose lens is wide enough not to want
 * them. Read once, as the plates are asked for.
 */
export function skyPlateUrl(url: string, width: number, memoryGb?: number): string {
  return width < 1024 || (memoryGb !== undefined && memoryGb <= 4) ? url.replace('_4k.', '_2k.') : url;
}

/** The ridge table's range (grade_sky_hours_v12.py): degrees, over 0..1. */
export const RIDGE_DEGREES = 64;

/** Which plates have arrived, for what falls back on the day's sky without them. */
export const skyHours = { twilight: false, night: false };

export const skyUniforms = {
  uSkyTwilight: { value: null as THREE.Texture | null },
  uSkyNight: { value: null as THREE.Texture | null },
  uSkyNoon: { value: null as THREE.Texture | null },
  /** How much of the day's plate is the visitor's noon. */
  uSkyNoonOn: { value: 0 },
  uSkyRidge: { value: null as THREE.Texture | null },
  /** How much of the day's plate is covered, 0..1 (the twilight). */
  uSkyDusk: { value: 0 },
  /** How much of the twilight's plate has gone to the midnight's. */
  uSkyMidnight: { value: 0 },
  /** The plate's turn (scene.backgroundRotation, as three's background reads it). */
  uSkyTurn: { value: new THREE.Matrix3() },
  /** How much of the stars is up. */
  uSkyStars: { value: 0 },
};

/** The stars' strength at midnight, scene-linear, over the print's lift. */
export const STARS = { strength: 1.5, from: 0.25, whole: 0.8 } as const;

const SKY_VERTEX = /* glsl */ `
varying vec3 vSkyDir;
void main() {
  vSkyDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

export const SKY_FRAGMENT = /* glsl */ `
uniform sampler2D uSkyTwilight;
uniform sampler2D uSkyNight;
uniform sampler2D uSkyNoon;
uniform float uSkyNoonOn;
uniform sampler2D uSkyRidge;
uniform float uSkyDusk;
uniform float uSkyMidnight;
uniform mat3 uSkyTurn;
uniform float uSkyStars;
varying vec3 vSkyDir;

float skyHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// One layer of stars: a sparse star in some cells of a grid round the sphere, at
// a place of its own in its cell, as bright as its hash and never under a pixel
// across (fwidth): a star narrower than a pixel is a dot that blinks as the
// camera moves.
vec3 skyStars(vec3 d, float scale, float keep) {
  vec3 p = d * scale;
  vec3 c = floor(p);
  float h = skyHash(c);
  if (h < keep) return vec3(0.0);
  vec3 o = (vec3(skyHash(c + 7.1), skyHash(c + 13.7), skyHash(c + 23.3)) - 0.5) * 0.62;
  float r = length(p - c - 0.5 - o);
  float px = length(fwidth(p));
  float k = (h - keep) / (1.0 - keep);
  float size = max(0.045 + 0.09 * k, px * 0.75);
  float dot_ = 1.0 - smoothstep(size * 0.25, size, r);
  // A smaller star is fainter, however large it had to be drawn.
  vec3 tint = mix(vec3(1.0, 0.86, 0.72), vec3(0.74, 0.84, 1.0), skyHash(c + 3.3));
  return tint * dot_ * dot_ * (0.25 + 1.75 * k * k);
}

void main() {
  vec3 d = uSkyTurn * normalize(vSkyDir);
  float az = atan(d.z, d.x);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float u = az * 0.15915494 + 0.5;
  vec2 uv = vec2(u, el * 0.31830989 + 0.5);
  vec3 c = mix(texture2D(uSkyTwilight, uv).rgb, texture2D(uSkyNight, uv).rgb, uSkyMidnight);
  if (uSkyStars > 0.0 && d.y > 0.0) {
    float deg = el * 57.29578;
    float ridge = texture2D(uSkyRidge, vec2(u, 0.5)).r * ${RIDGE_DEGREES.toFixed(1)};
    // Over the skyline, and thinned by the air for a few degrees above it.
    float clear = smoothstep(ridge + 0.3, ridge + 2.5, deg);
    if (clear > 0.0) c += (skyStars(d, 120.0, 0.962) + skyStars(d, 230.0, 0.982)) * uSkyStars * clear;
  }
  // Over the golden plate behind it: the dusk's, and the visitor's noon under that.
  float over = 1.0 - (1.0 - uSkyDusk) * (1.0 - uSkyNoonOn);
  if (uSkyNoonOn > 0.0) c = mix(texture2D(uSkyNoon, uv).rgb, c, uSkyDusk / max(over, 1.0e-3));
  gl_FragColor = vec4(c, over);
}`;

function loadPlate(url: string, gl: THREE.WebGLRenderer, done: (t: THREE.Texture) => void): () => void {
  let dead = false;
  new THREE.TextureLoader().load(
    url,
    (tex) => {
      if (dead) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      const image = tex.image as HTMLImageElement;
      const upload = () => {
        if (dead) {
          tex.dispose();
          return;
        }
        gl.initTexture(tex);
        done(tex);
      };
      // Decoded off the main thread where the browser can.
      if (typeof image.decode === 'function') image.decode().then(upload, upload);
      else upload();
    },
    undefined,
    // Without a plate the film keeps the day's sky, dimmed (WorldCanvas): the
    // picture is complete without it.
    () => {},
  );
  return () => {
    dead = true;
  };
}

const turn = new THREE.Euler();
const turnM = new THREE.Matrix4();

export function SkyHours({ film }: { film: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  const mesh = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      name: 'MAT_Sky_Hours',
      uniforms: skyUniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    keepDepthAlpha(material);
    // (material.visible, not the mesh's: the warm-up builds its program either
    // way, and nothing is compiled when the light begins to turn.)
    material.visible = false;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
    m.name = 'estate_sky_hours';
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    // Before the horizon's skirt (exteriorHaze.ts) and every other transparent.
    m.renderOrder = -11;
    return m;
  }, []);

  useEffect(() => {
    if (!film) return undefined;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const plate = (url: string) => skyPlateUrl(url, window.innerWidth, memory);
    const stops = [
      loadPlate(plate(SKY_TWILIGHT_URL), gl, (t) => {
        skyUniforms.uSkyTwilight.value = t;
        readSkyHour('twilight', t.image as CanvasImageSource);
        skyHours.twilight = true;
      }),
      loadPlate(plate(SKY_NIGHT_URL), gl, (t) => {
        skyUniforms.uSkyNight.value = t;
        readSkyHour('night', t.image as CanvasImageSource);
        skyHours.night = true;
      }),
      loadPlate(SKY_RIDGE_URL, gl, (t) => {
        t.colorSpace = THREE.NoColorSpace;
        t.needsUpdate = true;
        skyUniforms.uSkyRidge.value = t;
      }),
    ];
    // The visitor's noon: its plate on the first press, and never otherwise.
    let noonStop: (() => void) | null = null;
    const askNoon = () => {
      if (hourChoice.want !== 'day' || noonStop) return;
      noonStop = loadPlate(plate(SKY_NOON_URL), gl, (t) => {
        skyUniforms.uSkyNoon.value = t;
        readSkyHour('noon', t.image as CanvasImageSource);
        hourChoice.noonReady = true;
      });
    };
    askNoon();
    const unhear = onHourChoice(askNoon);
    return () => {
      unhear();
      noonStop?.();
      hourChoice.noonReady = false;
      if (skyUniforms.uSkyNoon.value) {
        skyUniforms.uSkyNoon.value.dispose();
        skyUniforms.uSkyNoon.value = null;
      }
      for (const stop of stops) stop();
      skyHours.twilight = false;
      skyHours.night = false;
      // (a page after the film stands in the golden hour's air)
      followSkyHour(0, 0);
      for (const u of [skyUniforms.uSkyTwilight, skyUniforms.uSkyNight, skyUniforms.uSkyRidge]) {
        u.value?.dispose();
        u.value = null;
      }
    };
  }, [film, gl]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  useFrame(() => {
    const on = skyHours.twilight && skyHours.night && skyUniforms.uSkyRidge.value !== null;
    const e = on ? filmState.evening : 0;
    const n = on ? filmState.night : 0;
    const noon = skyUniforms.uSkyNoon.value ? filmState.noon : 0;
    followSkyHour(e, n, noon);
    skyUniforms.uSkyNoonOn.value = noon;
    skyUniforms.uSkyDusk.value = e;
    skyUniforms.uSkyMidnight.value = n;
    // (three's own: a panorama's rotation is read the other way round)
    turn.set(-scene.backgroundRotation.x, -scene.backgroundRotation.y, -scene.backgroundRotation.z);
    skyUniforms.uSkyTurn.value.setFromMatrix4(turnM.makeRotationFromEuler(turn));
    const t = Math.min(1, Math.max(0, (n - STARS.from) / (STARS.whole - STARS.from)));
    skyUniforms.uSkyStars.value = ld('stars', STARS.strength) * t * t * (3 - 2 * t);
    (mesh.material as THREE.Material).visible = e > 0.001 || noon > 0.001;
  });

  return <primitive object={mesh} />;
}

/** Whether the plates are in: the day's sky is dimmed for the hour if they are not. */
export function skyHoursReady(): boolean {
  return skyHours.twilight && skyHours.night;
}
