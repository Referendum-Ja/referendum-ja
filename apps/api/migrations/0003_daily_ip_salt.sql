-- C-7: daily rotating IP hash salt. The Worker cannot mutate its own
-- secrets (Wrangler secrets are out-of-band), so the rotation lives in D1.
-- Each request reads the salt for today (creating it lazily on the first
-- request of the day), and the cron handler purges rows older than 14 days.

CREATE TABLE daily_ip_salt (
  date TEXT PRIMARY KEY,         -- YYYY-MM-DD UTC
  salt TEXT NOT NULL             -- 32 random bytes, base64-encoded
);

-- O-6: signed_by was reserved for a GPG fingerprint on the daily snapshot.
-- We never implemented signing here — drop the dead column so future readers
-- of the schema don't infer a property we don't provide.
ALTER TABLE daily_snapshots DROP COLUMN signed_by;
