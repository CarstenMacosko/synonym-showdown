// Ambient lobby music, synthesized live (no audio files). Each screen asks for a track with useMusic();
// tracks crossfade, stay quiet, pause when the tab is hidden, and only start after the player's first
// tap or key press (browsers block sound before that).

import { useEffect } from 'react';
import { TRACKS, type Drum, type Instrument, type Track, type TrackName } from './musicTracks';
import { isMuted } from './sound';

const VOLUME = 0.32; // relative to the master gain below; the whole mix is kept subtle
const MASTER = 0.22;
const LOOKAHEAD_S = 0.2;
const TICK_MS = 50;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let echo: GainNode | null = null;
let noise: AudioBuffer | null = null;
let meter: AnalyserNode | null = null;

let wanted: TrackName | null = null;
let playing: { name: TrackName; track: Track; bus: GainNode; nextTime: number; step: number } | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let unlocked = false;
let enabled = true;
try {
  enabled = localStorage.getItem('ss-music') !== '0';
} catch {
  /* storage unavailable */
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function setup(): AudioContext {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = MASTER;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  meter = ctx.createAnalyser();
  meter.fftSize = 2048;
  comp.connect(meter);
  // A soft echo send for ambience.
  echo = ctx.createGain();
  echo.gain.value = 0.22;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.36;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1800;
  echo.connect(delay).connect(tone).connect(feedback).connect(delay);
  tone.connect(master);
  // White noise for drums.
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

// ---------- instruments ----------

function voice(bus: GainNode, type: OscillatorType, freq: number, t: number, dur: number, vol: number, attack: number, opts: { filter?: number; send?: number; detune?: number } = {}) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  if (opts.detune) osc.detune.value = opts.detune;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out: AudioNode = g;
  if (opts.filter) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.filter;
    g.connect(f);
    out = f;
  }
  osc.connect(g);
  out.connect(bus);
  if (opts.send && echo) {
    const s = c.createGain();
    s.gain.value = opts.send;
    out.connect(s).connect(echo);
  }
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function play(bus: GainNode, inst: Instrument, midi: number, t: number, dur: number) {
  const f = hz(midi);
  switch (inst) {
    case 'pad':
      voice(bus, 'triangle', f, t, dur + 0.4, 0.05, Math.min(0.5, dur / 2), { filter: 1200, detune: -6 });
      voice(bus, 'sine', f, t, dur + 0.4, 0.05, Math.min(0.5, dur / 2), { detune: 6 });
      break;
    case 'bass':
      voice(bus, 'triangle', f, t, Math.min(dur, 0.9), 0.22, 0.01, { filter: 500 });
      break;
    case 'lead':
      voice(bus, 'triangle', f, t, dur + 0.15, 0.1, 0.02, { filter: 2600, send: 0.6 });
      break;
    case 'marimba':
      voice(bus, 'sine', f, t, 0.35, 0.11, 0.004);
      voice(bus, 'sine', f * 4, t, 0.08, 0.025, 0.002);
      break;
    case 'musicbox':
      voice(bus, 'sine', f, t, 0.9, 0.1, 0.003, { send: 0.8 });
      voice(bus, 'sine', f * 3, t, 0.25, 0.02, 0.002, { send: 0.5 });
      break;
    case 'epiano':
      voice(bus, 'sine', f, t, 0.5, 0.06, 0.005, { filter: 1600 });
      voice(bus, 'triangle', f * 2, t, 0.2, 0.015, 0.003);
      break;
    case 'vibes':
      voice(bus, 'sine', f, t, dur + 0.5, 0.09, 0.005, { send: 0.7 });
      voice(bus, 'sine', f * 4, t, 0.2, 0.012, 0.003);
      break;
  }
}

function drum(bus: GainNode, kind: Drum, t: number) {
  const c = ctx!;
  if (kind === 'kick') {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + 0.3);
    return;
  }
  if (kind === 'tick') {
    voice(bus, 'square', 2200, t, 0.03, 0.02, 0.001, { filter: 4000 });
    return;
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  const g = c.createGain();
  const [type, freq, vol, len] =
    kind === 'snare' ? (['bandpass', 1800, 0.07, 0.14] as const) : kind === 'hat' ? (['highpass', 7000, 0.035, 0.05] as const) : (['highpass', 5000, 0.025, 0.09] as const);
  f.type = type;
  f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(bus);
  src.start(t);
  src.stop(t + len + 0.02);
}

// ---------- sequencer ----------

function scheduleStep(p: NonNullable<typeof playing>, step: number, t: number) {
  const { track, bus } = p;
  const stepLen = 60 / track.bpm / 4;
  const bar = Math.floor(step / 16) % 8;
  const s = step % 16;
  const chordBar = bar % track.chords.length;
  const chord = track.chords[chordBar];

  // Chords
  if (track.chordStyle === 'pad' && s === 0) for (const n of chord) play(bus, track.chordInstrument, n, t, stepLen * 16);
  if (track.chordStyle === 'arp' && s % 2 === 0) {
    const order = [0, 1, 2, 3, 2, 1, 0, 1];
    play(bus, track.chordInstrument, chord[order[(s / 2) % order.length] % chord.length] + 12, t, stepLen * 2);
  }
  if (track.chordStyle === 'stabs' && (s === 2 || s === 6 || s === 10 || s === 14)) for (const n of chord) play(bus, track.chordInstrument, n, t, stepLen);

  // Bass
  for (const [at, midi, len] of track.bass[chordBar]) if (at === s) play(bus, 'bass', midi, t, len * stepLen);

  // Melody only in the first half of the 8-bar loop.
  if (bar < 4) for (const [at, midi, len] of track.melody[bar]) if (at === s) play(bus, track.lead, midi, t, len * stepLen);

  // Drums: lighter in the second half.
  for (const [at, d] of track.drums) if (at === s && (bar < 4 || d !== 'snare')) drum(bus, d, t);
}

function tick() {
  if (!ctx || !playing) return;
  while (playing.nextTime < ctx.currentTime + LOOKAHEAD_S) {
    scheduleStep(playing, playing.step, playing.nextTime);
    playing.nextTime += 60 / playing.track.bpm / 4;
    playing.step = (playing.step + 1) % (16 * 8);
  }
}

function fadeOut(bus: GainNode) {
  const t = ctx!.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(0, t + 1.2);
  setTimeout(() => bus.disconnect(), 1500);
}

function apply() {
  const target = enabled && !isMuted() && unlocked && document.visibilityState === 'visible' ? wanted : null;
  if (playing?.name === target) return;
  if (playing && ctx) fadeOut(playing.bus);
  playing = null;
  if (!target) {
    if (timer) clearInterval(timer);
    timer = null;
    return;
  }
  const c = setup();
  if (c.state === 'suspended') void c.resume();
  const bus = c.createGain();
  bus.gain.setValueAtTime(0, c.currentTime);
  bus.gain.linearRampToValueAtTime(VOLUME, c.currentTime + 1.5);
  bus.connect(master!);
  playing = { name: target, track: TRACKS[target], bus, nextTime: c.currentTime + 0.1, step: 0 };
  timer ??= setInterval(tick, TICK_MS);
}

/** Start or switch the background track (null = silence, e.g. during a game). */
export function setTrack(name: TrackName | null) {
  wanted = name;
  apply();
}

export function isMusicOn() {
  return enabled;
}

export function setMusicOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem('ss-music', on ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
  apply();
}

/** Re-check after the sound-effects mute changes (muting silences music too). */
export function refreshMusic() {
  apply();
}

/** The track each screen wants; the player's first tap unlocks audio. */
export function useMusic(name: TrackName | null) {
  useEffect(() => {
    setTrack(name);
  }, [name]);
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    apply();
  };
  window.addEventListener('pointerdown', unlock, { once: false, passive: true });
  window.addEventListener('keydown', unlock, { once: false });
  document.addEventListener('visibilitychange', apply);
  // For automated checks: what's playing right now.
  (window as unknown as { __music: () => unknown }).__music = () => {
    let rms = 0;
    let peak = 0;
    if (meter) {
      const buf = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(buf);
      for (const x of buf) {
        rms += x * x;
        peak = Math.max(peak, Math.abs(x));
      }
      rms = Math.sqrt(rms / buf.length);
    }
    return { wanted, playing: playing?.name ?? null, state: ctx?.state ?? 'none', rms, peak };
  };
}
