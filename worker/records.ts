// Database writes for scores, ratings, reports and cheat-detection tags.

import { publicUser, type User } from './auth.ts';
import { lockedPart, sanitizeAvatar } from '../src/game/avatar.ts';
import { dailyWindow, error, ipHash, json, rateLimited, readJson, recordEvent } from './http.ts';
import { inflate, rateGame, type Rating } from '../src/game/rating.ts';
import { verifySoloRun, type SoloSubmission } from '../src/game/soloVerify.ts';
import { assessPlay, shouldTag, updateBaseline, WORTH_LOGGING, type Assessment } from '../src/game/suspicion.ts';
import { STARTERS } from '../src/game/words.ts';

const STARTER_SET = new Set(STARTERS.map((s) => s.word));

/**
 * Feed one session's assessment into the account's running record. Notable sessions are logged for the
 * admin page; the visible "under review" tag is only added on strong or repeated evidence (see suspicion.ts).
 */
export async function recordAssessment(db: D1Database, userId: number, source: 'solo' | 'match', a: Assessment): Promise<void> {
  const row = await db.prepare('SELECT cheat_score, cheat_sessions FROM users WHERE id = ?').bind(userId).first<{ cheat_score: number; cheat_sessions: number }>();
  if (!row) return;
  const after = updateBaseline({ sessions: row.cheat_sessions, average: row.cheat_score }, a);
  const tag = shouldTag(a, after);
  const stmts = [
    db
      .prepare('UPDATE users SET cheat_score = ?, cheat_sessions = ?, suspicious = suspicious + ? WHERE id = ?')
      .bind(after.average, after.sessions, tag ? 1 : 0, userId),
  ];
  if (tag || a.score >= WORTH_LOGGING) {
    stmts.push(
      db
        .prepare('INSERT INTO flags (user_id, source, reasons, details, created_at, score, tagged) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(userId, source, JSON.stringify(a.reasons), JSON.stringify(a.stats), Date.now(), a.score, tag ? 1 : 0),
    );
  }
  await db.batch(stmts);
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

  await recordAssessment(db, user.id, 'solo', assessPlay(run.wordStats, sub.mode !== 'survival'));
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
       WHERE ranked_games > 0 AND suspicious = 0 ORDER BY rating DESC LIMIT 25`,
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

/** GET /api/profile: your account, plus your last few online games. */
export async function getProfile(db: D1Database, user: User): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT m.ranked, m.players, m.changes, m.created_at, m.starters FROM matches m, json_each(m.players) p
       WHERE json_extract(p.value, '$.userId') = ? ORDER BY m.created_at DESC LIMIT 10`,
    )
    .bind(user.id)
    .all<{ ranked: number; players: string; changes: string; created_at: number; starters: string }>();
  const recent = results.map((m) => {
    const players = JSON.parse(m.players) as MatchPlayer[];
    const changes = JSON.parse(m.changes || '{}') as Record<string, { before: number; after: number }>;
    return {
      at: m.created_at,
      ranked: m.ranked === 1,
      place: players.find((p) => p.userId === user.id)?.place ?? null,
      players: players.length,
      opponents: players.filter((p) => p.userId !== user.id).map((p) => p.name),
      change: changes[user.id] ?? null,
      word: (JSON.parse(m.starters) as string[]).at(-1) ?? '',
    };
  });
  return json({ user: publicUser(user), recent });
}

/** POST /api/profile: save your avatar. */
export async function saveProfile(db: D1Database, req: Request, user: User): Promise<Response> {
  const body = await readJson<{ avatar?: unknown }>(req, 2_000);
  const avatar = sanitizeAvatar(body?.avatar);
  if (!avatar) return error('That face has an unknown part.');
  const locked = lockedPart(avatar, user.points);
  if (locked) return error(`That ${locked.part} unlocks at ${locked.cost} points.`);
  await db.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(JSON.stringify(avatar), user.id).run();
  return json({ user: publicUser({ ...user, avatar: JSON.stringify(avatar) }) });
}
