'use client';

// apps/monolith/src/components/command/Gate.tsx
//
// Consent → ignition — MASTER_SPEC §8.2, §8.2a, L9.
//
// TWO GATES, DELIBERATELY, IN THIS ORDER:
//
//   1. CONSENT     three independent categories, nothing pre-checked
//   2. [ ENTER ]   unlocks AudioContext, starts the narrative
//
// They are not merged, and that is a compliance decision rather than a design
// one. Browsers block Web Audio without a user gesture, so it is tempting to
// make "Authorize" the gesture that both grants consent and starts the film.
// That would bundle a tracking decision into the only button that lets someone
// see the site, which is a textbook dark pattern — consent has to be freely
// given, and a choice you must make to proceed is not free.
//
// So consent resolves first, with all options equally weighted, and a separate
// neutral [ ENTER ] does the audio unlock.
//
// GDPR APPLIES — §8.2a. The client confirms German visitors. Granularity alone
// is not enough: GDPR wants DEMONSTRABLE consent, so each resolution writes a
// ledger row (categories, policy version, server timestamp). That write is
// stubbed here pending the Phase 5 vault; the shape is fixed so wiring it later
// is a function body, not a redesign.

import { useEffect, useState } from 'react';
import { useSceneStore } from '@/state/sceneStore';
import { setScrollLocked } from '@/lib/ticker';
import { startAudio } from '@/lib/audio';

const POLICY_VERSION = '2026-08-20';
const STORAGE_KEY = 'monolith.consent.v1';

export interface ConsentChoice {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  policyVersion: string;
  at: string;
}

function load(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ConsentChoice;
    // A stored choice against an older policy is not consent to the current
    // one. Re-ask rather than assume.
    return p.policyVersion === POLICY_VERSION ? p : null;
  } catch {
    return null;
  }
}

function persist(choice: ConsentChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // Private mode / storage disabled. The session still works; the visitor is
    // simply asked again next time, which is the correct failure direction.
  }
  // TODO(phase5): POST to the consent_ledger. Deliberately fire-and-forget and
  // deliberately NOT blocking the gate — a visitor must never be held at a
  // consent screen because a logging endpoint is slow.
}

export function Gate() {
  const gate = useSceneStore((s) => s.gate);
  const setGate = useSceneStore((s) => s.setGate);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Nothing non-essential may load before consent resolves (L9), so the gate
  // holds scroll too — a visitor should not be reading Act II while still
  // being asked.
  useEffect(() => {
    setScrollLocked(gate !== 'live');
  }, [gate]);

  useEffect(() => {
    const prior = load();
    if (prior) setGate('ignition');
  }, [setGate]);

  if (gate === 'live') return null;

  const resolve = (a: boolean, m: boolean) => {
    persist({
      essential: true,
      analytics: a,
      marketing: m,
      policyVersion: POLICY_VERSION,
      at: new Date().toISOString(),
    });
    setGate('ignition');
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-void px-6">
      {gate === 'consent' ? (
        <div className="w-full max-w-lg">
          <p className="t-mono text-ember">Encrypted telemetry protocol</p>

          <p className="t-body mt-8 text-ash">
            This site sets cookies it needs to function. Anything beyond that is
            your choice, and nothing is switched on until you make it.
          </p>

          <div className="mt-10 space-y-px border-y border-white/10">
            <Row label="Essential" note="Session and security. Cannot be disabled." locked />
            <Row
              label="Analytics"
              note="Aggregate page and scroll telemetry."
              checked={analytics}
              onChange={setAnalytics}
            />
            <Row
              label="Marketing"
              note="Advertising pixels and attribution."
              checked={marketing}
              onChange={setMarketing}
            />
          </div>

          {/* Both controls carry identical weight — same size, same treatment,
              no primary/secondary hierarchy. A visually dominant "Accept all"
              is the exact pattern regulators single out. */}
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => resolve(false, false)}
              className="t-mono border border-white/20 px-6 py-4 text-signal transition-colors hover:border-white/50"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => resolve(analytics, marketing)}
              className="t-mono border border-white/20 px-6 py-4 text-signal transition-colors hover:border-white/50"
            >
              Authorize selected
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg text-center">
          <p className="t-mono text-ash">Quality Homes Reality</p>

          <button
            type="button"
            autoFocus
            onClick={() => {
              // The gesture that unlocks Web Audio. Kept separate from consent
              // so neither decision contaminates the other. startAudio MUST run
              // synchronously inside this handler — an AudioContext created in
              // a later tick has no user gesture behind it and starts
              // suspended.
              startAudio();
              setGate('live');
              setScrollLocked(false);
            }}
            className="t-mono mt-12 border border-ember/50 px-14 py-6 text-ember transition-colors hover:bg-ember hover:text-void"
          >
            Enter
          </button>

          <p className="t-body mt-10 text-ash/60">
            Sound is part of this. Headphones if you have them.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  note,
  checked,
  onChange,
  locked,
}: {
  label: string;
  note: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
}) {
  const id = `consent-${label.toLowerCase()}`;
  return (
    <div className="flex items-start justify-between gap-6 py-5">
      <div>
        <label htmlFor={id} className="t-mono text-signal">
          {label}
        </label>
        <p className="t-body mt-1 text-ash/60">{note}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        checked={locked ? true : !!checked}
        disabled={locked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[#c8642a]"
      />
    </div>
  );
}
