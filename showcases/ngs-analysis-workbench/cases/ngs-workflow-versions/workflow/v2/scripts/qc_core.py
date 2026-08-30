#!/usr/bin/env python3
"""Transparent FASTQ QC core used by the versioned lifecycle showcases."""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def append_timeline(path: Path | None, state: str, details: dict) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps({"observed_at": timestamp(), "state": state, **details}, sort_keys=True) + "\n")


def read_fastq(path: Path):
    with path.open("r", encoding="ascii", newline="") as handle:
        record_number = 0
        while True:
            header = handle.readline().rstrip("\r\n")
            if not header:
                return
            sequence = handle.readline().rstrip("\r\n")
            plus = handle.readline().rstrip("\r\n")
            quality = handle.readline().rstrip("\r\n")
            record_number += 1
            if not (header.startswith("@") and plus.startswith("+")):
                raise ValueError(f"invalid FASTQ structure at record {record_number}")
            if len(sequence) != len(quality):
                raise ValueError(f"sequence/quality length mismatch at record {record_number}")
            scores = [ord(char) - 33 for char in quality]
            if any(score < 0 or score > 93 for score in scores):
                raise ValueError(f"quality outside Phred+33 range at record {record_number}")
            yield header[1:].split()[0], sequence.upper(), scores


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--summary", required=True, type=Path)
    parser.add_argument("--reads", required=True, type=Path)
    parser.add_argument("--cycles", required=True, type=Path)
    parser.add_argument("--q20", type=int, default=20)
    parser.add_argument("--q30", type=int, default=30)
    parser.add_argument("--timeline", type=Path)
    parser.add_argument("--log", type=Path)
    args = parser.parse_args()

    append_timeline(args.timeline, "prepared", {"input": str(args.input), "workflow_engine": "not_invoked"})
    append_timeline(args.timeline, "running", {"scientific_core": "python_fastq_qc"})
    records = list(read_fastq(args.input))
    if not records:
        raise ValueError("FASTQ contains no complete records")
    identifiers = [record[0] for record in records]
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("FASTQ record identifiers are not unique")

    lengths = [len(record[1]) for record in records]
    bases = sum(lengths)
    all_scores = [score for record in records for score in record[2]]
    gc = sum(record[1].count("G") + record[1].count("C") for record in records)
    n_bases = sum(record[1].count("N") for record in records)
    q20 = sum(score >= args.q20 for score in all_scores)
    q30 = sum(score >= args.q30 for score in all_scores)
    summary = {
        "schema_version": "2.0",
        "input_state": "raw public FASTQ subset",
        "phred_encoding": "Phred+33",
        "records": len(records),
        "unique_record_ids": len(set(identifiers)),
        "bases": bases,
        "read_length_min": min(lengths),
        "read_length_median": statistics.median(lengths),
        "read_length_max": max(lengths),
        "gc_percent": 100.0 * gc / bases,
        "n_percent": 100.0 * n_bases / bases,
        "mean_phred": statistics.fmean(all_scores),
        "q20_threshold": args.q20,
        "q20_percent": 100.0 * q20 / bases,
        "q30_threshold": args.q30,
        "q30_percent": 100.0 * q30 / bases,
        "fastq_integrity": "passed",
        "transformation_performed": False
    }

    for destination in (args.summary, args.reads, args.cycles):
        destination.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    with args.reads.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["read_id", "length", "gc_percent", "mean_phred", "q20_percent", "q30_percent"])
        for read_id, sequence, qualities in records:
            read_gc = sequence.count("G") + sequence.count("C")
            writer.writerow([
                read_id,
                len(sequence),
                f"{100.0 * read_gc / len(sequence):.6f}",
                f"{statistics.fmean(qualities):.6f}",
                f"{100.0 * sum(score >= args.q20 for score in qualities) / len(qualities):.6f}",
                f"{100.0 * sum(score >= args.q30 for score in qualities) / len(qualities):.6f}"
            ])

    max_length = max(lengths)
    with args.cycles.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["cycle", "bases", "mean_phred", "q20_percent", "q30_percent"])
        for index in range(max_length):
            values = [record[2][index] for record in records if len(record[2]) > index]
            writer.writerow([
                index + 1,
                len(values),
                f"{statistics.fmean(values):.6f}",
                f"{100.0 * sum(score >= args.q20 for score in values) / len(values):.6f}",
                f"{100.0 * sum(score >= args.q30 for score in values) / len(values):.6f}"
            ])

    if args.log:
        args.log.parent.mkdir(parents=True, exist_ok=True)
        args.log.write_text(
            f"python={sys.version.split()[0]}\nrecords={summary['records']}\nbases={summary['bases']}\n"
            f"q30_percent={summary['q30_percent']:.6f}\nstatus=completed\n",
            encoding="utf-8"
        )
    append_timeline(
        args.timeline,
        "completed",
        {
            "exit_code": 0,
            "records": summary["records"],
            "bases": summary["bases"],
            "q30_percent": round(summary["q30_percent"], 6),
            "summary": str(args.summary)
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
