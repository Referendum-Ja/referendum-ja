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
  applySecretSaltMix,
  getDailyIpSalt,
  utcDate,
} from "../utils.ts";

export const signRoute = new Hono<{ Bindings: Env }>();

type SignBody = {
  commitment?: unknown;
  initials?: unknown;
  comment?: unknown;
  pow_nonce?: unknown;
  pow_bucket?: unknown;
};

type DeleteBody = {
  commitment?: unknown;
  pow_nonce?: unknown;
  pow_bucket?: unknown;
};

function extractPow(body: { pow_nonce?: unknown; pow_bucket?: unknown }): {
  nonce: string;
  bucket: number;
} | null {
  if (typeof body.pow_nonce !== "string") return null;
  if (typeof body.pow_bucket !== "number" || !Number.isInteger(body.pow_bucket)) return null;
  return { nonce: body.pow_nonce, bucket: body.pow_bucket };
}

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
  const pow = extractPow(body);
  if (!pow || !(await verifyPoW(body.commitment, pow.nonce, pow.bucket, powBits))) {
    return c.json({ error: "pow_failed" }, 400);
  }

  if (!(await checkAndConsumeRateLimit(c.env, c.req.raw))) {
    return c.json({ error: "rate_limited" }, 429);
  }

  // Apply Level-2 HMAC layer if a secret salt is configured. Without the
  // salt, `storedCommitment === clientCommitment` (Level 1 behaviour).
  const storedCommitment = await applySecretSaltMix(body.commitment, c.env.SECRET_SALT_B64);

  const hour = currentHourUTC();
  const hasComment = typeof body.comment === "string" && body.comment.length > 0;

  // Insert signature first (the UNIQUE-bearing row). Only on success do we
  // insert the orphan-resistant comment. With this ordering, a transient
  // failure cannot leave a comment row pointing at no signature, and a
  // racing duplicate POST never touches the comments table at all.
  try {
    await c.env.DB.prepare(
      "INSERT INTO signatures (commitment, initials, created_at_hour) VALUES (?, ?, ?)",
    )
      .bind(storedCommitment, body.initials ?? null, hour)
      .run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      return c.json({ error: "already_signed" }, 409);
    }
    throw e;
  }

  if (hasComment) {
    await c.env.DB.prepare("INSERT INTO comments (body, status) VALUES (?, 'pending')")
      .bind(body.comment)
      .run();
  }

  const tokenSecret = c.env.SIGNATURE_TOKEN_HMAC;
  if (!tokenSecret) {
    return c.json({ ok: true, signature_token: null, note: "signature_token_disabled" }, 201);
  }
  const tokenPayload = `${storedCommitment}:${hour}`;
  const sig = await hmacSha256(tokenSecret, tokenPayload);
  const token = btoa(`${tokenPayload}:${sig}`).replace(/=+$/, "");

  return c.json({ ok: true, signature_token: token }, 201);
});

// RGPD / Llei 29/2021 art. 16 — right to erasure.
// The signatory proves NIA ownership by re-deriving the same commitment in
// their browser; we re-apply the same Level-2 HMAC layer and DELETE by the
// stored commitment. The NIA itself never reaches the server.
//
// Important caveat documented in /avis-legal: deletion creates a gap in the
// Merkle history once the day's snapshot is published. We accept that — the
// alternative (refusing deletion) is worse legally.
signRoute.delete("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as DeleteBody | null;
  if (!body) return c.json({ error: "invalid_body" }, 400);

  if (!isWellFormedCommitment(body.commitment)) {
    return c.json({ error: "invalid_commitment" }, 400);
  }

  const powBits = getInt(c.env, "POW_BITS", 18);
  const pow = extractPow(body);
  if (!pow || !(await verifyPoW(body.commitment, pow.nonce, pow.bucket, powBits))) {
    return c.json({ error: "pow_failed" }, 400);
  }

  if (!(await checkAndConsumeRateLimit(c.env, c.req.raw))) {
    return c.json({ error: "rate_limited" }, 429);
  }

  const storedCommitment = await applySecretSaltMix(body.commitment, c.env.SECRET_SALT_B64);
  const r = await c.env.DB.prepare("DELETE FROM signatures WHERE commitment = ?")
    .bind(storedCommitment)
    .run();

  const deleted = (r.meta.changes ?? 0) as number;
  if (deleted === 0) return c.json({ ok: true, deleted: 0 }, 404);
  return c.json({ ok: true, deleted: 1 }, 200);
});

async function checkAndConsumeRateLimit(env: Env, req: Request): Promise<boolean> {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";

  // Daily-rotating salt from D1: today's salt is generated lazily and
  // discarded after 14 days by the cron handler. A constant fallback secret
  // (IP_HASH_SALT) is mixed in so D1 read access alone is not enough to
  // re-derive a given IP — it must be combined with both the daily salt and
  // the env secret.
  const dailySalt = await getDailyIpSalt(env.DB, utcDate());
  const envSalt = env.IP_HASH_SALT ?? "no-salt-development-only";
  const ipHash = await sha256Hex(`${ip}|${dailySalt}|${envSalt}`);

  const windowSeconds = getInt(env, "RATE_LIMIT_WINDOW_SECONDS", 600);
  const max = getInt(env, "RATE_LIMIT_MAX", 20);
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
