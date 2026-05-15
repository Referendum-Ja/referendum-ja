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

async function merkleRootOf(leaves: string[]): Promise<string> {
  if (leaves.length === 0) {
    return "0000000000000000000000000000000000000000000000000000000000000000";
  }
  let layer = await Promise.all(leaves.map(sha256Hex));
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left; // duplicate last leaf if odd
      next.push(await sha256Hex(left + right));
    }
    layer = next;
  }
  return layer[0]!;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
