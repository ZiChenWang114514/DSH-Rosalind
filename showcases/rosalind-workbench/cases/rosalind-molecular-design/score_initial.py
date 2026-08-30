#!/usr/bin/env python3
"""Rank the 20 one-sample Boltz predictions with the retained contact score."""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path

import gemmi


EPITOPE = {37, 39, 41, 43, 44, 46, 49, 51, 52, 56, 96, 98, 100, 102, 103, 104, 105, 106, 108}
PARATOPE = {29, 31, 32, 34, 101, 102, 103, 104, 105, 106, 107, 110, 111, 113, 115, 116, 117, 118}


def contacts(cif_path: Path, cutoff: float = 5.0) -> tuple[set[int], set[int], float, int]:
    model = gemmi.read_structure(str(cif_path))[0]
    found_a, found_b, minimum, atom_pairs = set(), set(), math.inf, 0
    for residue_a in model["A"]:
        atoms_a = [atom for atom in residue_a if atom.element.name != "H"]
        for residue_b in model["B"]:
            atoms_b = [atom for atom in residue_b if atom.element.name != "H"]
            residue_contact = False
            for atom_a in atoms_a:
                for atom_b in atoms_b:
                    distance = atom_a.pos.dist(atom_b.pos)
                    minimum = min(minimum, distance)
                    if distance <= cutoff:
                        atom_pairs += 1
                        residue_contact = True
            if residue_contact:
                found_a.add(residue_a.seqid.num)
                found_b.add(residue_b.seqid.num)
    return found_a, found_b, minimum, atom_pairs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", required=True, type=Path)
    parser.add_argument("--predictions", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    designs = {row["candidate"]: row for row in csv.DictReader(args.candidates.open(encoding="utf-8", newline=""))}
    rows = []
    for confidence_path in sorted(args.predictions.rglob("confidence_*_model_0.json")):
        candidate = confidence_path.name.removeprefix("confidence_").removesuffix("_model_0.json")
        cif_path = confidence_path.with_name(f"{candidate}_model_0.cif")
        confidence = json.loads(confidence_path.read_text(encoding="utf-8"))
        found_a, found_b, minimum, atom_pairs = contacts(cif_path)
        epitope_recall = len(found_a & EPITOPE) / len(EPITOPE)
        paratope_recall = len(found_b & PARATOPE) / len(PARATOPE)
        clash_penalty = 0.10 if minimum < 1.8 else 0.0
        composite = (
            0.45 * float(confidence["protein_iptm"])
            + 0.20 * float(confidence["complex_iplddt"])
            + 0.15 * max(0.0, 1.0 - float(confidence["complex_ipde"]) / 5.0)
            + 0.10 * epitope_recall
            + 0.10 * paratope_recall
            - clash_penalty
        )
        design = designs[candidate]
        rows.append({
            "candidate": candidate, "mutations": design["mutations"], "composite_score": composite,
            "protein_iptm": float(confidence["protein_iptm"]), "complex_iplddt": float(confidence["complex_iplddt"]),
            "complex_ipde": float(confidence["complex_ipde"]), "epitope_recall": epitope_recall,
            "paratope_recall": paratope_recall, "contact_atom_pairs": atom_pairs,
            "minimum_interchain_distance_A": minimum, "clash_penalty": clash_penalty,
            "sequence": design["sequence"], "structure_path": cif_path.relative_to(args.predictions).as_posix(),
        })
    if len(rows) != 20:
        raise RuntimeError(f"Expected 20 predictions, found {len(rows)}")
    rows.sort(key=lambda row: row["composite_score"], reverse=True)
    for rank, row in enumerate(rows, 1):
        row["rank"] = rank
    args.output_dir.mkdir(parents=True, exist_ok=True)
    fieldnames = ["rank"] + [key for key in rows[0] if key != "rank"]
    with (args.output_dir / "ranking.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader(); writer.writerows(rows)
    (args.output_dir / "top5.json").write_text(json.dumps(rows[:5], indent=2) + "\n", encoding="utf-8", newline="\n")
    print("PASS: ranked 20 initial predictions")


if __name__ == "__main__":
    main()
