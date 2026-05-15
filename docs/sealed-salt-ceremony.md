# Sealed-salt ceremony (Level 2) — *l'Armari de les Set Claus*

> Public protocol for the generation and split of the secret salt used in Level 2. The design is a direct homage to the *Armari de les Set Claus* at the [Casa de la Vall](https://www.casadelavall.ad/fr/interior), the seven-locked cabinet that historically held the Andorran national archives — each of the seven Councillors representing one of the seven parishes held a distinct key, and all had to be present to open the cabinet.

## Why this exists

The Level 1 design (public salt only) is vulnerable to any adversary who obtains the official list of Andorran NIAs: they can deanonymise the petition in ~4 CPU-hours. To raise the bar to "infeasible", Level 2 adds a 32-byte **secret salt** that is split between seven public custodians using Shamir Secret Sharing with threshold 5.

While the petition is being collected:
- The salt is **never** held in full by any single person.
- Any four custodians colluding learn nothing about the secret (Shamir property).
- Five of the seven custodians must cooperate to reconstitute it.
- Each custodian has publicly committed not to do so until the petition concludes.

This protects against political pressure on any single actor — government, party, journalist, organiser. No single party can deanonymise the petition, and even a coalition of four cannot.

### Why 5-of-7 (and not 7-of-7)

The historical *Armari de les Set Claus* required **all seven** keys to be present. We deliberately relax the threshold to 5-of-7 for operational reasons:
- A 7-of-7 threshold makes the reconstitution ceremony impossible if any custodian becomes unavailable (illness, travel, refusal). Tolerating up to two absences keeps the final audit feasible.
- 5-of-7 is a strong supermajority (71%), comparable to the qualified-law threshold of the *Consell General* (2/3 ≈ 67%).
- 4-of-7 would be just a simple majority and is rejected as too weak against coalition pressure.

## Who are the seven custodians

To be selected and publicly named before launch. The aspiration is **one custodian per parish**, in homage to the historical seven Councillors:

1. **Andorra la Vella**
2. **Canillo**
3. **Encamp**
4. **Escaldes-Engordany**
5. **La Massana**
6. **Ordino**
7. **Sant Julià de Lòria**

The custodians do not need to be residents of their representing parish (although it is preferable). What matters is that they are **independent of each other**, publicly identifiable, and credible. Plausible profiles per parish:

- A respected local notary
- A faculty member of the Universitat d'Andorra
- A representative of the Col·legi d'Advocats d'Andorra
- A senior journalist (ARA Andorra, Diari d'Andorra, Bondia, Alto, RadioValira)
- A respected civic-society figure (cultural, sports, or religious association leadership)
- A retired magistrate, batlle, or Conseller (any party, ideally non-partisan in retirement)
- The petition organiser, Artur Homs (on behalf of Claror)

The seven names must be public, signed onto the commitment text below, and listed on the [`/com-funciona`](/) page of the platform.

## Ceremony protocol

The ceremony is **filmed in full**. The video is published on the ReferendumJa archives repository. The ceremony has 7 steps.

### 1. Verify the air-gapped machine

A fresh laptop, factory-reset, with a freshly installed Linux distribution from an immutable USB image. No network cable, Wi-Fi disabled at the hardware level if possible, Bluetooth off. The hashes of the installed ISO are read aloud and matched against the published reference.

### 2. Generate the secret salt

```bash
openssl rand -out secret-salt.bin 32
sha256sum secret-salt.bin   # read aloud, written down by every custodian
```

The hash is the **public commitment** to the salt: it lets us prove later that the salt used in production was the one generated at the ceremony.

### 3. Split with Shamir 5-of-7

Using `ssss-split` from the `ssss` package (Debian-packaged, open source, audited):

```bash
xxd -p -c 1000 secret-salt.bin | ssss-split -t 5 -n 7 -x -q > shares.txt
```

The seven shares are printed on separate sheets of paper, each with the custodian's name and their representing parish.

### 4. Hand off the shares

Each of the seven custodians receives:
- One sheet of paper with their share (and **only** their share).
- A sealed tamper-evident envelope containing a USB key with a digital copy.
- A signed receipt acknowledging their custodianship, their parish, and the public commitment.

All seven custodians physically sign each other's receipts so each holds proof of the others' participation.

### 5. Deploy the salt to production

```bash
base64 -w0 secret-salt.bin | npx wrangler secret put SECRET_SALT_B64
```

The Worker now uses the secret salt. A test signature is performed and compared against a Level-2 reference vector (`packages/crypto/tests/fixtures/commitment_vectors_level2.json`, encrypted with the salt's SHA-256 hash so it can be verified without revealing the salt itself).

### 6. Securely destroy the original

The plaintext `secret-salt.bin` on the air-gapped machine is shredded:

```bash
shred -uvz secret-salt.bin shares.txt
```

The laptop is then physically reset, disks wiped, and ideally retired.

### 7. Publish the ceremony record

To the archives repository:
- The video (raw, uncut).
- The SHA-256 commitment to the salt (the hash, **not** the salt).
- The seven signed custodianship receipts.
- This protocol document, with a Git tag signed by all seven custodians.

## Reconstitution (end of petition only)

When the petition concludes:
1. Five of the seven custodians convene in person.
2. The ceremony is again filmed.
3. The shares are combined with `ssss-combine`:
   ```bash
   ssss-combine -t 5 -q < shares.txt | xxd -r -p > secret-salt.bin
   sha256sum secret-salt.bin   # MUST match the public commitment
   ```
4. The salt is handed to the Govern (and only the Govern) for the audit procedure described in [`audit/README.md`](../audit/README.md).
5. After the audit, the salt is destroyed again. The Govern publishes the audit result.

## Public commitment text

Each of the seven custodians signs the following before the ceremony:

> I, [name and function], hereby accept to act as one of the seven public custodians of the secret salt used by the ReferendumJa petition platform, representing the parish of [parish name].
>
> I commit:
> - to keep my share private, in a physically secure location;
> - never to attempt to reconstitute the secret salt with any other custodian before the official end of the petition;
> - to participate in the reconstitution ceremony at the end of the petition, in person and on camera, only for the purpose of transmitting the salt to the Govern d'Andorra in the context of its consented audit procedure;
> - to immediately and publicly notify the organisation and the six other custodians of any attempt — by anyone, including a state actor — to obtain my share by coercion or otherwise;
> - to destroy my share definitively once the audit has been completed.
>
> I understand that the protocol requires the cooperation of at least five of the seven custodians to reconstitute the salt, in deliberate homage to the *Armari de les Set Claus* tradition of the Casa de la Vall.
>
> [Signature, date, place]
