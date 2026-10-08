import { describe, expect, it } from 'vitest';
import { canChallenge, challenge, findRepeat, continueGame, createGame, submitWord, timeLeft, timeout, type GameState, type Settings } from './engine.ts';
import { decideBotMove } from './bot.ts';
import { HAPPY } from './testFixtures.ts';

const settings: Settings = { tier: 'easy', timeControl: 'blitz', forgiveness: 'strict', afterElimination: 'newWord', range: 'standard' };
const setups = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), isBot: false, color: '#000' }));
const rng = () => 0; // always picks the first option: first player 'a'

function start(over: Partial<Settings> = {}): GameState {
  const g = createGame({ ...settings, ...over }, setups, rng, 0);
  return { ...g, starter: HAPPY };
}

describe('turns', () => {
  it('passes the turn after a word', () => {
    const { state, error } = submitWord(start(), 'a', 'glad', 1000);
    expect(error).toBeNull();
    expect(state.currentId).toBe('b');
  });
  it('rejects repeats, other forms and the starter word', () => {
    let s = submitWord(start(), 'a', 'joyful', 1).state;
    expect(submitWord(s, 'b', 'Joyfully', 2).error).toBe('repeat');
    expect(submitWord(s, 'b', 'happiness', 2).error).toBe('starter');
    expect(submitWord(s, 'c', 'glad', 2).error).toBe('notYourTurn');
  });
  it('reports which earlier play a word repeats', () => {
    let s = submitWord(start(), 'a', 'joyful', 1).state;
    s = submitWord(s, 'b', 'glad', 2).state;
    expect(findRepeat(s, 'Joyfully')).toMatchObject({ index: 0, play: { playerId: 'a', word: 'joyful' } });
    expect(findRepeat(s, 'glad')).toMatchObject({ index: 1, play: { playerId: 'b' } });
    expect(findRepeat(s, 'merry')).toBeNull();
    expect(findRepeat(s, 'g')).toBeNull();
  });
  it('cannot challenge before any word is said', () => {
    expect(canChallenge(start())).toBe(false);
  });
});

describe('challenges', () => {
  it('a real synonym eliminates the challenger', () => {
    const s = submitWord(start(), 'a', 'gleeful', 1).state;
    const r = challenge(s, 'b', 2);
    expect(r.lastEvent).toMatchObject({ kind: 'challenge', valid: true, eliminatedId: 'b' });
    expect(r.players.find((p) => p.id === 'b')!.alive).toBe(false);
  });
  it('a bluff eliminates the bluffer', () => {
    const s = submitWord(start(), 'a', 'banana', 1).state;
    const r = challenge(s, 'b', 2);
    expect(r.lastEvent).toMatchObject({ valid: false, eliminatedId: 'a' });
  });
  it('next round starts after the eliminated player with a new word', () => {
    const s = challenge(submitWord(start(), 'a', 'banana', 1).state, 'b', 2);
    const n = continueGame(s, () => 0.99, 3);
    expect(n.phase).toBe('playing');
    expect(n.currentId).toBe('b');
    expect(n.chain).toEqual([]);
    expect(n.starter.word).not.toBe('happy');
  });
  it('same-word mode keeps the chain but the judged word cannot be re-challenged', () => {
    const s = challenge(submitWord(start({ afterElimination: 'sameWord' }), 'a', 'glad', 1).state, 'b', 2);
    const n = continueGame(s, rng, 3);
    expect(n.starter.word).toBe('happy');
    expect(n.chain.length).toBe(1);
    expect(canChallenge(n)).toBe(false);
  });
  it('last player standing wins', () => {
    const two = createGame(settings, setups.slice(0, 2), rng, 0);
    const s = challenge(submitWord({ ...two, starter: HAPPY }, 'a', 'banana', 1).state, 'b', 2);
    const over = continueGame(s, rng, 3);
    expect(over.phase).toBe('over');
    expect(over.winnerId).toBe('b');
  });
});

describe('time', () => {
  it('times out a slow player', () => {
    const s = start();
    expect(timeout(s, 5_000)).toBe(s); // still has time
    const r = timeout(s, 10_001);
    expect(r.lastEvent).toMatchObject({ kind: 'timeout', eliminatedId: 'a' });
  });
  it('chess clock only ticks on your own turn', () => {
    let s = start({ timeControl: 'clock' });
    s = submitWord(s, 'a', 'glad', 15_000).state;
    expect(s.players.find((p) => p.id === 'a')!.bankMs).toBe(45_000);
    expect(timeLeft(s, 15_000)).toBe(60_000); // b's full bank
  });
});

describe('ranges and spelling', () => {
  it('a distant synonym is a bluff in a Standard game but fine in a Loose one', () => {
    const std = challenge(submitWord(start(), 'a', 'upbeat', 1).state, 'b', 2);
    expect(std.lastEvent).toMatchObject({ valid: false, eliminatedId: 'a', entry: { word: 'upbeat', closeness: 3 } });
    const loose = challenge(submitWord(start({ range: 'loose' }), 'a', 'upbeat', 1).state, 'b', 2);
    expect(loose.lastEvent).toMatchObject({ valid: true, eliminatedId: 'b' });
  });
  it('a misspelling of an earlier word counts as a repeat in typo mode', () => {
    const s = submitWord(start({ forgiveness: 'typos' }), 'a', 'cheerful', 1).state;
    expect(submitWord(s, 'b', 'cheerfull', 2).error).toBe('repeat');
  });
});

describe('bots', () => {
  it('always produce a legal move', () => {
    const bot = { ...setups[1], isBot: true, botLevel: 'hard' as const, alive: true, bankMs: 0 };
    let s = submitWord(start(), 'a', 'glad', 1).state;
    for (let i = 0; i < 50; i++) {
      const move = decideBotMove(s, bot, Math.random);
      if (move.type === 'say') expect(submitWord(s, 'b', move.word, 2).error).toBeNull();
    }
  });
});
