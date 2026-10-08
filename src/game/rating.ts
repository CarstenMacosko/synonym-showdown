// Ranked ratings: the Glicko system (Elo plus a measure of uncertainty, "RD").
// New players start at 1000 with a large RD, so their first few games move the rating a lot;
// the RD shrinks as they play and slowly grows back if they stop playing for a while.

export interface Rating {
  rating: number;
  /** Rating deviation: how unsure we are. 350 = brand new, ~60 = well established. */
  rd: number;
}

export const START_RATING: Rating = { rating: 1000, rd: 350 };
const MAX_RD = 350;
const MIN_RD = 60;
// RD grows from MIN_RD back to MAX_RD over roughly a year of not playing.
const C2 = (MAX_RD ** 2 - MIN_RD ** 2) / 365;
const Q = Math.LN10 / 400;

const g = (rd: number) => 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));
const expected = (a: Rating, b: Rating) => 1 / (1 + 10 ** ((-g(b.rd) * (a.rating - b.rating)) / 400));

/** Increase uncertainty for time away (call before rating a game). */
export function inflate(r: Rating, daysIdle: number): Rating {
  return { rating: r.rating, rd: Math.min(MAX_RD, Math.sqrt(r.rd ** 2 + C2 * Math.max(0, daysIdle))) };
}

function update(a: Rating, b: Rating, score: number): Rating {
  const gb = g(b.rd);
  const e = expected(a, b);
  const d2 = 1 / (Q * Q * gb * gb * e * (1 - e));
  const denom = 1 / (a.rd * a.rd) + 1 / d2;
  return {
    rating: a.rating + (Q / denom) * gb * (score - e),
    rd: Math.max(MIN_RD, Math.sqrt(1 / denom)),
  };
}

/** Rate one game between a and b. scoreA: 1 = a won, 0 = b won, 0.5 = draw. */
export function rateGame(a: Rating, b: Rating, scoreA: 0 | 0.5 | 1): [Rating, Rating] {
  return [update(a, b, scoreA), update(b, a, 1 - scoreA)];
}

/** Ratings with high uncertainty are shown as provisional ("1162?"). */
export function isProvisional(r: Rating): boolean {
  return r.rd > 110;
}
