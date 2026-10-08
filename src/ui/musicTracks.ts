// The ambient tracks, written as note data (MIDI numbers: 60 = middle C). music.ts plays them with
// synthesized instruments. Each loop is 8 bars: 4 with the melody, then 4 of just the backing, so the hook
// stays catchy without getting repetitive.

export type Instrument = 'pad' | 'bass' | 'lead' | 'marimba' | 'musicbox' | 'epiano' | 'vibes';
export type Drum = 'kick' | 'snare' | 'hat' | 'shaker' | 'tick';

/** [step within the bar (16ths), midi note, length in 16ths] */
export type Note = [number, number, number];

export interface Track {
  title: string;
  bpm: number;
  /** One chord per bar (repeats); notes held as a soft pad. */
  chords: number[][];
  /** How the chord is played: held pad, arpeggio, or short off-beat stabs. */
  chordStyle: 'pad' | 'arp' | 'stabs';
  chordInstrument: Instrument;
  /** Bass notes per bar. */
  bass: Note[][];
  /** Melody per bar (first 4 bars of the 8-bar loop). */
  melody: Note[][];
  lead: Instrument;
  /** Drum hits per bar: [step, drum]. */
  drums: [number, Drum][];
}

const C = { C2: 36, D2: 38, E2: 40, F2: 41, G2: 43, A2: 45, Bb2: 46, B2: 47, C3: 48, D3: 50, E3: 52, F3: 53, G3: 55 };

export const TRACKS = {
  /** Home menu: warm, breezy, C major. */
  home: {
    title: 'Paper Planes',
    bpm: 92,
    chords: [
      [48, 52, 55, 60],
      [43, 50, 55, 59],
      [45, 52, 57, 60],
      [41, 48, 53, 57],
    ],
    chordStyle: 'pad',
    chordInstrument: 'pad',
    bass: [
      [[0, C.C2, 6], [8, C.G2, 4], [12, C.C3, 2]],
      [[0, C.G2 - 12, 6], [8, C.D2, 4], [12, C.G2, 2]],
      [[0, C.A2 - 12, 6], [8, C.E2, 4], [12, C.A2, 2]],
      [[0, C.F2, 6], [8, C.C2, 4], [12, C.F2, 2]],
    ],
    melody: [
      [[0, 76, 2], [2, 79, 2], [4, 81, 2], [6, 79, 4], [12, 76, 2], [14, 74, 2]],
      [[0, 74, 2], [2, 76, 2], [4, 74, 4], [8, 71, 2], [10, 67, 6]],
      [[0, 72, 2], [2, 76, 2], [4, 81, 4], [8, 79, 2], [10, 76, 2], [12, 79, 4]],
      [[0, 81, 2], [2, 79, 2], [4, 77, 4], [8, 76, 2], [10, 72, 6]],
    ],
    lead: 'lead',
    drums: [[0, 'kick'], [2, 'shaker'], [6, 'shaker'], [8, 'kick'], [10, 'shaker'], [14, 'shaker']],
  },
  /** Friends' room lobby: bouncy marimba, F major, walking bass. */
  room: {
    title: 'Tea Party',
    bpm: 104,
    chords: [
      [55, 58, 62, 65],
      [55, 58, 60, 64],
      [53, 57, 60, 64],
      [50, 57, 60, 65],
    ],
    chordStyle: 'arp',
    chordInstrument: 'marimba',
    bass: [
      [[0, C.G2, 3], [4, C.Bb2, 3], [8, C.D3, 3], [12, C.F3, 3]],
      [[0, C.C2, 3], [4, C.E2, 3], [8, C.G2, 3], [12, C.Bb2, 3]],
      [[0, C.F2, 3], [4, C.A2, 3], [8, C.C3, 3], [12, C.E3, 3]],
      [[0, C.D2, 3], [4, C.F2, 3], [8, C.A2, 3], [12, C.C3, 3]],
    ],
    melody: [
      [[0, 74, 3], [3, 77, 1], [4, 79, 4], [10, 77, 2], [12, 74, 4]],
      [[0, 76, 2], [2, 79, 2], [4, 82, 4], [10, 81, 2], [12, 79, 4]],
      [[0, 81, 4], [4, 84, 2], [6, 81, 2], [8, 77, 8]],
      [[0, 77, 2], [2, 76, 2], [4, 74, 4], [8, 72, 2], [10, 69, 6]],
    ],
    lead: 'vibes',
    drums: [[0, 'kick'], [2, 'hat'], [4, 'snare'], [6, 'hat'], [8, 'kick'], [10, 'hat'], [12, 'snare'], [14, 'hat']],
  },
  /** Ranked queue: a ticking clock and a music box, A minor, a little suspense. */
  ranked: {
    title: 'Pencils Ready',
    bpm: 84,
    chords: [
      [57, 60, 64],
      [57, 60, 65],
      [55, 60, 64],
      [55, 59, 62],
    ],
    chordStyle: 'pad',
    chordInstrument: 'pad',
    bass: [
      [[0, 45, 2], [2, 45, 2], [4, 45, 2], [6, 45, 2], [8, 45, 2], [10, 45, 2], [12, 45, 2], [14, 45, 2]],
      [[0, 41, 2], [2, 41, 2], [4, 41, 2], [6, 41, 2], [8, 41, 2], [10, 41, 2], [12, 41, 2], [14, 41, 2]],
      [[0, 48, 2], [2, 48, 2], [4, 48, 2], [6, 48, 2], [8, 48, 2], [10, 48, 2], [12, 48, 2], [14, 48, 2]],
      [[0, 43, 2], [2, 43, 2], [4, 43, 2], [6, 43, 2], [8, 43, 2], [10, 43, 2], [12, 43, 2], [14, 43, 2]],
    ],
    melody: [
      [[0, 88, 2], [4, 84, 2], [8, 81, 2], [12, 83, 2]],
      [[0, 84, 2], [4, 81, 2], [8, 77, 4]],
      [[0, 79, 2], [4, 84, 2], [8, 88, 2], [12, 86, 2]],
      [[0, 83, 2], [4, 79, 2], [8, 74, 6]],
    ],
    lead: 'musicbox',
    drums: [[0, 'tick'], [4, 'tick'], [8, 'tick'], [12, 'tick'], [0, 'kick'], [8, 'kick']],
  },
  /** Profile & admin: lo-fi electric piano, G major. */
  studio: {
    title: 'Doodle Studio',
    bpm: 100,
    chords: [
      [55, 59, 62, 66],
      [52, 55, 59, 62],
      [48, 52, 55, 59],
      [50, 54, 57, 62],
    ],
    chordStyle: 'stabs',
    chordInstrument: 'epiano',
    bass: [
      [[0, C.G2, 7], [8, C.G2, 6]],
      [[0, C.E2, 7], [8, C.E2, 6]],
      [[0, C.C2, 7], [8, C.C2, 6]],
      [[0, C.D2, 7], [8, C.D2, 6]],
    ],
    melody: [
      [[0, 83, 2], [2, 86, 2], [4, 83, 2], [6, 81, 4], [12, 79, 4]],
      [[0, 76, 4], [4, 79, 2], [6, 83, 2], [8, 81, 8]],
      [[0, 76, 2], [2, 79, 2], [4, 83, 4], [8, 84, 2], [10, 83, 2], [12, 79, 4]],
      [[0, 81, 2], [2, 78, 2], [4, 74, 4], [8, 81, 2], [10, 79, 6]],
    ],
    lead: 'vibes',
    drums: [[0, 'kick'], [4, 'snare'], [6, 'hat'], [10, 'kick'], [12, 'snare'], [14, 'hat'], [2, 'hat']],
  },
} satisfies Record<string, Track>;

export type TrackName = keyof typeof TRACKS;
