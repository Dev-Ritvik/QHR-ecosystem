'use client';

// apps/monolith/src/components/experience/CameraRig.tsx
//
// The camera — MASTER_SPEC §3, §5, L2.
//
// This component is a pure reader. It never decides anything: `q` comes from
// the ticker, geometry comes from cameraPath, and every optical value comes
// from the continuity table. If a number appears here that is not derived from
// one of those three, that is a bug.
//
// It also does NOT use useFrame.
//
// That is deliberate and it is the whole point of the one-clock rule. useFrame
// runs on r3f's loop; the ticker runs on gsap's. Subscribing here means the
// camera is updated by the SAME loop that advanced Lenis, in the same tick,
// after scroll has already moved — so the camera can never sample a stale
// scroll value. Under frameloop="never" useFrame stops entirely, which would
// silently freeze the camera's own bookkeeping; a ticker subscription keeps the
// state coherent even while nothing renders.

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { subscribe } from '@/lib/ticker';
import { POSITION_CURVE, TARGET_CURVE, curveT } from '@/lib/cameraPath';
import { chaseExposure, continuityAt, evToExposure } from '@/lib/continuity';
import { useSceneStore } from '@/state/sceneStore';

/** Metres of camera offset at full pointer deflection. Deliberately tiny — this
 *  is a backdrop with text on it, and a camera that swings to the cursor makes
 *  the copy above it feel unstable. */
const PARALLAX = 0.9;

export function CameraRig() {
  const { camera, scene, gl } = useThree();
  const reportOptics = useSceneStore((s) => s.reportOptics);

  // Scratch vectors allocated once. Constructing a Vector3 inside the frame
  // callback is the most common way an r3f scene ends up garbage-collecting
  // mid-gesture, which on a phone is a visible hitch rather than a statistic.
  const pos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const pointer = useRef(new THREE.Vector2(0, 0));
  const exposure = useRef(-2.4);
  const fog = useRef<THREE.FogExp2 | null>(null);

  // Optics are reported to the store for the HUD, but at most a few times a
  // second — writing them every frame would re-render the React tree at frame
  // rate for values nothing is watching in real time.
  const lastReport = useRef(0);

  useEffect(() => {
    const f = new THREE.FogExp2(0x050505, 0.022);
    scene.fog = f;
    fog.current = f;
    return () => {
      scene.fog = null;
      fog.current = null;
    };
  }, [scene]);

  useEffect(() => {
    // pointer:fine only. On touch the finger IS the scroll, and offsetting the
    // camera to it fights the gesture the whole way down the page.
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
    };
    const onLeave = () => pointer.current.set(0, 0);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
    };
  }, [gl]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;

    return subscribe((q, dt) => {
      // ── Geometry ────────────────────────────────────────────────────────
      // NO EASE ON q. This is a correction, and it matters.
      //
      // An earlier version ran curveT(swing(q)) with power2.inOut. The gate
      // caught what that actually does: the ease REMAPS q, so a beat declared
      // at 0.75 no longer lands at 0.75. The Act IV pause — 0.75 to 0.82 by
      // design — was arriving at q 0.646 to 0.700 instead. Every beat was
      // displaced, and `at` had quietly stopped meaning "the scroll position
      // where this vantage appears".
      //
      // The ease existed to stop the camera moving at constant speed. But the
      // BEATS ALREADY DO THAT: 0.04→0.10 covers 226m of scroll-space while
      // 0.75→0.82 covers zero. Beat spacing IS the velocity design, written
      // explicitly and editable one number at a time. Layering a curve on top
      // fought it.
      //
      // Catmull-Rom is C1-continuous, so velocity is already smooth between
      // beats — no ease needed to avoid the corner. And this is NOT the
      // per-leg easing failure from Appendix B, which was an inOut applied
      // inside every segment; here there is no ease at all, so nothing drives
      // velocity to zero anywhere it should not.
      const u = curveT(q);
      POSITION_CURVE.getPoint(u, pos.current);
      TARGET_CURVE.getPoint(u, look.current);

      // ── Optics, from the table, on RAW q ────────────────────────────────
      // Raw, not eased: atmosphere and lens stay tied to where the visitor is
      // on the page rather than lurching with the camera.
      const c = continuityAt(q);

      // Pointer parallax, applied along the camera's own right/up axes so it
      // reads the same regardless of which way the camera faces.
      if (pointer.current.lengthSq() > 0) {
        const fwd = look.current.clone().sub(pos.current).normalize();
        const right = fwd.clone().cross(cam.up).normalize();
        const up = right.clone().cross(fwd).normalize();
        pos.current.addScaledVector(right, pointer.current.x * PARALLAX);
        pos.current.addScaledVector(up, pointer.current.y * PARALLAX * 0.6);
      }

      cam.position.copy(pos.current);
      cam.lookAt(look.current);

      // ── Bank ────────────────────────────────────────────────────────────
      // AFTER lookAt, in the camera's own space. lookAt writes the full
      // orientation with zero roll, so any roll set beforehand is discarded.
      // rotateZ post-multiplies about the view axis, which leans the horizon
      // into the turn rather than skewing the aim off the subject.
      if (c.roll !== 0) cam.rotateZ(THREE.MathUtils.degToRad(c.roll));

      // ── FOV ─────────────────────────────────────────────────────────────
      // Only when it actually changed. updateProjectionMatrix rebuilds the
      // matrix and dirties every frustum test downstream, so calling it
      // unconditionally every frame is real cost for no image.
      if (Math.abs(cam.fov - c.fov) > 0.01) {
        cam.fov = c.fov;
        cam.updateProjectionMatrix();
      }

      // ── Exposure ────────────────────────────────────────────────────────
      // Chases its target with τ = 1.05s rather than tracking it. This is the
      // physiological iris model: the interior should read as the eye hunting
      // for light, not as a dimmer switch. Exposure is the ONLY channel that
      // lags — everything else in the table is applied directly.
      exposure.current = chaseExposure(exposure.current, c.ev, dt);
      gl.toneMappingExposure = evToExposure(exposure.current);

      // ── Fog ─────────────────────────────────────────────────────────────
      if (fog.current) fog.current.density = c.fog;

      // ── Dev telemetry ───────────────────────────────────────────────────
      // Stripped from production builds. Exists so camera motion can be
      // ASSERTED rather than eyeballed — three cameras on the previous build
      // reached a client aimed at a wall, at nothing, and at the outside of a
      // building, and every one of them was a coordinate nobody had looked
      // through. A readable position at a known q is the cheapest possible
      // guard against that.
      if (process.env.NODE_ENV !== 'production') {
        (window as unknown as { __rig?: unknown }).__rig = {
          q,
          beat: c.beat,
          fov: +cam.fov.toFixed(2),
          ev: +exposure.current.toFixed(3),
          fog: +c.fog.toFixed(5),
          roll: +c.roll.toFixed(3),
          pos: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)],
        };
      }

      // ── Report, throttled ───────────────────────────────────────────────
      lastReport.current += dt;
      if (lastReport.current > 0.25) {
        lastReport.current = 0;
        reportOptics(exposure.current, c.fov);
      }
    });
  }, [camera, gl, reportOptics]);

  return null;
}
