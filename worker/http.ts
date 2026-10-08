// Small helpers shared by the API routes.

export const ALLOWED_ORIGINS = new Set([
  'https://synonymshowdown.com',
  'https://www.synonymshowdown.com',
  'https://synonym-showdown.carstenmacosko.workers.dev',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8787',
]);

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const error = (message: string, status = 400) => json({ error: message }, status);

/**
 * Requests that change anything must come from the game's own pages. Browsers always send Origin on
 * POSTs and WebSocket upgrades, so another website can't act on a signed-in player's behalf.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Also allow the exact host the request came in on (e.g. preview deployments).
  return origin === new URL(req.url).origin;
}

/** Read a JSON body, refusing anything large. */
export async function readJson<T>(req: Request, maxBytes = 64_000): Promise<T | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const enc = new TextEncoder();

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A privacy-friendly stand-in for the visitor's IP address (used only for rate limits). */
export async function ipHash(req: Request): Promise<string> {
  return (await sha256Hex('ss-ip:' + (req.headers.get('cf-connecting-ip') ?? 'local'))).slice(0, 24);
}

/** Count recent events for a key; returns true if the limit is already reached (and doesn't record). */
export async function rateLimited(db: D1Database, key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = Date.now() - windowMs;
  const row = await db.prepare('SELECT COUNT(*) AS n FROM rate_events WHERE key = ? AND at > ?').bind(key, since).first<{ n: number }>();
  return (row?.n ?? 0) >= limit;
}

export async function recordEvent(db: D1Database, key: string): Promise<void> {
  await db.prepare('INSERT INTO rate_events (key, at) VALUES (?, ?)').bind(key, Date.now()).run();
}

/** The YYYY-MM-DD dates a daily-word run may claim right now (players are in different time zones). */
export function dailyWindow(now = Date.now()): string[] {
  const day = (offset: number) => new Date(now + offset * 86_400_000).toISOString().slice(0, 10);
  return [day(-1), day(0), day(1)];
}
