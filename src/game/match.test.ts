import { describe, expect, it } from 'vitest';
import { findEntry, findSynonym as find, isSameWord, soundKey, stem } from './match.ts';
import { FAST as fast, HAPPY as happy } from './testFixtures.ts';
import { STARTERS, type Range, type StarterWord } from './words.ts';
import type { Forgiveness } from './match.ts';

const findSynonym = (guess: string, starter: StarterWord, f: Forgiveness, range: Range = 'loose') => find(guess, starter, f, range);

describe('word forms', () => {
  it('treats forms of one word as the same', () => {
    expect(stem('joyfully')).toBe(stem('joyful'));
    expect(stem('happily')).toBe(stem('happy'));
    expect(stem('happiness')).toBe(stem('happier'));
    expect(stem('bigger')).toBe(stem('big'));
  });
  it('accepts forms of a synonym', () => {
    expect(findSynonym('joyfully', happy, 'strict')).toBe('joyful');
    expect(findSynonym('Cheerful', happy, 'strict')).toBe('cheerful');
    expect(findSynonym('quicker', fast, 'strict')).toBe('quick');
  });
  it('rejects non-synonyms', () => {
    expect(findSynonym('lucky', happy, 'strict')).toBeNull();
    expect(findSynonym('sad', happy, 'soundalike')).toBeNull();
  });
});

describe('spelling forgiveness', () => {
  it('strict rejects typos', () => {
    expect(findSynonym('cheerfull', happy, 'strict')).toBeNull();
  });
  it('typos mode accepts small typos on longer words', () => {
    expect(findSynonym('cheerfull', happy, 'typos')).toBe('cheerful');
    expect(findSynonym('estatic', happy, 'typos')).toBe('ecstatic');
  });
  it('short words must still be exact', () => {
    expect(findSynonym('gald', happy, 'typos')).toBeNull();
  });
  it('soundalike mode accepts phonetic spellings', () => {
    expect(soundKey('chearful')).toBe(soundKey('cheerful'));
    expect(findSynonym('jubilent', happy, 'soundalike')).toBe('jubilant');
    expect(findSynonym('fonetik', { word: 'x', tier: 'easy', senses: [], synonyms: [{ word: 'phonetic', closeness: 1, sense: 0, rarity: 1 }], decoys: [] }, 'soundalike')).toBe('phonetic');
  });
  it('different words do not sound alike', () => {
    expect(isSameWord('gold', 'glad', 'soundalike')).toBe(false);
  });
});

describe('synonym range', () => {
  it('counts distant synonyms only in Loose games', () => {
    expect(findSynonym('upbeat', happy, 'strict', 'loose')).toBe('upbeat');
    expect(findSynonym('upbeat', happy, 'strict', 'standard')).toBeNull();
    expect(findSynonym('ecstatic', happy, 'strict', 'standard')).toBe('ecstatic');
    expect(findSynonym('ecstatic', happy, 'strict', 'close')).toBeNull();
    expect(findEntry('upbeat', happy, 'strict')).toMatchObject({ closeness: 3 });
  });
});

describe('real word bank', () => {
  it('has 300 starters, 100 per tier', () => {
    expect(STARTERS.length).toBe(300);
    for (const tier of ['easy', 'medium', 'hard']) expect(STARTERS.filter((s) => s.tier === tier).length).toBe(100);
  });
  it('never lists the starter itself, its own forms, or a decoy as a synonym', () => {
    for (const s of STARTERS) {
      for (const syn of s.synonyms) expect(stem(syn.word), `${s.word}: ${syn.word}`).not.toBe(stem(s.word));
      for (const d of s.decoys) expect(findEntry(d, s, 'strict'), `${s.word} decoy ${d}`).toBeNull();
    }
  });
  it('gives every starter something to play in a Standard game', () => {
    for (const s of STARTERS) expect(s.synonyms.filter((x) => x.closeness <= 2).length, s.word).toBeGreaterThanOrEqual(8);
  });
});
