export type Env = {
  DB: D1Database;
  PUBLIC_SALT: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  RATE_LIMIT_MAX: string;
  POW_BITS: string;
  IP_HASH_SALT?: string;
  SIGNATURE_TOKEN_HMAC?: string;
  SECRET_SALT_B64?: string;
  ARCHIVE_GITHUB_TOKEN?: string;
};

export function getInt(env: Env, key: keyof Env, fallback: number): number {
  const v = env[key];
  if (typeof v !== "string") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
