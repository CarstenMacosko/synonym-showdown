// Talking to the game server (worker/index.ts). Session cookies are handled by the browser.

import type { AvatarConfig } from '../game/avatar';
import type { SoloSubmission } from '../game/soloVerify';

export interface Account {
  username: string;
  rating: number;
  provisional: boolean;
  rankedGames: number;
  rankedWins: number;
  games: number;
  points: number;
  isAdmin: boolean;
  avatar: AvatarConfig | null;
  joined: number;
}

export interface RecentMatch {
  at: number;
  ranked: boolean;
  place: number | null;
  players: number;
  opponents: string[];
  change: { before: number; after: number } | null;
  word: string;
}

export interface AdminReport {
  starter: string;
  word: string;
  ruling: 'accepted' | 'rejected';
  range: string;
  n: number;
  last: number;
}

export interface AdminUser {
  username: string;
  created_at: number;
  rating: number;
  rd: number;
  ranked_games: number;
  ranked_wins: number;
  games: number;
  points: number;
  suspicious: number;
  is_admin: number;
}

export interface AdminFlag {
  username: string;
  suspicious: number;
  rating: number;
  ranked_games: number;
  source: string;
  reasons: string;
  created_at: number;
  cheat_score: number;
  cheat_sessions: number;
  score: number | null;
  tagged: number;
}

/** The server's daily request allowance resets at midnight UTC; this is that moment in the player's own clock. */
function resetTime(): string {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Turn a failed response into something a player can act on. Our own errors carry a JSON message; Cloudflare's don't. */
function failure(res: Response, data: { error?: string }): string {
  if (data.error) return data.error;
  if (res.status === 429) return `The game server is out of requests for today. Sign-in and online play are back at ${resetTime()}. Solo games still work!`;
  if (res.status >= 500) return 'The game server is having a hiccup. Try again in a minute.';
  return `The game server answered strangely (${res.status}). Try again in a minute.`;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const method = init?.method ?? 'GET';
  let res: Response | null = null;
  // Reads get one quiet retry for a dropped connection or a passing server error. Changes don't, so a sign-up
  // that went through isn't sent twice.
  for (let attempt = 0; attempt < (method === 'GET' ? 2 : 1); attempt++) {
    try {
      res = await fetch(path, {
        method,
        headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        credentials: 'same-origin',
      });
    } catch {
      res = null;
    }
    if (res && res.status !== 502 && res.status !== 503 && res.status !== 504) break;
    if (method === 'GET' && attempt === 0) await new Promise((r) => setTimeout(r, 800));
  }
  if (!res) throw new Error('Could not reach the server. Check your internet connection and try again.');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(failure(res, data));
  return data as T;
}

/** Why the server can't be used right now, or null if it's fine (used to explain a lost game connection). */
export async function serverTrouble(): Promise<string | null> {
  try {
    await call('/api/health');
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export const api = {
  me: () => call<{ user: Account | null }>('/api/me').then((r) => r.user),
  register: (username: string, password: string) =>
    call<{ user: Account }>('/api/register', { method: 'POST', body: { username, password } }).then((r) => r.user),
  login: (username: string, password: string) =>
    call<{ user: Account }>('/api/login', { method: 'POST', body: { username, password } }).then((r) => r.user),
  logout: () => call('/api/logout', { method: 'POST', body: {} }),
  profile: () => call<{ user: Account; recent: RecentMatch[] }>('/api/profile'),
  saveAvatar: (avatar: AvatarConfig) => call<{ user: Account }>('/api/profile', { method: 'POST', body: { avatar } }).then((r) => r.user),
  createRoom: () => call<{ code: string }>('/api/rooms', { method: 'POST', body: {} }).then((r) => r.code),
  submitSolo: (run: SoloSubmission) =>
    call<{ counted: boolean; score?: number; points?: number; reason?: string }>('/api/solo', { method: 'POST', body: run }),
  adminReports: () => call<{ reports: AdminReport[] }>('/api/admin/reports').then((r) => r.reports),
  resolveReport: (starter: string, word: string, status: 'fixed' | 'dismissed') =>
    call('/api/admin/reports/resolve', { method: 'POST', body: { starter, word, status } }),
  adminUsers: () => call<{ total: number; users: AdminUser[] }>('/api/admin/users'),
  adminFlags: () => call<{ flags: AdminFlag[] }>('/api/admin/flags').then((r) => r.flags),
  clearFlag: (username: string) => call('/api/admin/flags/clear', { method: 'POST', body: { username } }),
  leaderboard: () =>
    call<{ players: { username: string; rating: number; provisional: boolean; games: number; wins: number }[] }>('/api/leaderboard'),
};

/** ws(s)://<this host>/<path>, for the room and matchmaking sockets. */
export function socketUrl(path: string): string {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}${path}`;
}
