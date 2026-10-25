// The Worker: serves the website and the /api/* game server.
//
//   GET  /api/health               is the server (and its database) up? Used by tools/check/live.ts
//   GET  /api/me                   who's signed in
//   POST /api/register | login | logout
//   POST /api/solo                 save a finished solo run (re-verified here)
//   POST /api/report               "Disagree?" on a word ruling
//   GET  /api/leaderboard          top ranked players
//   POST /api/rooms                create a room code
//   GET  /api/rooms/:code/ws       join a room (WebSocket)
//   GET  /api/queue/ws             ranked matchmaking (WebSocket, signed in)

import { adminApi } from './admin.ts';
import { currentUser, login, logout, publicUser, register, userAvatar, type User } from './auth.ts';
import { error, ipHash, json, rateLimited, recordEvent, sameOrigin } from './http.ts';
import { getProfile, leaderboard, saveProfile, saveReport, saveSoloRun } from './records.ts';
import { createRoom } from './rooms.ts';
import { ROOM_CODE_RE } from '../src/game/protocol.ts';

export { GameRoom } from './room.ts';
export { Matchmaker } from './matchmaker.ts';

/** Forward a WebSocket upgrade to a Durable Object, telling it (in a header only we can set) who's signed in. */
function forward(stub: { fetch: (r: Request) => Promise<Response> }, req: Request, user: User | null): Promise<Response> {
  const headers = new Headers(req.headers);
  headers.delete('x-ss-user');
  if (user) {
    headers.set(
      'x-ss-user',
      JSON.stringify({ id: user.id, username: user.username, rating: user.rating, flagged: user.suspicious > 0, avatar: userAvatar(user) }),
    );
  }
  return stub.fetch(new Request(req, { headers }));
}

async function api(req: Request, env: Env, path: string): Promise<Response> {
  const method = req.method;
  const isUpgrade = req.headers.get('upgrade') === 'websocket';
  // Anything that changes state, and every WebSocket, must come from our own pages.
  if ((method !== 'GET' || isUpgrade) && !sameOrigin(req)) return error('Forbidden', 403);
  const db = env.DB;

  if (path === '/api/health' && method === 'GET') {
    await db.prepare('SELECT 1').first();
    return json({ ok: true });
  }
  if (path === '/api/me' && method === 'GET') {
    const user = await currentUser(db, req);
    return json({ user: user ? publicUser(user) : null });
  }
  if (path === '/api/register' && method === 'POST') return register(db, req);
  if (path === '/api/login' && method === 'POST') return login(db, req);
  if (path === '/api/logout' && method === 'POST') return logout(db, req);
  if (path === '/api/leaderboard' && method === 'GET') return leaderboard(db);
  if (path === '/api/profile') {
    const user = await currentUser(db, req);
    if (!user) return error('Sign in first.', 401);
    if (method === 'GET') return getProfile(db, user);
    if (method === 'POST') return saveProfile(db, req, user);
  }
  if (path.startsWith('/api/admin/')) return adminApi(db, req, path, await currentUser(db, req));
  if (path === '/api/report' && method === 'POST') return saveReport(db, req, await currentUser(db, req));
  if (path === '/api/solo' && method === 'POST') {
    const user = await currentUser(db, req);
    return user ? saveSoloRun(db, req, user) : error('Sign in to save scores.', 401);
  }
  if (path === '/api/rooms' && method === 'POST') {
    const ip = await ipHash(req);
    if (await rateLimited(db, `room:${ip}`, 30, 3_600_000)) return error('Too many rooms from here. Try again in a bit.', 429);
    await recordEvent(db, `room:${ip}`);
    return json({ code: await createRoom(env, false, null) });
  }

  const room = /^\/api\/rooms\/([A-Za-z]{4})\/ws$/.exec(path);
  if (room && isUpgrade) {
    const code = room[1].toUpperCase();
    if (!ROOM_CODE_RE.test(code)) return error('No such room.', 404);
    return forward(env.ROOMS.get(env.ROOMS.idFromName(code)), req, await currentUser(db, req));
  }
  if (path === '/api/queue/ws' && isUpgrade) {
    const user = await currentUser(db, req);
    if (!user) return error('Sign in to play ranked.', 401);
    return forward(env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global')), req, user);
  }
  return error('Not found', 404);
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await api(req, env, url.pathname);
      } catch (e) {
        console.error(e);
        return error('Something went wrong on our side.', 500);
      }
    }
    return env.ASSETS.fetch(req);
  },

  /** Nightly housekeeping (see "triggers" in wrangler.jsonc): drop expired sessions and old rate-limit records. */
  async scheduled(_event, env): Promise<void> {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
      env.DB.prepare('DELETE FROM rate_events WHERE at < ?').bind(now - 86_400_000),
    ]);
  },
} satisfies ExportedHandler<Env>;
