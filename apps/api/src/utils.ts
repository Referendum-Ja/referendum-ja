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

// Lightweight client proof-of-work check: HMAC-free, just verify that
// SHA-256(commitment || nonce) has the requested number of leading zero bits.
// This is a cheap anti-spam trick; it does not need to be cryptographically
// authenticated — the only thing it does is make scripted mass submissions
// expensive client-side.
export async function verifyPoW(commitment: string, nonce: string, bits: number): Promise<boolean> {
  if (typeof nonce !== "string" || nonce.length > 64) return false;
  const hex = await sha256Hex(commitment + ":" + nonce);
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
