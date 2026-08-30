#!/usr/bin/env python3
"""Recompute the retained human RAS alignment summary with the standard library."""

from __future__ import annotations

import csv
import hashlib
import json
from itertools import combinations
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ALIGNMENT = ROOT / "inputs" / "human-RAS-UniProt-SV1.aln-fasta"
SUMMARY = ROOT / "outputs" / "alignment-summary.json"
DIFFERENCES = ROOT / "outputs" / "variable-sites.csv"
EXPECTED = ["P01116", "P01111", "P01112"]
MOTIFS = [(10, 17, "P-loop"), (30, 38, "switch-I context"), (60, 76, "switch-II context"), (116, 119, "NKXD motif")]


def read_alignment(path: Path) -> tuple[list[str], dict[str, str]]:
    order: list[str] = []
    sequences: dict[str, list[str]] = {}
    current: str | None = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(">"):
            current = line[1:].split()[0]
            order.append(current)
            sequences[current] = []
        elif current is None:
            raise ValueError("sequence data precede the first FASTA header")
        else:
            sequences[current].append(line)
    joined = {key: "".join(value) for key, value in sequences.items()}
    if order != EXPECTED:
        raise ValueError(f"unexpected record order: {order}")
    widths = {len(value) for value in joined.values()}
    if len(widths) != 1:
        raise ValueError("alignment rows have unequal lengths")
    return order, joined


def reference_columns(reference: str) -> dict[int, int]:
    mapping: dict[int, int] = {}
    residue = 0
    for column, symbol in enumerate(reference, start=1):
        if symbol != "-":
            residue += 1
            mapping[residue] = column
    return mapping


def pairwise(a: str, b: str) -> dict[str, float | int]:
    comparable = [(x, y) for x, y in zip(a, b) if not (x == "-" and y == "-")]
    differences = sum(x != y for x, y in comparable)
    p_distance = differences / len(comparable)
    return {
        "comparable_columns": len(comparable),
        "differences": differences,
        "identity_percent": round(100 * (1 - p_distance), 6),
        "p_distance": round(p_distance, 12),
    }


def main() -> None:
    order, records = read_alignment(ALIGNMENT)
    width = len(records[order[0]])
    ref_map = reference_columns(records["P01116"])

    rows: list[dict[str, object]] = []
    for column in range(1, width + 1):
        symbols = [records[key][column - 1] for key in order]
        if len(set(symbols)) == 1:
            continue
        ref_positions = [position for position, mapped in ref_map.items() if mapped == column]
        rows.append(
            {
                "alignment_column": column,
                "kras_position": ref_positions[0] if ref_positions else "",
                **{key: symbol for key, symbol in zip(order, symbols)},
            }
        )

    pairwise_results = {
        f"{left}_vs_{right}": pairwise(records[left], records[right])
        for left, right in combinations(order, 2)
    }
    motifs = []
    for start, end, name in MOTIFS:
        columns = [ref_map[position] for position in range(start, end + 1)]
        slices = {
            key: "".join(records[key][column - 1] for column in columns)
            for key in order
        }
        motifs.append(
            {
                "name": name,
                "kras_positions": f"{start}-{end}",
                "alignment_columns": f"{columns[0]}-{columns[-1]}",
                "sequences": slices,
                "fully_conserved": len(set(slices.values())) == 1,
            }
        )

    payload = {
        "schema": "rosalind.ras-alignment-summary/v1",
        "case_id": "rosalind-ras-isoforms",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "Three reviewed UniProtKB sequence records were retained and transformed into the isoform comparison.",
        },
        "input": "inputs/human-RAS-UniProt-SV1.aln-fasta",
        "input_sha256": hashlib.sha256(ALIGNMENT.read_bytes()).hexdigest(),
        "method": "direct comparison of the retained 191-column aligned FASTA; double-gap columns excluded and residue-gap columns counted as differences",
        "record_order": order,
        "aligned_columns": width,
        "ungapped_lengths": {key: len(value.replace("-", "")) for key, value in records.items()},
        "invariant_columns": width - len(rows),
        "variable_columns": len(rows),
        "pairwise": pairwise_results,
        "motifs": motifs,
        "qualification": "The retained center-star alignment is an exploratory teaching alignment, not a publication-grade phylogenetic analysis.",
    }
    SUMMARY.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")
    with DIFFERENCES.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["alignment_column", "kras_position", *order], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    check_order, check_records = read_alignment(ALIGNMENT)
    assert check_order == order and check_records == records
    assert json.loads(SUMMARY.read_text(encoding="utf-8"))["variable_columns"] == len(rows)
    assert len(DIFFERENCES.read_text(encoding="utf-8").splitlines()) == len(rows) + 1
    print(f"PASS rosalind-ras-isoforms: {width} columns, {len(rows)} variable columns")


if __name__ == "__main__":
    main()
