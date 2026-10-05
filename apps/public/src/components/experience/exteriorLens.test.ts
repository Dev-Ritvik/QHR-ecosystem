// apps/public/src/components/experience/exteriorLens.test.ts
//
// The exterior's lens and sun, held to what they promise.
//
// Both are shader patches into three's own chunks (softSunShadows.ts,
// LensFocus.tsx), which is exactly the kind of change a three upgrade breaks
// silently: the anchor moves, the patch lands somewhere else or nowhere, and
// the frame still renders. So the patches are checked as text, in the place
// they must land. And the lens makes a promise about geometry — the house is
// never in the blur — that is checked against the same generated bounds the
// camera collision tests use, along the whole exterior leg.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installSoftSunShadows, PCSS_SPREAD, SUN_SHADOW_CAMERA } from './softSunShadows';
import {
  AO_PAIRS,
  AO_STEEP,
  EXTERIOR_APERTURE,
  FAR_FROM,
  FAR_RAMP,
  FAR_SOFT,
  FOCUS_INTO,
  FOCUS_RADIUS,
  GATE_MM,
  HOUSE_CORNERS,
  LensFocusEffect,
  exteriorBlur,
  focusDistanceFor,
  focusStartFor,
  installFocusDepth,
  lensGain,
} from './LensFocus';
import { FILM_SHARE, exteriorPoseAt, lensAt } from './cameraPath';
import { ESTATE_ARCHITECTURE, ESTATE_ROOF_TOP } from './estateBounds';

describe('the sun (PCSS)', () => {
  it('re-points getShadow at PCSS and leaves point shadows alone', () => {
    expect(installSoftSunShadows()).toBe(true);
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
    const getShadow = chunk.indexOf('float getShadow(');
    const getPoint = chunk.indexOf('float getPointShadow(');
    const call = chunk.indexOf('frustumTest ? pcssSun( shadowMap, shadowMapSize, shadowCoord');
    // getShadow's own return, gated by its own frustum test
    expect(call).toBeGreaterThan(getShadow);
    expect(call).toBeLessThan(getPoint);
    // exactly once, and getPointShadow keeps three's own return
    expect(chunk.split('pcssSun( shadowMap, shadowMapSize').length - 1).toBe(1);
    expect(chunk.indexOf('return mix( 1.0, shadow, shadowIntensity );')).toBeGreaterThan(getPoint);
    // and installing twice changes nothing
    installSoftSunShadows();
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(chunk);
  });

  it('derives its penumbra from the light it is written for', () => {
    // The sun's half-degree disc across the key's own shadow camera, three and
    // a half times as wide: the sun through the evening's haze (the paid
    // audit, 2026-10-04; it was half as wide again). If the frustum changes,
    // the penumbra follows by construction; this pins the number.
    const { left, right, near, far } = SUN_SHADOW_CAMERA;
    expect(right - left).toBe(156);
    expect(far - near).toBe(339);
    expect(PCSS_SPREAD).toBeCloseTo(0.03518, 4);
  });
});

describe('the contact occlusion (pairs of taps)', () => {
  // The depth is a half float, so the normal rebuilt from it is wrong by tens
  // of degrees; judged tap by tap against it, every flat wall occluded itself
  // (a hatched contour map of the depth's own steps, seen at leg 0.85). The
  // pass is checked as text: it is a shader, and what must hold is its shape.
  const source = new LensFocusEffect().getFragmentShader();
  const fn = source.slice(source.indexOf('float contactAO('), source.indexOf('vec2 cameraVelocity('));

  it('is there to check', () => {
    expect(fn.length).toBeGreaterThan(400);
    expect(source).toContain(`#define AO_PAIRS ${AO_PAIRS}`);
    expect(source).toContain(`#define AO_STEEP ${AO_STEEP.toFixed(2)}`);
  });

  it('takes twelve taps as six pairs through the pixel', () => {
    expect(AO_PAIRS * 2).toBe(12);
    expect(fn).toContain('for (int i = 0; i < AO_PAIRS; i++)');
    // the two taps of a pair, on one line through the pixel
    expect(fn.split('textureLod(inputBuffer, uv + o, 0.0)').length - 1).toBe(1);
    expect(fn.split('textureLod(inputBuffer, uv - o, 0.0)').length - 1).toBe(1);
  });

  it('turns the pairs through half a circle: a pair is its own opposite', () => {
    const phi = fn.slice(fn.indexOf('float phi ='), fn.indexOf(';', fn.indexOf('float phi =')));
    expect(phi).toContain('* 3.14159265');
    expect(phi).not.toContain('6.2831853');
  });

  it('clamps the SUM of a pair, so a tilted normal on a flat wall cancels', () => {
    // signed elevations: no tap is clamped on its own before the sum
    expect(fn).toContain('float sa = dot(va, n) * ia, sb = dot(vb, n) * ib;');
    expect(fn).toContain('max(0.0, sa + sb - bias * 0.5 * (ia + ib))');
    // one dead zone to the pair: the bias is not taken off each tap
    expect(fn).not.toContain('(dot(va, n) - bias)');
  });

  it('counts a lone tap only where it stands steeply over the pixel', () => {
    expect(AO_STEEP).toBeGreaterThanOrEqual(0.45);
    expect(AO_STEEP).toBeLessThanOrEqual(0.6);
    // both taps of a broken pair, each past the threshold, and nowhere else
    expect(fn.split('- AO_STEEP)').length - 1).toBe(2);
    expect(fn).toContain('if (da < reach && db < reach)');
  });

  it('weights the pair by one tap, and keeps the scale of twelve taps', () => {
    expect(fn).toContain('(sa > sb ? fa : fb)');
    expect(fn).toContain('occ * (1.0 / float(AO_PAIRS))');
  });
});

describe('the lens (depth in alpha)', () => {
  it('writes the POSITIVE view depth, never the far sentinel', () => {
    installFocusDepth();
    const chunk = THREE.ShaderChunk.opaque_fragment;
    // vViewPosition is three's negated view position: its z is the distance.
    // Negating it again wrote -60 m, which the clamp turned into 1.05
    // everywhere — the first build of the lens blurred nothing it should have.
    expect(chunk).toContain('max( vViewPosition.z, 1.05 )');
    expect(chunk).not.toMatch(/-\s*vViewPosition\.z/);
    // gated, so nothing unmarked (the hall, the sky) writes anything but 1.0
    expect(chunk).toMatch(/#if defined\( ESTATE_FOCUS \) && defined\( OPAQUE \)/);
  });

  it('leaves a surface seen by its own light out of the contact occlusion', () => {
    // A lit room behind its window is not darkened by its reveal. The pass
    // darkened it like any wall, and its sampling noise stood on every lit
    // window as a stipple of dark dots (seen, with the refinement brief).
    installFocusDepth();
    const chunk = THREE.ShaderChunk.opaque_fragment;
    expect(chunk).toContain('#ifdef ESTATE_EMITTER');
    expect(chunk).toContain('gl_FragColor.a = - gl_FragColor.a;');
    const source = new LensFocusEffect().getFragmentShader();
    // its depth is read by its size everywhere...
    expect(source).toContain('float aoDepth(vec4 c) { float a = abs(c.a);');
    expect(source).toMatch(/float lensBlur\(float a\) \{\s*a = abs\(a\);/);
    // ...and the pixel itself is left unoccluded
    expect(source).toContain('inputColor.a > 0.0) ao = contactAO(uv, z0);');
  });

  it('holds the whole house: roof top, podium and portico', () => {
    const ys = HOUSE_CORNERS.map((c) => c.y);
    const zs = HOUSE_CORNERS.map((c) => c.z);
    expect(Math.max(...ys)).toBeCloseTo(ESTATE_ROOF_TOP, 2);
    const mansion = ESTATE_ARCHITECTURE.find((b) => b.name === 'mansion')!;
    expect(Math.min(...zs)).toBe(mansion.min[2]);
    expect(Math.max(...zs)).toBe(mansion.max[2]);
  });

  // THE LENS IS A LENS (the refinement brief, 2026-10-03). A hand-drawn band
  // of focus with blur on both sides is how a MODEL photographs, and the
  // estate read as one. What is checked here is the thin lens the shader now
  // carries, on a 1920 x 1080 buffer.
  const W = 1920;
  const H = 1080;
  const cot = (fov: number) => 1 / Math.tan((fov * Math.PI) / 360);
  const poseAt = (s: number) => {
    const eye = new THREE.Vector3();
    const target = new THREE.Vector3();
    exteriorPoseAt(s, eye, target);
    const axis = target.clone().sub(eye).normalize();
    const focus = focusDistanceFor(eye, axis);
    return { eye, axis, focus, gain: lensGain(cot(lensAt(s).fov), focus, H), air: focusStartFor(eye, axis) };
  };

  it('is focused on the house, at every point of the exterior leg', () => {
    for (let i = 0; i <= 400; i += 1) {
      const { eye, axis, focus } = poseAt(i / 400);
      const depths = HOUSE_CORNERS.map((c) => c.clone().sub(eye).dot(axis));
      expect(focus).toBeGreaterThan(Math.min(...depths));
      expect(focus).toBeLessThan(Math.max(...depths) + FOCUS_INTO);
    }
  });

  it('pulls focus: no jump between neighbouring frames of the move', () => {
    let last = poseAt(0).focus;
    for (let i = 1; i <= 800; i += 1) {
      const { focus } = poseAt(i / 800);
      // A step of the leg this small moves the camera well under a metre.
      expect(Math.abs(focus - last)).toBeLessThan(2.5);
      last = focus;
    }
  });

  it('holds the whole house sharp on every wide shot of the film', () => {
    let worst = 0;
    for (let i = 0; i <= 250; i += 1) {
      const s = (i / 250) * FILM_SHARE;
      const { eye, axis, focus, gain, air } = poseAt(s);
      for (const c of HOUSE_CORNERS) {
        const d = c.clone().sub(eye).dot(axis);
        worst = Math.max(worst, exteriorBlur(d, focus, gain, air, W));
      }
    }
    // Under a pixel: no part of the house is soft from any vantage of the film.
    expect(worst).toBeLessThan(1);
  });

  it('is deep focus at the hero: the far land takes the air, not the lens', () => {
    const { focus, gain, air } = poseAt(0);
    // The lens's own blur at the horizon is a fraction of a pixel...
    expect(gain).toBeLessThan(0.5);
    // ...the air gives the tree belt its pixel and a half, and no more...
    const belt = exteriorBlur(air + FAR_RAMP, focus, gain, air, W);
    expect(belt).toBeCloseTo(FAR_SOFT * W, 6);
    expect(belt).toBeLessThan(2);
    // ...the garden between the lens and the house is sharp...
    expect(exteriorBlur(focus * 0.5, focus, gain, air, W)).toBeLessThan(0.6);
    // ...and only what brushes past the lens is soft.
    expect(exteriorBlur(2.5, focus, gain, air, W)).toBeGreaterThan(2);
  });

  it('gives the garden behind the house its softness as the camera closes', () => {
    const hero = poseAt(0);
    const door = poseAt(1);
    expect(door.focus).toBeLessThan(hero.focus * 0.6);
    expect(door.gain).toBeGreaterThan(hero.gain * 2);
    // Forty metres behind what the lens holds: soft, and still a lens's soft.
    const behind = exteriorBlur(door.focus + 40, door.focus, door.gain, door.air, W);
    expect(behind).toBeGreaterThan(0.5);
    expect(behind).toBeLessThan(FOCUS_RADIUS * W);
  });

  it('carries the lens in the shader: the circle of confusion and the air', () => {
    const source = new LensFocusEffect().getFragmentShader();
    const fn = source.slice(source.indexOf('float lensBlur('), source.indexOf('// ONE BAD PIXEL'));
    expect(fn).toContain('lensK * abs(d - focusDist) / max(d, 0.5)');
    expect(fn).toContain('farSoft * clamp((d - focusStart) / focusRamp, 0.0, 1.0)');
    expect(fn).toContain('min(max(coc, air), radiusPx) * strength');
    expect(EXTERIOR_APERTURE).toBeGreaterThanOrEqual(1.4);
    expect(GATE_MM).toBe(24);
    expect(FAR_FROM).toBeGreaterThan(20);
  });
});
