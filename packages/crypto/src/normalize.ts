// Normalisation and validation of the Andorran NIA
// (Número d'Identificació Administrativa).
//
// Format spec: 6 digits followed by 1 letter, as printed in the MRZ of the
// Andorran ordinary passport (Reglament del 18 de gener del 2023, art. 5.4).
//
// The same NIA also appears on the Andorran DNI and on the health card.
// It is stable across passport renewals — unlike the passport number itself
// (which is PP + 7 digits and changes on every issuance).

const NIA_REGEX = /^[0-9]{6}[A-Z]$/;

export class InvalidNiaError extends Error {
  constructor(public reason: "empty" | "format") {
    super(reason === "empty" ? "NIA is empty" : "NIA does not match the expected format");
    this.name = "InvalidNiaError";
  }
}

export function normalize(input: string): string {
  return input.normalize("NFKC").trim().toUpperCase().replace(/[\s\-_.]/g, "");
}

export function isValid(normalised: string): boolean {
  return NIA_REGEX.test(normalised);
}

export function normalizeAndValidate(input: string): string {
  const n = normalize(input);
  if (n.length === 0) throw new InvalidNiaError("empty");
  if (!isValid(n)) throw new InvalidNiaError("format");
  return n;
}
