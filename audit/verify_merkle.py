#!/usr/bin/env python3
"""
Reconstruct the SHA-256 Merkle root of a snapshot CSV and print it.

Usage:
    python3 verify_merkle.py snapshots/2026-05-15.csv

Algorithm (matches apps/api/src/snapshot.ts):
  - Read all commitments, one per line.
  - Sort lexicographically.
  - Leaves = sha256(commitment_b64) as hex.
  - Each layer pairs leaves; if odd, duplicate the last one.
  - Root = single remaining hash.

This is intentionally trivial so the implementation can be re-checked by hand.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path


def sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("ascii")).hexdigest()


def merkle_root(leaves: list[str]) -> str:
    if not leaves:
        return "0" * 64
    layer = [sha256_hex(c) for c in leaves]
    while len(layer) > 1:
        nxt: list[str] = []
        for i in range(0, len(layer), 2):
            left = layer[i]
            right = layer[i + 1] if i + 1 < len(layer) else left
            nxt.append(sha256_hex(left + right))
        layer = nxt
    return layer[0]


def main() -> int:
    if len(sys.argv) != 2:
        sys.stderr.write("Usage: verify_merkle.py SNAPSHOT.csv\n")
        return 2
    path = Path(sys.argv[1])
    commitments = [line.strip() for line in path.read_text().splitlines() if line.strip()]
    commitments.sort()
    print(merkle_root(commitments))
    return 0


if __name__ == "__main__":
    sys.exit(main())
