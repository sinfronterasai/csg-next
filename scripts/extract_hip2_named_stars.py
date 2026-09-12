#!/usr/bin/env python3
"""Extract the audited eight-star Hipparcos-2 subset.

Usage:
  python scripts/extract_hip2_named_stars.py hip2.dat.gz OUTPUT_DIR

The input must be the CDS/VizieR I/311/hip2 release whose compressed SHA-256
is pinned below. Outputs use LF line endings and deterministic HIP order.
"""
from __future__ import annotations

import gzip
import hashlib
import sys
from pathlib import Path

SOURCE_SHA256 = "8e624f843d4254a9b7c2e8dda8e3158dbe825bf98f6bf3dbbae7f0d0b73d6858"
HIP_IDS = (11767, 21421, 24436, 24608, 27989, 32349, 80763, 91262)


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_hip2_named_stars.py hip2.dat.gz OUTPUT_DIR")
    source = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    compressed = source.read_bytes()
    digest = hashlib.sha256(compressed).hexdigest()
    if digest != SOURCE_SHA256:
        raise SystemExit(f"unexpected source SHA-256: {digest}")

    rows: dict[int, str] = {}
    with gzip.open(source, "rt", encoding="ascii", newline="") as stream:
        for line in stream:
            hip = int(line[:6])
            if hip in HIP_IDS:
                rows[hip] = line.rstrip("\r\n")
    if tuple(sorted(rows)) != HIP_IDS:
        raise SystemExit("authoritative source did not contain exactly the expected HIP identifiers")

    output_dir.mkdir(parents=True, exist_ok=True)
    raw = "\n".join(rows[hip] for hip in HIP_IDS) + "\n"
    canonical_lines = []
    for hip in HIP_IDS:
        fields = rows[hip].split()
        canonical_lines.append(",".join((fields[0], fields[4], fields[5], fields[7], fields[8])))
    canonical = "\n".join(canonical_lines) + "\n"
    (output_dir / "hipparcos2-named-stars.raw.txt").write_text(raw, encoding="ascii", newline="\n")
    (output_dir / "hipparcos2-named-stars.canonical.csv").write_text(canonical, encoding="ascii", newline="\n")
    print("raw", hashlib.sha256(raw.encode("ascii")).hexdigest())
    print("canonical", hashlib.sha256(canonical.encode("ascii")).hexdigest())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
