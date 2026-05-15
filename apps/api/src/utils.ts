// Server-side helpers that never see the NIA.

const B64_CHARS = /^[A-Za-z0-9+/=]+$/;

export function isWellFormedCommitment(s: unknown): s is string {
  if (typeof s !== "string") return false;
  // 32 bytes base64-encoded with padding = 44 characters exactly.
  if (s.length !== 44) return false;
  if (!B64_CHARS.test(s)) return false;
  return true;
}

export function isWellFormedInitials(s: unknown): s is string | undefined {
  if (s === undefined || s === null || s === "") return true;
  if (typeof s !== "string") return false;
  if (s.length > 4) return false;
  // Letters only, no scripts beyond Latin extended — keep it boring.
  return /^[A-Za-zÀ-ÿ.\-' ]{1,4}$/.test(s);
}

export function isWellFormedComment(s: unknown): s is string | undefined {
  if (s === undefined || s === null || s === "") return true;
  if (typeof s !== "string") return false;
  if (s.length > 280) return false;
  return true;
}

export function currentHourUTC(): number {
  const now = Math.floor(Date.now() / 1000);
  return now - (now % 3600);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256(keyB64: string, message: string): Promise<string> {
  const keyBytes = b64ToBytes(keyB64);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const msgBytes = new TextEncoder().encode(message);
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes.buffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(sig));
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Returns today's IP-hash salt, generating it lazily on the first hit of the
// day. Concurrent generators are safe: INSERT OR IGNORE + re-read settles on
// one canonical row. Old rows are purged by the daily cron handler.
export async function getDailyIpSalt(db: D1Database, date: string): Promise<string> {
  const row = await db
    .prepare("SELECT salt FROM daily_ip_salt WHERE date = ?")
    .bind(date)
    .first<{ salt: string }>();
  if (row) return row.salt;

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const salt = bytesToB64(bytes);
  await db
    .prepare("INSERT OR IGNORE INTO daily_ip_salt (date, salt) VALUES (?, ?)")
    .bind(date, salt)
    .run();

  const row2 = await db
    .prepare("SELECT salt FROM daily_ip_salt WHERE date = ?")
    .bind(date)
    .first<{ salt: string }>();
  return row2!.salt;
}

// Applies the Level-2 server-side HMAC layer to a client-side Argon2id
// commitment. Without the secret salt, no party — including someone holding
// the official NIA registry — can brute-force the snapshot.
//
// stored = base64( HMAC-SHA256(secret_salt_bytes, decode_b64(client_commitment)) )
//
// At audit time, the Govern recomputes the same chain with the salt
// reconstituted from the 5-of-7 custodian ceremony.
export async function applySecretSaltMix(
  clientCommitmentB64: string,
  secretSaltB64: string | undefined,
): Promise<string> {
  if (!secretSaltB64) return clientCommitmentB64;
  const saltBytes = b64ToBytes(secretSaltB64);
  if (saltBytes.length !== 32) {
    throw new Error("SECRET_SALT_B64 must decode to exactly 32 bytes");
  }
  const commitmentBytes = b64ToBytes(clientCommitmentB64);
  const key = await crypto.subtle.importKey(
    "raw",
    saltBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const out = await crypto.subtle.sign("HMAC", key, commitmentBytes.buffer as ArrayBuffer);
  return bytesToB64(new Uint8Array(out));
}

// Proof-of-work check, bound to a 5-minute time bucket.
//
// SHA-256(commitment || ":" || nonce || ":" || time_bucket) must have the
// requested number of leading zero bits, where time_bucket = floor(now / 300).
// The server accepts the client's bucket if it falls within [server-1, server],
// which gives ~5–10 minutes of validity. Outside that window the nonce is
// stale and the client must re-mine.
//
// This binds the work to a short time window: a pre-mined nonce cannot be
// replayed indefinitely as a duplicate-check oracle.
export const POW_BUCKET_SECONDS = 300;
export function currentPowBucket(now = Date.now()): number {
  return Math.floor(now / 1000 / POW_BUCKET_SECONDS);
}

export async function verifyPoW(
  commitment: string,
  nonce: string,
  bucket: number,
  bits: number,
): Promise<boolean> {
  if (typeof nonce !== "string" || nonce.length > 64) return false;
  if (!Number.isInteger(bucket) || bucket < 0) return false;
  const serverBucket = currentPowBucket();
  // Tolerate up to 1 bucket of clock skew in either direction.
  if (bucket > serverBucket || bucket < serverBucket - 1) return false;

  const hex = await sha256Hex(commitment + ":" + nonce + ":" + bucket);
  const bytes = hex.match(/.{2}/g)!.map((b) => parseInt(b, 16));
  let zeroBits = 0;
  for (const b of bytes) {
    if (b === 0) {
      zeroBits += 8;
      continue;
    }
    let v = b;
    while ((v & 0x80) === 0 && zeroBits < bits) {
      zeroBits++;
      v <<= 1;
    }
    break;
  }
  return zeroBits >= bits;
}
