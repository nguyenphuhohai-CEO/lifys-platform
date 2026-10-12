ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE moderation_reports ADD COLUMN resolution_note TEXT NOT NULL DEFAULT '';
ALTER TABLE moderation_reports ADD COLUMN handled_at TEXT;
ALTER TABLE moderation_reports ADD COLUMN handled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_status_created ON moderation_reports(status, created_at);
