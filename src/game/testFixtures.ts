// A small, fixed starter word for rule tests, so they don't change whenever the real word data is rebuilt.

import type { StarterWord, Synonym } from './words.ts';

const syn = (word: string, closeness: Synonym['closeness'], sense = 0, rarity: Synonym['rarity'] = 1): Synonym => ({
  word,
  closeness,
  sense,
  rarity,
});

export const HAPPY: StarterWord = {
  word: 'happy',
  tier: 'easy',
  senses: [
    { label: 'glad', definition: 'feeling or showing joy', pos: 'adjective' },
    { label: 'fortunate', definition: 'marked by good fortune', pos: 'adjective' },
  ],
  synonyms: [
    syn('glad', 1),
    syn('joyful', 1),
    syn('cheerful', 1),
    syn('merry', 1),
    syn('jubilant', 1, 0, 2),
    syn('ecstatic', 2),
    syn('gleeful', 2, 0, 2),
    syn('blissful', 2),
    syn('fortunate', 1, 1),
    syn('upbeat', 3),
    syn('mirthful', 3, 0, 3),
  ],
  decoys: ['proud', 'funny', 'friendly'],
};

export const FAST: StarterWord = {
  word: 'fast',
  tier: 'easy',
  senses: [{ label: 'quick', definition: 'moving quickly', pos: 'adjective' }],
  synonyms: [syn('quick', 1), syn('rapid', 1), syn('swift', 1), syn('speedy', 2)],
  decoys: ['early'],
};
