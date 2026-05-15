# ReferendumJa

Plataforma de petició verificable per a demanar un referèndum consultatiu abans de la signatura de l'acord d'associació entre Andorra i la Unió Europea.

Plateforme de pétition vérifiable / Verifiable petition platform.

## Resum / Résumé / Summary

| | |
|---|---|
| CA | Cada ciutadà andorrà pot signar una vegada. La identitat no és coneguda per l'organitzador ni pel públic. El Govern, que disposa de la llista oficial dels NIA andorrans, pot auditar el nombre de signatures vàlides sense poder publicar qui ha signat. |
| FR | Chaque citoyen andorran peut signer une fois. L'identité n'est connue ni de l'organisateur ni du public. Le Govern, qui détient la liste officielle des NIA andorrans, peut auditer le nombre de signatures valides sans pouvoir publier qui a signé. |
| EN | Each Andorran citizen can sign once. Identity is known neither to the organiser nor to the public. The Govern, who holds the official list of Andorran NIA numbers, can audit the count of valid signatures without being able to publish who signed. |

## Architecture

- **Frontend** : Astro + Svelte islands → Cloudflare Pages
- **API** : Hono on Cloudflare Workers
- **Database** : Cloudflare D1 (SQLite)
- **Crypto** : Argon2id (hash-wasm in browser, argon2-cffi in audit script)
- **Snapshots** : daily Cron Workers → signed Merkle root pushed to public archive repo
- **License** : AGPL-3.0

## Repository layout

```
apps/
  web/        Astro frontend (CA / FR / ES)
  api/        Cloudflare Workers API
packages/
  crypto/     Shared commit() function with frozen parameters and test vectors
audit/        Python audit script for the Govern (air-gapped, reproducible)
docs/         Cryptographic design, sealed-salt ceremony protocol
```

## Cryptographic contract

A signature is a `commitment = Argon2id(normalize(NIA), public_salt [|| secret_salt], frozen_params)`.

- **Frozen public parameters** : see [packages/crypto/src/params.ts](packages/crypto/src/params.ts). They MUST never change after launch — any change would invalidate all prior signatures.
- **Secret salt (Level 2)** : 32 random bytes, Shamir 5-of-7 split between seven public custodians — one per Andorran parish, in homage to the *Armari de les Set Claus* at the [Casa de la Vall](https://www.casadelavall.ad/fr/interior). Applied server-side as an HMAC layer over the client-side Argon2id commitment. Reconstituted only at the end of the collection, in a public ceremony, and only for the Govern's official audit.

The NIA (Número d'Identificació Administrativa) is **never transmitted to the server**. The commitment is computed in the browser via WebAssembly Argon2id.

## Status

Live in Level 1 at [noalacord.com](https://noalacord.com). API at `api.noalacord.com`. Level 2 (sealed salt) deployed when the 5-of-7 custodian ceremony has been held. See [docs/cryptography.md](docs/cryptography.md) for the full design.

## License

AGPL-3.0. Any hosted fork must remain open source.
