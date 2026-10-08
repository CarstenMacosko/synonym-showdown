// "Disagree?" reports: a player thinks a ruling was wrong. Reports are kept in this browser and also sent to
// /api/report when the site has that endpoint (the Cloudflare Worker); they're reviewed into
// tools/wordbank/overrides.json.

import type { Range } from '../game/words';

export interface RulingReport {
  starter: string;
  word: string;
  /** What the game decided. */
  ruling: 'accepted' | 'rejected';
  range: Range;
  mode: string;
  at: string;
}

const KEY = 'ss-reports';

export function reportRuling(r: Omit<RulingReport, 'at'>) {
  const report: RulingReport = { ...r, at: new Date().toISOString() };
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    localStorage.setItem(KEY, JSON.stringify([...list, report].slice(-200)));
  } catch {
    /* storage unavailable */
  }
  // Best effort: fine if the endpoint doesn't exist yet or the player is offline.
  fetch('./api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) }).catch(
    () => {},
  );
}

/** Reports made on this device (useful for testing before the server side exists). */
export function localReports(): RulingReport[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
