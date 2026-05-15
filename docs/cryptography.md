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
2. **One-wayness conditional on the input space** — given a commitment, recovering the NIA requires testing candidates. **In Level 1 this is not a hard barrier** for an attacker who holds the official NIA registry (see threat model below). Level 2 closes this gap.
3. **Anonymity against the public** — the public ledger contains only commitments. The defence depends on the deployment level.
4. **Verifiability by the Govern** — the Govern holds the list, so it can compute `commit(NIA_i)` for every official NIA and intersect with the published snapshot. The result is a count, not a list.
5. **Public auditability** — every snapshot is committed to a public Git repository with an RFC 6962 Merkle root (domain-separated leaves and nodes; duplicates rejected). Any third party can verify the integrity of the snapshot.

## Pipeline

There are two layers, and which one is active is a deployment choice:

**Level 1 (current, public-salt only):**
```
client:  commitment_b64 = Argon2id(NIA, PUBLIC_SALT, 256 MiB × 4, len=32)  →  POST
server:  stored = commitment_b64
```

**Level 2 (after the 5-of-7 custodian ceremony has been held and `SECRET_SALT_B64` is set on the Worker):**
```
client:  commitment_b64 = Argon2id(NIA, PUBLIC_SALT, 256 MiB × 4, len=32)  →  POST
server:  stored = base64( HMAC-SHA256(SECRET_SALT, decode_b64(commitment_b64)) )
```

The browser never sees the secret salt — it cannot, since the browser is trusted by no one. The Worker applies the HMAC layer **after** receiving the client commitment, and the snapshot publishes the post-HMAC value. At audit time, the Govern's script re-runs the full pipeline (`audit/audit.py` with `--secret-salt`) against the official NIA registry.

## Threat model

| Adversary | Resources | Anonymity holds in Level 1? | In Level 2? | Why |
|---|---|---|---|---|
| General public | site, snapshots, source code | **Practically yes** (brute force the full 10⁷-NIA space costs single-digit days of cloud compute, ~€40–€100; out of reach for casual actors, in reach for motivated ones) | **Yes** (the snapshot is a per-row HMAC keyed by 256-bit unknown salt; brute force is 2²⁵⁶) | See "Brute-force economics" below. |
| Hostile actor with a leaked NIA registry | list (~28k) + everything above | **No.** ~30–60 wallclock minutes on one rented box (~€1) builds a full lookup table. The 4 CPU-hour figure assumed sequential single-thread, which is wrong for memory-bound Argon2id at this size. | **Yes** until the salt is reconstituted (5-of-7 custodians cooperating publicly at end of petition). | Memory-bandwidth-bound parallelism on commodity DDR5 ≈ 10–15 hashes/s/box. |
| Govern d'Andorra | the registry, full legal authority | Anonymity does not hold technically. | Same. The Govern can audit the count; it is **legally bound** (APDA law, Llei 29/2021) and politically bound not to publish individual matches. | The cryptography is not a defence against the legitimate registry holder. The legal and political contract is. |
| Coalition of ≥ 5 custodians + leaked NIA list | the salt + the list | n/a (Level 2 prerequisite) | **No, but loud.** Requires 5 named custodians publicly conspiring + an illegal registry exfiltration. Both events are politically catastrophic and detectable. | This is the only "successful attack" path on Level 2. |
| Single rogue custodian (or up to 4 colluding) | up to 4 of 7 shares | n/a | **Yes.** Shamir 5-of-7: any subset of 4 or fewer shares leaks no information about the secret. | Information-theoretic property of the SSS scheme. |

## The honest Level 1 statement

Level 1 alone does **not** protect against a hostile actor who holds the NIA registry. The threat is real: a leak of the Servei d'Immigració's registry has happened in other administrations, and we cannot rule it out here. **The defence in Level 1 is therefore primarily legal and political**:

- The Govern is bound by APDA law not to publish individual matches.
- The registry leak event is a major political and criminal incident on its own, independent of this platform.
- Until Level 2 is active, signatories should know that the cryptographic anonymity is contingent on the registry remaining under legitimate control.

This is why the project's launch communications need to carry the message: **the credibility of the petition's anonymity ramps up the day the 5-of-7 ceremony takes place**. Until then, the system is honest but not strong against an adversary holding the registry. Once Level 2 is on, the cryptographic defence becomes information-theoretic until the custodians convene.

## Choice of Argon2id parameters

We target ~500 ms on a modern desktop browser. This means ~3–5 s on a low-end smartphone. Acceptable for a single civic act per lifetime.

- `time_cost = 4` — minimum recommended for interactive use by the Argon2 authors.
- `memory_cost = 256 MiB` — the dominant cost; bandwidth-bound, not CPU-bound.
- `parallelism = 2` — matches the constraints of the WebAssembly Argon2 implementation (`hash-wasm`).
- `hash_length = 32 bytes` — collision probability negligible for input space sizes under 2³² (we are at 10⁷ for the syntactic NIA space, ~28k for the actual registry).

## Brute-force economics

Argon2id at `m=256 MiB, t=4, p=2` is memory-bandwidth-bound. On commodity DDR4/DDR5 (50 GB/s), a single rented bare-metal box (≈€100/month) sustains ~10 hashes/s when running multiple in parallel.

| Adversary | Effort | Cost |
|---|---|---|
| Journalist with leaked registry (~28k NIAs) | 28k ÷ 10 h/s on one box | **~45 minutes, < €1** |
| Hostile cluster (10 boxes) | 28k ÷ 100 h/s | **~5 minutes, < €5** |
| Public adversary, full 10⁷ brute force | 10⁷ ÷ 10 h/s, one box | **~11.6 days, ~€40 cloud spot** |
| Public adversary, full 10⁷, 100-box fleet | 10⁷ ÷ 1000 h/s | **~2.8 hours, ~€100** |
| State-level with registry | 28k × HMAC + Argon2id | minutes, ~€0 |

These numbers correct the earlier draft of this document, which framed Level 1 brute force as "infeasible". It is not. **Hardening cryptographically against a registry-holder is what Level 2 does, and Level 2 is the priority before any significant media exposure.**

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

**Where the salt enters the pipeline (important):** it is applied *server-side* as an HMAC-SHA256 over the client's Argon2id commitment (see `apps/api/src/utils.ts:applySecretSaltMix`). It is **not** included in the Argon2id `salt` argument, because the browser cannot know it. This means:

- Before the salt is set, the stored commitments are equal to the client commitments. Once the salt is set, all future commitments are HMAC'd with it. **Switching from Level 1 to Level 2 invalidates the deduplication continuity for any prior signatures**: a person who signed in Level 1 and tries to re-sign in Level 2 will produce a different `stored` value and bypass the UNIQUE check. **Plan the transition accordingly: either deploy Level 2 before opening to the public, or accept a one-time re-hash migration.**
- At audit time, the Govern's script (`audit/audit.py`) recomputes the same chain: Argon2id over each official NIA, then HMAC with the reconstituted salt. The expected snapshot match equals the count of valid signatures.

## What this design does *not* protect against

- **A nation-state adversary who obtains both the registry and the secret salt.** The system is not a perfect zero-knowledge proof; we trade theoretical perfection for political plausibility and operational simplicity.
- **A correlation attack on commentary.** The comments table has no foreign key to commitments, so individual comments cannot be tied to commitments by reading the database. But comments are timestamped at the hour, so coarse statistical correlation may still be possible for active commenters. Users who want maximum privacy should not leave comments.
- **A coercion attack on a single signer** (asking them to prove they signed). Anyone can prove they signed by re-computing their commitment and showing it is in the snapshot. This is a property of any deterministic-commit scheme. If this is unacceptable, the system needs to move to a randomised commitment with a zero-knowledge proof of membership — out of scope for v1.

## Public parameters file

Single source of truth: [`packages/crypto/src/params.ts`](../packages/crypto/src/params.ts). Mirrored in [`audit/audit.py`](../audit/audit.py). Reference test vectors in [`packages/crypto/tests/fixtures/commitment_vectors.json`](../packages/crypto/tests/fixtures/commitment_vectors.json).
