'use client';

// apps/public/src/components/experience/PostFX.tsx
//
// The cinematic lens: bloom and vignette.
//
// TONE MAPPING, CORRECTED (the AO / art-direction pass). This header used to
// say the scene arrives here already tone-mapped because three applies ACES in
// each material's fragment shader. On three r173 that is not what happens:
// WebGLRenderer.setProgram only compiles tone mapping into a material when it
// renders to the SCREEN (`_currentRenderTarget === null`), the composer renders
// the scene into its own buffer, and postprocessing's EffectMaterial is
// `toneMapped: false`. So with this composer mounted there was no curve at all:
// the frame went out as clamped scene-linear, and ColorPipeline's exposure was
// inert. Two consequences, both deliberate now rather than accidental:
//
//   * OUTSIDE, in daylight, FilmGrade supplies the curve (ACES, own exposure)
//     after bloom — so bloom still sees scene-linear, as it always did.
//   * INSIDE, since the old-money pass, the hall gets the same curve with its
//     own grade (HALL_GRADE): without one, its shadows had no toe and its ivory
//     no shoulder, and the room read as a milky, low-contrast print.
//   * At dusk the chain is left as it was measured and approved.
//
// Bloom's luminanceThreshold has therefore always been in scene-linear terms,
// and it is set per set (BLOOM / HALL_BLOOM).
//
// Gated by device tier. Low tier keeps vignette only, which costs almost
// nothing and still frames the composition.
//
// ─────────────────────────────────────────────────────────────────────────────
// DEPTH OF FIELD AND GOD RAYS ARE NOT IN THIS CHAIN, AND THAT IS A MEASUREMENT
// RATHER THAN A PREFERENCE.
//
// Both shipped here. Both were removed after a real browser showed what they
// were actually doing: with either one mounted, every frame logged
//
//   GL_INVALID_OPERATION: glBlitFramebuffer: Read and write depth stencil
//   attachments cannot be the same image
//
// until Chrome gave up ("too many errors, no more errors will be reported to
// the console for this context"). Bisected with the effect list as the only
// variable, ~10s of runtime each:
//
//   no composer at all (?free=1) ............. 0 GL warnings
//   composer + Bloom + Vignette .............. 0 GL warnings
//   composer + Bloom + Vignette + DOF ........ error every frame
//   composer + Bloom + Vignette + GodRays .... error every frame
//
// Ruled out along the way, each on its own run: the composer's multisampling
// (set to 0 — no change), DOF's downsampling path (`height` prop removed — no
// change), and three's transmission pass (every transmissive material zeroed at
// runtime through the live scene graph — no change, and its render target
// already sets resolveDepthBuffer: false).
//
// What the two removed effects have in common is the only thing left: they are
// the two that ask the composer for a DepthTexture. Attaching it makes the
// resolve blit read and write the same depth image, which is illegal — so the
// depth buffer these effects sample is undefined. The bokeh was not subtly
// wrong; it was computed from garbage, every frame, on every high-tier device,
// while filling the console.
//
// An effect that cannot read valid depth is not a cinematic lens, it is a cost.
// The focus language the brief asks for is carried instead by the parts of the
// system that do work and are already authored per beat: the FOV warp (44-56
// outside, 30 at the stations), the per-beat fog, and the vignette below.
// Atmospheric perspective is how architectural photography separates planes in
// any case.
//
// TO RESTORE: re-add <DepthOfField target={SUBJECT} focalLength={0.028}
// bokehScale={0.9} /> and re-run the bisect above. If the console stays clean on
// postprocessing > 6.39.3 or three > 0.173 the incompatibility is fixed and it
// should come back — cameraPath still exports SUBJECT for exactly that.
// ─────────────────────────────────────────────────────────────────────────────

import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
  HueSaturation,
  Noise,
  Vignette,
  wrapEffect,
} from '@react-three/postprocessing';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BlendFunction,
  EffectAttribute,
  SMAAEffect,
  SMAAPreset,
  type BloomEffect,
  type BrightnessContrastEffect,
  type HueSaturationEffect,
  type VignetteEffect,
} from 'postprocessing';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';
import { FILM_GRADE, FilmGrade, HALL_GRADE, type FilmGradeEffect } from './FilmGrade';
import { DepthOff, LensFocus } from './LensFocus';
import { passageLight } from './passageLight';
import type { SceneSet } from './poses';
import type { Grade } from './WorldCanvas';
import { ld, lookdevOn } from './lookdev';

/**
 * THE GRADE, AND WHY A RENDER NEEDS ONE.
 *
 * The client's verdict on the first estate was that it "looks like another 3D
 * build" — and the honest reading of that is not geometry, it is that nothing
 * had happened to the image after the renderer was finished with it. A
 * photograph of a house has been through a lens and a grade: it has grain, it
 * has a little more contrast than the scene did, its colour is pushed, and its
 * corners fall off. A raw framebuffer has none of that, and the eye reads the
 * absence instantly even when it cannot name it.
 *
 * Every effect below is SCREEN SPACE and depth-free, which is the constraint
 * the investigation at the top of this file established: anything that asks the
 * composer for a DepthTexture (depth of field, SSAO, god rays) makes the resolve
 * blit read and write the same image and produces garbage. Nothing here does.
 *
 *   contrast   +0.055   the shadow side of the stone gets its weight back
 *   saturation +0.09    warm light on limestone, not on beige
 *   grain      0.028    at 45% opacity in overlay: a film stock's noise floor,
 *                       which is what stops a flat sky reading as a gradient
 *
 * THERE IS NO CHROMATIC ABERRATION. An art-direction audit (2026-09-30) asked
 * for it "subtle", and it was set three times: at 0.00042 there was none to
 * see, at 0.0009 every bright leaf at the frame's edge split into red and
 * cyan, and at 0.00065 the forensic audit of 2026-10-09 (#21) still found it
 * on a still — magenta along a column and a car's roofline, a teal line down
 * the gravel's curve — on a picture with no edge smoothing, where a fringe
 * reads as a fault of the renderer and not as glass. A value small enough
 * not to be seen is no effect and a whole pass; the pass is gone, and its
 * place in the chain is the edge smoothing's (below).
 */
const GRADE = { contrast: 0.055, saturation: 0.09, grain: 0.028 } as const;

/**
 * Bloom, per set. The threshold is in SCENE-LINEAR light, because bloom runs
 * before the print.
 *
 * Outside: only the gold finials, the lit window reveals, the constellation and
 * the active hologram cross 0.82; a lower threshold catches the cream stone and
 * turns the whole facade into a lamp.
 *
 * Inside the same 0.82 caught the room. The hall is IVORY: its lit walls, its
 * ceiling and its stair stringer all sit near that level, so every bright
 * surface put a haze over its neighbours — a glow with no source, which is the
 * milky veil the hall had. Inside, only the light sources bloom: the
 * chandelier's crystal, the sconce flames, the holograms.
 */
// OUTSIDE, ONLY SOURCES NOW (the refinement brief, 2026-10-03: bloom is not
// to be "a primary carrier of luxury"). At 0.82 the sunlit trim, the pale
// loungers and every baluster the low sun caught stood over the threshold: a
// soft haze over the whole lit front by day, and at dusk a row of haloes along
// the parapet that read as a string of lamps. At 1.0 what blooms is what
// emits or mirrors light: the lantern, the lamps in the lit rooms, the path
// lights, the sun on the water.
const BLOOM = { intensity: 0.5, threshold: 1.0, smoothing: 0.25 } as const;
const HALL_BLOOM = { intensity: 0.55, threshold: 1.25, smoothing: 0.35 } as const;
/** A touch heavier than outside since the second client review: the room
 *  is lamp-lit, and its edges fall away toward the corners (FilmGrade HALL_GRADE). */
const HALL_VIGNETTE = { offset: 0.3, darkness: 0.62 } as const;
/** The estate's, under the print. */
// (0.55 until the paid audit, 2026-10-04: the corners fell a stop and more
// into black, on top of a print whose toe already darkens them.)
const FILM_VIGNETTE = { offset: 0.3, darkness: 0.35 } as const;

/**
 * MULTISAMPLING OFF, AND WHY IT STAYS OFF.
 *
 * The scene is drawn into the composer's buffer, not the screen, so the
 * canvas's own `antialias` never reaches the frame; and this buffer cannot be
 * multisampled, because its ALPHA IS THE SCENE'S DEPTH in metres
 * (LensFocus.tsx: the lens, the contact occlusion and the motion blur all
 * read it, with 1.0 exactly standing for the sky and a negative value for a
 * surface seen by its own light). A multisample resolve averages what is in a
 * pixel: at every silhouette the depth would become a distance that is
 * neither surface's, the sky's mark would stop being the sky's, and a lamp's
 * edge would average to nothing at all.
 */
const MULTISAMPLING = 0;

/**
 * EDGE SMOOTHING, AFTER THE PRINT.
 *
 * The forensic audit of 2026-10-09 (#5, its first systemic finding): "the
 * picture is drawn with no edge smoothing. Thin features break into
 * stair-steps and dotted lines, and they crawl as the camera moves" — every
 * baluster, cornice and glazing bar, on a 1920x1080 screen at 100% scaling,
 * which is the client's own. On such a screen a pixel of the picture is a
 * pixel of the panel: the renderer's ratio is 1 and nothing is supersampled.
 *
 * So the finished frame is smoothed where it has edges (SMAA: it finds them
 * in the picture as printed, and blends along them), after the print and
 * before the grain, in the pass the aberration used to take. Not on a screen
 * with two or more device pixels to each of the page's — there the renderer
 * already draws four to a pixel of the page and the eye cannot resolve the
 * steps — and not on the low tier, which keeps its one-pass chain.
 *
 * (`?aa=0` with `?debug=1` leaves it out, to compare.)
 */
const SMOOTH_UNDER_RATIO = 1.75;

/**
 * THE SMOOTHING PASS, DECLARING ONLY WHAT IT USES.
 *
 * The library's SMAA can find its edges three ways (by colour, by luma, by
 * depth) and can sharpen that search with depth again ("predication"); so it
 * declares to the composer that it READS THE SCENE'S DEPTH, whichever way it
 * is asked to work. This build asks for colour and no predication: it never
 * samples depth. But the declaration alone makes the composer attach a depth
 * texture to its buffers, and on this chain that is the illegal blit written
 * up at the top of this file, to the letter —
 *
 *   GL_INVALID_OPERATION: glBlitFramebuffer: Read and write depth stencil
 *   attachments cannot be the same image
 *
 * — every frame, until the browser stops counting. MEASURED on the first
 * build of the smoothing (2026-10-10, c13/gl_warn.mjs): 257 console messages
 * in three and a half seconds on /about and on the film, none with `?aa=0`,
 * none on the build the forensic audit measured. The picture was right; the
 * console was not, and a console that fills is the first thing a reviewer
 * with the tools open sees.
 *
 * So the effect is the library's own, with the one attribute it uses: a
 * convolution (it reads its neighbours, so it takes a pass to itself).
 */
class EdgeSmoothingEffect extends SMAAEffect {
  constructor(options?: ConstructorParameters<typeof SMAAEffect>[0]) {
    super(options);
    this.setAttributes(EffectAttribute.CONVOLUTION);
  }
}
const EdgeSmoothing = wrapEffect(EdgeSmoothingEffect);
function smoothingAsked(): boolean {
  if (typeof window === 'undefined') return true;
  const q = new URLSearchParams(window.location.search);
  return !(q.get('debug') === '1' && q.get('aa') === '0');
}

/**
 * A callback ref for an effect instance. @react-three/postprocessing types an
 * effect component's ref as the effect CLASS rather than the instance, so an
 * object ref will not type-check; a callback that takes what it is given does.
 */
function useEffectRef<T>() {
  const ref = useRef<T | null>(null);
  const bind = useCallback((instance: unknown) => {
    ref.current = (instance as T | null) ?? null;
  }, []);
  return [ref, bind] as const;
}

/** Look-dev: with ?debug=1 the composer joins window.__estate (WorldCanvas),
 *  and the two prints are published so a capture can move them live. */
function exposeComposer(composer: unknown) {
  if (typeof window === 'undefined' || !composer) return;
  if (new URLSearchParams(window.location.search).get('debug') !== '1') return;
  const w = window as unknown as { __estateComposer?: unknown; __estateGrades?: unknown };
  w.__estateComposer = composer;
  w.__estateGrades = { film: FILM_GRADE, hall: HALL_GRADE };
}

type Look = { intensity: number; threshold: number; smoothing: number; offset: number; darkness: number };

/** The bloom and the vignette at `rest`, carried `toHall` (0..1) of the way to
 *  the hall's. */
function applyLook(
  b: BloomEffect | null,
  v: VignetteEffect | null,
  rest: Look,
  toHall: number,
  tier: DeviceTier,
): void {
  const mix = (from: number, to: number) => from + (to - from) * toHall;
  if (b) {
    b.intensity = mix(rest.intensity, HALL_BLOOM.intensity);
    b.luminanceMaterial.threshold = mix(rest.threshold, HALL_BLOOM.threshold);
    b.luminanceMaterial.smoothing = mix(rest.smoothing, HALL_BLOOM.smoothing);
  }
  if (v) {
    // The low tier's pair is one pair, in and out.
    v.offset = tier === 'low' ? rest.offset : mix(rest.offset, HALL_VIGNETTE.offset);
    v.darkness = tier === 'low' ? rest.darkness : mix(rest.darkness, HALL_VIGNETTE.darkness);
  }
}

export function PostFX({
  tier,
  set = 'exterior',
  grade = 'daylight',
  still = false,
}: {
  tier: DeviceTier;
  set?: SceneSet;
  grade?: Grade;
  /** A page's held frame, not the film (LensFocus: which lens a still takes). */
  still?: boolean;
}) {
  // Grain and aberration are the two passes that buy the least per millisecond,
  // so they are the two a mid-tier device does without: it keeps the bloom, the
  // grade and the vignette, which carry the look.
  const lens = tier === 'high';
  // A pixel of the picture is a pixel of the panel (or nearly): smooth it.
  const ratio = useThree((s) => s.viewport.dpr);
  const smooth = ratio < SMOOTH_UNDER_RATIO && smoothingAsked();
  // THE EXTERIOR PRINT (FilmGrade.tsx): a filmic curve and the green, split
  // and contrast grade, in place of the contrast/saturation pair. Outside in
  // daylight; the dusk rollback keeps the chain it was measured against.
  const film = set === 'exterior' && grade === 'daylight';
  // THE HALL'S PRINT (FilmGrade's HALL_GRADE): the same curve, graded for a
  // lamplit ivory room. The hall had no curve at all before this.
  const hall = set === 'interior';
  const printed = film || hall;
  const printSettings = hall ? HALL_GRADE : FILM_GRADE;

  // THE THRESHOLD IS A UNIFORM WRITE, NOT A NEW CHAIN. The set flips from
  // exterior to interior in the middle of the door passage, under the veil.
  // If that flip changed which effects are mounted, the composer would rebuild
  // and recompile its passes right there — measured, a stall long enough that
  // the passage's white peak was never drawn (E2E: "the light fills the frame"
  // read 0). So every effect either chain needs stays mounted for the life of
  // a tier, and the flip only moves values the effects already own: the print
  // to 1 or 0 (0 is an exact passthrough), the contrast/saturation pair to its
  // graded values or to identity, the vignette to its two settings. The r3f
  // wrappers put their props into constructor args, so these are driven
  // through refs rather than props — a changed prop would re-instantiate the
  // effect and rebuild the chain all the same.
  const [contrast, bindContrast] = useEffectRef<BrightnessContrastEffect>();
  const [saturation, bindSaturation] = useEffectRef<HueSaturationEffect>();
  const [print, bindPrint] = useEffectRef<FilmGradeEffect>();
  const [vignette, bindVignette] = useEffectRef<VignetteEffect>();
  const [bloom, bindBloom] = useEffectRef<BloomEffect>();
  // What the set asks of the bloom and the vignette, kept so the door can carry
  // them across (below).
  const rest = useRef<Look>({ ...BLOOM, offset: 0.28, darkness: 0.7 });
  // A LAYOUT effect: these land in the commit that changes the sets. As a
  // passive one they landed a frame after it, the hall's first frame under the
  // estate's bloom and vignette.
  useLayoutEffect(() => {
    if (contrast.current) contrast.current.contrast = printed ? 0 : GRADE.contrast;
    if (saturation.current) saturation.current.saturation = printed ? 0 : GRADE.saturation;
    if (print.current) print.current.amount = printed ? 1 : 0;
    const look = hall ? HALL_BLOOM : BLOOM;
    rest.current = {
      ...look,
      // Lighter under the print, whose toe already darkens the corners the
      // vignette used to be responsible for. Low tier keeps its own pair.
      offset: tier === 'low' ? 0.32 : hall ? HALL_VIGNETTE.offset : film ? FILM_VIGNETTE.offset : 0.28,
      darkness: tier === 'low' ? 0.62 : hall ? HALL_VIGNETTE.darkness : film ? FILM_VIGNETTE.darkness : 0.7,
    };
    applyLook(bloom.current, vignette.current, rest.current, 0, tier);
  }, [film, hall, printed, tier, contrast, saturation, print, vignette, bloom]);

  // THROUGH THE OPEN DOOR (doorway.ts, 'through') the room fills the frame
  // before the sets change, so the bloom and the vignette go over to the
  // room's with the print (passageLight.grade): they are the room's by the
  // sill, and the change of sets moves nothing. Uniform writes, and only while
  // a passage is carrying the grade.
  const carried = useRef(0);
  useFrame(() => {
    const g = hall ? 0 : passageLight.grade;
    // Look-dev: the film's vignette and bloom, live.
    if (lookdevOn() && film) {
      rest.current = {
        intensity: ld('bloom', BLOOM.intensity),
        threshold: ld('bloomThreshold', BLOOM.threshold),
        smoothing: BLOOM.smoothing,
        offset: ld('vigOffset', FILM_VIGNETTE.offset),
        darkness: ld('vigDark', FILM_VIGNETTE.darkness),
      };
      carried.current = -1;
    }
    if (g === carried.current) return;
    carried.current = g;
    applyLook(bloom.current, vignette.current, rest.current, g, tier);
  });

  if (tier === 'low') {
    // A phone gets the grade but not the passes that cost a full-screen blur:
    // the grade and the vignette are one shader between them.
    return (
      <EffectComposer multisampling={MULTISAMPLING}>
        <DepthOff />
        <BrightnessContrast ref={bindContrast} brightness={0} contrast={GRADE.contrast} />
        <HueSaturation ref={bindSaturation} hue={0} saturation={GRADE.saturation} />
        <FilmGrade ref={bindPrint} settings={printSettings} />
        <Vignette ref={bindVignette} offset={0.32} darkness={0.62} eskil={false} />
      </EffectComposer>
    );
  }

  // KEYED ON THE TIER, so a tier change rebuilds the chain in the order it is
  // written. r3f appends an effect that mounts later — the tier is promoted
  // from 'mid' to 'high' after the first frames are measured — to the END of
  // the composer's children, so the high-tier chain was running Render ->
  // [Bloom, grade, Vignette] -> Aberration -> Grain: grain and aberration after
  // the vignette, and with the lens, the lens after the pass that clamps the
  // scene's alpha, where the depth it reads had already been flattened to 1.0
  // and it blurred the whole frame as if it were sky. The promotion happens
  // once, at load; nothing else changes the effect set (see above).
  return (
    <EffectComposer key={tier + (smooth ? ':smooth' : '')} multisampling={MULTISAMPLING} ref={exposeComposer}>
      {/* FIRST, and on its own pass: the lens reads the scene's depth from
          the alpha channel, which the next pass clamps away (LensFocus.tsx).
          It rests at zero strength anywhere but the exterior leg. */}
      {lens ? <LensFocus active={film || hall} stillHall={still && hall} /> : <DepthOff />}
      {/* Selective, per set (BLOOM / HALL_BLOOM): only light sources cross
          the threshold. Driven through the ref, like the grade below, so the
          threshold at the door is a uniform write. */}
      <Bloom
        ref={bindBloom}
        intensity={BLOOM.intensity}
        luminanceThreshold={BLOOM.threshold}
        luminanceSmoothing={BLOOM.smoothing}
        mipmapBlur
      />
      <BrightnessContrast ref={bindContrast} brightness={0} contrast={GRADE.contrast} />
      <HueSaturation ref={bindSaturation} hue={0} saturation={GRADE.saturation} />
      <FilmGrade ref={bindPrint} settings={printSettings} />
      {/* The edges, on the printed picture and under the grain (which is
          not an edge, and must not be found as one). */}
      {smooth ? <EdgeSmoothing preset={SMAAPreset.HIGH} /> : <></>}
      {/* OVERLAY, not screen: overlay leaves the midtones where they are and
          works into the shadows and highlights, which is how grain sits on an
          image instead of fogging it. */}
      {lens ? (
        <Noise premultiply={false} blendFunction={BlendFunction.OVERLAY} opacity={GRADE.grain} />
      ) : (
        <></>
      )}
      <Vignette ref={bindVignette} offset={0.28} darkness={0.7} eskil={false} />
    </EffectComposer>
  );
}
