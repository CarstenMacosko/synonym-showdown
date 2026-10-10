// One shared audio engine for music and sound effects, plus the tricks phones need to make web audio work:
//
//  - iPhones mute web audio when the ringer/silent switch is on, unless the page uses "playback" audio
//    (the same kind as videos). Newer iOS supports navigator.audioSession for this; older iOS needs a
//    silent <audio> element playing in the background.
//  - Browsers only allow sound after a tap, and iPhones need the audio started and a tiny silent sound
//    played *during* that tap to fully unlock it.
//  - Phones pause audio for calls, Siri, notifications and locking, so every tap resumes it.

let ctx: AudioContext | null = null;
let primed = false;
let silentTag: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

/** The shared AudioContext (created on first use). */
export function audioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

/** Called after every tap/key press (music uses it to start or switch tracks). */
export function onUserGesture(fn: () => void) {
  listeners.add(fn);
}

/** A tiny silent WAV, built in code (no file needed). */
function silentWav(): string {
  const rate = 8000;
  const samples = rate / 2; // half a second
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples * 2, true);
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return 'data:audio/wav;base64,' + btoa(bin);
}

function useMediaPlayback() {
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session) {
    // iOS 17+ / Safari: play like a video, even with the silent switch on.
    session.type = 'playback';
    return;
  }
  // Older iPhones: a looping silent <audio> element switches the page to playback audio.
  if (!silentTag && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    silentTag = document.createElement('audio');
    silentTag.src = silentWav();
    silentTag.loop = true;
    silentTag.setAttribute('playsinline', '');
    silentTag.volume = 0.01;
  }
  if (silentTag && document.visibilityState === 'visible') void silentTag.play().catch(() => {});
}

function onGesture() {
  try {
    useMediaPlayback();
    const c = audioContext();
    if (c.state !== 'running') void c.resume().catch(() => {});
    if (!primed) {
      // Play one silent sample inside the tap: this is what fully unlocks web audio on iPhones.
      const b = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = b;
      src.connect(c.destination);
      src.start(0);
      primed = true;
    }
  } catch {
    /* no web audio on this device */
  }
  for (const fn of listeners) fn();
}

if (typeof window !== 'undefined') {
  // Browsers grant sound permission on different events (a touch counts when the finger lifts), so
  // listen to all of them.
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const) {
    window.addEventListener(type, onGesture, { passive: true, capture: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
      if (silentTag) void silentTag.play().catch(() => {});
    } else silentTag?.pause();
  });
}
