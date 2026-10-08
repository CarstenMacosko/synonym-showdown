-- Player avatars and the cheat detector's running record.

-- JSON avatar settings (colors, texture, hat…), see src/game/avatar.ts.
ALTER TABLE users ADD COLUMN avatar TEXT;
-- Running average of session suspicion scores (0–100) and how many sessions it covers.
ALTER TABLE users ADD COLUMN cheat_score REAL NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN cheat_sessions INTEGER NOT NULL DEFAULT 0;

-- Every notable session is logged; only some lead to a visible tag.
ALTER TABLE flags ADD COLUMN score REAL;
ALTER TABLE flags ADD COLUMN tagged INTEGER NOT NULL DEFAULT 1;
