#!/usr/bin/env python3
"""Measure the deposited 3PTB catalytic-triad geometry without a viewer."""

from __future__ import annotations

import hashlib
import json
from itertools import combinations
from pathlib import Path

import numpy as np


CASE = Path(__file__).resolve().parents[1]
SOURCE = CASE / "inputs" / "3PTB.pdb"
OUTPUT = CASE / "outputs" / "triad-geometry.json"
RESIDUES = {57: "HIS", 102: "ASP", 195: "SER"}


def parse_atoms() -> dict[tuple[int, str], dict[str, np.ndarray]]:
    result: dict[tuple[int, str], dict[str, np.ndarray]] = {}
    for line in SOURCE.read_text(encoding="ascii").splitlines():
        if not line.startswith("ATOM  ") or line[21] != "A" or line[16] not in {" ", "A"}:
            continue
        seq = int(line[22:26])
        residue = line[17:20].strip()
        if RESIDUES.get(seq) != residue:
            continue
        atom = line[12:16].strip()
        result.setdefault((seq, residue), {})[atom] = np.array(
            [float(line[30:38]), float(line[38:46]), float(line[46:54])]
        )
    return result


def distance(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a - b))


def main() -> None:
    atoms = parse_atoms()
    missing = [f"{name}{seq}" for seq, name in RESIDUES.items() if (seq, name) not in atoms]
    if missing:
        raise SystemExit(f"Missing residues: {', '.join(missing)}")

    residue_rows = []
    for seq, name in RESIDUES.items():
        residue_atoms = atoms[(seq, name)]
        residue_rows.append(
            {
                "auth_chain": "A",
                "auth_seq_id": seq,
                "residue": name,
                "atom_names": sorted(residue_atoms),
                "ca_xyz_angstrom": [round(float(v), 3) for v in residue_atoms["CA"]],
            }
        )

    ca_pairs = []
    for (seq_a, name_a), (seq_b, name_b) in combinations(RESIDUES.items(), 2):
        ca_pairs.append(
            {
                "pair": [f"{name_a}{seq_a}:CA", f"{name_b}{seq_b}:CA"],
                "distance_angstrom": round(distance(atoms[(seq_a, name_a)]["CA"], atoms[(seq_b, name_b)]["CA"]), 6),
            }
        )

    catalytic_pairs = [
        ("HIS57:ND1", atoms[(57, "HIS")]["ND1"], "ASP102:OD1", atoms[(102, "ASP")]["OD1"]),
        ("HIS57:ND1", atoms[(57, "HIS")]["ND1"], "ASP102:OD2", atoms[(102, "ASP")]["OD2"]),
        ("HIS57:NE2", atoms[(57, "HIS")]["NE2"], "SER195:OG", atoms[(195, "SER")]["OG"]),
    ]

    payload = SOURCE.read_bytes()
    result = {
        "schema_version": 1,
        "showcase_id": "structure-motif-search",
        "run_date": "2026-08-30",
        "source": {
            "accession": "3PTB",
            "url": "https://files.rcsb.org/download/3PTB.pdb",
            "path": "inputs/3PTB.pdb",
            "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
        },
        "selection": residue_rows,
        "method": "Euclidean distances from deposited Cartesian coordinates; no hydrogens or protonation model added.",
        "ca_pair_distances": ca_pairs,
        "candidate_catalytic_atom_distances": [
            {"pair": [name_a, name_b], "distance_angstrom": round(distance(a, b), 6)}
            for name_a, a, name_b, b in catalytic_pairs
        ],
        "public_motif_request": {
            "publicPdbId": "3PTB",
            "residues": [
                {"numbering": "author", "authAsymId": "A", "authSeqId": 57, "structOperId": "1"},
                {"numbering": "author", "authAsymId": "A", "authSeqId": 102, "structOperId": "1"},
                {"numbering": "author", "authAsymId": "A", "authSeqId": 195, "structOperId": "1"},
            ],
            "atomPairing": "SIDE_CHAIN",
            "motifPruning": "KRUSKAL",
            "rmsdCutoffAngstrom": 2.0,
            "backboneDistanceTolerance": 1.0,
            "sideChainDistanceTolerance": 1.0,
            "angleTolerance": 20.0,
            "limit": 10,
            "matchesPerHit": 3,
            "offset": 0,
        },
        "interpretation_scope": "The distances describe one deposited geometry. Similar geometry alone does not establish function or catalytic competence.",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
