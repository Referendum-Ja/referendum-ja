import { describe, it, expect } from "vitest";
import { commit } from "../src/commit.ts";
import vectors from "./fixtures/commitment_vectors.json" with { type: "json" };

// These tests use the frozen public salt (Level 1) only. Level 2 vectors live
// alongside the sealed-salt ceremony documentation and are not committed in
// plain to the repository.

describe("commit() — determinism", () => {
  it("produces the same commitment for the same NIA", async () => {
    const a = await commit("123456A");
    const b = await commit("123456A");
    expect(a).toBe(b);
  });

  it("produces the same commitment regardless of input formatting", async () => {
    const a = await commit("123456A");
    const b = await commit(" 123-456-a ");
    expect(a).toBe(b);
  });

  it("produces different commitments for different NIAs", async () => {
    const a = await commit("123456A");
    const b = await commit("123456B");
    expect(a).not.toBe(b);
  });
}, { timeout: 30_000 });

describe("commit() — reference vectors", () => {
  for (const v of vectors.level1) {
    it(`matches reference vector ${v.nia}`, async () => {
      const out = await commit(v.nia);
      expect(out).toBe(v.commitment_b64);
    });
  }
}, { timeout: 60_000 });

describe("commit() — invalid inputs", () => {
  it("rejects an empty NIA before doing crypto", async () => {
    await expect(commit("")).rejects.toThrow(/empty/i);
  });

  it("rejects a passport number masquerading as a NIA", async () => {
    await expect(commit("PP1234567")).rejects.toThrow(/format/i);
  });
});
