'use client';

// apps/monolith/src/lib/tier.ts
//
// Device tiering — MASTER_SPEC §9.3.
//
// This is the usability bet, not a performance nicety. Awwwards weights
// Usability at 30% and most cinematic WebGL sites score 6.0–7.0 there because
// they ship one build and hope. Tier D in particular is a SECOND DESIGNED
// ARTEFACT, not an apology screen — it is what a juror sees the moment they
// enable reduced-motion, and most competitors show them a blank canvas.
//
// Detected once on mount. Built into Act I from day one, because every
// subsequent act inherits the composer stack and retrofitting tiers during QA
// is how this build fails.

import type { Tier } from '@/state/sceneStore';

export interface DeviceProfile {
  tier: Tier;
  reducedMotion: boolean;
  /** Why this tier was chosen. Surfaced in the debug overlay — a tier decision
   *  nobody can explain is a tier decision nobody can tune. */
  reason: string;
}

/** Does this browser have a usable WebGL2 context at all? */
function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    // Release it immediately. A probe context left alive counts against the
    // browser's per-page context limit, and on some mobile drivers that limit
    // is as low as 8.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Renderer string via WEBGL_debug_renderer_info where available.
 * Chrome has been progressively restricting this, so it is a hint that
 * improves the guess, never the basis of it.
 */
function rendererHint(): string {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return s.toLowerCase();
  } catch {
    return '';
  }
}

export function detectTier(): DeviceProfile {
  if (typeof window === 'undefined') {
    return { tier: 'D', reducedMotion: false, reason: 'server' };
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reduced motion is a stated preference, not a capability signal. It
  // outranks every heuristic below — a powerful machine whose owner asked for
  // less motion gets Tier D, and that is the correct reading of the request.
  if (reducedMotion) {
    return { tier: 'D', reducedMotion: true, reason: 'prefers-reduced-motion' };
  }

  if (!hasWebGL()) {
    return { tier: 'D', reducedMotion: false, reason: 'no webgl2' };
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 768;
  const gpu = rendererHint();

  // Software rasterisers report as SwiftShader/llvmpipe and will not hold 60fps
  // on anything. Straight to D — this is a correctness call, not a budget one.
  if (/swiftshader|llvmpipe|software/.test(gpu)) {
    return { tier: 'D', reducedMotion: false, reason: `software renderer (${gpu})` };
  }

  // Phone or small touch device. Even a flagship phone gets C: the constraint
  // there is sustained thermal headroom over a 90-second scroll, not peak
  // capability, and no probe measures that in one frame.
  if (coarse || narrow) {
    const strong = cores >= 8 && mem >= 6;
    return {
      tier: strong ? 'B' : 'C',
      reducedMotion: false,
      reason: `touch/narrow, ${cores} cores, ${mem}GB`,
    };
  }

  if (cores >= 8 && mem >= 8) {
    return { tier: 'A', reducedMotion: false, reason: `${cores} cores, ${mem}GB, ${gpu || 'gpu unknown'}` };
  }
  if (cores >= 4) {
    return { tier: 'B', reducedMotion: false, reason: `${cores} cores, ${mem}GB` };
  }
  return { tier: 'C', reducedMotion: false, reason: `${cores} cores, ${mem}GB` };
}

/** Per-tier render budget. Read by the Canvas and the composer — §9.3. */
export const TIER_BUDGET: Record<Tier, {
  dpr: [number, number];
  bloom: boolean;
  dof: boolean;
  godrays: boolean;
  composerScale: number;
  maxLights: number;
  /** Cap on simultaneous <Html transform> nodes. CSS3D is the dominant mobile
   *  cost in Acts II–III. */
  htmlNodes: number;
}> = {
  A: { dpr: [1, 2],    bloom: true,  dof: true,  godrays: true,  composerScale: 1.0,  maxLights: 4, htmlNodes: 6 },
  B: { dpr: [1, 1.5],  bloom: true,  dof: false, godrays: false, composerScale: 0.75, maxLights: 3, htmlNodes: 4 },
  C: { dpr: [1, 1.25], bloom: false, dof: false, godrays: false, composerScale: 0.6,  maxLights: 2, htmlNodes: 2 },
  D: { dpr: [1, 1],    bloom: false, dof: false, godrays: false, composerScale: 0,    maxLights: 0, htmlNodes: 0 },
};
