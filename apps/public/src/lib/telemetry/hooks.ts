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
import { ScrollAccumulator } from '@estate/domain/telemetry/scroll';

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    openedAt.current = Date.now();
    telemetry.push('route_open', routeId);

    // Reading scrollHeight forces layout, so it is sampled here and on resize
    // rather than on every scroll event.
    const scrollableNow = () =>
      document.documentElement.scrollHeight - window.innerHeight;

    // The accumulation maths lives in @estate/domain and is unit-tested there.
    // It could not be verified through a browser — the preview pane never
    // dispatches scroll events, so every metric read back as zero and a broken
    // implementation would have looked identical to a working one.
    const acc = new ScrollAccumulator(
      window.scrollY,
      performance.now(),
      scrollableNow(),
    );
    const remeasure = () => acc.setScrollable(scrollableNow());

    // Sample SYNCHRONOUSLY on scroll. The first cut deferred this to
    // requestAnimationFrame to stay off the hot path, which was wrong twice
    // over: rAF does not run at all while the tab is not compositing, and by
    // the time a route unmounts the browser has already restored scroll to the
    // top — so a visitor who read to the bottom was reported at zero depth.
    //
    // Reading window.scrollY costs nothing (no layout); only scrollHeight does,
    // and that is cached above. So the handler stays cheap without deferring.
    const onScroll = () => acc.sample(window.scrollY, performance.now());
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', remeasure);
      // No final sample here on purpose: by unmount the browser has already
      // restored scroll to the top, so reading position now would report zero.
      // maxDepth is accumulated live instead.
      telemetry.push('route_close', routeId, {
        dwellMs: Date.now() - openedAt.current,
        ...acc.summary(),
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
