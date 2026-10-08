// Cheat detection. Each finished game or solo run gets a suspicion score from 0 to 100, built from several
// independent signals, and each account keeps a running average of its scores. Players are only *tagged*
// (shown as "under review", hidden from the leaderboard) when one session is blatant or the evidence keeps
// repeating, so a single lucky or unusual game never gets anyone tagged. Nobody is ever banned automatically.
//
// Signals, and why they're there:
//   volume       more correct words per minute than top human players manage
//   speed        answers that arrive faster than anyone can think and type
//   rhythm       people's answer times vary a lot; scripts and pasting from a list are eerily regular
//   typing       time from first keystroke to submit is too short for the word's length (desktop only:
//                phone keyboards insert whole suggested words at once, so this would wrongly tag them)
//   pasting      the browser reports when text was pasted or dropped rather than typed
//   rare words   a much higher share of rare words than even strong players produce
//   perfection   long fast streaks without a single miss

export interface WordStat {
  valid: boolean;
  /** 1 common, 2 uncommon, 3 rare; null if not a synonym. */
  rarity: 1 | 2 | 3 | null;
  /** Milliseconds the player took for this word (from turn start, or from their previous word). */
  ms: number;
  /** The word as typed (for typing-speed checks). */
  word?: string;
  /** Reported by the browser: first keystroke to submit, in ms (null/undefined if unknown). */
  typedMs?: number | null;
  /** Reported by the browser: the word was pasted or dropped in. */
  pasted?: boolean;
  /** Reported by the browser: a touch device (typing-speed checks don't apply). */
  touch?: boolean;
}

export interface Assessment {
  /** 0 (nothing odd) to 100 (almost certainly not a fair human player). */
  score: number;
  /** This session alone looks suspicious (score at or above SESSION_SUSPICIOUS). */
  suspicious: boolean;
  reasons: string[];
  stats: {
    words: number;
    valid: number;
    accuracy: number;
    medianMs: number;
    timingSpread: number;
    rareShare: number;
    pasted: number;
    medianCharsPerSec: number | null;
  };
}

/** An account's running record (stored on the users row). */
export interface Baseline {
  sessions: number;
  /** Exponential moving average of session scores. */
  average: number;
}

export const SESSION_SUSPICIOUS = 60;
/** One session this bad is enough to tag on its own. */
export const BLATANT = 80;
/** Sessions worth logging for the admin page even if not tagged. */
export const WORTH_LOGGING = 40;

export const LIMITS = {
  wordsPerMinute: 28,
  wordsPerMinuteHigh: 22,
  fastMedianMs: 1200,
  quickMedianMs: 1800,
  roboticSpread: 0.15,
  stiffSpread: 0.25,
  charsPerSec: 18,
  instantTypedMs: 60,
  rareShare: 0.6,
  rareShareHigh: 0.45,
  perfectStreak: 20,
  minSample: 8,
};

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Standard deviation divided by the mean: ~0.4–1.0 for people, near 0 for scripts. */
function spread(xs: number[]): number {
  if (xs.length < 2) return 1;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean <= 0) return 0;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance) / mean;
}

/**
 * Score one run or match. `perMinute` = true for 60-second modes, where the raw count of correct words
 * is itself a signal.
 */
export function assessPlay(words: WordStat[], perMinute = false): Assessment {
  const valid = words.filter((w) => w.valid);
  const times = words.map((w) => Math.max(0, w.ms));
  const medianMs = median(times);
  const timingSpread = spread(times);
  const rareShare = valid.length ? valid.filter((w) => w.rarity === 3).length / valid.length : 0;
  const accuracy = words.length ? valid.length / words.length : 0;
  const pasted = words.filter((w) => w.pasted).length;
  const desktopTyped = words.filter((w) => !w.touch && typeof w.typedMs === 'number' && w.word && w.word.length >= 4);
  const cps = desktopTyped.map((w) => w.word!.length / Math.max(0.001, (w.typedMs as number) / 1000));
  const medianCps = cps.length ? median(cps) : null;
  const instant = desktopTyped.filter((w) => (w.typedMs as number) < LIMITS.instantTypedMs).length;

  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };
  const enough = words.length >= LIMITS.minSample;

  if (perMinute && valid.length > LIMITS.wordsPerMinute) add(60, `${valid.length} correct words in one minute`);
  else if (perMinute && valid.length > LIMITS.wordsPerMinuteHigh) add(25, `${valid.length} correct words in one minute`);

  if (enough && medianMs < LIMITS.fastMedianMs) add(35, `answers typically took ${Math.round(medianMs)}ms`);
  else if (enough && medianMs < LIMITS.quickMedianMs) add(15, `answers typically took ${Math.round(medianMs)}ms`);

  if (words.length >= 10 && timingSpread < LIMITS.roboticSpread) add(30, 'answer timing was machine-regular');
  else if (words.length >= 10 && timingSpread < LIMITS.stiffSpread) add(12, 'answer timing was unusually regular');

  if (desktopTyped.length >= 6 && medianCps !== null && medianCps > LIMITS.charsPerSec) {
    add(30, `typed about ${Math.round(medianCps)} letters per second`);
  }
  if (desktopTyped.length >= 6 && instant / desktopTyped.length >= 0.5) add(35, `${instant} words appeared instantly`);

  if (pasted >= 3) add(40, `${pasted} words were pasted in`);
  else if (pasted > 0) add(10 * pasted, `${pasted} word${pasted > 1 ? 's were' : ' was'} pasted in`);

  if (valid.length >= 10 && rareShare > LIMITS.rareShare) add(25, `${Math.round(rareShare * 100)}% of correct words were rare`);
  else if (valid.length >= 10 && rareShare > LIMITS.rareShareHigh) add(10, `${Math.round(rareShare * 100)}% of correct words were rare`);

  if (valid.length >= LIMITS.perfectStreak && accuracy === 1 && medianMs < 2500) add(20, `${valid.length} fast answers without a miss`);

  score = Math.min(100, score);
  return {
    score,
    suspicious: score >= SESSION_SUSPICIOUS,
    reasons,
    stats: { words: words.length, valid: valid.length, accuracy, medianMs, timingSpread, rareShare, pasted, medianCharsPerSec: medianCps },
  };
}

/** Fold a session into the account's running record. Short sessions count for less. */
export function updateBaseline(b: Baseline, a: Assessment): Baseline {
  if (a.stats.words < 3) return b;
  const weight = Math.min(0.4, 0.1 + a.stats.words / 100);
  return { sessions: b.sessions + 1, average: b.sessions ? b.average * (1 - weight) + a.score * weight : a.score };
}

/** Tag only on strong evidence: one blatant session, or suspicion that keeps repeating. */
export function shouldTag(a: Assessment, after: Baseline): boolean {
  if (a.score >= BLATANT) return true;
  if (a.suspicious && after.sessions >= 2 && after.average >= 40) return true;
  return after.sessions >= 4 && after.average >= 50;
}
