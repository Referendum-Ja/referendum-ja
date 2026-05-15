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
