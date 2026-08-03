// packages/domain/src/telemetry/device-tier.ts
//
// Device tiering. Spec §10.
//
// Decided by MEASURED frame time, plus memory and core count as coarse priors.
// Never by GPU model string: §9 rules out hardware-based profiling, browsers are
// restricting WEBGL_debug_renderer_info anyway, and — most practically — the
// string is a poor predictor. A mid-range 2024 phone outruns plenty of laptops
// whose renderer string looks impressive.
//
// Pure so it can be tested. The measurement itself lives in the React layer;
// this only decides what the numbers mean.

export type DeviceTier = 'high' | 'mid' | 'low';

export interface TierSignals {
  /** Median frame time in ms over the sampling window. Undefined until enough
   *  frames have been seen. */
  medianFrameMs?: number;
  /** navigator.deviceMemory, in GB. Absent on Safari and Firefox. */
  deviceMemoryGb?: number;
  /** navigator.hardwareConcurrency. */
  cores?: number;
  /** False when WebGL2 could not be created at all. */
  webgl2?: boolean;
  /** prefers-reduced-motion. A request, not a capability — but it means the
   *  full flight should not play regardless of what the hardware could manage. */
  reducedMotion?: boolean;
}

/** ~55fps. Above this the full interactive scene is comfortable. */
export const HIGH_FRAME_MS = 18;
/** ~30fps. Below this the pre-rendered spine is the honest choice. */
export const LOW_FRAME_MS = 33;

/** Enough frames to see past first-frame compile and texture upload spikes. */
export const SAMPLE_FRAMES = 90;

export function decideTier(s: TierSignals): DeviceTier {
  // No WebGL2 at all: nothing to negotiate.
  if (s.webgl2 === false) return 'low';

  // A stated preference for reduced motion caps the experience regardless of
  // capability. Honouring it is not a performance decision.
  if (s.reducedMotion) return 'low';

  // Hard floors from the coarse priors. A 2GB device will thrash on a 4K
  // lightmap however well it happens to be scoring in the first second.
  if (typeof s.deviceMemoryGb === 'number' && s.deviceMemoryGb <= 2) return 'low';
  if (typeof s.cores === 'number' && s.cores <= 2) return 'low';

  // Measurement wins once available.
  if (typeof s.medianFrameMs === 'number') {
    if (s.medianFrameMs <= HIGH_FRAME_MS) {
      // Do not promote to high on frame time alone if memory is marginal:
      // early frames are cheap before the full scene is resident.
      if (typeof s.deviceMemoryGb === 'number' && s.deviceMemoryGb < 4) return 'mid';
      return 'high';
    }
    if (s.medianFrameMs >= LOW_FRAME_MS) return 'low';
    return 'mid';
  }

  // No measurement yet. Start at 'mid' rather than 'high': beginning heavy and
  // dropping is a visible stutter on exactly the devices that can least afford
  // it, whereas starting lighter and promoting is invisible.
  return 'mid';
}

/** Median is deliberate — a single GC pause or texture upload would drag a mean
 *  across a threshold and mis-tier an otherwise capable device. */
export function medianOf(samples: readonly number[]): number | undefined {
  if (samples.length === 0) return undefined;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
