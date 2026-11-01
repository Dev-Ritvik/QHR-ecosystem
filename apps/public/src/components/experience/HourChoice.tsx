'use client';

// apps/public/src/components/experience/HourChoice.tsx
//
// DAY, GOLDEN, NIGHT (the brief of 2026-11-01: "an interactive Day / Golden Hour / Night
// lighting toggle ... so users can see warm interior and facade lighting illuminate the
// mansion and pool at night").
//
// The film's own hours stay the film's: gold on the cover, the blue hour over the layout,
// midnight at the door, on the scroll (filmHours.ts, the user's own order of the same
// day). This holds the estate at the hour a visitor asks for, anywhere on the way, and
// the one they pressed, pressed again, gives the hours back to the film. So nothing about
// the film changes for anyone who never touches it. Under the sound, in the same place on
// the picture; the estate's alone: it goes when the film goes indoors.

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { bandSkyAt, hourChoice, onHourChoice, setHourChoice, type HourChoice as Choice } from './filmHours';
import { journeyState } from './journey';

export const HOURS_SLOT_ID = 'film-hours';

const CHOICES: readonly { id: Exclude<Choice, 'film'>; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'golden', label: 'Golden' },
  { id: 'night', label: 'Night' },
];

export function HourChoice() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [want, setWant] = useState<Choice>(hourChoice.want);
  const [outside, setOutside] = useState(true);
  // (where the header's band falls to the horizon this needs little ground of its own, and
  // on that clear a sky a lot of one is a smudge: BAND_SKY)
  const [inSky, setInSky] = useState(false);

  // The slot is the header's, which may come a commit after this.
  useEffect(() => {
    let raf = 0;
    const find = () => {
      const el = document.getElementById(HOURS_SLOT_ID);
      if (el) setSlot(el);
      else raf = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => onHourChoice(() => setWant(hourChoice.want)), []);

  // Only over the estate. Looked at a few times a second: nothing here needs a frame.
  useEffect(() => {
    const t = window.setInterval(() => {
      const out = journeyState.leg === 'exterior';
      setOutside(out);
      setInSky(out && bandSkyAt(journeyState.legProgress) > 0.5);
    }, 250);
    return () => window.clearInterval(t);
  }, []);

  const press = useCallback((id: Exclude<Choice, 'film'>) => {
    setHourChoice(hourChoice.want === id ? 'film' : id);
  }, []);

  if (!slot) return null;
  return createPortal(
    <div role="group" aria-label="Light on the estate" className={'hour-choice' + (outside ? '' : ' is-away') + (inSky ? ' is-in-sky' : '')} aria-hidden={!outside}>
      {CHOICES.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={want === c.id}
          tabIndex={outside ? 0 : -1}
          onClick={() => press(c.id)}
          className="hour-choice-button tap-target"
        >
          {c.label}
        </button>
      ))}
    </div>,
    slot,
  );
}
