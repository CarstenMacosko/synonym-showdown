import { describe, expect, it } from 'vitest';
import { findSynonym, isSameWord, soundKey, stem } from './match.ts';
import { STARTERS, synonymWords } from './words.ts';

const happy = STARTERS.find((s) => s.word === 'happy')!;
const fast = STARTERS.find((s) => s.word === 'fast')!;

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
    expect(findSynonym('fonetik', { word: 'x', tier: 'easy', synonyms: ['phonetic'], decoys: [] }, 'soundalike')).toBe('phonetic');
  });
  it('different words do not sound alike', () => {
    expect(isSameWord('gold', 'glad', 'soundalike')).toBe(false);
  });
});

describe('spelling variants', () => {
  const obstinate = STARTERS.find((s) => s.word === 'obstinate')!;
  it('accepts either spelling and reports the main one', () => {
    expect(findSynonym('wilful', obstinate, 'strict')).toBe('willful');
    expect(findSynonym('willful', obstinate, 'strict')).toBe('willful');
    expect(synonymWords(obstinate)).not.toContain('wilful');
  });
});

describe('word list sanity', () => {
  it('no starter lists itself or a decoy as a synonym', () => {
    for (const s of STARTERS) {
      for (const syn of s.synonyms.flatMap((e) => e.split('/'))) expect(stem(syn), `${s.word}: ${syn}`).not.toBe(stem(s.word));
      for (const d of s.decoys) expect(findSynonym(d, s, 'strict'), `${s.word} decoy ${d}`).toBeNull();
    }
  });
});
