#!/usr/bin/env python3
"""Compute the shared canonical FASTQ metrics used by both workflow definitions."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def compute(path: Path) -> dict:
    records = 0
    bases = 0
    gc = 0
    q30 = 0
    lengths = []
    with path.open(encoding="utf-8", newline="") as handle:
        while True:
            header = handle.readline()
            if not header:
                break
            sequence = handle.readline().strip()
            plus = handle.readline()
            quality = handle.readline().strip()
            if not header.startswith("@") or not plus.startswith("+"):
                raise ValueError(f"Malformed FASTQ record {records + 1}")
            if len(sequence) != len(quality):
                raise ValueError(f"Sequence/quality length mismatch in record {records + 1}")
            records += 1
            length = len(sequence)
            lengths.append(length)
            bases += length
            gc += sum(base in "GCgc" for base in sequence)
            q30 += sum(ord(character) - 33 >= 30 for character in quality)
    if not records:
        raise ValueError("No FASTQ records")
    return {
        "records": records,
        "total_bases": bases,
        "minimum_read_length": min(lengths),
        "maximum_read_length": max(lengths),
        "mean_read_length": bases / records,
        "GC_percent": 100 * gc / bases,
        "Q30_percent": 100 * q30 / bases,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = compute(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
