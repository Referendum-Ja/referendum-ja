-- Initial schema for ReferendumJa.
-- The model is intentionally minimal: no users, no sessions, no cookies.
-- Comments are stored in a separate table without any relation to commitments,
-- so it is impossible to know which commitment authored which comment.

CREATE TABLE signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commitment TEXT NOT NULL UNIQUE,
  initials TEXT,
  created_at_hour INTEGER NOT NULL
);

CREATE INDEX idx_signatures_created_at_hour ON signatures(created_at_hour);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at_hour INTEGER NOT NULL,
  CHECK (status IN ('pending', 'approved', 'rejected')),
  CHECK (length(body) <= 280)
);

CREATE INDEX idx_comments_status ON comments(status);

CREATE TABLE daily_snapshots (
  date TEXT PRIMARY KEY,
  total_count INTEGER NOT NULL,
  merkle_root TEXT NOT NULL,
  csv_url TEXT NOT NULL,
  signed_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  ip_hash TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);
