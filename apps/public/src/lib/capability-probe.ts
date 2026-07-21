// apps/public/src/lib/capability-probe.ts
/**
 * Capability Probe (FR-PM3, §4.4, Pushback #1)
 * Evaluates the client's GPU, memory, and network at runtime to determine 
 * the appropriate asset manifest tier and effect intensity.
 * 
 * Progressive enhancement inside a single codebase, rather than tier routing.
 */

export type CapabilityTier = 'high' | 'medium' | 'low';
export type MediaVariant = 'presentation_4k' | 'web' | 'thumb';
export type TransitionStyle = 'full' | 'reduced' | 'crossfade';

export interface DeviceCapabilities {
  tier: CapabilityTier;
  mediaVariant: MediaVariant;
  enableExtrusion: boolean;
  transitionStyle: TransitionStyle;
}

export async function probeCapabilities(): Promise<DeviceCapabilities> {
  // SSR / initial static pass fallback
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      tier: 'medium',
      mediaVariant: 'web',
      enableExtrusion: true,
      transitionStyle: 'full',
    };
  }

  let score = 0;
  let isSlowNetwork = false;

  // 1. Network / Connection check
  const nav = navigator as any;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  
  if (connection) {
    if (connection.effectiveType === '4g') score += 2;
    else if (connection.effectiveType === '3g') score += 1;
    
    // Explicitly crippled network
    if (connection.saveData || (connection.downlink && connection.downlink < 2)) {
      isSlowNetwork = true;
    }
  } else {
    score += 2; // Assume decent if unmeasurable
  }

  // 2. Memory check (Device Memory API)
  if (nav.deviceMemory) {
    if (nav.deviceMemory >= 8) score += 2;
    else if (nav.deviceMemory >= 4) score += 1;
  } else {
    score += 1.5; // Assume middle-ground if unmeasurable (e.g., iOS Safari doesn't support this)
  }

  // 3. GPU / WebGL heuristic test
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (gl) {
      score += 1;
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      
      if (debugInfo) {
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        // Reward known discrete GPUs or high-end integrated silicon
        if (/(nvidia|amd|radeon|geforce|apple m|rtx|gtx)/i.test(renderer)) {
          score += 2;
        }
      }
    }
  } catch (e) {
    // WebGL instantiation failed; hardware accel is likely disabled/unavailable
  }

  // 4. Accessibility Preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Derive Tier
  let tier: CapabilityTier = 'low';
  if (score >= 5.5 && !isSlowNetwork) {
    tier = 'high';
  } else if (score >= 3.5) {
    tier = 'medium';
  }

  // Tier mappings to specific effect boundaries
  return {
    tier,
    // Maps to projection schema's pubMediaKind variants
    mediaVariant: tier === 'high' ? 'presentation_4k' : tier === 'medium' ? 'web' : 'thumb',
    // 2.5D building/wall extrusion (FR-PM6b)
    enableExtrusion: tier !== 'low',
    // NFR-A1: Reduced motion honored via cross-fade. Low-tier devices naturally fall back to reduced transitions.
    transitionStyle: prefersReducedMotion ? 'crossfade' : tier === 'high' ? 'full' : 'reduced',
  };
}
