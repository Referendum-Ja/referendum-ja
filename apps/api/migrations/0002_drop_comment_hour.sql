-- C-5: remove created_at_hour from comments. The column was a privacy leak:
-- low-traffic launch hours give a k-anonymity of 1-3 between commitments and
-- comments. Comments do not need any timestamp for any function in the code.
--
-- The created_at_hour column on signatures is intentionally preserved — it is
-- already published via /api/stats/timeseries as aggregate hourly counts, so
-- the per-commitment value is not a new leak vector beyond what the public
-- timeseries already exposes.

-- SQLite (and D1) support DROP COLUMN since 3.35. The comments table has no
-- foreign keys, no triggers, no indexes on this column.
ALTER TABLE comments DROP COLUMN created_at_hour;
