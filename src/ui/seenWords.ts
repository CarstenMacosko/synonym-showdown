// Starter words this device has already been given, so the game can hand out new ones first. Once every word
// at a difficulty has come up, that difficulty starts a fresh cycle.

import { cleanSeen, STARTERS, startersForTier, type SeenCounts } from '../game/words';

const KEY = 'ss-seen';

export function seenWords(): string[] {
  try {
    return cleanSeen(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return [];
  }
}

/** This player's seen words in the shape the word picker takes. */
export function seenCounts(): SeenCounts {
  return Object.fromEntries(seenWords().map((w) => [w, 1]));
}

export function markSeen(word: string) {
  const starter = STARTERS.find((s) => s.word === word);
  if (!starter) return;
  let list = seenWords();
  if (!list.includes(word)) list.push(word);
  // Seen them all at this difficulty? Start over, keeping only this word so it doesn't come straight back.
  const tier = startersForTier(starter.tier).map((s) => s.word);
  if (tier.every((w) => list.includes(w))) list = list.filter((w) => w === word || !tier.includes(w));
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}
