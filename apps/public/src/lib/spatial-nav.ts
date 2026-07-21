// apps/public/src/lib/spatial-nav.ts
'use client';

import { useEffect } from 'react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

function getDirection(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp': return 'UP';
    case 'ArrowDown': return 'DOWN';
    case 'ArrowLeft': return 'LEFT';
    case 'ArrowRight': return 'RIGHT';
    default: return null;
  }
}

class SpatialNavigationManager {
  private isPointerMode = true;
  private rafId: number | null = null;
  private lastGamepadInput = 0;
  private readonly GAMEPAD_COOLDOWN = 200; // ms to prevent rapid-fire skipping

  /**
   * Touch/Mouse Bypass (FR-PM1): Any pointer interaction instantly removes focus rings
   * and restores standard browser pointing behavior.
   */
  private onPointerMove = () => {
    if (this.isPointerMode) return;
    this.isPointerMode = true;
    document.body.classList.remove('spatial-mode-active');
    
    // Drop focus if we were on a spatial element to immediately clear the ring
    const active = document.activeElement as HTMLElement;
    if (active && active !== document.body && active.hasAttribute('data-spatial')) {
      active.blur();
    }
  };

  /**
   * Keyboard/Gamepad Engagement: Restores the spatial focus state and hides cursor.
   */
  private onNavAction = () => {
    if (!this.isPointerMode) return;
    this.isPointerMode = false;
    document.body.classList.add('spatial-mode-active');
  };

  private onKeyDown = (e: KeyboardEvent) => {
    // If a custom widget (like the MapLibre canvas) handles the key and prevents default,
    // we yield spatial navigation to it. This cleanly handles FR-PM5 in-map navigation.
    if (e.defaultPrevented) return;

    const dir = getDirection(e.key);
    if (!dir) {
      if (e.key === 'Enter') this.onNavAction();
      return;
    }

    this.onNavAction();

    // Elements explicitly opt-in to spatial nav. 
    // They must also have tabIndex={0} to be natively focusable.
    const candidates = Array.from(document.querySelectorAll('[data-spatial]')) as HTMLElement[];
    const visibleCandidates = candidates.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });

    if (visibleCandidates.length === 0) return;

    const current = document.activeElement as HTMLElement;
    let nextEl: HTMLElement | null = null;

    if (!current || current === document.body || !visibleCandidates.includes(current)) {
      // Default to the top-left-most element if nothing is focused
      nextEl = visibleCandidates.reduce((best, el) => {
        const r1 = best.getBoundingClientRect();
        const r2 = el.getBoundingClientRect();
        return (r2.top + r2.left < r1.top + r1.left) ? el : best;
      }, visibleCandidates[0]);
    } else {
      nextEl = this.findBestCandidate(current, visibleCandidates, dir);
    }

    if (nextEl) {
      e.preventDefault(); // Prevent native scrolling when arrow keys are pressed
      nextEl.focus({ preventScroll: true });
      // Bring into view without the jarring snap of default focus scroll
      nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  };

  /**
   * Geometry-based closest neighbor calculation.
   * Heavily penalizes off-axis movement to prefer straight lines over diagonals.
   */
  private findBestCandidate(current: HTMLElement, candidates: HTMLElement[], dir: Direction): HTMLElement | null {
    const currentRect = current.getBoundingClientRect();
    const cx = currentRect.left + currentRect.width / 2;
    const cy = currentRect.top + currentRect.height / 2;

    let bestEl: HTMLElement | null = null;
    let minScore = Infinity;

    for (const el of candidates) {
      if (el === current) continue;
      
      const rect = el.getBoundingClientRect();
      const ex = rect.left + rect.width / 2;
      const ey = rect.top + rect.height / 2;

      const dx = ex - cx;
      const dy = ey - cy;

      let primary = 0;
      let secondary = 0;
      let valid = false;

      // ±5px buffer to prevent near-identical alignments from trapping the cursor
      switch (dir) {
        case 'UP':
          if (dy < -5) { valid = true; primary = -dy; secondary = Math.abs(dx); }
          break;
        case 'DOWN':
          if (dy > 5) { valid = true; primary = dy; secondary = Math.abs(dx); }
          break;
        case 'LEFT':
          if (dx < -5) { valid = true; primary = -dx; secondary = Math.abs(dy); }
          break;
        case 'RIGHT':
          if (dx > 5) { valid = true; primary = dx; secondary = Math.abs(dy); }
          break;
      }

      if (valid) {
        // Core heuristic: primary axis distance + high penalty for secondary axis drift
        const score = primary + (secondary * 4);
        if (score < minScore) {
          minScore = score;
          bestEl = el;
        }
      }
    }

    return bestEl;
  }

  /**
   * Gamepad Polling Loop.
   * Maps D-pad and Left-stick to Arrow keys, and A/Cross to Enter.
   * Dispatches synthetic KeyboardEvents so React's synthetic event system and the DOM nav both catch it.
   */
  private pollGamepad = () => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    for (const gp of gamepads) {
      if (!gp) continue;
      
      const now = Date.now();
      if (now - this.lastGamepadInput < this.GAMEPAD_COOLDOWN) continue;

      let key: string | null = null;

      // Map D-pad and left analog stick (with a robust deadzone)
      if (gp.buttons[12]?.pressed || gp.axes[1] < -0.6) key = 'ArrowUp';
      else if (gp.buttons[13]?.pressed || gp.axes[1] > 0.6) key = 'ArrowDown';
      else if (gp.buttons[14]?.pressed || gp.axes[0] < -0.6) key = 'ArrowLeft';
      else if (gp.buttons[15]?.pressed || gp.axes[0] > 0.6) key = 'ArrowRight';
      else if (gp.buttons[0]?.pressed) key = 'Enter';

      if (key) {
        this.lastGamepadInput = now;
        
        const target = document.activeElement || document.body;
        const event = new KeyboardEvent('keydown', {
          key,
          code: key,
          bubbles: true,
          cancelable: true
        });
        
        target.dispatchEvent(event);
        
        // Synthetic KeyboardEvents don't natively trigger clicks on buttons/links; force it.
        if (key === 'Enter' && !event.defaultPrevented && target instanceof HTMLElement) {
          target.click();
        }
        
        break; // Only process one input per frame to avoid duplicate jumps
      }
    }

    this.rafId = requestAnimationFrame(this.pollGamepad);
  };

  mount() {
    if (typeof window === 'undefined') return;
    
    // Core interaction listeners
    window.addEventListener('keydown', this.onKeyDown);
    
    // Pointer bypass listeners (passive for performance)
    window.addEventListener('mousemove', this.onPointerMove, { passive: true });
    window.addEventListener('touchstart', this.onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this.onPointerMove, { passive: true });
    
    this.rafId = requestAnimationFrame(this.pollGamepad);
  }

  unmount() {
    if (typeof window === 'undefined') return;
    
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('mousemove', this.onPointerMove);
    window.removeEventListener('touchstart', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerMove);
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}

// Singleton instance coordinates all spatial navigation for the session
const manager = new SpatialNavigationManager();

/**
 * Client component to initialize the Spatial Navigation engine in the layout.
 */
export function SpatialNavInit() {
  useEffect(() => {
    manager.mount();
    return () => manager.unmount();
  }, []);
  
  return null;
}
