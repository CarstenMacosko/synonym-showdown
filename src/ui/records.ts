// Personal bests and daily results, kept in this browser only.
// (Once accounts exist these will sync to the server.)

import type { SoloMode } from '../game/solo';

export interface DailyResult {
  word: string;
  score: number;
  found: string[];
}

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function getBest(mode: SoloMode, variant: string): number {
  return read<number>(`ss-best-${mode}-${variant}`) ?? 0;
}

/** Saves the score if it's a new best. Returns true when it was. */
export function recordBest(mode: SoloMode, variant: string, score: number): boolean {
  if (score <= getBest(mode, variant)) return false;
  write(`ss-best-${mode}-${variant}`, score);
  return true;
}

export function getDaily(dateKey: string): DailyResult | null {
  return read<DailyResult>(`ss-daily-${dateKey}`);
}

export function saveDaily(dateKey: string, result: DailyResult) {
  write(`ss-daily-${dateKey}`, result);
}
