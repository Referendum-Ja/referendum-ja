#!/usr/bin/env python3
"""
ReferendumJa governmental audit script.

Designed to be run AIR-GAPPED on a trusted machine that has access to the
official list of Andorran NIA numbers (held by the Servei d'Immigració /
Servei de Nacionalitat i Passaports).

Inputs:
  --nia-list      CSV with one normalised NIA per line (column header: nia).
  --snapshot      CSV with one commitment per line (column header: commitment).
                  Get it from the public archive repository.
  --secret-salt   base64 of 32 bytes, only if running in Level 2 mode.
                  Reconstituted from the 3-of-5 Shamir shares held by the
                  five public custodians.

Outputs (to stdout, machine-readable JSON):
  {
    "valid_count":   <int>,      # commitments matching a real Andorran NIA
    "invalid_count": <int>,      # commitments with no NIA match
    "total":         <int>,
    "params": { ... },           # the frozen Argon2id parameters used
    "snapshot_sha256": "<hex>",
    "nia_list_sha256": "<hex>",
    "audit_timestamp_utc": "<iso8601>"
  }

The script never writes the matched NIA values anywhere. The matching is
in-memory and the only output is an aggregate count.

Reference parameters (must mirror packages/crypto/src/params.ts):
"""
from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import hmac
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    from argon2.low_level import Type, hash_secret_raw  # type: ignore
except ImportError:
    sys.stderr.write(
        "FATAL: argon2-cffi is not installed. Inside the air-gapped container, "
        "run `pip install argon2-cffi==23.1.0` from the bundled wheels.\n"
    )
    sys.exit(2)


PUBLIC_SALT = b"petitio-referendum-andorra-2026-v1"
ARGON2ID = {
    "time_cost": 4,
    "memory_cost": 262_144,  # KiB
    "parallelism": 2,
    "hash_len": 32,
    "type": Type.ID,
}
NIA_REGEX = re.compile(r"^[0-9]{6}[A-Z]$")


def normalise(raw: str) -> str:
    s = unicodedata.normalize("NFKC", raw).strip().upper()
    return re.sub(r"[\s\-_.]+", "", s)


def client_commit(nia: str) -> bytes:
    """The same Argon2id commitment the signatory's browser produced. Always
    salted with PUBLIC_SALT only — the secret salt does NOT enter the password
    derivation, exactly because the browser cannot know it."""
    n = normalise(nia)
    if not NIA_REGEX.match(n):
        raise ValueError(f"invalid NIA after normalisation: {n!r}")
    return hash_secret_raw(
        secret=n.encode("ascii"),
        salt=PUBLIC_SALT,
        time_cost=ARGON2ID["time_cost"],
        memory_cost=ARGON2ID["memory_cost"],
        parallelism=ARGON2ID["parallelism"],
        hash_len=ARGON2ID["hash_len"],
        type=ARGON2ID["type"],
    )


def commit(nia: str, secret_salt: bytes | None) -> str:
    """The stored commitment, mirroring the Worker pipeline:
       1. Argon2id over the NIA with PUBLIC_SALT (the browser side).
       2. If a secret salt is provided (Level 2), apply HMAC-SHA256 over the
          Argon2id output keyed by the secret salt — this is what the Worker
          does in apps/api/src/utils.ts:applySecretSaltMix.
       Level 1 (secret_salt is None) yields the raw client commitment."""
    raw = client_commit(nia)
    if secret_salt is not None:
        if len(secret_salt) != 32:
            raise ValueError("secret_salt must be exactly 32 bytes")
        raw = hmac.new(secret_salt, raw, hashlib.sha256).digest()
    return base64.b64encode(raw).decode("ascii")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def read_column(path: Path, column: str) -> list[str]:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if column not in (reader.fieldnames or []):
            raise SystemExit(f"column {column!r} not found in {path}; headers: {reader.fieldnames}")
        return [row[column] for row in reader if row.get(column)]


def main() -> int:
    ap = argparse.ArgumentParser(description="ReferendumJa governmental audit")
    ap.add_argument("--nia-list", required=True, type=Path, help="Official CSV of valid Andorran NIA numbers (column: nia)")
    ap.add_argument("--snapshot", required=True, type=Path, help="Snapshot CSV from the archive (column: commitment)")
    ap.add_argument("--secret-salt", default=None, help="Level 2 secret salt, base64-encoded (32 bytes)")
    ap.add_argument("--workers", type=int, default=1, help="Currently unused; placeholder for future parallel mode")
    args = ap.parse_args()

    if args.secret_salt:
        secret = base64.b64decode(args.secret_salt)
        if len(secret) != 32:
            raise SystemExit("--secret-salt must decode to exactly 32 bytes")
    else:
        secret = None

    sys.stderr.write(f"[audit] reading official NIA list: {args.nia_list}\n")
    nias = read_column(args.nia_list, "nia")
    sys.stderr.write(f"[audit] {len(nias)} NIA numbers loaded\n")

    sys.stderr.write(f"[audit] reading snapshot: {args.snapshot}\n")
    raw_commitments = read_column(args.snapshot, "commitment")
    snapshot_commitments = set(raw_commitments)
    if len(snapshot_commitments) != len(raw_commitments):
        sys.stderr.write(
            f"FATAL: snapshot contains {len(raw_commitments) - len(snapshot_commitments)} "
            "duplicate commitment(s). This should never happen under the UNIQUE constraint; "
            "the snapshot is corrupt or has been tampered with. Aborting.\n"
        )
        return 3
    sys.stderr.write(f"[audit] {len(snapshot_commitments)} commitments in snapshot (no duplicates)\n")

    sys.stderr.write(f"[audit] computing commitments for every official NIA — this is the expensive step\n")
    valid = 0
    for i, raw in enumerate(nias, 1):
        try:
            c = commit(raw, secret)
        except ValueError as e:
            sys.stderr.write(f"  skipping malformed NIA at row {i}: {e}\n")
            continue
        if c in snapshot_commitments:
            valid += 1
        if i % 500 == 0:
            sys.stderr.write(f"  processed {i}/{len(nias)} NIA numbers\n")

    invalid = len(snapshot_commitments) - valid
    result = {
        "valid_count": valid,
        "invalid_count": invalid,
        "total": len(snapshot_commitments),
        "params": {
            "public_salt": PUBLIC_SALT.decode(),
            "argon2id": {k: v for k, v in ARGON2ID.items() if k != "type"} | {"variant": "argon2id"},
            "level": 2 if secret else 1,
        },
        "snapshot_sha256": sha256_file(args.snapshot),
        "nia_list_sha256": sha256_file(args.nia_list),
        "audit_timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
