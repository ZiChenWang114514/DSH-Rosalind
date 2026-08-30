#!/usr/bin/env python3
"""Score five Boltz samples for each selected candidate."""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

import gemmi


EPITOPE = {37, 39, 41, 43, 44, 46, 49, 51, 52, 56, 96, 98, 100, 102, 103, 104, 105, 106, 108}
PARATOPE = {29, 31, 32, 34, 101, 102, 103, 104, 105, 106, 107, 110, 111, 113, 115, 116, 117, 118}


def contacts(cif_path: Path, cutoff: float = 5.0) -> tuple[set[int], set[int], float]:
    model = gemmi.read_structure(str(cif_path))[0]
    found_a, found_b, minimum = set(), set(), math.inf
    for residue_a in model["A"]:
        atoms_a = [atom for atom in residue_a if atom.element.name != "H"]
        for residue_b in model["B"]:
            atoms_b = [atom for atom in residue_b if atom.element.name != "H"]
            residue_contact = False
            for atom_a in atoms_a:
                for atom_b in atoms_b:
                    distance = atom_a.pos.dist(atom_b.pos)
                    minimum = min(minimum, distance)
                    residue_contact = residue_contact or distance <= cutoff
            if residue_contact:
                found_a.add(residue_a.seqid.num); found_b.add(residue_b.seqid.num)
    return found_a, found_b, minimum


def score(confidence: dict, er: float, pr: float, minimum: float) -> float:
    return (0.55 * float(confidence["protein_iptm"]) + 0.20 * float(confidence["complex_iplddt"])
            + 0.15 * max(0.0, 1.0 - float(confidence["complex_ipde"]) / 5.0)
            + 0.05 * er + 0.05 * pr - 0.02 * (minimum < 1.5))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", required=True, type=Path)
    parser.add_argument("--predictions", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    designs = {row["candidate"]: row for row in csv.DictReader(args.candidates.open(encoding="utf-8", newline=""))}
    grouped: dict[str, list[dict]] = defaultdict(list)
    for confidence_path in sorted(args.predictions.rglob("confidence_*.json")):
        stem = confidence_path.name.removeprefix("confidence_").removesuffix(".json")
        candidate, model_text = stem.rsplit("_model_", 1)
        cif_path = confidence_path.with_name(f"{candidate}_model_{model_text}.cif")
        confidence = json.loads(confidence_path.read_text(encoding="utf-8"))
        found_a, found_b, minimum = contacts(cif_path)
        er, pr = len(found_a & EPITOPE) / len(EPITOPE), len(found_b & PARATOPE) / len(PARATOPE)
        grouped[candidate].append({
            "model": int(model_text), "protein_iptm": float(confidence["protein_iptm"]),
            "complex_iplddt": float(confidence["complex_iplddt"]), "complex_ipde": float(confidence["complex_ipde"]),
            "epitope_recall": er, "paratope_recall": pr, "minimum_interchain_distance_A": minimum,
            "severe_clash": minimum < 1.5, "model_score": score(confidence, er, pr, minimum),
            "structure_path": cif_path.relative_to(args.predictions).as_posix(),
        })
    if len(grouped) != 5 or any(len(models) != 5 for models in grouped.values()):
        raise RuntimeError("Expected five candidates with five models each")
    summary = []
    for candidate, models in grouped.items():
        summary.append({
            "candidate": candidate, "mutations": designs[candidate]["mutations"],
            "ensemble_score_mean": statistics.mean(x["model_score"] for x in models),
            "ensemble_score_sd": statistics.pstdev(x["model_score"] for x in models),
            "protein_iptm_mean": statistics.mean(x["protein_iptm"] for x in models),
            "protein_iptm_sd": statistics.pstdev(x["protein_iptm"] for x in models),
            "complex_iplddt_mean": statistics.mean(x["complex_iplddt"] for x in models),
            "complex_ipde_mean": statistics.mean(x["complex_ipde"] for x in models),
            "epitope_recall_mean": statistics.mean(x["epitope_recall"] for x in models),
            "paratope_recall_mean": statistics.mean(x["paratope_recall"] for x in models),
            "severe_clash_models": sum(x["severe_clash"] for x in models),
            "sequence": designs[candidate]["sequence"], "best_model": max(models, key=lambda x: x["model_score"])["model"],
            "models": models,
        })
    summary.sort(key=lambda row: row["ensemble_score_mean"], reverse=True)
    for rank, row in enumerate(summary, 1): row["rank"] = rank
    args.output_dir.mkdir(parents=True, exist_ok=True)
    csv_rows = [{key: value for key, value in row.items() if key != "models"} for row in summary]
    fieldnames = ["rank"] + [key for key in csv_rows[0] if key != "rank"]
    with (args.output_dir / "top5_ensemble_ranking.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n"); writer.writeheader(); writer.writerows(csv_rows)
    (args.output_dir / "top5_ensemble_details.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("PASS: scored five candidates with five models each")


if __name__ == "__main__":
    main()
