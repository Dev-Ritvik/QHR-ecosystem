'use client';

// apps/monolith/src/lib/audio.ts
//
// The acoustic bed — MASTER_SPEC §5, §9.5.
//
// Entirely synthesised. No .mp3, no impulse-response WAV, nothing fetched — the
// whole soundtrack is oscillators and filtered noise, which is both the payload
// argument (§9.2, under 2MB total media) and one of the four things §1 points a
// Developer Award jury at.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE PROBLEM NOBODY IN THE SOURCE DOCUMENTS CAUGHT
//
// The entire design rests on a 34–42 Hz sub-bass drone. Laptop speakers roll off
// below roughly 150 Hz. Phone speakers below roughly 400 Hz.
//
// So on the majority of devices that will ever load this site — and on at least
// some of the machines a jury will judge it on — Acts I to IV are SILENT. Not
// quiet. Silent. The "Zimmer pressure" layer would be inaudible to most of its
// audience, and everyone reviewing the spec agreed it was the emotional spine.
//
// The fix is psychoacoustic rather than louder. The ear reconstructs a MISSING
// FUNDAMENTAL from its harmonics: present 68 Hz and 102 Hz together and a
// listener perceives 34 Hz even on hardware that cannot reproduce it. So every
// fundamental ships with its 2nd and 3rd harmonics, ~9 dB down so they never
// colour the tone on monitoring that can actually reproduce the real thing.
//
// Full-range systems get the genuine sub. Everything else gets the perception
// of it. Both hear the same note.
// ─────────────────────────────────────────────────────────────────────────────
//
// AudioContext cannot be created before a user gesture — that is what [ ENTER ]
// is for (§8.2). start() must be called from inside that click handler.

import { continuityAt } from './continuity';

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  /** Multiple of the fundamental: 1 = the sub itself, 2 and 3 = reinforcement. */
  ratio: number;
  /** Level relative to the fundamental. */
  level: number;
}

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  voices: Voice[];
  /** Wind / water bed: filtered noise, not a loop. */
  noise: AudioBufferSourceNode;
  noiseFilter: BiquadFilterNode;
  noiseGain: GainNode;
  /** Irrational LFO rates so the bed never repeats audibly. */
  lfos: OscillatorNode[];
  muted: boolean;
}

let engine: Engine | null = null;

/** Brown-ish noise: integrated white, which falls at ~6 dB/octave and reads as
 *  mass rather than hiss. Generated once into a looping buffer — a 4-second
 *  buffer costs ~700KB of RAM and zero bytes over the wire. */
function makeNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

export function startAudio(): void {
  if (engine || typeof window === 'undefined') return;

  const Ctor = window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;

  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // THE HARMONIC STACK. ratio 1 is the real sub; 2 and 3 are what carry it on
  // hardware that cannot reproduce 34 Hz.
  const voices: Voice[] = [
    { ratio: 1, level: 1.0 },
    { ratio: 2, level: 0.35 },   // ~ -9 dB
    { ratio: 3, level: 0.22 },   // ~ -13 dB
  ].map(({ ratio, level }) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const gain = ctx.createGain();
    gain.gain.value = level;
    osc.connect(gain).connect(master);
    osc.start();
    return { osc, gain, ratio, level };
  });

  // Air. Band-passed brown noise standing in for wind over open ground in Acts
  // I–II, and for room tone once inside.
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoise(ctx);
  noise.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 420;
  noiseFilter.Q.value = 0.7;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.06;
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start();

  // Three LFOs at mutually irrational rates, so their combined period is long
  // enough that no listener will ever hear the bed repeat. A single LFO, or
  // rationally-related ones, produce an audible pulse within about a minute.
  const lfos = [0.017, 0.029, 0.043].map((rate, i) => {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.value = [0.018, 60, 0.012][i];
    lfo.connect(depth);
    depth.connect(i === 1 ? noiseFilter.frequency : noiseGain.gain);
    lfo.start();
    return lfo;
  });

  engine = { ctx, master, voices, noise, noiseFilter, noiseGain, lfos, muted: false };

  // Fade in over 2.4s. An instant start on a 34 Hz sine is a click, and a click
  // is the one sound this entire design cannot afford.
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.4);
}

/** Called from the ticker. Pure reader of q — never decides anything. */
export function updateAudio(q: number): void {
  if (!engine || engine.muted) return;
  const { ctx, voices, noiseFilter } = engine;
  const c = continuityAt(q);
  const now = ctx.currentTime;

  if (c.hz <= 0) {
    // THE SEVERANCE (§5 Act IV). Exponential to near-zero over 140ms — fast
    // enough to read as a vault sealing, slow enough to avoid a digital pop.
    // setTargetAtTime rather than linearRamp because the ear hears amplitude
    // logarithmically, so a linear fade sounds like it stops early.
    engine.master.gain.setTargetAtTime(0.0001, now, 0.045);
    return;
  }

  engine.master.gain.setTargetAtTime(0.5, now, 0.12);

  for (const v of voices) {
    // Glide rather than jump. A stepped pitch change on a sustained sine is a
    // chirp; 0.35s of time constant makes 34 -> 42 Hz read as pressure
    // changing rather than as a new note starting.
    v.osc.frequency.setTargetAtTime(c.hz * v.ratio, now, 0.35);
  }

  // The air closes down as the camera enters the building — acoustic isolation,
  // not a mute. Exterior 420 Hz, interior ~180 Hz.
  const target = q < 0.64 ? 420 : 180;
  noiseFilter.frequency.setTargetAtTime(target, now, 0.5);
}

/** Command Overlay ducking (§7): the world stops, the dossier remains. */
export function duckAudio(ducked: boolean): void {
  if (!engine) return;
  const { ctx, master } = engine;
  master.gain.setTargetAtTime(ducked ? 0.04 : 0.5, ctx.currentTime, 0.05);
}

export function toggleMute(): boolean {
  if (!engine) return false;
  engine.muted = !engine.muted;
  engine.master.gain.setTargetAtTime(
    engine.muted ? 0.0001 : 0.5,
    engine.ctx.currentTime,
    0.08,
  );
  return engine.muted;
}

export function isAudioRunning(): boolean {
  return !!engine && engine.ctx.state === 'running';
}

export function stopAudio(): void {
  if (!engine) return;
  const { ctx, voices, noise, lfos } = engine;
  for (const v of voices) v.osc.stop();
  for (const l of lfos) l.stop();
  noise.stop();
  void ctx.close();
  engine = null;
}
