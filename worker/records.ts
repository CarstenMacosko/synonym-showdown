// Database writes for scores, ratings, reports and cheat-detection tags.

import type { User } from './auth.ts';
import { dailyWindow, error, ipHash, json, rateLimited, readJson, recordEvent } from './http.ts';
import { inflate, rateGame, type Rating } from '../src/game/rating.ts';
import { verifySoloRun, type SoloSubmission } from '../src/game/soloVerify.ts';
import { assessPlay, type Assessment } from '../src/game/suspicion.ts';
import { STARTERS } from '../src/game/words.ts';

const STARTER_SET = new Set(STARTERS.map((s) => s.word));

/** Tag a player for review. They keep playing; the tag is only for us to look at. */
export async function flagUser(db: D1Database, userId: number, source: 'solo' | 'match', a: Assessment): Promise<void> {
  await db.batch([
    db
      .prepare('INSERT INTO flags (user_id, source, reasons, details, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, source, JSON.stringify(a.reasons), JSON.stringify(a.stats), Date.now()),
    db.prepare('UPDATE users SET suspicious = suspicious + 1 WHERE id = ?').bind(userId),
  ]);
}

/** POST /api/solo: a signed-in player's finished Score Attack / Daily / Survival run. */
export async function saveSoloRun(db: D1Database, req: Request, user: User): Promise<Response> {
  if (await rateLimited(db, `solo:${user.id}`, 60, 3_600_000)) return error('Slow down a little!', 429);
  const sub = await readJson<SoloSubmission>(req);
  if (!sub) return error('Bad run.');
  const run = verifySoloRun(sub, dailyWindow());
  if (!run.ok) return error(`Run not counted: ${run.error}.`);
  await recordEvent(db, `solo:${user.id}`);

  const inserted = await db
    .prepare('INSERT OR IGNORE INTO solo_runs (user_id, mode, variant, day, score, words, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(user.id, sub.mode, run.variant, run.day, run.score, run.words, Date.now())
    .run();
  if (!inserted.meta.changes) return json({ counted: false, reason: 'You already played today’s word.' });
  await db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(run.score, user.id).run();

  const verdict = assessPlay(run.wordStats, sub.mode !== 'survival');
  if (verdict.suspicious) await flagUser(db, user.id, 'solo', verdict);
  return json({ counted: true, score: run.score, points: user.points + run.score });
}

interface ReportBody {
  starter?: unknown;
  word?: unknown;
  ruling?: unknown;
  range?: unknown;
  mode?: unknown;
}

/** POST /api/report: "Disagree?" on a word ruling. */
export async function saveReport(db: D1Database, req: Request, user: User | null): Promise<Response> {
  const ip = await ipHash(req);
  if (await rateLimited(db, `report:${ip}`, 40, 3_600_000)) return error('Thanks! That’s plenty of reports for now.', 429);
  const b = await readJson<ReportBody>(req, 2_000);
  const ok =
    b &&
    typeof b.starter === 'string' &&
    STARTER_SET.has(b.starter) &&
    typeof b.word === 'string' &&
    /^[a-z][a-z' -]{0,38}$/i.test(b.word.trim()) &&
    (b.ruling === 'accepted' || b.ruling === 'rejected') &&
    (b.range === 'close' || b.range === 'standard' || b.range === 'loose') &&
    typeof b.mode === 'string' &&
    b.mode.length <= 20;
  if (!ok) return error('Bad report.');
  await db
    .prepare('INSERT INTO reports (starter, word, ruling, range, mode, user_id, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(b.starter, (b.word as string).trim().toLowerCase(), b.ruling, b.range, b.mode, user?.id ?? null, ip, Date.now())
    .run();
  await recordEvent(db, `report:${ip}`);
  return json({ ok: true });
}

export interface MatchPlayer {
  userId: number | null;
  name: string;
  place: number;
}

/**
 * Store a finished online game; for ranked 1v1 games, update both ratings.
 * Returns rating changes by user id.
 */
export async function recordMatch(
  db: D1Database,
  m: { room: string; ranked: boolean; starters: string[]; players: MatchPlayer[] },
): Promise<Record<number, { before: number; after: number }>> {
  const now = Date.now();
  const winner = m.players.find((p) => p.place === 1);
  const changes: Record<number, { before: number; after: number }> = {};
  const stmts: D1PreparedStatement[] = [];

  const signedIn = m.players.filter((p) => p.userId !== null);
  for (const p of signedIn) {
    const won = p.place === 1;
    stmts.push(db.prepare('UPDATE users SET games = games + 1, points = points + ? WHERE id = ?').bind(won ? 20 : 5, p.userId));
  }

  const ranked = m.ranked && m.players.length === 2 && signedIn.length === 2 && signedIn[0].userId !== signedIn[1].userId;
  if (ranked) {
    const [pa, pb] = signedIn;
    const load = (id: number) => db.prepare('SELECT rating, rd, rated_at FROM users WHERE id = ?').bind(id).first<Rating & { rated_at: number | null }>();
    const [ra, rb] = await Promise.all([load(pa.userId!), load(pb.userId!)]);
    if (ra && rb) {
      const days = (r: { rated_at: number | null }) => (r.rated_at ? (now - r.rated_at) / 86_400_000 : 0);
      const [na, nb] = rateGame(inflate(ra, days(ra)), inflate(rb, days(rb)), pa.place === 1 ? 1 : 0);
      for (const [p, before, after] of [[pa, ra, na], [pb, rb, nb]] as const) {
        changes[p.userId!] = { before: Math.round(before.rating), after: Math.round(after.rating) };
        stmts.push(
          db
            .prepare('UPDATE users SET rating = ?, rd = ?, rated_at = ?, ranked_games = ranked_games + 1, ranked_wins = ranked_wins + ? WHERE id = ?')
            .bind(after.rating, after.rd, now, p.place === 1 ? 1 : 0, p.userId),
        );
      }
    }
  }

  stmts.push(
    db
      .prepare('INSERT INTO matches (room, ranked, starters, players, winner_id, changes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(m.room, ranked ? 1 : 0, JSON.stringify(m.starters), JSON.stringify(m.players), winner?.userId ?? null, JSON.stringify(changes), now),
  );
  await db.batch(stmts);
  return changes;
}

/** GET /api/leaderboard: top ranked players. */
export async function leaderboard(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT username, rating, rd, ranked_games, ranked_wins FROM users
       WHERE ranked_games > 0 ORDER BY rating DESC LIMIT 25`,
    )
    .all<{ username: string; rating: number; rd: number; ranked_games: number; ranked_wins: number }>();
  return json({
    players: results.map((r) => ({
      username: r.username,
      rating: Math.round(r.rating),
      provisional: r.rd > 110,
      games: r.ranked_games,
      wins: r.ranked_wins,
    })),
  });
}
