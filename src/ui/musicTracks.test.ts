import { describe, expect, it } from 'vitest';
import { TRACKS } from './musicTracks';

describe('music tracks', () => {
  for (const [name, t] of Object.entries(TRACKS)) {
    it(`${name} ("${t.title}") is well-formed`, () => {
      expect(t.bpm).toBeGreaterThan(60);
      expect(t.bpm).toBeLessThan(140);
      expect(t.chords).toHaveLength(4);
      expect(t.bass).toHaveLength(4);
      expect(t.melody).toHaveLength(4);
      for (const bar of [...t.bass, ...t.melody]) {
        for (const [step, midi, len] of bar) {
          expect(step).toBeGreaterThanOrEqual(0);
          expect(step).toBeLessThan(16);
          expect(midi).toBeGreaterThan(20);
          expect(midi).toBeLessThan(100);
          expect(len).toBeGreaterThan(0);
          expect(step + len).toBeLessThanOrEqual(16); // notes end within their bar
        }
      }
      for (const [step] of t.drums) expect(step).toBeLessThan(16);
    });
  }
  it('every lobby has its own track', () => {
    expect(new Set(Object.values(TRACKS).map((t) => t.title)).size).toBe(Object.keys(TRACKS).length);
  });
});
