// Tiny synthesized sound effects (no audio files needed).

import { audioContext } from './audio';

let muted = false;
try {
  muted = localStorage.getItem('ss-muted') === '1';
} catch {
  /* storage unavailable */
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('ss-muted', m ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

function tone(freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.12, slideTo?: number, delay = 0) {
  if (muted) return;
  try {
    const ctx = audioContext();
    // Sound effects play right after taps, so this is allowed even if the system had paused audio.
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    const t = ctx.currentTime + delay / 1000;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + ms / 1000);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000);
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  pop: () => tone(520, 90, 'triangle', 0.15, 880),
  tick: () => tone(1200, 30, 'square', 0.04),
  error: () => tone(180, 160, 'sawtooth', 0.08, 120),
  challenge: () => {
    tone(330, 120, 'square', 0.08);
    tone(440, 160, 'square', 0.08, undefined, 110);
  },
  good: () => {
    tone(523, 120, 'triangle', 0.14);
    tone(659, 120, 'triangle', 0.14, undefined, 100);
    tone(784, 220, 'triangle', 0.14, undefined, 200);
  },
  bad: () => tone(300, 400, 'sawtooth', 0.09, 90),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 200, 'triangle', 0.14, undefined, i * 120)),
};
