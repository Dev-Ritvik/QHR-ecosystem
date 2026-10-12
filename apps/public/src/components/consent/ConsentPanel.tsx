'use client';

// apps/public/src/components/consent/ConsentPanel.tsx
//
// The consent moment. Spec §3.2: at this budget a grey cookie bar is a wasted
// opportunity and an opt-in killer, so this is a card of the site's own.
//
// IN THE SITE'S OWN KIT (the forensic audit of 2026-10-09, #105 to #107). It
// was "the first designed object a visitor meets, and it comes from a
// different kit": three outlined boxes where every other action on the site
// is a hairline and capitals, a heading in tracked capitals of a cool white
// found nowhere else, and the smallest body text anywhere. Now: the heading
// in the text's own ivory at the size of a name, the notice at the reading
// size, the three answers as the site's quiet action (app/globals.css,
// .cta-quiet), a hairline for its edge, and no blur behind it — nothing else
// on the site blurs.
//
// Three rules that are not styling preferences:
//   1. The three actions carry EQUAL visual weight. A de-emphasised "Essential
//      only" is a dark pattern, and under the DPDP Act refusal must be as easy
//      as acceptance.
//   2. NO ANSWER IS PRE-SELECTED. The card used to open with the keyboard's
//      focus on its first button, so "Accept all" alone carried a ring and the
//      Enter key accepted all tracking (#106). Focus now lands on the card
//      itself: a screen reader reads its title and notice, and the first Tab
//      goes to the first answer.
//   3. The first decision cannot be dismissed by clicking away or pressing Esc.
//      Dismissal is not a choice, and treating it as one is exactly the
//      "unambiguous" failure the Act is aimed at. Re-opened later, it closes
//      freely — by then a valid choice already exists.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConsent } from '@/lib/consent/ConsentProvider';
import {
  CONSENT_CATEGORIES,
  CONSENT_COPY,
  PRIVACY_CONTROL_NAME,
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
  const [erasing, setErasing] = useState(false);
  const [erased, setErased] = useState(false);
  const [eraseFailed, setEraseFailed] = useState(false);

  const erase = useCallback(async () => {
    setErasing(true);
    setEraseFailed(false);
    try {
      const res = await fetch('/api/privacy', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      // Only claim success when the server actually confirms it. `fetch` not
      // throwing is not evidence: the first cut here showed "Deleted" after a
      // relay failure, which is the one thing this control must never do.
      const body = res.ok ? await res.json().catch(() => null) : null;
      if (res.ok && body?.ok === true) {
        setErased(true);
      } else {
        setEraseFailed(true);
        setErasing(false);
      }
    } catch {
      setEraseFailed(true);
      setErasing(false);
    }
  }, []);
  const [choice, setChoice] = useState<Record<ConsentCategory, boolean>>({
    experience: false,
    analytics: false,
    marketing: false,
  });
  const ref = useRef<HTMLDivElement>(null);
  /** "Choose" was pressed: the keyboard goes on to the first of the choices. */
  const toChoices = useRef(false);

  const open = needsDecision || panelOpen;
  const dismissible = !needsDecision;

  // Re-opening should show what was actually chosen, not the defaults — and
  // show it: a visitor who comes back to this card has come to change a
  // setting, so it opens on the settings as they stand. A first visit opens on
  // the three answers alone.
  useEffect(() => {
    if (!open) return;
    setChoice({
      experience: consent?.experience ?? false,
      analytics: consent?.analytics ?? false,
      marketing: consent?.marketing ?? false,
    });
    setDetail(!needsDecision);
  }, [open, consent, needsDecision]);

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
      const at = document.activeElement;
      // From the card itself (where focus lands): forward to the first answer,
      // back to the last. Never out of the card.
      if (at === ref.current) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && at === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [dismissible, closePanel],
  );

  // On the card, not on an answer.
  useEffect(() => {
    if (!open || !ref.current) return;
    ref.current.focus({ preventScroll: true });
  }, [open]);

  // After "Choose", the first of the choices.
  useEffect(() => {
    if (!detail || !toChoices.current || !ref.current) return;
    toChoices.current = false;
    ref.current.querySelector<HTMLElement>('input[type="checkbox"]')?.focus();
  }, [detail]);

  if (!open) return null;

  return (
    <div className="consent folio-stage" aria-hidden={false}>
      <div
        className="consent-scrim"
        onClick={dismissible ? closePanel : undefined}
        aria-hidden="true"
      />

      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-body"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="consent-card"
      >
        <h2 id="consent-title" className="consent-title">
          {needsDecision ? 'Before you explore.' : `${PRIVACY_CONTROL_NAME}.`}
        </h2>

        {needsDecision ? (
          <p id="consent-body" className="consent-body">
            We keep what is needed to run the site. Beyond that, you decide:
            remembering your preferences, measuring which layouts are looked at,
            and following up on other sites are each off until you turn them
            on. You can change your mind at any time under “
            {PRIVACY_CONTROL_NAME}” at the foot of every page.
          </p>
        ) : (
          <p id="consent-body" className="consent-body">
            What this site keeps beyond what it needs to run. Each is off
            unless you have turned it on.
          </p>
        )}

        {detail && (
          <ul className="consent-list">
            <li className="consent-row">
              <p className="consent-check is-fixed">
                <span className="consent-check-mark" aria-hidden />
                <span className="consent-row-name">{CONSENT_COPY.essential.title}</span>
              </p>
              <p className="consent-row-line">{CONSENT_COPY.essential.body}</p>
            </li>

            {CONSENT_CATEGORIES.map((cat) => (
              <li key={cat} className="consent-row">
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={choice[cat]}
                    onChange={(e) =>
                      setChoice((c) => ({ ...c, [cat]: e.target.checked }))
                    }
                  />
                  <span className="consent-check-mark" aria-hidden />
                  <span className="consent-row-name">{CONSENT_COPY[cat].title}</span>
                </label>
                <p className="consent-row-line">{CONSENT_COPY[cat].body}</p>
              </li>
            ))}
          </ul>
        )}

        {/* Equal weight, deliberately. Same size, same treatment, no primary. */}
        <div className="consent-actions">
          <button type="button" onClick={acceptAll} className="cta-quiet">
            <span className="cta-quiet-label">Accept all</span>
          </button>
          <button type="button" onClick={rejectAll} className="cta-quiet">
            <span className="cta-quiet-label">Essential only</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (detail) {
                save(choice);
              } else {
                toChoices.current = true;
                setDetail(true);
              }
            }}
            className="cta-quiet"
          >
            <span className="cta-quiet-label">{detail ? 'Save choices' : 'Choose'}</span>
          </button>
        </div>

        {/* Erasure. The DPDP Act grants this, and an endpoint nobody can find
            is not a right — so it lives here, next to the choice that created
            the data, rather than behind an email address. Shown only in the
            detail view so it cannot be hit by accident. */}
        {detail && (
          <div className="consent-erase">
            {erased ? (
              <p>Deleted. Nothing from this visit is retained.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={erase}
                  disabled={erasing}
                  className="consent-erase-action"
                >
                  {erasing ? 'Deleting…' : 'Delete the data from this visit'}
                </button>
                {eraseFailed && (
                  <p className="consent-error" role="alert">
                    We could not complete that just now, so nothing was
                    deleted. Please try again.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The persistent withdrawal control. Consent has to be as easy to take back as
 *  it was to give, so this belongs everywhere the footer is. */
export function PrivacyControl({ className }: { className?: string }) {
  const { reopen } = useConsent();
  return (
    <button type="button" onClick={reopen} className={className ?? 'colophon-legal-link'}>
      {PRIVACY_CONTROL_NAME}
    </button>
  );
}
