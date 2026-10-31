'use client';

// apps/public/src/components/experience/AmbientSound.tsx
//
// A sound layer for the film, muted until asked for.
//
// THE THIRD REVIEW: "A website does not feel like a multi-million-dollar estate
// until it sounds like one ... an elegant, muted-by-default audio layer. A low,
// resonant ... drone or warm ambient soundscape ... a soft, deep air resonance
// as the camera sweeps through the grand hall, accompanied by tactile clicks on
// interactive elements."
//
// ALL OF IT IS SYNTHESISED, in the visitor's browser, with the Web Audio API:
// nothing is downloaded, nothing is licensed, and nothing plays until the
// visitor presses the control (which is also what browsers require before a
// page may make a sound).
//
//   THE DRONE. A low root and its fifth, each two slightly detuned voices so
//   they beat slowly against each other, through a low-pass that breathes open
//   and shut over ~20 s — warm, never a tone you can name.
//   THE AIR. Brown noise through a band-pass, its level following how fast the
//   page is moving: still air at rest, a soft rush as the camera sweeps.
//   THE ROOM. A generated impulse response (decaying noise) as reverb, so every
//   part of it sits in a large space rather than in headphones.
//   THE TOUCH. A short, soft tick when the pointer presses a link or a button.
//
// The choice is remembered for this visitor (localStorage, guarded).

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Where the control is set: a place the film's header keeps for it
 *  (SiteHeader), beside Enquire and Menu. */
export const SOUND_SLOT_ID = 'film-sound';

const KEY = 'estate.sound';

type Rig = {
  ctx: AudioContext;
  master: GainNode;
  air: GainNode;
  click: () => void;
};

function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function brown(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

function build(): Rig {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);

  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 4.2, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  room.connect(wet).connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 0.6;
  dry.connect(master);
  const bus = ctx.createGain();
  bus.connect(dry);
  bus.connect(room);

  // THE DRONE: root and fifth, two detuned voices each, under a breathing filter.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 420;
  tone.Q.value = 0.6;
  const toneLfo = ctx.createOscillator();
  toneLfo.frequency.value = 0.05;
  const toneDepth = ctx.createGain();
  toneDepth.gain.value = 180;
  toneLfo.connect(toneDepth).connect(tone.frequency);
  toneLfo.start();
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.12;
  tone.connect(droneGain).connect(bus);
  const voices: [number, OscillatorType, number, number][] = [
    [55, 'sawtooth', -4, 0.35],
    [55, 'sawtooth', 5, 0.35],
    [82.41, 'triangle', -3, 0.5],
    [82.41, 'triangle', 4, 0.5],
    [110, 'sine', 0, 0.25],
  ];
  for (const [f, type, cents, level] of voices) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = cents;
    const g = ctx.createGain();
    g.gain.value = level;
    // Each voice swells on its own slow cycle.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.03 + Math.random() * 0.04;
    const depth = ctx.createGain();
    depth.gain.value = level * 0.35;
    lfo.connect(depth).connect(g.gain);
    lfo.start();
    o.connect(g).connect(tone);
    o.start();
  }

  // THE AIR, following the page's speed.
  const noise = ctx.createBufferSource();
  noise.buffer = brown(ctx, 6);
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 380;
  band.Q.value = 0.5;
  const air = ctx.createGain();
  air.gain.value = 0.02;
  noise.connect(band).connect(air).connect(bus);
  noise.start();

  const click = () => {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * 0.03);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    src.buffer = b;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
  };

  return { ctx, master, air, click };
}

export function AmbientSound() {
  const [on, setOn] = useState(false);
  // THE CONTROL STANDS IN THE HEADER (globals.css, .sound-toggle, for why):
  // the page owns the sound and its state, the header owns the place, and a
  // portal joins them. The header is in the layout and is there before this
  // mounts; the retry is for a route change that commits them a frame apart.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const find = () => {
      const el = document.getElementById(SOUND_SLOT_ID);
      if (el) setSlot(el);
      else if ((tries += 1) < 120) raf = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(raf);
  }, []);
  // ON THE OPENING FRAME TOO, now (the concept built 1:1, 2026-10-27, has it
  // under the co-ordinates on the cover). The third art-direction critique had
  // kept it off the first frame ("Only the absolute essential UI elements are
  // visible") until the film was half a viewport under way.
  const rig = useRef<Rig | null>(null);

  const apply = useCallback((next: boolean) => {
    if (next && !rig.current) rig.current = build();
    const r = rig.current;
    if (!r) return;
    if (next && r.ctx.state === 'suspended') void r.ctx.resume();
    const t = r.ctx.currentTime;
    r.master.gain.cancelScheduledValues(t);
    r.master.gain.setTargetAtTime(next ? 0.9 : 0, t, next ? 1.2 : 0.3);
  }, []);

  const toggle = useCallback(() => {
    const next = !on;
    setOn(next);
    apply(next);
    try {
      window.localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      /* storage unavailable: the choice lasts this visit */
    }
  }, [apply, on]);

  // A visitor who turned it on last time sees the control lit, but browsers
  // allow no sound before a gesture, so it starts on their first press anywhere.
  useEffect(() => {
    let wanted = false;
    try {
      wanted = window.localStorage.getItem(KEY) === 'on';
    } catch {
      wanted = false;
    }
    if (!wanted) return;
    const start = (e: PointerEvent) => {
      // A press on the control itself is the control's to handle.
      if ((e.target as HTMLElement | null)?.closest('.sound-toggle')) return;
      window.removeEventListener('pointerdown', start);
      setOn(true);
      apply(true);
    };
    window.addEventListener('pointerdown', start);
    return () => window.removeEventListener('pointerdown', start);
  }, [apply]);

  // The air follows the page's speed; the touch sounds on press.
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let level = 0;
    const tick = (t: number) => {
      const r = rig.current;
      const dt = Math.max(1, t - lastT);
      const speed = Math.abs(window.scrollY - lastY) / dt; // px per ms
      lastY = window.scrollY;
      lastT = t;
      level += (Math.min(1, speed / 3) - level) * 0.05;
      if (r) r.air.gain.setTargetAtTime(0.02 + 0.16 * level, r.ctx.currentTime, 0.2);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const press = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('a, button');
      if (el) rig.current?.click();
    };
    window.addEventListener('pointerdown', press);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', press);
    };
  }, [on]);

  useEffect(
    () => () => {
      void rig.current?.ctx.close();
      rig.current = null;
    },
    [],
  );

  if (!slot) return null;
  return createPortal(
    <button
      type="button"
      role="switch"
      onClick={toggle}
      aria-checked={on}
      aria-label="Sound"
      className={'sound-toggle tap-target group' + (on ? ' is-on' : '')}
    >
      {/* A WAVEFORM AND A SWITCH (the concept the user asked to be built 1:1,
          2026-10-27). The loudspeaker it replaces was the audit of 2026-10-05's
          answer to four bars that "read as a glitch": what makes this one
          read is the switch beside it, which says on or off as a switch does.
          The waveform stands still while the sound is off and breathes while
          it plays. */}
      <span aria-hidden className="sound-wave-bars">
        {WAVE.map((h, i) => (
          <i key={i} style={{ ['--h' as string]: h, ['--i' as string]: i }} />
        ))}
      </span>
      <span aria-hidden className="sound-switch">
        <i />
      </span>
    </button>,
    slot,
  );
}

/** The waveform's bars, as heights out of one: a short phrase, loudest in its
 *  middle, as a recording's envelope is drawn. */
const WAVE = [0.16, 0.24, 0.2, 0.36, 0.3, 0.52, 0.42, 0.7, 0.58, 1, 0.82, 0.62, 0.9, 0.5, 0.66, 0.4, 0.3, 0.44, 0.24, 0.3, 0.18, 0.12];
