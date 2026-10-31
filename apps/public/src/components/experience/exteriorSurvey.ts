// apps/public/src/components/experience/exteriorSurvey.ts
//
// THE COVER'S SURVEY (the concept the user asked to be built 1:1, 2026-10-27:
// "contour lines on the ground", "survey labels").
//
// The concept draws a surveyor's sheet over the land on its first frame: fine
// ivory contours running across the lawns, the estate's bounds and a ring
// round the fountain ruled on the ground, and three small labels pinned to it
// ("BOUND // 18.11° N"). It is the cover's argument made visible - "every
// sanctioned plan published in full" - and it belongs to the cover: it goes
// as the camera leaves it.
//
//   THE CONTOURS are of the ground's own lie, invented for the drawing (the
//   lawn is level; a sheet's contours are what make it a sheet): a gentle
//   field of rises (surveyHeight), ruled every SURVEY.interval metres, every
//   fifth line heavier, each a pixel wide wherever it is and gone before the
//   lines crowd into one another at a grazing angle.
//   THE BOUNDS are four lines set in from the walls and two across the
//   forecourt; THE RING stands round the fountain.
//   THE PINS are text (site-home's cover), stood each frame over their place
//   on the ground (SurveyPins, below).
//
// One quad over the compound, drawn after the ground and before anything
// that stands on it, with the depth test on: the house, its podium, the
// terraces and the trees hide what is under them, as they would hide ink on
// the ground. It writes no depth and keeps the frame's depth in its alpha
// (LensFocus.keepDepthAlpha).

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { journeyState } from './journey';
import { keepDepthAlpha } from './LensFocus';

export const SURVEY = {
  /** The sheet's extent: x from, x to, z from, z to (metres, three's axes). */
  area: [-90, 90, -100, 104] as const,
  /** How far over the lawn it is laid. */
  y: 0.07,
  /** Metres of rise between contours, and every how many an index line. */
  interval: 0.28,
  index: 5,
  /** How much of a line is drawn, minor and index. */
  ink: [0.24, 0.46] as const,
  /** The contours are drawn on the east lawn, the cover's right (the concept's
   *  place for them): from this x, whole by the next. */
  east: [16, 30] as const,
  /** Gone over this much of the exterior leg. */
  gone: [0.015, 0.12] as const,
  /** And with distance from the eye, metres. */
  far: [130, 240] as const,
  /** The bounds: set in from the walls by this much. */
  inset: 12,
  /** The ring round the fountain. */
  ring: { x: 0, z: 30, r: 9.5 },
} as const;

/** The ground's lie as the sheet draws it, metres. Pure, for the test. */
export function surveyHeight(x: number, z: number): number {
  return (
    3.2 * Math.sin(x * 0.045 + 1.3 * Math.sin(z * 0.031)) +
    2.6 * Math.sin(z * 0.052 + 0.9) +
    1.8 * Math.sin((x + z) * 0.07 + 2.1) +
    0.04 * (x * 0.6 - z * 0.3)
  );
}

/** The pins, by their place on the ground: what each says, and its weight. */
export const SURVEY_PINS: readonly { at: readonly [number, number, number]; major?: boolean }[] = [
  { at: [7, 0, -104] },
  { at: [-11, 0, -70] },
  { at: [-1, 0, 14], major: true },
];

export const surveyUniforms = {
  uSurvey: { value: 0 },
};

const SURVEY_GLSL = /* glsl */ `
float surveyHeight(vec2 p) {
  return 3.2 * sin(p.x * 0.045 + 1.3 * sin(p.y * 0.031))
       + 2.6 * sin(p.y * 0.052 + 0.9)
       + 1.8 * sin((p.x + p.y) * 0.07 + 2.1)
       + 0.04 * (p.x * 0.6 - p.y * 0.3);
}
// a line a pixel wide at distance d (in the field's units, w a pixel's reach)
float surveyLine(float d, float w, float px) {
  return 1.0 - smoothstep(0.35 * px * w, 1.1 * px * w, d);
}
`;

export function surveySheet(): THREE.Mesh {
  const [x0, x1, z0, z1] = SURVEY.area;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, SURVEY.y, (z0 + z1) / 2);
  const material = new THREE.ShaderMaterial({
    name: 'MAT_Survey_Sheet',
    uniforms: surveyUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uSurvey;
      varying vec3 vWorld;
      ${SURVEY_GLSL}
      void main() {
        if (uSurvey <= 0.0) discard;
        vec2 p = vWorld.xz;
        // the contours
        float f = surveyHeight(p) / ${SURVEY.interval.toFixed(3)};
        float w = fwidth(f);
        float minor = surveyLine(abs(fract(f + 0.5) - 0.5), w, 1.0);
        float fi = f / ${SURVEY.index.toFixed(1)};
        float major = surveyLine(abs(fract(fi + 0.5) - 0.5), fwidth(fi), 1.6);
        // gone before they crowd into one another, and only on the east lawn
        float crowd = 1.0 - smoothstep(0.18, 0.4, w);
        float east = smoothstep(${SURVEY.east[0].toFixed(1)}, ${SURVEY.east[1].toFixed(1)}, p.x);
        float ink = max(minor * ${SURVEY.ink[0].toFixed(2)}, major * ${SURVEY.ink[1].toFixed(2)}) * crowd * east;
        // the bounds, set in from the walls (east and north), and two lines
        // across the forecourt
        float bx = abs(p.x - ${(72 - SURVEY.inset).toFixed(1)});
        float bz = abs(p.y - ${(-84 + SURVEY.inset).toFixed(1)}) + step(p.x, 0.0) * 1.0e4;
        vec2 pw = fwidth(p);
        float bound = max(surveyLine(bx, pw.x + pw.y, 1.0), surveyLine(bz, pw.x + pw.y, 1.0));
        float d1 = abs(dot(p - vec2(-30.0, 18.0), normalize(vec2(-42.0, 70.0))));
        float d2 = abs(dot(p - vec2(30.0, 18.0), normalize(vec2(42.0, 70.0))));
        float cross = max(surveyLine(d1, pw.x + pw.y, 1.0), surveyLine(d2, pw.x + pw.y, 1.0))
                    * step(${(18).toFixed(1)}, p.y) * step(p.y, 70.0);
        float ring = surveyLine(abs(length(p - vec2(${SURVEY.ring.x.toFixed(1)}, ${SURVEY.ring.z.toFixed(1)})) - ${SURVEY.ring.r.toFixed(1)}), pw.x + pw.y, 1.2);
        ink = max(ink, max(bound * 0.75, max(cross * 0.55, ring * 0.7)));
        // with distance from the eye, and with the cover
        float dist = distance(cameraPosition, vWorld);
        ink *= (1.0 - smoothstep(${SURVEY.far[0].toFixed(1)}, ${SURVEY.far[1].toFixed(1)}, dist)) * uSurvey;
        if (ink < 0.003) discard;
        // ivory as the film's small type prints it, under the bloom's threshold
        gl_FragColor = vec4(0.56, 0.53, 0.46, ink);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    fog: false,
    toneMapped: false,
  });
  keepDepthAlpha(material);
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'survey_sheet';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // after the ground and the lawn's own (opaque) passes, with the other
  // transparent things
  mesh.renderOrder = 2;
  return mesh;
}

/** How much of the survey is on at this point of the exterior leg, 0..1. */
export function surveyOn(leg: 'exterior' | 'interior', legProgress: number, film = true): number {
  if (leg !== 'exterior' || !film) return 0;
  const [a, b] = SURVEY.gone;
  const k = Math.min(1, Math.max(0, (legProgress - a) / (b - a)));
  return 1 - k * k * (3 - 2 * k);
}

const TMP = new THREE.Vector3();

/**
 * The sheet's fade, and its pins stood over their places: each frame, every
 * element `[data-survey-pin="i"]` (site-home's cover) is moved to where
 * SURVEY_PINS[i] stands in the frame, and faded with the sheet. Renders
 * nothing in the canvas.
 */
export function SurveyPins() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const pins = useRef<HTMLElement[]>([]);
  const next = useRef(0);
  useEffect(
    () => () => {
      for (const el of pins.current) el.style.opacity = '0';
    },
    [],
  );
  useFrame(() => {
    // (a wide frame's: a phone's cover has no ground to spare, and its pins are
    // not drawn either: globals.css)
    const on = size.width > size.height ? surveyOn(journeyState.leg, journeyState.legProgress, !!journeyState.film) : 0;
    surveyUniforms.uSurvey.value = on;
    const now = performance.now();
    if (now > next.current) {
      next.current = now + 1000;
      pins.current = Array.from(document.querySelectorAll<HTMLElement>('[data-survey-pin]'));
    }
    for (const el of pins.current) {
      const pin = SURVEY_PINS[Number(el.dataset.surveyPin)];
      if (!pin) continue;
      TMP.set(pin.at[0], pin.at[1], pin.at[2]).project(camera);
      const seen = TMP.z < 1 && Math.abs(TMP.x) < 1.2 && Math.abs(TMP.y) < 1.2;
      const x = (TMP.x * 0.5 + 0.5) * size.width;
      const y = (-TMP.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = seen ? on.toFixed(3) : '0';
    }
  });
  return null;
}
