-- Synonym Showdown database (Cloudflare D1 / SQLite).
-- Apply with: npx wrangler d1 migrations apply synonym-showdown --remote

-- Accounts. Passwords are never stored: only a salted PBKDF2 hash.
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  -- Ranked rating (Glicko): starts at 1000 with a large uncertainty (rd) so the first games move it a lot.
  rating        REAL NOT NULL DEFAULT 1000,
  rd            REAL NOT NULL DEFAULT 350,
  rated_at      INTEGER,
  ranked_games  INTEGER NOT NULL DEFAULT 0,
  ranked_wins   INTEGER NOT NULL DEFAULT 0,
  games         INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 0,
  -- Cheat detection: number of times this account was tagged as suspicious (never auto-banned).
  suspicious    INTEGER NOT NULL DEFAULT 0,
  is_admin      INTEGER NOT NULL DEFAULT 0
);

-- Login sessions. The browser keeps a random token in an HttpOnly cookie; only its SHA-256 hash is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Simple rate limiting (failed logins, sign-ups, reports), keyed by e.g. "login:<username>" or "report:<ip hash>".
CREATE TABLE rate_events (
  key TEXT NOT NULL,
  at  INTEGER NOT NULL
);
CREATE INDEX rate_events_key ON rate_events(key, at);

-- "Disagree?" reports on word rulings, reviewed into tools/wordbank/overrides.json.
CREATE TABLE reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  starter    TEXT NOT NULL,
  word       TEXT NOT NULL,
  ruling     TEXT NOT NULL CHECK (ruling IN ('accepted', 'rejected')),
  range      TEXT NOT NULL,
  mode       TEXT NOT NULL,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_hash    TEXT,
  created_at INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'dismissed'))
);
CREATE INDEX reports_open ON reports(status, starter);

-- Finished online games.
CREATE TABLE matches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room       TEXT NOT NULL,
  ranked     INTEGER NOT NULL,
  starters   TEXT NOT NULL,          -- JSON array of starter words played
  players    TEXT NOT NULL,          -- JSON [{userId, name, place}]
  winner_id  INTEGER,
  changes    TEXT,                   -- JSON rating changes for ranked games
  created_at INTEGER NOT NULL
);

-- Solo runs submitted by signed-in players (scores are recomputed on the server).
CREATE TABLE solo_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode       TEXT NOT NULL,
  variant    TEXT NOT NULL,
  day        TEXT,                   -- for the daily word: one counted run per day
  score      INTEGER NOT NULL,
  words      INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX solo_user ON solo_runs(user_id, mode);
CREATE UNIQUE INDEX solo_daily_once ON solo_runs(user_id, day) WHERE day IS NOT NULL;

-- Suspicious-activity tags from the cheat detector. Players are tagged, not banned.
CREATE TABLE flags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT NOT NULL,          -- 'solo' or 'match'
  reasons    TEXT NOT NULL,          -- JSON array of strings
  details    TEXT,                   -- JSON stats behind the tag
  created_at INTEGER NOT NULL
);
CREATE INDEX flags_user ON flags(user_id);
