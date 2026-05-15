import { commit } from "@referendum-ja/crypto";

// Browser-side signing flow.
//
// The NIA never leaves the browser. We compute the Argon2id commitment, then
// mine a small proof-of-work over (commitment || nonce), then POST only the
// commitment + nonce + optional initials/comment to the API.
//
// The PoW is intentionally weak (~18 bits, a couple of seconds on mobile) —
// it exists only to make scripted mass spam expensive. It is not a CAPTCHA
// replacement against a determined adversary.

export type SignInput = {
  nia: string;
  initials?: string;
  comment?: string;
  apiBase: string;
  powBits: number;
};

export type SignResult =
  | { status: "ok"; signatureToken: string | null }
  | { status: "duplicate" }
  | { status: "rate_limited" }
  | { status: "error"; code: string; message: string };

export type DeleteResult =
  | { status: "deleted" }
  | { status: "not_found" }
  | { status: "rate_limited" }
  | { status: "error"; code: string; message: string };

export async function sign(input: SignInput, onProgress?: (phase: string) => void): Promise<SignResult> {
  onProgress?.("hashing");
  let commitmentB64: string;
  try {
    commitmentB64 = await commit(input.nia);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "error", code: "invalid_nia", message };
  }

  onProgress?.("proof_of_work");
  const bucket = currentPowBucket();
  const nonce = await minePoW(commitmentB64, bucket, input.powBits);

  onProgress?.("submitting");
  const res = await fetch(`${input.apiBase}/api/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commitment: commitmentB64,
      initials: input.initials || undefined,
      comment: input.comment || undefined,
      pow_nonce: nonce,
      pow_bucket: bucket,
    }),
  });

  if (res.status === 201) {
    const body = (await res.json()) as { signature_token?: string | null };
    return { status: "ok", signatureToken: body.signature_token ?? null };
  }
  if (res.status === 409) return { status: "duplicate" };
  if (res.status === 429) return { status: "rate_limited" };
  const body = await res.text();
  return { status: "error", code: String(res.status), message: body };
}

export type DeleteInput = {
  nia: string;
  apiBase: string;
  powBits: number;
};

export async function deleteSignature(
  input: DeleteInput,
  onProgress?: (phase: string) => void,
): Promise<DeleteResult> {
  onProgress?.("hashing");
  let commitmentB64: string;
  try {
    commitmentB64 = await commit(input.nia);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "error", code: "invalid_nia", message };
  }

  onProgress?.("proof_of_work");
  const bucket = currentPowBucket();
  const nonce = await minePoW(commitmentB64, bucket, input.powBits);

  onProgress?.("submitting");
  const res = await fetch(`${input.apiBase}/api/sign`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commitment: commitmentB64, pow_nonce: nonce, pow_bucket: bucket }),
  });

  if (res.status === 200) return { status: "deleted" };
  if (res.status === 404) return { status: "not_found" };
  if (res.status === 429) return { status: "rate_limited" };
  const body = await res.text();
  return { status: "error", code: String(res.status), message: body };
}

export function currentPowBucket(): number {
  return Math.floor(Date.now() / 1000 / 300);
}

async function minePoW(commitment: string, bucket: number, bits: number): Promise<string> {
  for (let i = 0; ; i++) {
    const nonce = i.toString(36);
    const hex = await sha256Hex(`${commitment}:${nonce}:${bucket}`);
    if (leadingZeroBits(hex) >= bits) return nonce;
    if (i > 10_000_000) throw new Error("PoW mining gave up");
  }
}

function leadingZeroBits(hex: string): number {
  let zeroBits = 0;
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.slice(i, i + 2), 16);
    if (b === 0) {
      zeroBits += 8;
      continue;
    }
    let v = b;
    while ((v & 0x80) === 0) {
      zeroBits++;
      v <<= 1;
    }
    break;
  }
  return zeroBits;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
