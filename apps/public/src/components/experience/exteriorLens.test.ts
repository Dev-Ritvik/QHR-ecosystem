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
import { FOCUS_MARGIN, HOUSE_CORNERS, focusStartFor, installFocusDepth } from './LensFocus';
import { exteriorPoseAt } from './cameraPath';
import { ESTATE_ARCHITECTURE, ESTATE_PLANTING, ESTATE_SPIRE_TIP } from './estateBounds';

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
    // The sun's half-degree disc across the key's own shadow camera, softened
    // by half again. If the frustum changes, the penumbra follows by
    // construction; this pins the number the comments quote.
    const { left, right, near, far } = SUN_SHADOW_CAMERA;
    expect(right - left).toBe(156);
    expect(far - near).toBe(339);
    expect(PCSS_SPREAD).toBeCloseTo(0.01508, 4);
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

  it('holds the whole house: spire tip, podium and portico', () => {
    const ys = HOUSE_CORNERS.map((c) => c.y);
    const zs = HOUSE_CORNERS.map((c) => c.z);
    expect(Math.max(...ys)).toBeCloseTo(ESTATE_SPIRE_TIP, 2);
    const mansion = ESTATE_ARCHITECTURE.find((b) => b.name === 'mansion')!;
    expect(Math.min(...zs)).toBe(mansion.min[2]);
    expect(Math.max(...zs)).toBe(mansion.max[2]);
  });

  it('never puts any part of the house in the blur, anywhere on the exterior leg', () => {
    const eye = new THREE.Vector3();
    const target = new THREE.Vector3();
    const axis = new THREE.Vector3();
    let tightest = Infinity;
    for (let i = 0; i <= 400; i += 1) {
      exteriorPoseAt(i / 400, eye, target);
      axis.copy(target).sub(eye).normalize();
      const start = focusStartFor(eye, axis);
      for (const c of HOUSE_CORNERS) {
        tightest = Math.min(tightest, start - c.clone().sub(eye).dot(axis));
      }
    }
    // The margin itself, less nothing: the farthest corner defines the plane.
    expect(tightest).toBeCloseTo(FOCUS_MARGIN, 6);
    expect(tightest).toBeGreaterThan(0);
  });

  it('does reach the tree belt at the hero, so it is doing something', () => {
    const eye = new THREE.Vector3();
    const target = new THREE.Vector3();
    exteriorPoseAt(0, eye, target);
    const axis = target.clone().sub(eye).normalize();
    const start = focusStartFor(eye, axis);
    // In frame, near enough: within 30 degrees of the lens axis (the hero's
    // vertical fov is 44, and the frame is wider than it is tall).
    const cone = Math.cos((30 * Math.PI) / 180);
    const ahead = ESTATE_PLANTING.filter((b) => {
      const centre = new THREE.Vector3(
        (b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2,
      );
      return centre.sub(eye).normalize().dot(axis) > cone;
    });
    expect(ahead.length).toBeGreaterThan(20);
    const beyond = ahead.filter((b) => {
      const centre = new THREE.Vector3(
        (b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2,
      );
      return centre.sub(eye).dot(axis) > start;
    });
    // Most of what stands in front of the hero camera is the belt beyond the
    // house; the few trees nearer than its far side stay sharp.
    expect(beyond.length / ahead.length).toBeGreaterThan(0.5);
  });
});
