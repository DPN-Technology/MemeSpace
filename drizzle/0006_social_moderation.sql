ALTER TABLE social_posts ADD COLUMN hidden_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE social_reports ADD COLUMN reviewed_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_reports ADD COLUMN reviewed_by TEXT NOT NULL DEFAULT '';
ALTER TABLE social_reports ADD COLUMN resolution_note TEXT NOT NULL DEFAULT '';
