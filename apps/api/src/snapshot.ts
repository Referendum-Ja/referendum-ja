import type { Env } from "./env.ts";

// Daily snapshot worker. Runs at 03:00 UTC via cron trigger.
//
// 1. Read all commitments
// 2. Sort lexicographically (stable, no information leak)
// 3. Compute SHA-256 Merkle root
// 4. Build a CSV (one commitment per line, sorted)
// 5. Push to the archives GitHub repo
// 6. Record the snapshot in daily_snapshots
//
// The archives repo is intentionally separate so that the git history itself
// becomes the audit log: every snapshot is a signed commit.

export async function runDailySnapshot(env: Env): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const existing = await env.DB.prepare("SELECT 1 FROM daily_snapshots WHERE date = ?")
    .bind(today)
    .first();
  if (existing) return;

  const rows = (await env.DB.prepare(
    "SELECT commitment FROM signatures ORDER BY commitment ASC",
  ).all()) as { results: Array<{ commitment: string }> };

  const commitments = rows.results.map((r) => r.commitment);
  const merkleRoot = await merkleRootOf(commitments);
  const csv = commitments.join("\n") + "\n";

  const archiveUrl = await pushToArchive(env, today, csv, merkleRoot);

  await env.DB.prepare(
    "INSERT INTO daily_snapshots (date, total_count, merkle_root, csv_url, created_at) " +
      "VALUES (?, ?, ?, ?, ?)",
  )
    .bind(today, commitments.length, merkleRoot, archiveUrl, Math.floor(Date.now() / 1000))
    .run();

  // Clean rate-limit entries older than 7 days.
  const cutoff = Math.floor(Date.now() / 1000) - 7 * 86400;
  await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(cutoff).run();
}

// Merkle tree per RFC 6962 §2.1: domain-separated leaves (prefix 0x00) and
// internal nodes (prefix 0x01). Odd layers are NOT padded by duplicating the
// last leaf — they are promoted unchanged to the next layer. This eliminates
// the classic Bitcoin-style second-preimage attack where appending a duplicate
// leaf produces an identical root.
//
// We also reject duplicate inputs at the call site (the UNIQUE constraint on
// signatures.commitment already guarantees this in practice, but the snapshot
// path defensively double-checks).
async function merkleRootOf(leaves: string[]): Promise<string> {
  if (leaves.length === 0) {
    return "0000000000000000000000000000000000000000000000000000000000000000";
  }
  const seen = new Set<string>();
  for (const l of leaves) {
    if (seen.has(l)) throw new Error("duplicate commitment in snapshot input");
    seen.add(l);
  }

  let layer = await Promise.all(leaves.map(rfc6962LeafHash));
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1];
      next.push(right ? await rfc6962NodeHash(left, right) : left);
    }
    layer = next;
  }
  return layer[0]!;
}

async function rfc6962LeafHash(commitmentB64: string): Promise<string> {
  // 0x00 || leaf
  const leafBytes = new TextEncoder().encode(commitmentB64);
  const buf = new Uint8Array(1 + leafBytes.length);
  buf[0] = 0x00;
  buf.set(leafBytes, 1);
  return sha256HexFromBytes(buf);
}

async function rfc6962NodeHash(leftHex: string, rightHex: string): Promise<string> {
  // 0x01 || left || right (left, right are 32-byte digests)
  const left = hexToBytes(leftHex);
  const right = hexToBytes(rightHex);
  const buf = new Uint8Array(1 + left.length + right.length);
  buf[0] = 0x01;
  buf.set(left, 1);
  buf.set(right, 1 + left.length);
  return sha256HexFromBytes(buf);
}

async function sha256HexFromBytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function pushToArchive(
  env: Env,
  date: string,
  csv: string,
  merkleRoot: string,
): Promise<string> {
  if (!env.ARCHIVE_GITHUB_TOKEN) {
    return `local://snapshot/${date}.csv`;
  }

  const owner = "Referendum-Ja";
  const repo = "referendum-ja-archives";
  const path = `snapshots/${date}.csv`;
  const message = `snapshot ${date}: ${csv.split("\n").length - 1} signatures, merkle ${merkleRoot.slice(0, 16)}`;

  const contentB64 = btoa(unescape(encodeURIComponent(csv)));

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.ARCHIVE_GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "referendum-ja-worker",
    },
    body: JSON.stringify({ message, content: contentB64 }),
  });
  if (!res.ok) {
    throw new Error(`Archive push failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { content?: { html_url?: string } };
  return body.content?.html_url ?? `https://github.com/${owner}/${repo}/blob/main/${path}`;
}
