// One-shot script to populate tests/fixtures/commitment_vectors.json with real
// Argon2id outputs. Run once after `pnpm install`, then commit the resulting
// file and sign the commit with GPG. After that, the fixtures act as the
// reference contract — both the audit script and the browser MUST produce
// these exact values.
//
// Usage: pnpm tsx packages/crypto/scripts/generate-vectors.ts

import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commit } from "../src/commit.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "../tests/fixtures/commitment_vectors.json");

type Fixture = {
  _meta: Record<string, unknown>;
  level1: Array<{ nia: string; commitment_b64: string }>;
};

const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

for (const v of fixture.level1) {
  v.commitment_b64 = await commit(v.nia);
  console.log(`${v.nia.padEnd(20)} -> ${v.commitment_b64}`);
}

fixture._meta.generated_at = new Date().toISOString();

writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
console.log(`\nWrote ${fixture.level1.length} vectors to ${fixturePath}`);
console.log("Now: git add, commit with a GPG-signed tag, and never modify these values.");
