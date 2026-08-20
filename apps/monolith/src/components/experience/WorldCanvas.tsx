'use client';

// apps/monolith/src/components/experience/WorldCanvas.tsx
//
// The single WebGL context — MASTER_SPEC §4.2, §4.5, L3.
//
// Mounted exactly ONCE by (experience)/layout.tsx and never unmounted while the
// visitor is inside that segment. Navigating between the narrative, a syndicate
// dossier and fifteen utility pages re-renders `children`; this subtree is
// untouched, so the scene survives every navigation and the camera simply eases
// to wherever the new route says it should stand.
//
// CONTEXT-CREATION DECISIONS MADE HERE, PERMANENTLY:
//
//   preserveDrawingBuffer   NOT set. It is a context-creation attribute and
//                           cannot be changed after mount, which is exactly why
//                           this file comes before Phase 6 in the build order.
//                           The freeze captures inside onAfterRender — the same
//                           tick as the render — so the backbuffer is still
//                           intact and we avoid both the memory cost and the
//                           mobile driver fast-path disable.
//
//   frameloop               "demand" while live, "never" while frozen. NOT
//                           interchangeable: drei calls invalidate() on its own
//                           (Html transform matrix updates, texture loads), so
//                           "stop calling invalidate" does not idle the GPU —
//                           a third-party component wakes it. Only "never"
//                           ignores invalidate outright.
//
//   toneMapping             ACES Filmic, in the material shader. There is NO
//                           ToneMapping composer pass anywhere in this build.
//                           Adding one maps an already-mapped image twice, and
//                           that exact arithmetic produced the "radioactive
//                           glare" rejection on apps/public.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '@/state/sceneStore';
import { useCommandStore } from '@/state/commandStore';
import { bindInvalidate, startTicker, stopTicker } from '@/lib/ticker';
import { TIER_BUDGET, detectTier } from '@/lib/tier';
import { CameraRig } from './CameraRig';
import { Corridor } from './Corridor';

/**
 * Hands R3F's invalidate() to the ticker, and owns the freeze capture.
 *
 * Lives inside <Canvas> because both `invalidate` and `gl` are only available
 * from inside the r3f context.
 */
function CanvasBridge() {
  const { invalidate, scene } = useThree();
  const setFrameloop = useSceneStore((s) => s.setFrameloop);
  const overlayOpen = useCommandStore((s) => s.overlayOpen);
  const commitFreeze = useCommandStore((s) => s.commitFreeze);
  const pendingCapture = useRef(false);

  useEffect(() => {
    bindInvalidate(invalidate);
    return () => bindInvalidate(null);
  }, [invalidate]);

  // Step 1–2 of the freeze sequence (§4.5): the overlay asked to open, so force
  // one more render of the CURRENT state. The capture happens in the
  // onAfterRender below, on that render's own tick.
  useEffect(() => {
    if (!overlayOpen) {
      setFrameloop('demand');
      invalidate();
      return;
    }
    pendingCapture.current = true;
    invalidate();
  }, [overlayOpen, invalidate, setFrameloop]);

  useEffect(() => {
    // three calls scene.onAfterRender(renderer, scene, camera) exactly once per
    // render, after the frame is rasterised to the backbuffer
    // (WebGLRenderer.render, three 0.173 line 15632). That is the only hook
    // that is both after the draw and still inside the same tick — which is
    // precisely what the seamless freeze requires.
    //
    // Verified against three's source rather than assumed. An earlier draft of
    // this file wrapped gl.render and also listened for a scene event that does
    // not exist; both were unnecessary.
    const prev = scene.onAfterRender;

    // Typed as Object3D.onAfterRender (6 params) even though three invokes the
    // Scene form with 3 — the extra parameters are simply undefined here.
    scene.onAfterRender = ((
      renderer: THREE.WebGLRenderer,
      sc: THREE.Scene,
      cam: THREE.Camera,
    ) => {
      (prev as unknown as ((...a: unknown[]) => void) | undefined)?.call(
        scene, renderer, sc, cam,
      );
      if (!pendingCapture.current) return;
      pendingCapture.current = false;

      // THE SAME TICK. Capture and freeze are two statements, not two scheduled
      // operations. That is what makes the crossfade seamless by construction:
      // the canvas freezes on exactly the frame that was captured, so for the
      // whole 350ms fade the live canvas and the image are pixel-identical.
      // You are dissolving an image into itself — there is no motion to
      // perceive at any point, regardless of timing precision.
      //
      // Split these into separate effects and you will occasionally capture one
      // frame and freeze on another. That bug passes QA nine times and fails
      // the tenth.
      let url: string | null = null;
      try {
        url = renderer.domElement.toDataURL('image/webp', 0.85);
      } catch {
        // Tainted canvas, or an out-of-memory encode on a weak device. The
        // overlay carries a solid fallback ground, so losing the backdrop
        // degrades the effect rather than the page.
        url = null;
      }
      commitFreeze(url);
      setFrameloop('never');
    }) as typeof scene.onAfterRender;

    return () => {
      scene.onAfterRender = prev;
    };
  }, [scene, commitFreeze, setFrameloop]);

  return null;
}

export function WorldCanvas() {
  const errorState = useSceneStore((s) => s.errorState);
  const frameloop = useSceneStore((s) => s.frameloop);
  const tier = useSceneStore((s) => s.tier);
  const setDevice = useSceneStore((s) => s.setDevice);
  const overlayOpen = useCommandStore((s) => s.overlayOpen);
  const [ready, setReady] = useState(false);

  // Tier before anything renders. Detecting after the first frame means a weak
  // device pays for one expensive frame before being downgraded, and that frame
  // is the one that stutters on entry.
  useEffect(() => {
    const p = detectTier();
    setDevice(p.tier, p.reducedMotion);
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info('[tier] %s — %s', p.tier, p.reason);
    }
    setReady(true);
  }, [setDevice]);

  useEffect(() => {
    startTicker();
    return () => stopTicker();
  }, []);

  const onCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    // Exposure is driven per-frame by CameraRig from the continuity table.
    // Seeded at the q=0 value so the first painted frame is already correct
    // rather than flashing bright and settling.
    gl.toneMappingExposure = Math.pow(2, -2.4);
  }, []);

  // Tier D and the error state both mean: do not create a context at all.
  if (!ready || errorState || tier === 'D') return null;

  const budget = TIER_BUDGET[tier];

  return (
    <div
      className="world"
      aria-hidden
      style={{
        // opacity, never display:none. Some browsers deprioritise or lose WebGL
        // contexts on genuinely undisplayed canvases, which is the expensive
        // rebuild the freeze exists to avoid.
        opacity: overlayOpen ? 0 : 1,
        pointerEvents: overlayOpen ? 'none' : 'auto',
        transition: 'opacity 350ms linear',
      }}
    >
      <Canvas
        frameloop={frameloop}
        dpr={budget.dpr}
        gl={{
          antialias: tier === 'A',
          alpha: false,
          powerPreference: 'high-performance',
          // preserveDrawingBuffer deliberately absent — see the file header.
        }}
        camera={{ fov: 28, near: 0.1, far: 4000, position: [2, 1.6, 6] }}
        onCreated={onCreated}
      >
        <CanvasBridge />
        <CameraRig />
        <Suspense fallback={null}>
          <Corridor />
        </Suspense>
      </Canvas>
    </div>
  );
}
