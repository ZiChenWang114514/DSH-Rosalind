#!/usr/bin/env python3
"""Compute deterministic structural statistics for a small FASTQ fixture."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def summarize(path: Path) -> dict:
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) % 4:
        raise ValueError("FASTQ line count is not divisible by four")

    sequences: list[str] = []
    qualities: list[str] = []
    for offset in range(0, len(lines), 4):
        header, sequence, separator, quality = lines[offset : offset + 4]
        if not header.startswith("@") or not separator.startswith("+"):
            raise ValueError(f"invalid FASTQ structure at record {offset // 4 + 1}")
        if len(sequence) != len(quality):
            raise ValueError(f"sequence and quality lengths differ at record {offset // 4 + 1}")
        sequences.append(sequence.upper())
        qualities.append(quality)

    lengths = [len(sequence) for sequence in sequences]
    scores = [ord(symbol) - 33 for quality in qualities for symbol in quality]
    total_bases = sum(lengths)
    gc_bases = sum(sequence.count("G") + sequence.count("C") for sequence in sequences)
    q30_bases = sum(score >= 30 for score in scores)
    return {
        "schema_version": "1.0.0",
        "fixture": path.name,
        "record_count": len(sequences),
        "total_bases": total_bases,
        "read_length": {
            "minimum": min(lengths),
            "maximum": max(lengths),
            "mean": round(total_bases / len(lengths), 3),
        },
        "gc_bases": gc_bases,
        "gc_percent": round(100 * gc_bases / total_bases, 3),
        "q30_bases": q30_bases,
        "q30_percent": round(100 * q30_bases / total_bases, 3),
        "mean_phred": round(sum(scores) / len(scores), 3),
        "validation": {
            "complete_records": True,
            "sequence_quality_lengths_equal": True,
            "quality_encoding_assumed": "Phred+33",
        },
    }


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit("usage: reference_fastq_stats.py INPUT.fastq [OUTPUT.json]")
    result = summarize(Path(sys.argv[1]))
    payload = json.dumps(result, indent=2) + "\n"
    if len(sys.argv) == 3:
        Path(sys.argv[2]).write_text(payload, encoding="utf-8", newline="\n")
    else:
        sys.stdout.write(payload)


if __name__ == "__main__":
    main()
