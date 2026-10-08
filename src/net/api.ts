// Talking to the game server (worker/index.ts). Session cookies are handled by the browser.

import type { SoloSubmission } from '../game/soloVerify';

export interface Account {
  username: string;
  rating: number;
  provisional: boolean;
  rankedGames: number;
  rankedWins: number;
  games: number;
  points: number;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not reach the server.');
  return data as T;
}

export const api = {
  me: () => call<{ user: Account | null }>('/api/me').then((r) => r.user),
  register: (username: string, password: string) =>
    call<{ user: Account }>('/api/register', { method: 'POST', body: { username, password } }).then((r) => r.user),
  login: (username: string, password: string) =>
    call<{ user: Account }>('/api/login', { method: 'POST', body: { username, password } }).then((r) => r.user),
  logout: () => call('/api/logout', { method: 'POST', body: {} }),
  createRoom: () => call<{ code: string }>('/api/rooms', { method: 'POST', body: {} }).then((r) => r.code),
  submitSolo: (run: SoloSubmission) =>
    call<{ counted: boolean; score?: number; points?: number; reason?: string }>('/api/solo', { method: 'POST', body: run }),
  leaderboard: () =>
    call<{ players: { username: string; rating: number; provisional: boolean; games: number; wins: number }[] }>('/api/leaderboard'),
};

/** ws(s)://<this host>/<path>, for the room and matchmaking sockets. */
export function socketUrl(path: string): string {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}${path}`;
}
