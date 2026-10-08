import { describe, expect, it } from 'vitest';
import { isProvisional, rateGame, START_RATING } from './rating.ts';
import { dailyStarter, survivalTier } from './solo.ts';
import { verifySoloRun } from './soloVerify.ts';
import { assessPlay, shouldTag, updateBaseline, type Baseline, type WordStat } from './suspicion.ts';
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
  // Deterministic random numbers so the simulation gives the same result every run.
  let seed = 42;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  const normal = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
  const WORDS = ['joyful', 'cheerful', 'merry', 'delighted', 'content', 'ecstatic', 'blissful', 'jubilant', 'glad', 'elated'];

  interface Player {
    medianMs: number;
    spreadSigma: number; // log-normal spread of answer times
    cps: number; // typing speed in letters per second
    accuracy: number;
    rare: number;
    touch?: boolean;
    paste?: boolean;
    exactMs?: number; // scripted: fixed timing
  }
  function session(p: Player, n: number): WordStat[] {
    return Array.from({ length: n }, () => {
      const word = WORDS[Math.floor(rand() * WORDS.length)];
      const ms = p.exactMs ? p.exactMs * (1 + normal() * 0.02) : p.medianMs * Math.exp(normal() * p.spreadSigma);
      const valid = rand() < p.accuracy;
      return {
        valid,
        rarity: valid ? (rand() < p.rare ? 3 : 1) : null,
        ms,
        word,
        typedMs: p.paste ? 4 : p.touch ? 30 : (word.length / Math.max(1, p.cps * (1 + normal() * 0.25))) * 1000,
        pasted: !!p.paste,
        touch: !!p.touch,
      } satisfies WordStat;
    });
  }
  /** Play `games` sessions and report whether the account ended up tagged, and after how many. */
  function career(p: Player, games: number, perMinute: boolean, n: () => number) {
    let b: Baseline = { sessions: 0, average: 0 };
    for (let g = 1; g <= games; g++) {
      const a = assessPlay(session(p, n()), perMinute);
      b = updateBaseline(b, a);
      if (shouldTag(a, b)) return g;
    }
    return 0;
  }

  const humans: [string, Player][] = [
    ['casual player', { medianMs: 5000, spreadSigma: 0.6, cps: 4, accuracy: 0.75, rare: 0.1 }],
    ['strong player', { medianMs: 2600, spreadSigma: 0.45, cps: 8, accuracy: 0.92, rare: 0.25 }],
    ['very fast typist', { medianMs: 2000, spreadSigma: 0.4, cps: 12, accuracy: 0.9, rare: 0.3 }],
    ['phone player with swipe keyboard', { medianMs: 3000, spreadSigma: 0.5, cps: 6, accuracy: 0.85, rare: 0.15, touch: true }],
  ];
  for (const [name, p] of humans) {
    it(`never tags a ${name} (200 careers of 30 games)`, () => {
      let tagged = 0;
      for (let i = 0; i < 200; i++) if (career(p, 30, i % 2 === 0, () => 8 + Math.floor(rand() * 14))) tagged++;
      expect(tagged).toBe(0);
    });
  }

  const cheaters: [string, Player][] = [
    ['paster', { medianMs: 2500, spreadSigma: 0.4, cps: 6, accuracy: 1, rare: 0.4, paste: true }],
    ['script', { medianMs: 0, spreadSigma: 0, cps: 50, accuracy: 1, rare: 0.5, exactMs: 900 }],
    ['steady list-copier', { medianMs: 0, spreadSigma: 0, cps: 30, accuracy: 1, rare: 0.35, exactMs: 2400 }],
  ];
  for (const [name, p] of cheaters) {
    it(`catches a ${name} within 2 sessions`, () => {
      const when = career(p, 5, true, () => 24);
      expect(when).toBeGreaterThan(0);
      expect(when).toBeLessThanOrEqual(2);
    });
  }

  it('explains its reasons', () => {
    const a = assessPlay(session(cheaters[0][1], 20), true);
    expect(a.reasons.join(' ')).toMatch(/pasted/);
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
