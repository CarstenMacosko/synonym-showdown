// Primitive cheat detection: flag play that is beyond what a person can plausibly do
// (e.g. pasting answers from a thesaurus). Flagged players are tagged for review, never banned.
//
// The thresholds are deliberately generous so normal strong players don't get tagged.

export interface WordStat {
  valid: boolean;
  /** 1 common, 2 uncommon, 3 rare; null if not a synonym. */
  rarity: 1 | 2 | 3 | null;
  /** Milliseconds the player took for this word. */
  ms: number;
}

export interface Assessment {
  suspicious: boolean;
  reasons: string[];
  stats: { words: number; valid: number; accuracy: number; medianMs: number; rareShare: number };
}

export const LIMITS = {
  /** Correct words in one 60-second Score Attack / Daily run. */
  maxWordsPerMinute: 28,
  /** Median time per answer, once there are enough answers to judge. */
  minMedianMs: 1200,
  /** Share of correct answers that are rare words. */
  maxRareShare: 0.6,
  /** Long streaks of perfect accuracy with fast answers. */
  perfectStreak: 25,
  perfectStreakMedianMs: 2500,
  /** Minimum answers before speed/rarity rules apply. */
  minSample: 10,
};

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Judge one run or match. `perMinute` = true for timed 60-second modes, where the raw number
 * of correct words is itself a signal.
 */
export function assessPlay(words: WordStat[], perMinute = false): Assessment {
  const valid = words.filter((w) => w.valid);
  const medianMs = median(words.map((w) => w.ms));
  const rareShare = valid.length ? valid.filter((w) => w.rarity === 3).length / valid.length : 0;
  const accuracy = words.length ? valid.length / words.length : 0;
  const reasons: string[] = [];

  if (perMinute && valid.length > LIMITS.maxWordsPerMinute) {
    reasons.push(`${valid.length} correct words in one minute`);
  }
  if (words.length >= LIMITS.minSample && medianMs < LIMITS.minMedianMs) {
    reasons.push(`answers typically took ${Math.round(medianMs)}ms`);
  }
  if (valid.length >= LIMITS.minSample && rareShare > LIMITS.maxRareShare) {
    reasons.push(`${Math.round(rareShare * 100)}% of correct words were rare`);
  }
  if (valid.length >= LIMITS.perfectStreak && accuracy === 1 && medianMs < LIMITS.perfectStreakMedianMs) {
    reasons.push(`${valid.length} fast answers without a single miss`);
  }
  return {
    suspicious: reasons.length > 0,
    reasons,
    stats: { words: words.length, valid: valid.length, accuracy, medianMs, rareShare },
  };
}
