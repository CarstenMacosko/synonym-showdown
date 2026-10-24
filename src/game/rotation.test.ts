import { describe, expect, it } from 'vitest';
import { allRounds, challenge, continueGame, createGame, submitWord, type Settings } from './engine.ts';
import { createSolo } from './solo.ts';
import { cleanSeen, countSeen, pickStarter, startersForTier } from './words.ts';

const settings: Settings = { tier: 'easy', timeControl: 'blitz', forgiveness: 'strict', afterElimination: 'newWord', range: 'standard' };
const setups = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), isBot: false, color: '#000' }));

describe('fresh starter words', () => {
  const pool = startersForTier('easy');

  it('never repeats a word until every other word has been seen', () => {
    const seen: string[] = [];
    for (let i = 0; i < pool.length; i++) {
      const w = pickStarter(pool, [], countSeen([seen]), Math.random).word;
      expect(seen).not.toContain(w);
      seen.push(w);
    }
  });

  it('prefers the word the fewest players in a room have seen', () => {
    const everyoneButOne = pool.slice(1).map((s) => s.word);
    const w = pickStarter(pool, [], countSeen([everyoneButOne, everyoneButOne]), Math.random).word;
    expect(w).toBe(pool[0].word);
  });

  it('uses the players seen lists in games and solo runs', () => {
    const allButLast = countSeen([pool.slice(0, -1).map((s) => s.word)]);
    expect(createGame(settings, setups, Math.random, 0, allButLast).starter.word).toBe(pool[pool.length - 1].word);
    expect(createSolo('score', { tier: 'easy', forgiveness: 'strict', range: 'standard', seen: allButLast }, Math.random, 0).starter.word).toBe(
      pool[pool.length - 1].word,
    );
  });

  it('ignores junk in a browser-sent list', () => {
    expect(cleanSeen([pool[0].word, pool[0].word, 'not-a-starter', 42])).toEqual([pool[0].word]);
    expect(cleanSeen('nope')).toEqual([]);
  });
});

describe('round history', () => {
  it('keeps every word of the game for the end screen', () => {
    let s = createGame(settings, setups, () => 0, 0);
    const first = s.starter.word;
    s = submitWord(s, 'a', 'zzzz', 1).state;
    s = challenge(s, 'b', 2); // bluff caught: a is out
    s = continueGame(s, () => 0, 3);
    const rounds = allRounds(s);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].starter.word).toBe(first);
    expect(rounds[0].chain).toEqual([{ playerId: 'a', word: 'zzzz', rejected: true, confirmed: false }]);
    expect(rounds[1].starter.word).not.toBe(first);
  });
});
