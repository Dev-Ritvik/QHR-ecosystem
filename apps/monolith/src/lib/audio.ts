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

/**
 * Where the pitch plunge lands at the severance.
 *
 * `frequency` cannot be ramped TO zero: exponentialRampToValueAtTime throws on
 * a zero target, and a linear ramp through DC is a click — the one sound this
 * design cannot afford. So the table's final `hz: 0` is read as "stop tracking"
 * and the plunge lands here instead: far below the passband of any speaker, and
 * arriving under a master gain already on its way to −80 dB. What the ear gets
 * is a pitch collapsing into silence.
 */
const FLOOR_HZ = 8;

/** The q=0 pitch. Oscillators are created here rather than at the Web Audio
 *  default of 440 Hz — see startAudio. */
const BASE_HZ = 34;

// Last values actually SCHEDULED. setTargetAtTime called at frame rate queues
// sixty approaches per second per voice; that is churn on the audio thread for
// a parameter that has not moved, and the overwhelming majority of frames in a
// session are frames where the user is not scrolling.
let lastHz = -1;
let lastAir = -1;
let lastGain = -1;

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
    // SEED THE PITCH. An OscillatorNode defaults to 440 Hz — a plainly audible
    // A4. Left at the default, the first updateAudio would glide it down to
    // 34 Hz over ~1 s while the 2.4 s fade-in was still rising, so pressing
    // [ ENTER ] produced a descending whoop before the drone arrived.
    osc.frequency.value = BASE_HZ * ratio;
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

  // Seed the trackers. lastGain in particular MUST start at the fade-in's
  // destination: if updateAudio believes the gain has not yet been set it will
  // schedule its own approach to 0.5 on the very next frame, which overrides
  // the ramp above and collapses a 2.4 s fade into 0.12 s.
  lastGain = 0.5;
  lastHz = BASE_HZ;
  lastAir = -1;
}

/**
 * Called from the ticker. Pure reader of q — never decides anything.
 *
 * The pitch is ONE continuous function of q, read straight out of the
 * continuity table (§3): 34 Hz through Act I, ramping to 42 Hz at the Act III
 * breach, held across the interior, then 36 Hz at the collapse and a plunge
 * into the severance. The table is the authority; nothing here interprets it.
 *
 * ON THE CLOCK: this is driven by gsap.ticker via subscribe(), not by a Zustand
 * subscription. L1 allows exactly one requestAnimationFrame in the application
 * and the ticker owns it; q is deliberately NOT in the store, because writing a
 * value that changes every frame into Zustand re-renders the React tree at
 * frame rate and the 60 fps budget in §9.1 is a hard gate. The ticker path
 * delivers the same per-frame q to this function with none of that cost.
 */
export function updateAudio(q: number): void {
  if (!engine || engine.muted) return;
  const { ctx, voices, noiseFilter, master } = engine;
  const c = continuityAt(q);
  const now = ctx.currentTime;

  // ── GAIN ──────────────────────────────────────────────────────────────────
  // THE SEVERANCE (§5 Act IV). Exponential to near-zero over 140ms — fast
  // enough to read as a vault sealing, slow enough to avoid a digital pop.
  // setTargetAtTime rather than linearRamp because the ear hears amplitude
  // logarithmically, so a linear fade sounds like it stops early.
  const gain = c.hz <= 0 ? 0.0001 : 0.5;
  if (gain !== lastGain) {
    master.gain.setTargetAtTime(gain, now, c.hz <= 0 ? 0.045 : 0.12);
    lastGain = gain;
  }

  // ── PITCH ─────────────────────────────────────────────────────────────────
  const hz = Math.max(c.hz, FLOOR_HZ);

  // Re-target only on real movement. The threshold is small enough that an
  // active scroll re-targets every frame — during the Act I to Act III ramp q
  // moves the pitch by ~0.01 Hz per frame — while a stationary reader schedules
  // nothing at all.
  if (Math.abs(hz - lastHz) > 0.004) {
    // Glide rather than jump. A stepped pitch change on a sustained sine is a
    // chirp; 0.35s of time constant makes 34 -> 42 Hz read as pressure changing
    // rather than as a new note starting.
    //
    // The constant tightens for the severance. Holding 0.35 s across the
    // collapse would smear the drop into a slow sag; at 0.05 s the same table
    // values read as the plunge §5 Act IV asks for.
    const tau = q >= 0.955 ? 0.05 : 0.35;
    for (const v of voices) {
      // Harmonics track the fundamental, always. ratio 2 and 3 are what carry
      // the sub on hardware that cannot reproduce it (see the header): at the
      // Act I base that is 68 and 102 Hz, at the Act III breach 84 and 126 Hz.
      v.osc.frequency.setTargetAtTime(hz * v.ratio, now, tau);
    }
    lastHz = hz;
  }

  // ── AIR ───────────────────────────────────────────────────────────────────
  // The air closes down as the camera enters the building — acoustic isolation,
  // not a mute. Exterior 420 Hz, interior ~180 Hz.
  const air = q < 0.64 ? 420 : 180;
  if (air !== lastAir) {
    noiseFilter.frequency.setTargetAtTime(air, now, 0.5);
    lastAir = air;
  }
}

/**
 * State for the dev handle.
 *
 * `sounding` is what the oscillators are producing RIGHT NOW; `target` is what
 * updateAudio last scheduled. The two differ, and the distinction matters when
 * reading this:
 *
 * setTargetAtTime schedules an approach along the AudioContext's own timeline,
 * so `frequency.value` only advances as `ctx.currentTime` advances. In a
 * SUSPENDED context — which is every context before the [ ENTER ] gesture —
 * currentTime is frozen, so `sounding` never leaves its seeded value no matter
 * what q is fed in. Reading only `sounding` makes a perfectly working pitch
 * ramp look like a drone stuck at 34 Hz.
 */
export function audioState(): {
  sounding: number;
  soundingHarmonics: number[];
  target: number;
  targetHarmonics: number[];
  gain: number;
  ctxState: AudioContextState;
  ctxTime: number;
} | null {
  if (!engine) return null;
  return {
    sounding: engine.voices[0]?.osc.frequency.value ?? 0,
    soundingHarmonics: engine.voices.map((v) => v.osc.frequency.value),
    target: lastHz,
    targetHarmonics: engine.voices.map((v) => lastHz * v.ratio),
    gain: engine.master.gain.value,
    ctxState: engine.ctx.state,
    ctxTime: engine.ctx.currentTime,
  };
}

/** Dev only: let the verification harness advance the audio clock. */
export function resumeAudio(): Promise<void> | undefined {
  return engine?.ctx.resume();
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
  lastHz = -1; lastAir = -1; lastGain = -1;
}
