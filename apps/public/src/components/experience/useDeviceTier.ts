'use client';

// apps/public/src/components/experience/useDeviceTier.ts
//
// Measures real frame cost and reports a tier. The decision logic is pure and
// unit-tested in @estate/domain; this only gathers the numbers.

import { useCallback, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  decideTier,
  medianOf,
  SAMPLE_FRAMES,
  type DeviceTier,
  type TierSignals,
} from '@estate/domain/telemetry/device-tier';
import { sceneWarm } from './sceneWarm';

/** Frames skipped before sampling begins: shader compile, texture upload and
 *  the first Draco decode all land here and describe nothing about steady
 *  state. Sampling them would demote almost every device. */
const WARMUP_FRAMES = 30;

function staticSignals(): TierSignals {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    cores: nav.hardwareConcurrency || undefined,
    reducedMotion:
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  };
}

/** Call inside the Canvas. Returns the current tier and whether measurement has
 *  settled, so callers can avoid acting on the provisional value. */
export function useDeviceTier() {
  const gl = useThree((s) => s.gl);
  const [tier, setTier] = useState<DeviceTier>(() => decideTier(staticSignals()));
  const [settled, setSettled] = useState(false);
  const frames = useRef<number[]>([]);
  const seen = useRef(0);

  useFrame((_, delta) => {
    if (settled) return;
    // ONLY FRAMES THAT DRAW THE SCENE. A set is hidden while its programs are
    // built (sceneWarm.ts), and those frames draw a sky and nothing under it:
    // sampled, they measured an empty canvas and promoted every device to the
    // heaviest tier — the weakest first, since its build takes longest.
    // (`drawing`, not `ready`: the scene is being drawn under its still, and
    // is not shown until this has given its verdict.)
    if (!sceneWarm.drawing) return;
    seen.current += 1;
    if (seen.current <= WARMUP_FRAMES) return;

    frames.current.push(delta * 1000);
    if (frames.current.length < SAMPLE_FRAMES) return;

    const webgl2 = Boolean(
      (gl as unknown as { capabilities?: { isWebGL2?: boolean } }).capabilities?.isWebGL2,
    );
    setTier(
      decideTier({
        ...staticSignals(),
        medianFrameMs: medianOf(frames.current),
        webgl2,
      }),
    );
    setSettled(true);
    sceneWarm.tierSettled = true;
  });

  const reset = useCallback(() => {
    frames.current = [];
    seen.current = 0;
    setSettled(false);
  }, []);

  return { tier, settled, reset };
}
