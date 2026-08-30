#!/usr/bin/env python3
"""Recompute deterministic quality metrics for the first 500 public ENA reads."""

from __future__ import annotations

import csv
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "inputs" / "DRR037765.fastq.gz"
SUMMARY = ROOT / "outputs" / "quality-summary.json"
PER_CYCLE = ROOT / "outputs" / "per-cycle-quality.csv"
EXPECTED_MD5 = "81735432a6f578b332aae58cdbd95231"
RECORD_LIMIT = 500


def main() -> None:
    compressed = SOURCE.read_bytes()
    if hashlib.md5(compressed).hexdigest() != EXPECTED_MD5:
        raise ValueError("compressed ENA source MD5 mismatch")
    records: list[tuple[str, str, str]] = []
    with gzip.open(SOURCE, "rt", encoding="ascii", newline=None) as handle:
        while len(records) < RECORD_LIMIT:
            header = handle.readline().rstrip("\r\n")
            if not header:
                break
            sequence = handle.readline().rstrip("\r\n")
            plus = handle.readline().rstrip("\r\n")
            quality = handle.readline().rstrip("\r\n")
            if not header.startswith("@") or not plus.startswith("+") or len(sequence) != len(quality):
                raise ValueError(f"invalid FASTQ record {len(records) + 1}")
            records.append((header.split()[0], sequence, quality))
    if len(records) != RECORD_LIMIT:
        raise ValueError(f"expected {RECORD_LIMIT} reads, found {len(records)}")

    canonical = "".join(f"{header}\n{sequence}\n+\n{quality}\n" for header, sequence, quality in records).encode("ascii")
    lengths = [len(sequence) for _, sequence, _ in records]
    bases = sum(lengths)
    gc = sum(sequence.upper().count("G") + sequence.upper().count("C") for _, sequence, _ in records)
    qualities = [[ord(symbol) - 33 for symbol in quality] for _, _, quality in records]
    quality_bases = sum(len(row) for row in qualities)
    q30 = sum(value >= 30 for row in qualities for value in row)
    length_distribution = Counter(lengths)
    payload = {
        "schema": "rosalind.fastq-quality-summary/v1",
        "case_id": "rosalind-fastq-qc",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "The retained public ENA FASTQ object was verified and transformed into deterministic 500-read QC outputs.",
        },
        "source": {
            "run": "DRR037765",
            "url": "https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz",
            "compressed_bytes": len(compressed),
            "compressed_md5": hashlib.md5(compressed).hexdigest(),
        },
        "subset_rule": "first 500 complete records; first header token retained; plus line normalized to +; LF line endings",
        "records": len(records),
        "bases": bases,
        "read_length_min": min(lengths),
        "read_length_max": max(lengths),
        "read_length_mean": round(bases / len(records), 6),
        "read_length_distribution": {str(key): value for key, value in sorted(length_distribution.items())},
        "gc_percent": round(100 * gc / bases, 12),
        "q30_percent": round(100 * q30 / quality_bases, 12),
        "canonical_subset_bytes": len(canonical),
        "canonical_subset_sha256": hashlib.sha256(canonical).hexdigest(),
        "qualification": "Metrics describe only the deterministic 500-read subset and do not establish run-wide or assay-specific suitability.",
    }
    SUMMARY.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")
    with PER_CYCLE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["cycle", "base_count", "mean_phred", "q30_percent"])
        for index in range(max(lengths)):
            values = [row[index] for row in qualities if index < len(row)]
            writer.writerow([index + 1, len(values), f"{sum(values) / len(values):.6f}", f"{100 * sum(value >= 30 for value in values) / len(values):.6f}"])
    check = json.loads(SUMMARY.read_text(encoding="utf-8"))
    assert check["records"] == 500 and check["bases"] == 235490
    assert check["canonical_subset_sha256"] == "46bd72991d9c9c2bf64751e88e52548d852d5fa021da4815ee6f6517a51b18b9"
    print(f"PASS rosalind-fastq-qc: {check['records']} reads, Q30 {check['q30_percent']:.6f}%")


if __name__ == "__main__":
    main()
