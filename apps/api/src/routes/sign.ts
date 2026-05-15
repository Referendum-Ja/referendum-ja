import { Hono } from "hono";
import type { Env } from "../env.ts";
import { getInt } from "../env.ts";
import {
  isWellFormedCommitment,
  isWellFormedInitials,
  isWellFormedComment,
  currentHourUTC,
  sha256Hex,
  hmacSha256,
  verifyPoW,
} from "../utils.ts";

export const signRoute = new Hono<{ Bindings: Env }>();

type SignBody = {
  commitment?: unknown;
  initials?: unknown;
  comment?: unknown;
  pow_nonce?: unknown;
};

signRoute.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as SignBody | null;
  if (!body) return c.json({ error: "invalid_body" }, 400);

  if (!isWellFormedCommitment(body.commitment)) {
    return c.json({ error: "invalid_commitment" }, 400);
  }
  if (!isWellFormedInitials(body.initials)) {
    return c.json({ error: "invalid_initials" }, 400);
  }
  if (!isWellFormedComment(body.comment)) {
    return c.json({ error: "invalid_comment" }, 400);
  }

  const powBits = getInt(c.env, "POW_BITS", 18);
  const nonce = typeof body.pow_nonce === "string" ? body.pow_nonce : "";
  if (!(await verifyPoW(body.commitment, nonce, powBits))) {
    return c.json({ error: "pow_failed" }, 400);
  }

  if (!(await checkAndConsumeRateLimit(c.env, c.req.raw))) {
    return c.json({ error: "rate_limited" }, 429);
  }

  const hour = currentHourUTC();

  let commentId: number | null = null;
  if (typeof body.comment === "string" && body.comment.length > 0) {
    const r = await c.env.DB.prepare(
      "INSERT INTO comments (body, status, created_at_hour) VALUES (?, 'pending', ?)",
    )
      .bind(body.comment, hour)
      .run();
    commentId = (r.meta.last_row_id ?? null) as number | null;
  }

  try {
    await c.env.DB.prepare(
      "INSERT INTO signatures (commitment, initials, created_at_hour) VALUES (?, ?, ?)",
    )
      .bind(body.commitment, body.initials ?? null, hour)
      .run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      // Roll back the comment if any — we never want orphan comments tied to a
      // rejected duplicate signature. The mapping is intentionally absent in the
      // schema, so we just discard.
      if (commentId !== null) {
        await c.env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(commentId).run();
      }
      return c.json({ error: "already_signed" }, 409);
    }
    throw e;
  }

  const tokenSecret = c.env.SIGNATURE_TOKEN_HMAC;
  if (!tokenSecret) {
    return c.json({ ok: true, signature_token: null, note: "signature_token_disabled" }, 201);
  }
  const tokenPayload = `${body.commitment}:${hour}`;
  const sig = await hmacSha256(tokenSecret, tokenPayload);
  // The token is autonomous: it embeds the commitment and an HMAC so we can
  // verify it later without storing anything server-side.
  const token = btoa(`${tokenPayload}:${sig}`).replace(/=+$/, "");

  return c.json({ ok: true, signature_token: token }, 201);
});

async function checkAndConsumeRateLimit(env: Env, req: Request): Promise<boolean> {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";

  const salt = env.IP_HASH_SALT ?? "no-salt-development-only";
  const ipHash = await sha256Hex(`${ip}|${salt}`);

  const windowSeconds = getInt(env, "RATE_LIMIT_WINDOW_SECONDS", 3600);
  const max = getInt(env, "RATE_LIMIT_MAX", 5);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);

  const row = await env.DB.prepare(
    "SELECT hits, window_start FROM rate_limits WHERE ip_hash = ?",
  )
    .bind(ipHash)
    .first<{ hits: number; window_start: number }>();

  if (!row || row.window_start < windowStart) {
    await env.DB.prepare(
      "INSERT INTO rate_limits (ip_hash, hits, window_start) VALUES (?, 1, ?) " +
        "ON CONFLICT(ip_hash) DO UPDATE SET hits = 1, window_start = excluded.window_start",
    )
      .bind(ipHash, windowStart)
      .run();
    return true;
  }
  if (row.hits >= max) return false;
  await env.DB.prepare("UPDATE rate_limits SET hits = hits + 1 WHERE ip_hash = ?")
    .bind(ipHash)
    .run();
  return true;
}
