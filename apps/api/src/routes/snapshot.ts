import { Hono } from "hono";
import type { Env } from "../env.ts";

export const snapshotRoute = new Hono<{ Bindings: Env }>();

snapshotRoute.get("/:date", async (c) => {
  const date = c.req.param("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "invalid_date" }, 400);
  }
  const row = await c.env.DB.prepare(
    "SELECT date, total_count, merkle_root, csv_url FROM daily_snapshots WHERE date = ?",
  )
    .bind(date)
    .first();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row);
});

snapshotRoute.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT date, total_count, merkle_root, csv_url FROM daily_snapshots ORDER BY date DESC LIMIT 90",
  ).all();
  return c.json({ snapshots: rows.results });
});
