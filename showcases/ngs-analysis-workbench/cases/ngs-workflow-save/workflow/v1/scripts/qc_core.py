#!/usr/bin/env python3
"""Minimal FASTQ integrity and quality summary used as workflow version 1."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def read_fastq(path: Path):
    with path.open("r", encoding="ascii", newline="") as handle:
        while True:
            header = handle.readline().rstrip("\r\n")
            if not header:
                return
            sequence = handle.readline().rstrip("\r\n")
            plus = handle.readline().rstrip("\r\n")
            quality = handle.readline().rstrip("\r\n")
            if not (header.startswith("@") and plus.startswith("+")):
                raise ValueError(f"invalid FASTQ record near {header!r}")
            if len(sequence) != len(quality):
                raise ValueError(f"sequence/quality length mismatch for {header}")
            yield header[1:].split()[0], sequence.upper(), [ord(char) - 33 for char in quality]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--summary", required=True, type=Path)
    parser.add_argument("--reads", required=True, type=Path)
    parser.add_argument("--cycles", required=True, type=Path)
    args = parser.parse_args()

    records = list(read_fastq(args.input))
    if not records:
        raise ValueError("FASTQ contains no complete records")
    identifiers = [record[0] for record in records]
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("FASTQ record identifiers are not unique")

    lengths = [len(record[1]) for record in records]
    bases = sum(lengths)
    gc = sum(record[1].count("G") + record[1].count("C") for record in records)
    q30 = sum(score >= 30 for record in records for score in record[2])
    summary = {
        "schema_version": "1.0",
        "records": len(records),
        "bases": bases,
        "read_length_min": min(lengths),
        "read_length_max": max(lengths),
        "gc_percent": 100.0 * gc / bases,
        "q30_percent": 100.0 * q30 / bases,
        "fastq_integrity": "passed"
    }

    for destination in (args.summary, args.reads, args.cycles):
        destination.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    with args.reads.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["read_id", "length", "gc_percent", "mean_phred"])
        for read_id, sequence, qualities in records:
            read_gc = sequence.count("G") + sequence.count("C")
            writer.writerow([read_id, len(sequence), f"{100.0 * read_gc / len(sequence):.6f}", f"{sum(qualities) / len(qualities):.6f}"])

    max_length = max(lengths)
    with args.cycles.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["cycle", "bases", "mean_phred"])
        for index in range(max_length):
            values = [record[2][index] for record in records if len(record[2]) > index]
            writer.writerow([index + 1, len(values), f"{sum(values) / len(values):.6f}"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
