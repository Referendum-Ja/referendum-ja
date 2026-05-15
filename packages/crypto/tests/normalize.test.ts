import { describe, it, expect } from "vitest";
import { normalize, isValid, normalizeAndValidate, InvalidNiaError } from "../src/normalize.ts";

describe("normalize", () => {
  it("trims, uppercases, strips separators", () => {
    expect(normalize(" 123 456 a ")).toBe("123456A");
    expect(normalize("123-456-a")).toBe("123456A");
    expect(normalize("123.456_a")).toBe("123456A");
    expect(normalize("123456a")).toBe("123456A");
  });

  it("normalises NFKC unicode", () => {
    expect(normalize("Ⅴ")).toBe("V"); // roman numeral five → ASCII V via NFKC
  });

  it("is idempotent", () => {
    const a = normalize(" 123 456 a ");
    const b = normalize(a);
    expect(a).toBe(b);
  });
});

describe("isValid", () => {
  it("accepts the canonical NIA format (6 digits + 1 letter)", () => {
    expect(isValid("123456A")).toBe(true);
    expect(isValid("000000Z")).toBe(true);
    expect(isValid("999999B")).toBe(true);
  });

  it("rejects passport numbers (PP + 7 digits)", () => {
    expect(isValid("PP1234567")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(isValid("12345A")).toBe(false);
    expect(isValid("1234567A")).toBe(false);
    expect(isValid("123456")).toBe(false);
  });

  it("rejects wrong character classes", () => {
    expect(isValid("12345AB")).toBe(false);
    expect(isValid("A23456A")).toBe(false);
    expect(isValid("123456a")).toBe(false); // must be uppercase post-normalisation
  });
});

describe("normalizeAndValidate", () => {
  it("returns the normalised NIA when valid", () => {
    expect(normalizeAndValidate(" 123-456-a ")).toBe("123456A");
  });

  it("throws InvalidNiaError on empty input", () => {
    expect(() => normalizeAndValidate("   ")).toThrow(InvalidNiaError);
    try {
      normalizeAndValidate("");
    } catch (e) {
      expect((e as InvalidNiaError).reason).toBe("empty");
    }
  });

  it("throws InvalidNiaError on format mismatch", () => {
    expect(() => normalizeAndValidate("PP1234567")).toThrow(InvalidNiaError);
    try {
      normalizeAndValidate("XYZ");
    } catch (e) {
      expect((e as InvalidNiaError).reason).toBe("format");
    }
  });
});
