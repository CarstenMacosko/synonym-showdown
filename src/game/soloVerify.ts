// Server-side check of a finished solo run. The browser sends what the player typed and when;
// the server replays it with the real rules and computes the score itself, so a tampered client
// can't claim points it didn't earn. The same replay feeds the cheat detector.

import type { Forgiveness } from './match.ts';
import { createSolo, dailyStarter, guessSolo, survivalTier, tickSolo, type SoloMode, type SoloState } from './solo.ts';
import type { WordStat } from './suspicion.ts';
import { STARTERS, type Range, type StarterWord, type Tier } from './words.ts';

export interface SoloRound {
  starter: string;
  /** Words typed during this round, with ms since the run started. */
  guesses: { word: string; t: number }[];
}

export interface SoloSubmission {
  mode: SoloMode;
  tier: Tier;
  range: Range;
  forgiveness: Forgiveness;
  dateKey?: string;
  rounds: SoloRound[];
}

export type VerifiedRun =
  | { ok: true; score: number; words: number; variant: string; day: string | null; wordStats: WordStat[] }
  | { ok: false; error: string };

const MAX_GUESSES = 400;
const MODES: SoloMode[] = ['score', 'daily', 'survival'];
const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const RANGES: Range[] = ['close', 'standard', 'loose'];
const FORGIVENESS: Forgiveness[] = ['strict', 'typos', 'soundalike'];

const byWord = new Map(STARTERS.map((s) => [s.word, s]));

/**
 * @param allowedDays daily-word dates the server accepts right now (today, plus yesterday/tomorrow for time zones)
 */
export function verifySoloRun(sub: SoloSubmission, allowedDays: string[]): VerifiedRun {
  const fail = (error: string): VerifiedRun => ({ ok: false, error });
  if (!sub || !MODES.includes(sub.mode) || !TIERS.includes(sub.tier) || !RANGES.includes(sub.range)) return fail('bad settings');
  if (!FORGIVENESS.includes(sub.forgiveness) || !Array.isArray(sub.rounds) || !sub.rounds.length) return fail('bad run');
  const total = sub.rounds.reduce((n, r) => n + (Array.isArray(r.guesses) ? r.guesses.length : 0), 0);
  if (total > MAX_GUESSES) return fail('too many guesses');

  const starters: StarterWord[] = [];
  for (const r of sub.rounds) {
    const s = byWord.get(r.starter);
    if (!s || !Array.isArray(r.guesses)) return fail('unknown starter');
    if (starters.includes(s)) return fail('repeated starter');
    starters.push(s);
  }
  if (sub.mode !== 'survival' && sub.rounds.length !== 1) return fail('one word per run');
  if (sub.mode === 'score' && starters[0].tier !== sub.tier) return fail('wrong tier');
  if (sub.mode === 'daily') {
    if (!sub.dateKey || !allowedDays.includes(sub.dateKey)) return fail('wrong day');
    if (dailyStarter(sub.dateKey).word !== starters[0].word) return fail('not the daily word');
  }
  if (sub.mode === 'survival' && starters.some((s, i) => s.tier !== survivalTier(i + 1))) return fail('wrong survival word');

  const rng = () => 0;
  let state: SoloState = createSolo(sub.mode, { tier: sub.tier, forgiveness: sub.forgiveness, range: sub.range, dateKey: sub.dateKey }, rng, 0);
  state = { ...state, starter: starters[0], usedStarters: [starters[0].word], tier: starters[0].tier };

  const wordStats: WordStat[] = [];
  let lastT = 0;
  let words = 0;
  for (let r = 0; r < sub.rounds.length; r++) {
    const guesses = sub.rounds[r].guesses;
    for (let i = 0; i < guesses.length; i++) {
      const { word, t } = guesses[i];
      if (typeof word !== 'string' || word.length > 40 || typeof t !== 'number' || !(t >= lastT)) return fail('bad guess');
      state = tickSolo(state, t);
      if (state.over) return fail('guess after time ran out');
      const out = guessSolo(state, word, t, rng);
      if (out.result === 'empty' || out.result === 'starter' || out.result === 'repeat') {
        lastT = t;
        state = out.state;
        continue; // the client blocks these; harmless either way
      }
      wordStats.push({ valid: out.result === 'ok', rarity: out.result === 'ok' ? out.entry!.rarity : null, ms: t - lastT });
      lastT = t;
      state = out.state;
      if (out.result === 'ok') words++;
      if (sub.mode === 'survival' && out.result === 'ok') {
        // A correct answer ends the round; the next round must start with the next submitted word.
        if (i !== guesses.length - 1) return fail('guesses after a correct survival answer');
        const next = starters[r + 1];
        if (next) state = { ...state, starter: next, tier: next.tier, usedStarters: [...state.usedStarters.slice(0, -1), next.word] };
      }
      if (state.over) break;
    }
    if (state.over) break;
  }

  const variant = sub.mode === 'daily' ? 'daily' : sub.mode === 'score' ? `${sub.tier}-${sub.forgiveness}-${sub.range}` : `${sub.forgiveness}-${sub.range}`;
  return { ok: true, score: state.score, words, variant, day: sub.mode === 'daily' ? sub.dateKey! : null, wordStats };
}
