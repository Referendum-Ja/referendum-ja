# Cryptographic design

> Audience: cryptographers, security reviewers, journalists with a technical background, civil-society auditors. This document is the canonical reference for the system's anonymity contract. Any contradiction between this document and the code is a bug.

## Summary

A signature in ReferendumJa is the output of a slow, salted, key-stretching function applied to the signer's Andorran NIA. The function is deterministic, so the same NIA always produces the same commitment, which is how duplicates are prevented. The function is also pre-image resistant under the chosen parameters, so the commitment does not leak the NIA to anyone who does not already hold the official list of valid NIAs.

```
commitment = Argon2id(
  password = normalise(NIA),
  salt     = PUBLIC_SALT [|| SECRET_SALT],
  params   = { time=4, memory=256 MiB, parallelism=2, length=32 bytes }
)
```

The cardinality of the input space is small (the Andorran citizen body is ≈ 26–28 000 people). This is the central design constraint. A naive hash would be inverted in seconds by anyone with the registry. Argon2id is the answer: invertible only by those willing to spend hours of compute, and only against a list they already hold.

## Properties

1. **Determinism** — `commit(NIA)` always returns the same value. This is what allows the database `UNIQUE` constraint on `commitment` to act as a deduplicator.
2. **One-wayness conditional on the input space** — given a commitment, recovering the NIA requires testing candidates from the input space. If the attacker holds the official list (~28 k entries), this takes 4 to 8 CPU-hours on a modern server in Level 1, considerably more in Level 2 (where the secret salt is unknown until the public ceremony).
3. **Anonymity against the public** — the public ledger contains only commitments. Without the list of NIAs, a brute-force attack must explore the entire format space (10 million combinations × Argon2id ≈ infeasible).
4. **Verifiability by the Govern** — the Govern holds the list, so it can compute `commit(NIA_i)` for every official NIA and intersect with the published snapshot. The result is a count, not a list.
5. **Public auditability** — every snapshot is committed to a public Git repository with a Merkle root. Any third party can verify the integrity of the snapshot and re-run the audit if they obtain a list of NIAs (which only the Govern legitimately has).

## Threat model

| Adversary | Resources | Anonymity holds? | Why |
|---|---|---|---|
| General public | The site, the snapshots, the source code | **Yes** | No access to the NIA list. Brute-forcing 10⁷ NIA candidates through Argon2id (256 MiB × 4) is computationally significant but possible for a determined adversary in Level 1. Level 2 makes it infeasible because the secret salt is unknown. |
| Journalist with a leaked NIA list | The list + everything above | **Conditional** | In Level 1: 4–8 CPU-hours to deanonymise. In Level 2: infeasible until the secret salt is reconstituted, which requires the cooperation of 5 of the 7 public custodians (one per Andorran parish, in homage to the *Armari de les Set Claus* at the [Casa de la Vall](https://www.casadelavall.ad/fr/interior)), all of whom have committed publicly to release it only at the end of the petition. |
| Govern d'Andorra | The official list, full legal authority | Anonymity does not hold technically — but the Govern is **bound by APDA law** and by political accountability not to publish individual matches. The system reduces the attack to a procedural one, not a cryptographic one. |
| Coalition of ≥ 5 custodians + leaked NIA list | The Level-2 secret salt + the list | **No, but loud** | This is the only path to total deanonymisation. It requires a public ceremony breach by 5 named custodians out of 7 + an illegal exfiltration of the official registry. Both events are politically catastrophic and detectable. |
| Single rogue custodian (or up to 4 colluding) | Up to 4 of 7 shares | **Yes** | Shamir 5-of-7: any subset of 4 or fewer shares leaks no information about the secret. |

## Choice of Argon2id parameters

We targeted ~500 ms on a modern desktop browser. This means ~3–5 s on a low-end smartphone. We consider this acceptable for a single civic act per lifetime.

- `time_cost = 4` — minimum recommended for interactive use by the Argon2 authors.
- `memory_cost = 256 MiB` — the dominant cost; this is what prevents GPU acceleration.
- `parallelism = 2` — matches the constraints of the WebAssembly Argon2 implementation we use (`hash-wasm`).
- `hash_length = 32 bytes` — collision probability negligible for input space sizes under 2³² (we are at 10⁷).

Cost estimate for an attacker with the registry:

- ~28 000 NIAs × 0.5 s/hash ≈ 14 000 s ≈ 4 CPU-hours per machine.
- On a 16-core machine with sufficient RAM bandwidth: ~15 min.
- On a small cluster: minutes.

This is faster than we would like for Level 1 alone, which is why Level 2 is **strongly recommended** before any significant media exposure. The Level 2 secret salt makes the attack require an additional 2²⁵⁶ effort, which is infeasible.

## Normalisation

```ts
normalise(input) =
  input.normalize("NFKC")
       .trim()
       .toUpperCase()
       .replace(/[\s\-_.]/g, "")
```

After normalisation, the NIA must match `/^[0-9]{6}[A-Z]$/`. Inputs that fail this check are rejected client-side before any commitment is computed. This prevents a single user from producing multiple distinct commitments through typo variations and prevents the inadvertent use of passport numbers (`PP1234567`) in place of the NIA.

## Sealed secret salt (Level 2)

The secret salt is 32 random bytes, generated once on an air-gapped machine, split into 7 Shamir shares with threshold 5, and distributed to seven public custodians — one per Andorran parish, in homage to the *Armari de les Set Claus* at the [Casa de la Vall](https://www.casadelavall.ad/fr/interior), the historical seven-locked cabinet of the national archives. The ceremony is filmed; the shares are physical (USB key + paper backup, sealed in tamper-evident envelopes).

The Worker loads the secret salt from a sealed Wrangler secret (`SECRET_SALT_B64`), set once and never rotated. Rotation is impossible by design: rotating the salt would invalidate every prior commitment.

## What this design does *not* protect against

- **A nation-state adversary who obtains both the registry and the secret salt.** The system is not a perfect zero-knowledge proof; we trade theoretical perfection for political plausibility and operational simplicity.
- **A correlation attack on commentary.** The comments table has no foreign key to commitments, so individual comments cannot be tied to commitments by reading the database. But comments are timestamped at the hour, so coarse statistical correlation may still be possible for active commenters. Users who want maximum privacy should not leave comments.
- **A coercion attack on a single signer** (asking them to prove they signed). Anyone can prove they signed by re-computing their commitment and showing it is in the snapshot. This is a property of any deterministic-commit scheme. If this is unacceptable, the system needs to move to a randomised commitment with a zero-knowledge proof of membership — out of scope for v1.

## Public parameters file

Single source of truth: [`packages/crypto/src/params.ts`](../packages/crypto/src/params.ts). Mirrored in [`audit/audit.py`](../audit/audit.py). Reference test vectors in [`packages/crypto/tests/fixtures/commitment_vectors.json`](../packages/crypto/tests/fixtures/commitment_vectors.json).
