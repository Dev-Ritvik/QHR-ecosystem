'use client';

// apps/public/src/components/consent/ConsentPanel.tsx
//
// The consent moment. Spec §3.2: at this budget a grey cookie bar is a wasted
// opportunity and an opt-in killer, so this is built in the same material
// language as the hologram callout cards — smoked glass, a gold rule, tracked
// caps.
//
// Two rules that are not styling preferences:
//   1. The three actions carry EQUAL visual weight. A de-emphasised "Essential
//      only" is a dark pattern, and under the DPDP Act refusal must be as easy
//      as acceptance.
//   2. The first decision cannot be dismissed by clicking away or pressing Esc.
//      Dismissal is not a choice, and treating it as one is exactly the
//      "unambiguous" failure the Act is aimed at. Re-opened later, it closes
//      freely — by then a valid choice already exists.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConsent } from '@/lib/consent/ConsentProvider';
import {
  CONSENT_CATEGORIES,
  CONSENT_COPY,
  type ConsentCategory,
} from '@/lib/consent/types';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function ConsentPanel() {
  const {
    consent,
    needsDecision,
    panelOpen,
    closePanel,
    acceptAll,
    rejectAll,
    save,
  } = useConsent();

  const [detail, setDetail] = useState(false);
  const [choice, setChoice] = useState<Record<ConsentCategory, boolean>>({
    experience: false,
    analytics: false,
    marketing: false,
  });
  const ref = useRef<HTMLDivElement>(null);

  const open = needsDecision || panelOpen;
  const dismissible = !needsDecision;

  // Re-opening should show what was actually chosen, not the defaults.
  useEffect(() => {
    if (!open) return;
    setChoice({
      experience: consent?.experience ?? false,
      analytics: consent?.analytics ?? false,
      marketing: consent?.marketing ?? false,
    });
    setDetail(false);
  }, [open, consent]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        closePanel();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      // Focus stays inside the dialog while a decision is outstanding.
      const items = Array.from(
        ref.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [dismissible, closePanel],
  );

  useEffect(() => {
    if (!open || !ref.current) return;
    ref.current.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open, detail]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      aria-hidden={false}
    >
      <div
        className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px]"
        onClick={dismissible ? closePanel : undefined}
        aria-hidden="true"
      />

      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-body"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-neutral-950/95 text-neutral-100 shadow-2xl"
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />

        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <h2
            id="consent-title"
            className="font-serif text-lg tracking-[0.18em] text-neutral-50 sm:text-xl"
          >
            BEFORE YOU EXPLORE
          </h2>

          <p
            id="consent-body"
            className="mt-3 text-sm leading-relaxed text-neutral-300"
          >
            We keep what is needed to run the experience. Beyond that, you decide.
            Turning these on lets us show you the projects and plots you actually
            spent time with — and skip the ones you did not. You can change your
            mind at any time from the Privacy link.
          </p>

          {detail && (
            <ul className="mt-6 space-y-4 border-t border-white/10 pt-5">
              <li className="flex items-start gap-4">
                <span className="mt-1 shrink-0 rounded border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-neutral-400">
                  Always on
                </span>
                <div>
                  <p className="text-sm font-medium text-neutral-100">
                    {CONSENT_COPY.essential.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                    {CONSENT_COPY.essential.body}
                  </p>
                </div>
              </li>

              {CONSENT_CATEGORIES.map((cat) => (
                <li key={cat} className="flex items-start gap-4">
                  <label className="mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={choice[cat]}
                      onChange={(e) =>
                        setChoice((c) => ({ ...c, [cat]: e.target.checked }))
                      }
                      className="h-4 w-4 cursor-pointer rounded border-white/25 bg-transparent text-brand-400 focus:ring-2 focus:ring-brand-400 focus:ring-offset-0"
                    />
                    <span className="sr-only">{CONSENT_COPY[cat].title}</span>
                  </label>
                  <div>
                    <p className="text-sm font-medium text-neutral-100">
                      {CONSENT_COPY[cat].title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                      {CONSENT_COPY[cat].body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Equal weight, deliberately. Same size, same treatment, no primary. */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={acceptAll}
              className="flex-1 rounded border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.16em] text-neutral-100 transition hover:border-amber-200/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={rejectAll}
              className="flex-1 rounded border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.16em] text-neutral-100 transition hover:border-amber-200/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => (detail ? save(choice) : setDetail(true))}
              className="flex-1 rounded border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.16em] text-neutral-100 transition hover:border-amber-200/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {detail ? 'Save choices' : 'Choose'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The persistent withdrawal control. Consent has to be as easy to take back as
 *  it was to give, so this belongs everywhere the footer is. */
export function PrivacyControl({ className }: { className?: string }) {
  const { reopen } = useConsent();
  return (
    <button
      type="button"
      onClick={reopen}
      className={
        className ??
        'text-xs uppercase tracking-[0.14em] text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline'
      }
    >
      Privacy &amp; data choices
    </button>
  );
}
