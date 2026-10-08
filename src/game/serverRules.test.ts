import { describe, expect, it } from 'vitest';
import { isProvisional, rateGame, START_RATING } from './rating.ts';
import { dailyStarter, survivalTier } from './solo.ts';
import { verifySoloRun } from './soloVerify.ts';
import { assessPlay, type WordStat } from './suspicion.ts';
import { STARTERS } from './words.ts';

describe('ratings', () => {
  it('a first win between new players moves ratings a lot', () => {
    const [a, b] = rateGame(START_RATING, START_RATING, 1);
    expect(a.rating).toBeGreaterThan(1140);
    expect(b.rating).toBeLessThan(860);
    expect(a.rd).toBeLessThan(350);
    expect(isProvisional(a)).toBe(true);
  });
  it('settles down after many games', () => {
    let a = START_RATING;
    let b = START_RATING;
    for (let i = 0; i < 30; i++) [a, b] = rateGame(a, b, (i % 2) as 0 | 1);
    expect(isProvisional(a)).toBe(false);
    const [a2] = rateGame(a, b, 1);
    expect(a2.rating - a.rating).toBeLessThan(40);
  });
  it('beating a much stronger player is worth more than beating a weaker one', () => {
    const strong = { rating: 1400, rd: 80 };
    const weak = { rating: 800, rd: 80 };
    const me = { rating: 1100, rd: 80 };
    expect(rateGame(me, strong, 1)[0].rating - me.rating).toBeGreaterThan(rateGame(me, weak, 1)[0].rating - me.rating);
  });
});

describe('cheat detection', () => {
  const words = (n: number, ms: number, rarity: 1 | 3 = 1): WordStat[] => Array.from({ length: n }, () => ({ valid: true, rarity, ms }));
  it('leaves a strong normal player alone', () => {
    expect(assessPlay(words(18, 3000), true).suspicious).toBe(false);
  });
  it('tags superhuman volume, speed, and rarity', () => {
    expect(assessPlay(words(35, 1700), true).reasons.join()).toMatch(/correct words in one minute/);
    expect(assessPlay(words(12, 600)).reasons.join()).toMatch(/answers typically took/);
    expect(assessPlay(words(12, 4000, 3)).reasons.join()).toMatch(/rare/);
  });
});

describe('server replay of solo runs', () => {
  const easy = STARTERS.find((s) => s.tier === 'easy')!;
  const good = easy.synonyms.filter((s) => s.closeness <= 2);
  it('recomputes the score from the guesses', () => {
    const run = verifySoloRun(
      {
        mode: 'score',
        tier: 'easy',
        range: 'standard',
        forgiveness: 'strict',
        rounds: [{ starter: easy.word, guesses: [{ word: good[0].word, t: 3000 }, { word: 'zzzz', t: 6000 }, { word: good[1].word, t: 9000 }] }],
      },
      [],
    );
    expect(run.ok).toBe(true);
    if (run.ok) {
      expect(run.words).toBe(2);
      expect(run.score).toBe(good[0].rarity + good[1].rarity);
      expect(run.wordStats.map((w) => w.valid)).toEqual([true, false, true]);
    }
  });
  it('ignores guesses after the clock ran out', () => {
    const run = verifySoloRun(
      { mode: 'score', tier: 'easy', range: 'standard', forgiveness: 'strict', rounds: [{ starter: easy.word, guesses: [{ word: good[0].word, t: 61_000 }] }] },
      [],
    );
    expect(run.ok).toBe(false);
  });
  it('rejects a daily run for the wrong word or day', () => {
    const day = '2026-10-08';
    const wrong = STARTERS.find((s) => s.word !== dailyStarter(day).word)!;
    const sub = { mode: 'daily' as const, tier: 'easy' as const, range: 'standard' as const, forgiveness: 'typos' as const, dateKey: day, rounds: [{ starter: wrong.word, guesses: [] }] };
    expect(verifySoloRun(sub, [day]).ok).toBe(false);
    expect(verifySoloRun({ ...sub, rounds: [{ starter: dailyStarter(day).word, guesses: [] }] }, ['2026-10-09']).ok).toBe(false);
    expect(verifySoloRun({ ...sub, rounds: [{ starter: dailyStarter(day).word, guesses: [] }] }, [day]).ok).toBe(true);
  });
  it('replays survival rounds and checks each word comes from the right tier', () => {
    const r1 = STARTERS.find((s) => s.tier === survivalTier(1))!;
    const r2 = STARTERS.find((s) => s.tier === survivalTier(2) && s !== r1)!;
    const ok1 = r1.synonyms.find((s) => s.closeness <= 2)!.word;
    const run = verifySoloRun(
      {
        mode: 'survival',
        tier: 'hard',
        range: 'standard',
        forgiveness: 'strict',
        rounds: [
          { starter: r1.word, guesses: [{ word: ok1, t: 2000 }] },
          { starter: r2.word, guesses: [{ word: 'zzzz', t: 4000 }] },
        ],
      },
      [],
    );
    expect(run).toMatchObject({ ok: true, score: 1 });
  });
});
