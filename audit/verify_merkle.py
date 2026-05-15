#!/usr/bin/env python3
"""
Reconstruct the RFC 6962 Merkle root of a snapshot CSV and print it.

Usage:
    python3 verify_merkle.py snapshots/2026-05-15.csv

Algorithm (matches apps/api/src/snapshot.ts):
  - Read all commitments, one per line.
  - REJECT duplicates (an inflation attack vector if accepted).
  - Sort lexicographically.
  - Leaf hash:    sha256(0x00 || commitment_b64_bytes)
  - Node hash:    sha256(0x01 || left || right)
  - Odd layers:   the unpaired node is promoted unchanged (no duplication).
  - Root:         the single remaining hash.

The 0x00/0x01 domain separation neutralises the classic Bitcoin-style
second-preimage attack where appending a duplicated leaf would yield the
same root.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def leaf_hash(commitment_b64: str) -> str:
    return sha256_hex(b"\x00" + commitment_b64.encode("ascii"))


def node_hash(left_hex: str, right_hex: str) -> str:
    return sha256_hex(b"\x01" + bytes.fromhex(left_hex) + bytes.fromhex(right_hex))


def merkle_root(commitments: list[str]) -> str:
    if not commitments:
        return "0" * 64
    layer = [leaf_hash(c) for c in commitments]
    while len(layer) > 1:
        nxt: list[str] = []
        for i in range(0, len(layer), 2):
            left = layer[i]
            if i + 1 < len(layer):
                nxt.append(node_hash(left, layer[i + 1]))
            else:
                # Promote unpaired node unchanged (do NOT duplicate).
                nxt.append(left)
        layer = nxt
    return layer[0]


def main() -> int:
    if len(sys.argv) != 2:
        sys.stderr.write("Usage: verify_merkle.py SNAPSHOT.csv\n")
        return 2
    path = Path(sys.argv[1])
    commitments = [line.strip() for line in path.read_text().splitlines() if line.strip()]
    if len(set(commitments)) != len(commitments):
        sys.stderr.write("FATAL: duplicate commitments in snapshot — refusing to compute root.\n")
        return 3
    commitments.sort()
    print(merkle_root(commitments))
    return 0


if __name__ == "__main__":
    sys.exit(main())
