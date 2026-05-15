import { Hono } from "hono";
import type { Env } from "../env.ts";
import { hmacSha256 } from "../utils.ts";

export const verifyRoute = new Hono<{ Bindings: Env }>();

// Verifies that a previously issued signature_token corresponds to a signature
// present in the latest daily snapshot. The token is autonomous (HMAC-signed),
// so no server-side lookup is needed beyond reading the snapshot table.
verifyRoute.get("/:token", async (c) => {
  const token = c.req.param("token");
  const secret = c.env.SIGNATURE_TOKEN_HMAC;
  if (!secret) return c.json({ error: "verification_disabled" }, 503);

  let decoded: string;
  try {
    const padded = token + "=".repeat((4 - (token.length % 4)) % 4);
    decoded = atob(padded);
  } catch {
    return c.json({ error: "invalid_token" }, 400);
  }
  const parts = decoded.split(":");
  if (parts.length !== 3) return c.json({ error: "invalid_token" }, 400);
  const [commitment, hour, sig] = parts as [string, string, string];

  const expected = await hmacSha256(secret, `${commitment}:${hour}`);
  if (!timingSafeEqualHex(expected, sig)) {
    return c.json({ error: "invalid_token" }, 400);
  }

  const snap = await c.env.DB.prepare(
    "SELECT date, total_count, merkle_root FROM daily_snapshots ORDER BY date DESC LIMIT 1",
  ).first<{ date: string; total_count: number; merkle_root: string }>();

  if (!snap) {
    return c.json({ present_in_latest_snapshot: false, snapshot_date: null });
  }

  // We cannot reveal whether a specific commitment is in the snapshot via the
  // database alone without leaking which token corresponds to which user. So
  // we redirect the caller to fetch the snapshot CSV and search locally —
  // this is the only path that gives genuine verifiability anyway.
  return c.json({
    snapshot_date: snap.date,
    snapshot_total: snap.total_count,
    snapshot_merkle_root: snap.merkle_root,
    commitment,
    instructions:
      "Download the snapshot CSV and check whether your commitment appears in it. The Merkle root above lets you verify the CSV has not been tampered with.",
  });
});

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
