#!/usr/bin/env python3
"""Create portable Boltz YAML inputs from the retained public sequences."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


CASE_DIR = Path(__file__).resolve().parent
DEFAULT_CANDIDATES = CASE_DIR / "inputs" / "candidates.csv"
DEFAULT_TARGET = CASE_DIR / "inputs" / "PDL1_Q9NZQ7_18-239.fasta"


def read_fasta(path: Path) -> str:
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    sequence = "".join(line for line in lines if line and not line.startswith(">"))
    if len(sequence) != 222 or set(sequence) - set("ACDEFGHIKLMNPQRSTVWY"):
        raise ValueError(f"Unexpected PD-L1 sequence in {path}")
    return sequence


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--target-fasta", type=Path, default=DEFAULT_TARGET)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--select", help="comma-separated candidate names; default writes all")
    args = parser.parse_args()

    selected = set(args.select.split(",")) if args.select else None
    target = read_fasta(args.target_fasta)
    rows = list(csv.DictReader(args.candidates.open(encoding="utf-8", newline="")))
    if len(rows) != 20 or len({row["candidate"] for row in rows}) != 20:
        raise ValueError("Expected 20 uniquely named candidates")
    if selected and selected - {row["candidate"] for row in rows}:
        raise ValueError(f"Unknown candidates: {sorted(selected - {row['candidate'] for row in rows})}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    for row in rows:
        if selected and row["candidate"] not in selected:
            continue
        sequence = row["sequence"]
        if len(sequence) != 130 or set(sequence) - set("ACDEFGHIKLMNPQRSTVWY"):
            raise ValueError(f"Unexpected sequence for {row['candidate']}")
        yaml_text = (
            "version: 1\nsequences:\n"
            "  - protein:\n      id: A\n"
            f"      sequence: {target}\n"
            "  - protein:\n      id: B\n"
            f"      sequence: {sequence}\n"
        )
        (args.output_dir / f"{row['candidate']}.yaml").write_text(
            yaml_text, encoding="utf-8", newline="\n"
        )
        written += 1
    print(f"PASS: wrote {written} Boltz YAML inputs to {args.output_dir}")


if __name__ == "__main__":
    main()
