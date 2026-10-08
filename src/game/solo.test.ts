import { describe, expect, it } from 'vitest';
import { createSolo, dailyStarter, findSoloRepeat, guessSolo, survivalMs, tickSolo, type SoloState } from './solo.ts';
import { HAPPY } from './testFixtures.ts';

const rng = () => 0;
const happy = HAPPY;
function score(): SoloState {
  return { ...createSolo('score', { tier: 'easy', forgiveness: 'strict', range: 'standard' }, rng, 0), starter: happy };
}

describe('score attack', () => {
  it('scores new synonyms and rejects repeats', () => {
    let s = guessSolo(score(), 'glad', 1, rng).state;
    expect(s.score).toBe(1);
    const r = guessSolo(s, 'Glad', 2, rng);
    expect(r.result).toBe('repeat');
    s = guessSolo(s, 'joyfully', 3, rng).state;
    expect(guessSolo(s, 'joyful', 4, rng).result).toBe('repeat');
  });
  it('wrong guesses cost time, not the game', () => {
    const r = guessSolo(score(), 'banana', 1, rng);
    expect(r.result).toBe('wrong');
    expect(r.state.over).toBe(false);
    expect(r.state.deadline).toBe(58_000);
  });
  it('flags repeats of right and wrong guesses, without a second penalty', () => {
    let s = guessSolo(score(), 'joyful', 1, rng).state;
    expect(findSoloRepeat(s, 'joyfully')).toEqual({ word: 'joyful', correct: true });
    s = guessSolo(s, 'Banana', 2, rng).state;
    expect(findSoloRepeat(s, 'banana ')).toEqual({ word: 'banana', correct: false });
    const again = guessSolo(s, 'banana', 3, rng);
    expect(again.result).toBe('repeat');
    expect(again.state.deadline).toBe(s.deadline);
    expect(findSoloRepeat(s, 'glad')).toBeNull();
  });
  it('rare words are worth more points', () => {
    let s = guessSolo(score(), 'gleeful', 1, rng).state; // uncommon: 2 points
    expect(s.score).toBe(2);
    s = guessSolo(s, 'glad', 2, rng).state; // common: 1 point
    expect(s.score).toBe(3);
  });
  it('a distant synonym is out of range in a Standard game, but says so', () => {
    const r = guessSolo(score(), 'upbeat', 1, rng);
    expect(r.result).toBe('wrong');
    expect(r.entry).toMatchObject({ word: 'upbeat', closeness: 3 });
  });
  it('ends when time runs out', () => {
    expect(tickSolo(score(), 60_000).over).toBe(true);
  });
});

describe('survival', () => {
  it('moves to a new word after each correct answer and ends on a miss', () => {
    let s = createSolo('survival', { tier: 'hard', forgiveness: 'strict', range: 'standard' }, rng, 0);
    expect(s.tier).toBe('easy');
    const first = s.starter;
    s = guessSolo(s, first.synonyms.find((x) => x.closeness === 1)!.word, 1000, rng).state;
    expect(s.round).toBe(2);
    expect(s.starter.word).not.toBe(first.word);
    expect(s.deadline).toBe(1000 + survivalMs(2));
    const miss = guessSolo(s, 'zzzz', 2000, rng);
    expect(miss.state.over).toBe(true);
    expect(miss.state.endReason).toBe('wrong');
  });
  it('speeds up but never below 4s', () => {
    expect(survivalMs(1)).toBe(10_000);
    expect(survivalMs(100)).toBe(4_000);
  });
});

describe('daily', () => {
  it('is the same word all day and changes between days', () => {
    expect(dailyStarter('2026-10-07').word).toBe(dailyStarter('2026-10-07').word);
    const week = new Set(['01', '02', '03', '04', '05', '06', '07'].map((d) => dailyStarter(`2026-10-${d}`).word));
    expect(week.size).toBeGreaterThan(4);
  });
});
