// Single-player modes where every word is checked immediately (no bluffing):
//  - score:    60 seconds on one word, name as many synonyms as you can; wrong guesses cost 2s.
//  - daily:    same as score, but everyone in the world gets the same word each day.
//  - survival: a new word after every correct answer, with less time each round; one miss ends it.

import type { Rng } from './engine';
import { findSynonym, isSameWord, type Forgiveness } from './match';
import { STARTERS, startersForTier, type StarterWord, type Tier } from './words';

export type SoloMode = 'score' | 'daily' | 'survival';

export const SCORE_MS = 60_000;
export const WRONG_PENALTY_MS = 2_000;

export interface SoloState {
  mode: SoloMode;
  forgiveness: Forgiveness;
  tier: Tier;
  starter: StarterWord;
  usedStarters: string[];
  /** Canonical synonyms found for the current starter. */
  found: string[];
  /** Wrong guesses for the current starter (so repeating one doesn't cost time twice). */
  tried: string[];
  score: number;
  round: number;
  /** When the clock runs out (ms timestamp). */
  deadline: number;
  /** Length of the current round's clock, for drawing the timer bar. */
  roundMs: number;
  over: boolean;
  endReason: 'time' | 'wrong' | null;
  /** The word that ended a survival run. */
  lastWrong: string | null;
}

export type GuessResult = 'ok' | 'repeat' | 'wrong' | 'starter' | 'empty';

/** Survival gets faster: 10s, then 0.4s less per round, never below 4s. */
export function survivalMs(round: number): number {
  return Math.max(4_000, 10_000 - (round - 1) * 400);
}

/** Survival ramps difficulty: easy words first, then medium, then hard. */
function survivalTier(round: number): Tier {
  return round <= 5 ? 'easy' : round <= 12 ? 'medium' : 'hard';
}

/** "2026-10-07" in the player's local time. */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Same word for everyone on a given date. */
export function dailyStarter(dateKey: string): StarterWord {
  let h = 0;
  for (const c of dateKey) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // Mix the bits so consecutive days don't land on neighbouring words.
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return STARTERS[h % STARTERS.length];
}

function pickFrom(pool: StarterWord[], used: string[], rng: Rng): StarterWord {
  const fresh = pool.filter((s) => !used.includes(s.word));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(rng() * from.length)];
}

export function createSolo(
  mode: SoloMode,
  opts: { tier: Tier; forgiveness: Forgiveness; dateKey?: string },
  rng: Rng,
  now: number,
): SoloState {
  const tier = mode === 'survival' ? survivalTier(1) : opts.tier;
  const starter = mode === 'daily' ? dailyStarter(opts.dateKey ?? todayKey()) : pickFrom(startersForTier(tier), [], rng);
  const roundMs = mode === 'survival' ? survivalMs(1) : SCORE_MS;
  return {
    mode,
    // The daily puzzle uses fixed rules so everyone's score is comparable.
    forgiveness: mode === 'daily' ? 'typos' : opts.forgiveness,
    tier: starter.tier,
    starter,
    usedStarters: [starter.word],
    found: [],
    tried: [],
    score: 0,
    round: 1,
    deadline: now + roundMs,
    roundMs,
    over: false,
    endReason: null,
    lastWrong: null,
  };
}

export function soloTimeLeft(s: SoloState, now: number): number {
  return Math.max(0, s.deadline - now);
}

/** End the run if the clock has run out. */
export function tickSolo(s: SoloState, now: number): SoloState {
  if (s.over || now < s.deadline) return s;
  return { ...s, over: true, endReason: 'time' };
}

/**
 * If `raw` repeats an earlier guess for this word, return that guess and whether it was correct.
 * Matches other forms and spellings too ("joyfully" after "joyful").
 */
export function findSoloRepeat(s: SoloState, raw: string): { word: string; correct: boolean } | null {
  const word = raw.trim();
  if (!/[a-z]{2,}/i.test(word)) return null;
  const canonical = findSynonym(word, s.starter, s.forgiveness);
  if (canonical && s.found.includes(canonical)) return { word: canonical, correct: true };
  const wrong = s.tried.find((t) => isSameWord(word, t, s.forgiveness));
  return wrong ? { word: wrong, correct: false } : null;
}

export function guessSolo(
  s: SoloState,
  raw: string,
  now: number,
  rng: Rng,
): { state: SoloState; result: GuessResult; canonical: string | null } {
  const word = raw.trim();
  if (s.over) return { state: s, result: 'empty', canonical: null };
  if (!/[a-z]{2,}/i.test(word)) return { state: s, result: 'empty', canonical: null };
  if (isSameWord(word, s.starter.word, s.forgiveness)) return { state: s, result: 'starter', canonical: null };

  if (findSoloRepeat(s, word)) return { state: s, result: 'repeat', canonical: null };
  const canonical = findSynonym(word, s.starter, s.forgiveness);
  if (!canonical) {
    if (s.mode === 'survival') {
      return { state: { ...s, over: true, endReason: 'wrong', lastWrong: word }, result: 'wrong', canonical: null };
    }
    const tried = [...s.tried, word.toLowerCase()];
    return { state: { ...s, tried, deadline: s.deadline - WRONG_PENALTY_MS }, result: 'wrong', canonical: null };
  }

  if (s.mode === 'survival') {
    const round = s.round + 1;
    const tier = survivalTier(round);
    const starter = pickFrom(startersForTier(tier), s.usedStarters, rng);
    const roundMs = survivalMs(round);
    return {
      result: 'ok',
      canonical,
      state: {
        ...s,
        score: s.score + 1,
        round,
        tier,
        starter,
        usedStarters: [...s.usedStarters, starter.word],
        found: [],
        tried: [],
        deadline: now + roundMs,
        roundMs,
      },
    };
  }
  return { result: 'ok', canonical, state: { ...s, score: s.score + 1, found: [...s.found, canonical] } };
}
