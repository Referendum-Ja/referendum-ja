// Frozen cryptographic parameters for ReferendumJa.
//
// CRITICAL: these values define the commitment function. Changing any of them
// after launch invalidates every prior signature and breaks the petition.
// They are duplicated in audit/audit.py and MUST stay in lockstep.

export const PUBLIC_SALT = "petitio-referendum-andorra-2026-v1";

export const ARGON2ID_PARAMS = {
  // Argon2id variant
  variant: "argon2id" as const,
  // Iterations (time cost). 4 is the minimum recommended for interactive use.
  iterations: 4,
  // Memory cost in KiB. 262144 KiB = 256 MiB.
  memorySize: 262_144,
  // Parallelism (lanes).
  parallelism: 2,
  // Output length in bytes.
  hashLength: 32,
} as const;

// When null the system is in Level 1 (public-salt only).
// When set (32 random bytes, base64-encoded) the system is in Level 2 with a
// Shamir 3-of-5 sealed salt held by 5 public custodians.
// In production this is loaded from a Workers secret binding; in tests it is
// null. The audit script accepts the secret salt as a CLI argument.
export type SecretSalt = Uint8Array | null;

export function getSecretSaltFromEnv(env: { SECRET_SALT_B64?: string }): SecretSalt {
  if (!env.SECRET_SALT_B64) return null;
  const bin = atob(env.SECRET_SALT_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length !== 32) {
    throw new Error("SECRET_SALT_B64 must decode to exactly 32 bytes");
  }
  return bytes;
}
