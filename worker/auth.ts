// Accounts: username + password, sessions in an HttpOnly cookie.

import { error, ipHash, json, rateLimited, readJson, recordEvent, sha256Hex } from './http.ts';
import { isProvisional } from '../src/game/rating.ts';

const COOKIE = 'ss_session';
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000; // the maximum Cloudflare Workers allow
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const BAD_NAME = /(fuck|shit|bitch|cunt|nigg|fag|slut|whore|rape|nazi|hitler|admin|moderator)/i;
// "admin"/"moderator" names are blocked so nobody can pose as staff, except the owner's own account name.
const STAFF_NAMES = new Set(['carstenmadmin']);

export interface User {
  id: number;
  username: string;
  rating: number;
  rd: number;
  rated_at: number | null;
  ranked_games: number;
  ranked_wins: number;
  games: number;
  points: number;
  suspicious: number;
  is_admin: number;
}

/** What the browser is told about the signed-in player. */
export function publicUser(u: User) {
  return {
    username: u.username,
    rating: Math.round(u.rating),
    provisional: isProvisional(u),
    rankedGames: u.ranked_games,
    rankedWins: u.ranked_wins,
    games: u.games,
    points: u.points,
    isAdmin: u.is_admin === 1,
  };
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

async function hashPassword(password: string, saltB64: string): Promise<string> {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return b64(new Uint8Array(bits));
}

/** Compare without leaking how many characters matched. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function cookieHeader(token: string, maxAge: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function startSession(db: D1Database, userId: number): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Date.now();
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, now, now + SESSION_DAYS * 86_400_000)
    .run();
  return cookieHeader(token, SESSION_DAYS * 86_400);
}

function readCookie(req: Request): string | null {
  const m = /(?:^|;\s*)ss_session=([A-Za-z0-9_-]{20,})/.exec(req.headers.get('cookie') ?? '');
  return m ? m[1] : null;
}

/** The signed-in user for this request, or null. */
export async function currentUser(db: D1Database, req: Request): Promise<User | null> {
  const token = readCookie(req);
  if (!token) return null;
  return db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(await sha256Hex(token), Date.now())
    .first<User>();
}

interface Credentials {
  username?: unknown;
  password?: unknown;
}

function checkCredentials(body: Credentials | null): { username: string; password: string } | string {
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') return 'Enter a username and password.';
  const username = body.username.trim();
  if (!USERNAME_RE.test(username)) return 'Usernames are 3–16 letters, numbers or underscores.';
  if (body.password.length < 8 || body.password.length > 200) return 'Passwords need at least 8 characters.';
  return { username, password: body.password };
}

export async function register(db: D1Database, req: Request): Promise<Response> {
  const ip = await ipHash(req);
  if (await rateLimited(db, `signup:${ip}`, 20, 3_600_000)) return error('Too many new accounts from here. Try again later.', 429);
  const creds = checkCredentials(await readJson<Credentials>(req));
  if (typeof creds === 'string') return error(creds);
  if (BAD_NAME.test(creds.username) && !STAFF_NAMES.has(creds.username.toLowerCase())) return error('Please pick a different username.');
  const exists = await db.prepare('SELECT 1 FROM users WHERE username = ?').bind(creds.username).first();
  if (exists) return error('That username is taken.');

  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(creds.password, salt);
  const row = await db
    .prepare('INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(creds.username, hash, salt, Date.now())
    .first<User>();
  await recordEvent(db, `signup:${ip}`);
  const cookie = await startSession(db, row!.id);
  return json({ user: publicUser(row!) }, 200, { 'set-cookie': cookie });
}

export async function login(db: D1Database, req: Request): Promise<Response> {
  const creds = checkCredentials(await readJson<Credentials>(req));
  if (typeof creds === 'string') return error('Wrong username or password.', 401);
  const ip = await ipHash(req);
  const nameKey = `login:${creds.username.toLowerCase()}`;
  if ((await rateLimited(db, nameKey, 10, 900_000)) || (await rateLimited(db, `login-ip:${ip}`, 30, 900_000))) {
    return error('Too many attempts. Wait 15 minutes and try again.', 429);
  }
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(creds.username).first<User & { password_hash: string; salt: string }>();
  // Hash even when the user doesn't exist, so response time doesn't reveal which usernames are real.
  const hash = await hashPassword(creds.password, user?.salt ?? 'AAAAAAAAAAAAAAAAAAAAAA==');
  if (!user || !constantTimeEqual(hash, user.password_hash)) {
    await recordEvent(db, nameKey);
    await recordEvent(db, `login-ip:${ip}`);
    return error('Wrong username or password.', 401);
  }
  const cookie = await startSession(db, user.id);
  return json({ user: publicUser(user) }, 200, { 'set-cookie': cookie });
}

export async function logout(db: D1Database, req: Request): Promise<Response> {
  const token = readCookie(req);
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0) });
}
