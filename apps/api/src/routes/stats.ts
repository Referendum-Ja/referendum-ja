import { Hono } from "hono";
import type { Env } from "../env.ts";

export const statsRoute = new Hono<{ Bindings: Env }>();

statsRoute.get("/", async (c) => {
  const total = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM signatures").first<{ n: number }>();
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  const last24 = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM signatures WHERE created_at_hour >= ?",
  )
    .bind(since)
    .first<{ n: number }>();

  const snapshot = await c.env.DB.prepare(
    "SELECT date, total_count, merkle_root FROM daily_snapshots ORDER BY date DESC LIMIT 1",
  ).first<{ date: string; total_count: number; merkle_root: string }>();

  return c.json({
    total: total?.n ?? 0,
    last_24h: last24?.n ?? 0,
    last_snapshot: snapshot ?? null,
  });
});

// Hourly counts for the public chart. Returns one row per hour for the last
// `hours` hours (default 7 days = 168 hours).
statsRoute.get("/timeseries", async (c) => {
  const hours = Math.min(Math.max(parseInt(c.req.query("hours") ?? "168", 10) || 168, 1), 24 * 30);
  const since = (Math.floor(Date.now() / 3600_000) - hours) * 3600;
  const rows = await c.env.DB.prepare(
    "SELECT created_at_hour AS hour, COUNT(*) AS n FROM signatures " +
      "WHERE created_at_hour >= ? GROUP BY created_at_hour ORDER BY created_at_hour ASC",
  )
    .bind(since)
    .all<{ hour: number; n: number }>();
  return c.json({ points: rows.results });
});
