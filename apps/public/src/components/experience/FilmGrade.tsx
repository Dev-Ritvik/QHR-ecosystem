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
// tone mapping back into the chain, because the doorway passage drives
// gl.toneMappingExposure for its own effect; waking that knob up would change
// a transition this pass has been asked to leave alone.
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
import { Uniform, Vector3 } from 'three';

/**
 * How far into evening the film is, 0..1, written each frame by
 * ExteriorLighting from the same atmosphereAt() read that dims the key and the
 * sky. The print opens up as the light falls — the way a camera operator rides
 * the iris through a dusk shot — so the last exterior chapter reads as dusk
 * rather than as underexposure. Without it the filmic toe took the evening
 * beats to a frame mean of 30.
 */
export const filmState = { evening: 0 };
/** Exposure multiplier at full evening. */
export const EVENING_LIFT = 0.55;

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

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = filmCurve(max(inputColor.rgb, vec3(0.0)) * whiteBalance);
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
  exposure: 1.95,
  whiteBalance: [0.87, 1.0, 1.1],
  greenSat: 1,
  greenHue: 0,
  greenValue: 1,
  shadowTint: [0.0, -0.002, -0.004],
  highlightTint: [0.004, 0.002, -0.004],
  contrast: 0.2,
  saturation: 1.04,
};

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
    useFrame(() => {
      // Every uniform, every frame — eight writes — so a look-dev session
      // (?debug=1 publishes the grades on window.__estateGrades) can move any
      // of them live, and the exposure can ride the evening.
      effect.settings = settings;
      const lift = settings.ridesEvening ? 1 + EVENING_LIFT * filmState.evening : 1;
      effect.uniforms.get('exposure')!.value = settings.exposure * lift;
    });
    // No dispose={null} on the primitive: r3f applies that as a PROPERTY and
    // nulls the method, which then threw here the first time the composer
    // remounted. r3f never disposes a primitive itself; the composer disposes
    // its effects on unmount, and this is the belt to that brace.
    useEffect(() => () => effect.dispose?.(), [effect]);
    return <primitive ref={ref} object={effect} />;
  },
);
