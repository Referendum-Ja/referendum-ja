import { argon2id } from "hash-wasm";
import { ARGON2ID_PARAMS, PUBLIC_SALT, type SecretSalt } from "./params.ts";
import { normalizeAndValidate } from "./normalize.ts";

// Computes the commitment for a given NIA.
//
// commitment = Argon2id(
//   password = normalised_NIA,
//   salt     = PUBLIC_SALT || (SECRET_SALT if level 2, else empty),
//   params   = ARGON2ID_PARAMS
// )
//
// Returns a base64 (standard, with padding) string of 32 bytes.
//
// The password (NIA) is normalised and validated first. Any invalid input
// throws InvalidNiaError synchronously before any cryptographic work happens.

export async function commit(rawNia: string, secretSalt: SecretSalt = null): Promise<string> {
  const nia = normalizeAndValidate(rawNia);

  const saltBytes = buildSalt(secretSalt);

  const hashHex = await argon2id({
    password: nia,
    salt: saltBytes,
    parallelism: ARGON2ID_PARAMS.parallelism,
    iterations: ARGON2ID_PARAMS.iterations,
    memorySize: ARGON2ID_PARAMS.memorySize,
    hashLength: ARGON2ID_PARAMS.hashLength,
    outputType: "hex",
  });

  return hexToBase64(hashHex);
}

function buildSalt(secretSalt: SecretSalt): Uint8Array {
  const publicSaltBytes = new TextEncoder().encode(PUBLIC_SALT);
  if (!secretSalt) return publicSaltBytes;
  const out = new Uint8Array(publicSaltBytes.length + secretSalt.length);
  out.set(publicSaltBytes, 0);
  out.set(secretSalt, publicSaltBytes.length);
  return out;
}

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
