'use client';

// apps/public/src/components/experience/FilmGrade.tsx
//
// The print: a filmic tone curve and the grade that sits on it, as one
// screen-space effect in the composer — the exterior's (FILM_GRADE) and, since
// the old-money pass, the hall's (HALL_GRADE).
//
// WHY THERE IS A TONE CURVE HERE AT ALL. Since three r153 a material only
// tone-maps when it renders to the SCREEN (WebGLRenderer.setProgram checks
// `_currentRenderTarget === null`). The composer renders the scene into its own
// buffer, and postprocessing's EffectMaterial is `toneMapped: false`, so with a
// composer mounted the ACES curve and exposure ColorPipeline sets are never
// applied: the frame went to the display as clamped scene-linear. That is what
// a hard-clipped, "digital" highlight is — the lit limestone and the sky by the
// sun ran into 1.0 and stopped, where film rolls off into a shoulder — and the
// shadows had no toe to fall into. The art-direction review's "cinematic
// contrast: deep shadows, bright highlights" is, in large part, a tone curve.
//
// It is done HERE, with its own exposure, rather than by letting three's
// tone mapping back into the chain. That exposure is also the door passage's
// iris (passageLight, doorway.ts): the hall comes up from five stops under as
// the eye adjusts, and because it is an exposure BEFORE the curve, the lamps
// and the windows reach the shoulder first and the walls last — which is how
// a room looks when an eye adjusts to it, and not how a fade looks.
//
// THE GRADE, in display space after the curve:
//
//   greens    The review: "reduce the saturation of the green grass and trees;
//             use moody, rich, deep greens rather than bright, neon greens."
//             Hues from yellow-green to blue-green (60-175 deg), weighted by
//             their own saturation so a grey stone never picks up the band,
//             lose a quarter of their chroma, turn a few degrees away from
//             yellow, and drop a little in value. Limestone sits at 35-45 deg
//             and the sky at 210: neither is in the band.
//   split     shadows a breath toward teal, highlights toward the sun's amber —
//             the separation a graded plate has between the planes the sky
//             lights and the planes the sun does.
//   contrast  a gentle S about the middle, on top of the curve's own.
//
// One uniform block, one pass: postprocessing merges it into the EffectPass it
// shares with the rest of the chain, so its cost is a few ALU ops a pixel.

import { forwardRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect } from 'postprocessing';
import { Uniform, Vector2, Vector3, Vector4 } from 'three';
import { passageLight } from './passageLight';
import { HEADER_BAND, lensFilter } from './lensFilter';
import { READING_CEILING, READING_STOPS, readingLight } from './readingLight';
import { ld } from './lookdev';

/**
 * How far into evening the film is, 0..1, written each frame by
 * ExteriorLighting from the same atmosphereAt() read that dims the key and the
 * sky. The print opens up as the light falls — the way a camera operator rides
 * the iris through a dusk shot — so the last exterior chapter reads as dusk
 * rather than as underexposure. Without it the filmic toe took the evening
 * beats to a frame mean of 30.
 */
export const filmState = { evening: 0, night: 0 };
/** Exposure multiplier at full evening. */
export const EVENING_LIFT = 0.2;
/** And what the night does to that exposure, once the sun has gone (a
 *  multiplier on the evening's: 1 holds it). */
export const NIGHT_LIFT = 1.35;
/**
 * The print's shadows at full evening. By day they lean a breath toward teal
 * (FILM_GRADE.shadowTint): the planes the sky lights, against the planes the
 * sun does. At dusk there is no blue sky to lean toward — the client,
 * 2026-10-01: "the blue shadows of this look cheap" — so the lean comes off
 * with the evening and the shadows print warm, the colour of the air they are
 * in (WorldCanvas, HAZE_NIGHT).
 *
 * AND THEY ARE LIFTED OFF BLACK, the way a dusk exposure holds its shadows: of
 * the forecourt at dusk the client wrote "this looks darker make it less
 * dark", and the darkest of that frame — the shaded lawn, the hedges, the car
 * — printed at a luma of 9, which no fill light brings out of the curve's
 * toe. A print lifts them: this much at black, nothing by the middle grey.
 */
export const EVENING_SHADOW_TINT: [number, number, number] = [0.03, 0.03, 0.03];
/**
 * The greens after sundown. By day the print already takes a quarter of their
 * chroma (FILM_GRADE.greenSat); at dusk the eye, and a long exposure, see a
 * lawn as a dark olive-grey, and under the dusk's even sky (WorldCanvas,
 * FILL_NIGHT) the turf otherwise printed as the most saturated thing in the
 * frame at the door.
 */
export const NIGHT_GREENS = { sat: 0.5, value: 0.78 } as const;

const FRAGMENT = /* glsl */ `
uniform float exposure;
uniform vec3 whiteBalance;
uniform float greenSat;
uniform float greenHue;
uniform float greenValue;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float contrast;
uniform float saturation;
uniform float amount;
uniform vec4 ndShape;
uniform float ndStops;
uniform float ndInner;
uniform vec4 ndShape2;
uniform float ndStops2;
uniform float ndInner2;
uniform vec4 ndTop;
uniform float ndAll;
uniform vec2 readCap;

// three's ACESFilmicToneMapping (Stephen Hill's fit), with the exposure taken
// from this effect's own uniform instead of the renderer's.
vec3 filmCurve(vec3 color) {
  const mat3 inputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 outputMat = mat3(
    vec3( 1.60475, -0.10208, -0.00327),
    vec3(-0.53108,  1.10813, -0.07276),
    vec3(-0.07367, -0.00605,  1.07602)
  );
  color *= exposure / 0.6;
  color = inputMat * color;
  vec3 a = color * (color + 0.0245786) - 0.000090537;
  vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
  color = outputMat * (a / b);
  return clamp(color, 0.0, 1.0);
}

vec3 toHsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1.0e-10)), d / (q.x + 1.0e-10), q.x);
}

vec3 toRgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// THE GRADUATED ND (lensFilter). A soft ellipse of neutral density, in
// stops, in scene-linear light BEFORE the curve — a filter in front of the
// lens, taking light away from a bright sky the way a photographer's grad
// does: highlights come down into the shoulder, nothing is laid over them.
//
// AND THE TOP BAND (ndTop: stops, full to, gone by — as fractions of the
// frame's height from its top edge): the grad a photographer sets on a bright
// sky, for the header that stands on it. The denser of the two holds at each
// point; they never add.
//
// AND THE WHOLE FRAME (ndAll: stops): the lens closed down, for the colophon
// that comes up over the film's last light (lensFilter.codaFilter). The same
// rule: the densest of the three holds.
float ndFilter(vec2 uv) {
  float d = ndAll;
  if (ndStops > 0.0) {
    vec2 q = (uv - ndShape.xy) / ndShape.zw;
    d = max(d, ndStops * (1.0 - smoothstep(ndInner, 1.0, length(q))));
  }
  // A second ellipse (lensFilter.second): the cover wears a grad on its sky
  // AND a half stop under its small copy, on the land, at once.
  if (ndStops2 > 0.0) {
    vec2 q2 = (uv - ndShape2.xy) / ndShape2.zw;
    d = max(d, ndStops2 * (1.0 - smoothstep(ndInner2, 1.0, length(q2))));
  }
  if (ndTop.x > 0.0) d = max(d, ndTop.x * (1.0 - smoothstep(ndTop.y, ndTop.z, 1.0 - uv.y)));
  return exp2(-d);
}

// THE BAND'S HIGHLIGHTS, burnt in (lensFilter.ts, HEADER_BAND.ceiling): in the
// print's gamma, a luma above the shoulder is rolled off under the ceiling —
// a window behind the header prints as a pale pane, not a white one. Below
// the shoulder nothing moves, and outside the band nothing at all.
//
// IT COMES IN WITHOUT AN EDGE. 'on' is how far the ceiling has come down, 0..1:
// the ceiling goes from none to its own level with it, AND the knee comes
// down off the ceiling over the first third of that — at nothing the knee is
// the ceiling and the ceiling is white, so nothing moves. With the knee fixed
// at seven-tenths of the ceiling from the start, the first sliver of the band
// already rolled off everything above a luma of 178 by up to a ninth, and the
// band's lower edge was a line across any white wall or window that crossed
// it (measured in the hall: a step of 6 to 7 between two rows, at 23.9% of
// the frame's height).
vec3 shoulder(vec3 g, float ceiling, float on) {
  float cap = mix(1.0, ceiling, on);
  float knee = cap * mix(1.0, 0.7, smoothstep(0.0, 0.35, on));
  float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  if (l <= knee) return g;
  float over = (l - knee) / max(1.0e-4, cap - knee);
  return g * ((knee + (cap - knee) * (1.0 - exp(-over))) / l);
}

vec3 burnTop(vec3 g, vec2 uv) {
  if (ndTop.x <= 0.0) return g;
  float k = (1.0 - smoothstep(ndTop.y, ndTop.z, 1.0 - uv.y)) * min(1.0, ndTop.x);
  if (k <= 0.0) return g;
  return shoulder(g, ndTop.w, k);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = filmCurve(max(inputColor.rgb, vec3(0.0)) * whiteBalance * ndFilter(uv));
  vec3 g = pow(c, vec3(1.0 / 2.2));

  vec3 hsv = toHsv(g);
  float band = smoothstep(0.155, 0.195, hsv.x) * (1.0 - smoothstep(0.43, 0.49, hsv.x))
             * smoothstep(0.06, 0.2, hsv.y);
  hsv.x = fract(hsv.x + greenHue * band);
  hsv.y *= mix(1.0, greenSat, band);
  hsv.z *= mix(1.0, greenValue, band);
  g = toRgb(hsv);

  float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  g += shadowTint * (1.0 - smoothstep(0.0, 0.5, l)) + highlightTint * smoothstep(0.45, 1.0, l);
  g = clamp(g, 0.0, 1.0);
  g = mix(g, g * g * (3.0 - 2.0 * g), contrast);
  l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  g = mix(vec3(l), g, saturation);
  g = burnTop(g, uv);
  // A reading page's highlights, held over the whole frame (readingLight.ts,
  // READING_CEILING): the same shoulder, coming down as the page's light does.
  // (ceiling, how far down): 0 down is none.
  if (readCap.y > 0.0) g = shoulder(g, readCap.x, readCap.y);

  // amount 0 is an exact passthrough (mix(x, y, 0) == x): the dusk rollback
  // runs through this pass untouched, and switching between the exterior's
  // print and the hall's is a uniform write rather than a rebuilt chain.
  outputColor = vec4(mix(inputColor.rgb, pow(max(g, vec3(0.0)), vec3(2.2)), amount), inputColor.a);
}
`;

export interface FilmGradeSettings {
  exposure: number;
  greenSat: number;
  greenHue: number;
  greenValue: number;
  shadowTint: [number, number, number];
  highlightTint: [number, number, number];
  contrast: number;
  saturation: number;
  /** Per-channel gain in scene-linear light, before the curve: a camera's
   *  white balance. [1, 1, 1] is none. */
  whiteBalance?: [number, number, number];
  /** Open the iris with the exterior's evening (filmState). Only a print for
   *  a set that HAS an evening should: the hall is lit the same at every hour,
   *  and a stale evening left over from the last exterior frame must not lift
   *  it. */
  ridesEvening?: boolean;
}

/**
 * The shipped exterior print. Every number was set against the settled hero
 * and the four facade beats of the film on the production build; see FIXLOG.
 */
export const FILM_GRADE: FilmGradeSettings = {
  exposure: 1.0,
  greenSat: 0.72,
  greenHue: 0.012,
  greenValue: 0.9,
  shadowTint: [-0.012, 0.002, 0.016],
  highlightTint: [0.016, 0.006, -0.014],
  // Half of the first setting: with the sun's shadows working the curve alone
  // takes the hero to p95/p05 = 15, and the extra S was pushing p05 into black.
  contrast: 0.06,
  saturation: 1.02,
  ridesEvening: true,
};

/**
 * THE HALL'S PRINT.
 *
 * The hall used to leave the renderer as clamped scene-linear light with no
 * curve at all (see PostFX's header): no toe, so its shadows were lifted grey;
 * no shoulder, so the ivory walls, the bloom and the chandelier all piled up at
 * the same flat white. That is most of what "milky" was describing. The same
 * filmic curve as outside, graded for a lamplit room of ivory, walnut and gilt:
 * no green band (there is nothing green in it), highlights leaning warm the way
 * ivory under tungsten does, and shadows held neutral so the walnut stays brown
 * rather than going to mud.
 */
export const HALL_GRADE: FilmGradeSettings = {
  // MEASURED, not dialled. The approved Cycles renders put the lit walls at
  // (204, 193, 181), luma 194; the first print of this pass put the same wall
  // at (154, 132, 108), luma 135 — a stop down and orange (red/blue 1.43
  // against 1.13), because the bake's lamps are warm (1.0, 0.68, 0.38) and the
  // plaster is ivory. Solving the wall's scene-linear colour back through this
  // curve and fitting to a warm ivory (200, 190, 175) gives exposure 2.3 with a
  // white balance of 0.87 red, 1.10 blue: what a photographer does to a
  // tungsten-lit room — expose for the walls and balance the lamps toward
  // white, keeping them warm rather than neutral. The Cycles renders were made
  // through a view transform and exposure of their own; this is the same move.
  // DOWN A THIRD OF A STOP, AND HARDER (the second client review: "heavily
  // washed out and shadowless ... a hollow, synthetic box"; the reference it
  // came with is a dark, lamp-lit room). The fit above put the lit walls at
  // the approved renders' luma; this lets them fall below it so the room's
  // own lights — chandelier, sconces, the plans on the tables — carry the
  // frame, and the corners and the stair's underside go properly dark.
  // AND DOWN AGAIN FOR THE IMPERIAL HALL (the art-direction audit: "the
  // interior is moody, dramatically lit by light spilling through the
  // windows"): a quarter-stop under, with more contrast, so the window light
  // (WindowLight.tsx) and the lamps carry the room rather than the walls.
  exposure: 1.72,
  whiteBalance: [0.87, 1.0, 1.1],
  greenSat: 1,
  greenHue: 0,
  greenValue: 1,
  shadowTint: [0.0, -0.002, -0.004],
  highlightTint: [0.004, 0.002, -0.004],
  contrast: 0.27,
  saturation: 1.04,
};

const GRADE_TMP = new Vector3();

export class FilmGradeEffect extends Effect {
  constructor(s: FilmGradeSettings = FILM_GRADE) {
    super('FilmGradeEffect', FRAGMENT, {
      uniforms: new Map<string, Uniform>([
        ['exposure', new Uniform(s.exposure)],
        ['whiteBalance', new Uniform(new Vector3(...(s.whiteBalance ?? [1, 1, 1])))],
        ['greenSat', new Uniform(s.greenSat)],
        ['greenHue', new Uniform(s.greenHue)],
        ['greenValue', new Uniform(s.greenValue)],
        ['shadowTint', new Uniform(new Vector3(...s.shadowTint))],
        ['highlightTint', new Uniform(new Vector3(...s.highlightTint))],
        ['contrast', new Uniform(s.contrast)],
        ['saturation', new Uniform(s.saturation)],
        ['amount', new Uniform(1)],
        ['ndShape', new Uniform(new Vector4(0.2, 0.5, 0.3, 0.2))],
        ['ndStops', new Uniform(0)],
        ['ndInner', new Uniform(0.35)],
        ['ndShape2', new Uniform(new Vector4(0.2, 0.3, 0.3, 0.2))],
        ['ndStops2', new Uniform(0)],
        ['ndInner2', new Uniform(0.45)],
        ['ndTop', new Uniform(new Vector4(0, 0.07, 0.24, 0.4))],
        ['ndAll', new Uniform(0)],
        ['readCap', new Uniform(new Vector2(READING_CEILING, 0))],
      ]),
    });
  }

  /** 1 prints the frame, 0 passes it through untouched. */
  get amount(): number {
    return this.uniforms.get('amount')!.value as number;
  }

  set amount(v: number) {
    this.uniforms.get('amount')!.value = v;
  }

  set settings(s: FilmGradeSettings) {
    const u = this.uniforms;
    u.get('exposure')!.value = s.exposure;
    (u.get('whiteBalance')!.value as Vector3).set(...(s.whiteBalance ?? [1, 1, 1]));
    u.get('greenSat')!.value = s.greenSat;
    u.get('greenHue')!.value = s.greenHue;
    u.get('greenValue')!.value = s.greenValue;
    (u.get('shadowTint')!.value as Vector3).set(...s.shadowTint);
    (u.get('highlightTint')!.value as Vector3).set(...s.highlightTint);
    u.get('contrast')!.value = s.contrast;
    u.get('saturation')!.value = s.saturation;
  }
}

/** Declarative wrapper, for use as a child of <EffectComposer>. */
export const FilmGrade = forwardRef<FilmGradeEffect, { settings?: FilmGradeSettings }>(
  function FilmGrade({ settings = FILM_GRADE }, ref) {
    const effect = useMemo(() => new FilmGradeEffect(settings), []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      effect.settings = settings;
    }, [effect, settings]);
    useFrame((_, delta) => {
      // Every uniform, every frame — eight writes — so a look-dev session
      // (?debug=1 publishes the grades on window.__estateGrades) can move any
      // of them live, and the exposure can ride the evening.
      effect.settings = settings;
      const lift = settings.ridesEvening
        ? (1 + ld('evLift', EVENING_LIFT) * filmState.evening) * (1 + (ld('nightLift', NIGHT_LIFT) - 1) * filmState.night)
        : 1;
      // A reading page's light (readingLight.ts), eased so a route change
      // dims rather than cuts.
      readingLight.stops += (readingLight.want - readingLight.stops) * (1 - Math.exp(-Math.max(0, delta) / 0.35));
      const reading = Math.pow(2, -readingLight.stops);
      effect.uniforms.get('exposure')!.value = settings.exposure * lift * passageLight.exposure * reading;
      // The shadows' lean, off the sky's blue as the evening falls
      // (EVENING_SHADOW_TINT).
      if (settings.ridesEvening && filmState.evening > 0) {
        const e = filmState.evening;
        const [r, g, b] = settings.shadowTint;
        (effect.uniforms.get('shadowTint')!.value as Vector3).set(
          r + (ld('shadeR', EVENING_SHADOW_TINT[0]) - r) * e,
          g + (ld('shadeG', EVENING_SHADOW_TINT[1]) - g) * e,
          b + (ld('shadeB', EVENING_SHADOW_TINT[2]) - b) * e,
        );
      }
      if (settings.ridesEvening && filmState.night > 0) {
        const n = filmState.night;
        effect.uniforms.get('greenSat')!.value =
          settings.greenSat + (ld('greenSatNight', NIGHT_GREENS.sat) - settings.greenSat) * n;
        effect.uniforms.get('greenValue')!.value =
          settings.greenValue + (ld('greenValueNight', NIGHT_GREENS.value) - settings.greenValue) * n;
      }
      // THROUGH THE DOOR (passageLight.grade): the exterior's print goes to the
      // hall's as the camera closes on the open doorway, so the sets can change
      // behind it without the picture changing.
      if (settings.ridesEvening && passageLight.grade > 0) {
        const g = passageLight.grade;
        const u = effect.uniforms;
        const to = HALL_GRADE;
        const mix = (name: string, target: number) => {
          const x = u.get(name)!;
          x.value = (x.value as number) + (target - (x.value as number)) * g;
        };
        mix('exposure', to.exposure * passageLight.exposure * reading);
        mix('greenSat', to.greenSat);
        mix('greenHue', to.greenHue);
        mix('greenValue', to.greenValue);
        mix('contrast', to.contrast);
        mix('saturation', to.saturation);
        const wb = to.whiteBalance ?? [1, 1, 1];
        (u.get('whiteBalance')!.value as Vector3).lerp(GRADE_TMP.set(wb[0], wb[1], wb[2]), g);
        (u.get('shadowTint')!.value as Vector3).lerp(GRADE_TMP.set(...to.shadowTint), g);
        (u.get('highlightTint')!.value as Vector3).lerp(GRADE_TMP.set(...to.highlightTint), g);
      }
      // ...and its ceiling, coming down with the same ease.
      const held = Math.min(1, Math.max(0, readingLight.stops / READING_STOPS));
      (effect.uniforms.get('readCap')!.value as Vector2).set(READING_CEILING, held < 0.004 ? 0 : held);
      effect.uniforms.get('ndStops')!.value = lensFilter.stops;
      effect.uniforms.get('ndAll')!.value = lensFilter.all;
      effect.uniforms.get('ndInner')!.value = lensFilter.inner;
      (effect.uniforms.get('ndTop')!.value as Vector4).set(
        lensFilter.top,
        lensFilter.topFull,
        lensFilter.topZero,
        HEADER_BAND.ceiling,
      );
      (effect.uniforms.get('ndShape')!.value as Vector4).copy(lensFilter.shape);
      effect.uniforms.get('ndStops2')!.value = lensFilter.second.stops;
      effect.uniforms.get('ndInner2')!.value = lensFilter.second.inner;
      (effect.uniforms.get('ndShape2')!.value as Vector4).copy(lensFilter.second.shape);
    });
    // No dispose={null} on the primitive: r3f applies that as a PROPERTY and
    // nulls the method, which then threw here the first time the composer
    // remounted. r3f never disposes a primitive itself; the composer disposes
    // its effects on unmount, and this is the belt to that brace.
    useEffect(() => () => effect.dispose?.(), [effect]);
    return <primitive ref={ref} object={effect} />;
  },
);
