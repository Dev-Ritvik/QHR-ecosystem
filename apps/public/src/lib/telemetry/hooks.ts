'use client';

// apps/public/src/lib/telemetry/hooks.ts
//
// Producers for the non-spatial half of the taxonomy (spec §4.1). These need no
// 3D scene, so they can run on every route today.
//
// Everything here is a no-op until Analytics consent exists, because the
// collector itself refuses events when disabled — the hooks never have to
// re-check, and there is still exactly one gate to audit.

import { useCallback, useEffect, useRef } from 'react';
import { telemetry } from './collector';

/**
 * Route dwell, scroll depth and PACING.
 *
 * Pacing is the interesting one. Depth alone cannot tell a reader from someone
 * flinging the scrollbar to the footer — both reach 100%. Velocity separates
 * them: slow, sustained scrolling is consideration, and that is what feeds the
 * "content consideration" component of the score. So we accumulate distance and
 * moving time and report px/s, plus the share of time spent barely moving.
 */
export function useRouteTelemetry(routeId: string) {
  const openedAt = useRef(0);
  const maxDepth = useRef(0);
  const distance = useRef(0);
  const movingMs = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const slowMs = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    openedAt.current = Date.now();
    maxDepth.current = 0;
    distance.current = 0;
    movingMs.current = 0;
    slowMs.current = 0;
    lastY.current = window.scrollY;
    lastT.current = performance.now();

    telemetry.push('route_open', routeId);

    let queued = false;
    const measure = () => {
      queued = false;
      const y = window.scrollY;
      const now = performance.now();
      const dy = Math.abs(y - lastY.current);
      const dt = now - lastT.current;

      if (dt > 0 && dy > 0) {
        distance.current += dy;
        movingMs.current += dt;
        // Under ~250 px/s is reading pace rather than seeking.
        if (dy / (dt / 1000) < 250) slowMs.current += dt;
      }
      lastY.current = y;
      lastT.current = now;

      const scrollable = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const pct = Math.round(Math.min(100, (y / scrollable) * 100));
      if (pct > maxDepth.current) maxDepth.current = pct;
    };

    // rAF-throttled and passive: this runs alongside a WebGL scene on mid-tier
    // phones, so it must not touch layout on the scroll event itself.
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      const dwellMs = Date.now() - openedAt.current;
      const moving = movingMs.current;
      telemetry.push('route_close', routeId, {
        dwellMs,
        maxScrollPct: maxDepth.current,
        pacingPxPerS:
          moving > 0 ? Math.round(distance.current / (moving / 1000)) : 0,
        // The share of scrolling done at reading pace — the signal that
        // separates consideration from skimming.
        consideredMs: Math.round(slowMs.current),
      });
    };
  }, [routeId]);
}

/**
 * Hover hesitation on a call to action.
 *
 * Long hover then NO click is the signal worth having: interest coupled with
 * something holding them back, usually price. `followedThrough` is what makes
 * the difference legible in the CRM.
 */
export function useCtaTelemetry(ctaId: string, placeId?: string) {
  const enteredAt = useRef(0);
  const clicked = useRef(false);

  const onPointerEnter = useCallback(() => {
    enteredAt.current = Date.now();
    clicked.current = false;
  }, []);

  const onPointerLeave = useCallback(() => {
    if (!enteredAt.current) return;
    const hoverMs = Date.now() - enteredAt.current;
    enteredAt.current = 0;
    // Sub-300ms is the cursor crossing the element, not considering it.
    if (hoverMs < 300) return;
    telemetry.push('cta_hover', placeId, {
      ctaId,
      hoverMs,
      followedThrough: clicked.current,
    });
  }, [ctaId, placeId]);

  const onClick = useCallback(() => {
    clicked.current = true;
  }, []);

  return { onPointerEnter, onPointerLeave, onClick };
}

/**
 * Form engagement.
 *
 * `form_abandon` carries the number of fields REACHED and nothing else. No
 * names, no values, no keystrokes. This is the deliberate boundary between
 * measuring drop-off and the ghost-capture the spec refuses in §9 — the version
 * in the original brief transmitted the phone number of someone who had decided
 * not to submit.
 */
export function useFormTelemetry(formId: string) {
  const started = useRef(false);
  const fieldsReached = useRef(0);
  const submitted = useRef(false);

  const onFieldFocus = useCallback(
    (index: number) => {
      if (!started.current) {
        started.current = true;
        telemetry.push('form_start', undefined, { formId });
      }
      if (index + 1 > fieldsReached.current) fieldsReached.current = index + 1;
    },
    [formId],
  );

  const onSubmit = useCallback(() => {
    submitted.current = true;
    telemetry.push('form_submit', undefined, { formId });
  }, [formId]);

  useEffect(() => {
    return () => {
      if (started.current && !submitted.current) {
        telemetry.push('form_abandon', undefined, {
          formId,
          fieldsReached: fieldsReached.current,
        });
      }
    };
  }, [formId]);

  return { onFieldFocus, onSubmit };
}
