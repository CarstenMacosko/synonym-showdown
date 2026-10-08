// Admin-only API for the website's Admin page: review "Disagree?" reports and cheat-detector tags.
// Every route checks that the signed-in account has is_admin = 1.

import type { User } from './auth.ts';
import { error, json, readJson } from './http.ts';

export async function adminApi(db: D1Database, req: Request, path: string, user: User | null): Promise<Response> {
  if (!user?.is_admin) return error('Admins only.', 403);

  if (path === '/api/admin/reports' && req.method === 'GET') {
    const { results } = await db
      .prepare(
        `SELECT starter, word, ruling, MAX(range) AS range, COUNT(*) AS n, MAX(created_at) AS last
         FROM reports WHERE status = 'open' GROUP BY starter, word, ruling ORDER BY n DESC, last DESC LIMIT 200`,
      )
      .all();
    return json({ reports: results });
  }
  if (path === '/api/admin/reports/resolve' && req.method === 'POST') {
    const b = await readJson<{ starter?: string; word?: string; status?: string }>(req, 1_000);
    if (!b?.starter || !b.word || (b.status !== 'fixed' && b.status !== 'dismissed')) return error('Bad request.');
    await db.prepare("UPDATE reports SET status = ? WHERE starter = ? AND word = ? AND status = 'open'").bind(b.status, b.starter, b.word).run();
    return json({ ok: true });
  }
  if (path === '/api/admin/users' && req.method === 'GET') {
    const { results } = await db
      .prepare(
        `SELECT username, created_at, rating, rd, ranked_games, ranked_wins, games, points, suspicious, is_admin
         FROM users ORDER BY created_at DESC LIMIT 1000`,
      )
      .all();
    const total = await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
    return json({ total: total?.n ?? 0, users: results });
  }
  if (path === '/api/admin/flags' && req.method === 'GET') {
    const { results } = await db
      .prepare(
        `SELECT u.username, u.suspicious, u.rating, u.ranked_games, u.cheat_score, u.cheat_sessions,
                f.source, f.reasons, f.details, f.created_at, f.score, f.tagged
         FROM users u JOIN flags f ON f.user_id = u.id
         WHERE u.suspicious > 0 OR u.cheat_score >= 30 ORDER BY f.created_at DESC LIMIT 300`,
      )
      .all();
    return json({ flags: results });
  }
  if (path === '/api/admin/flags/clear' && req.method === 'POST') {
    const b = await readJson<{ username?: string }>(req, 1_000);
    if (!b?.username) return error('Bad request.');
    // The tag history stays in the flags table; clearing just removes the visible tag.
    await db.prepare('UPDATE users SET suspicious = 0, cheat_score = 0, cheat_sessions = 0 WHERE username = ?').bind(b.username).run();
    return json({ ok: true });
  }
  return error('Not found', 404);
}
