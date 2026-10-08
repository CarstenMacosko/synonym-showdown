// How computer opponents decide what to do on their turn.

import { canChallenge, checkWord, lastPlay, timeLeft, type BotLevel, type GameState, type Player, type Rng } from './engine.ts';
import { findEntry, findSynonym, key } from './match.ts';
import { RANGE_MAX, STARTERS, type Synonym } from './words.ts';

interface Profile {
  /** Share of each synonym list the bot "knows". */
  vocab: number;
  /** Chance to catch a bluff (a word that isn't a synonym). */
  detect: number;
  /** Chance to wrongly challenge a real synonym it doesn't know. */
  suspicion: number;
  /** Chance to bluff even when it still knows a real word. */
  bluff: number;
  /** Thinking time range in ms. */
  think: [number, number];
}

export const BOT_PROFILES: Record<BotLevel, Profile> = {
  easy: { vocab: 0.35, detect: 0.5, suspicion: 0.15, bluff: 0.12, think: [2500, 6500] },
  medium: { vocab: 0.6, detect: 0.75, suspicion: 0.1, bluff: 0.07, think: [1800, 5000] },
  hard: { vocab: 0.88, detect: 0.93, suspicion: 0.05, bluff: 0.04, think: [1200, 3800] },
};

export const BOT_NAMES = ['Thesaurus Rex', 'Lexi', 'Wordsworth', 'Penny', 'Doodle', 'Professor Quill', 'Scribbles', 'Gus'];

export type BotMove = { type: 'say'; word: string } | { type: 'challenge' } | { type: 'stall' };

/** Stable pseudo-random 0..1 from a string, so a bot's vocabulary doesn't change mid-game. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function knows(bot: Player, word: string, rarity: Synonym['rarity'] = 1): boolean {
  const level = bot.botLevel ?? 'medium';
  // Rare words are known less often, like with people.
  const vocab = BOT_PROFILES[level].vocab * (rarity === 3 ? 0.5 : rarity === 2 ? 0.8 : 1);
  return hash01(bot.id + ':' + key(word)) < vocab;
}

function pick<T>(arr: T[], rng: Rng): T | undefined {
  return arr.length ? arr[Math.floor(rng() * arr.length)] : undefined;
}

/** Real synonyms this bot knows that haven't been said yet (core and solid ones only, even in Loose games). */
function knownFreshWords(state: GameState, bot: Player): string[] {
  const max = Math.min(2, RANGE_MAX[state.settings.range]);
  return state.starter.synonyms
    .filter((s) => s.closeness <= max && knows(bot, s.word, s.rarity) && checkWord(state, s.word) === null)
    .map((s) => s.word);
}

/** Plausible-sounding wrong words: the starter's decoys, then synonyms of other words. */
function bluffWords(state: GameState): string[] {
  const own = state.starter.decoys.filter((w) => checkWord(state, w) === null && !findEntry(w, state.starter, 'strict'));
  if (own.length) return own;
  return STARTERS.flatMap((s) => s.decoys).filter(
    (w) => checkWord(state, w) === null && !findEntry(w, state.starter, 'strict'),
  );
}

export function decideBotMove(state: GameState, bot: Player, rng: Rng): BotMove {
  const p = BOT_PROFILES[bot.botLevel ?? 'medium'];
  const fresh = knownFreshWords(state, bot);

  if (canChallenge(state)) {
    const prev = lastPlay(state)!;
    const isReal = findSynonym(prev.word, state.starter, state.settings.forgiveness, state.settings.range) !== null;
    const rarity = findEntry(prev.word, state.starter, state.settings.forgiveness)?.rarity;
    let chance: number;
    if (!isReal) chance = p.detect;
    else if (knows(bot, prev.word, rarity)) chance = 0.01;
    else chance = p.suspicion;
    // Running out of words makes a bot desperate enough to gamble on a challenge.
    if (fresh.length === 0) chance = Math.min(0.95, chance + 0.35);
    if (rng() < chance) return { type: 'challenge' };
  }

  const word = fresh.length && rng() >= p.bluff ? pick(fresh, rng) : pick(bluffWords(state), rng) ?? pick(fresh, rng);
  return word ? { type: 'say', word } : { type: 'stall' };
}

/** How long the bot "thinks" before moving; usually inside its time, occasionally cutting it close. */
export function botThinkMs(state: GameState, bot: Player, rng: Rng, now: number): number {
  const [lo, hi] = BOT_PROFILES[bot.botLevel ?? 'medium'].think;
  const want = lo + rng() * (hi - lo);
  const left = timeLeft(state, now);
  return Math.max(400, Math.min(want, left * 0.8));
}
