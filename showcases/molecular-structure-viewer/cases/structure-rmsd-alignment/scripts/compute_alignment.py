#!/usr/bin/env python3
"""Reproduce the chain-A C-alpha comparison for RCSB 4AKE and 1AKE."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np


CASE = Path(__file__).resolve().parents[1]
REFERENCE = CASE / "inputs" / "4AKE.pdb"
MOBILE = CASE / "inputs" / "1AKE.pdb"
OUTPUT = CASE / "outputs" / "alignment-results.json"


def file_record(path: Path, accession: str) -> dict:
    payload = path.read_bytes()
    return {
        "accession": accession,
        "path": path.relative_to(CASE).as_posix(),
        "url": f"https://files.rcsb.org/download/{accession}.pdb",
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def read_ca(path: Path, chain: str = "A") -> dict[tuple[int, str], dict]:
    rows: dict[tuple[int, str], dict] = {}
    for line in path.read_text(encoding="ascii").splitlines():
        if not line.startswith("ATOM  ") or line[21] != chain or line[12:16].strip() != "CA":
            continue
        altloc = line[16]
        occupancy = float(line[54:60])
        if altloc not in {" ", "A"} or occupancy <= 0:
            continue
        key = (int(line[22:26]), line[26].strip())
        rows.setdefault(
            key,
            {
                "auth_seq_id": key[0],
                "insertion_code": key[1] or None,
                "residue": line[17:20].strip(),
                "xyz": np.array([float(line[30:38]), float(line[38:46]), float(line[46:54])]),
            },
        )
    return rows


def kabsch(mobile: np.ndarray, reference: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mobile_center = mobile.mean(axis=0)
    reference_center = reference.mean(axis=0)
    covariance = (mobile - mobile_center).T @ (reference - reference_center)
    u, _, vt = np.linalg.svd(covariance)
    correction = np.eye(3)
    correction[-1, -1] = np.sign(np.linalg.det(u @ vt))
    rotation = u @ correction @ vt
    translation = reference_center - mobile_center @ rotation
    return mobile @ rotation + translation, rotation, translation


def rmsd(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.sum((a - b) ** 2, axis=1))))


def domain_for(residue: int) -> str:
    if 30 <= residue <= 67:
        return "NMP"
    if 118 <= residue <= 160:
        return "LID"
    return "CORE"


def main() -> None:
    reference_rows = read_ca(REFERENCE)
    mobile_rows = read_ca(MOBILE)
    shared = [
        key
        for key in sorted(reference_rows)
        if key in mobile_rows and reference_rows[key]["residue"] == mobile_rows[key]["residue"]
    ]
    reference = np.stack([reference_rows[key]["xyz"] for key in shared])
    mobile = np.stack([mobile_rows[key]["xyz"] for key in shared])
    aligned, rotation, translation = kabsch(mobile, reference)
    deviations = np.linalg.norm(aligned - reference, axis=1)

    domains = {}
    for name in ("CORE", "NMP", "LID"):
        indices = np.array([i for i, key in enumerate(shared) if domain_for(key[0]) == name], dtype=int)
        independent, _, _ = kabsch(mobile[indices], reference[indices])
        domains[name] = {
            "auth_residue_ranges": {
                "CORE": ["1-29", "68-117", "161-214"],
                "NMP": ["30-67"],
                "LID": ["118-160"],
            }[name],
            "paired_ca_count": int(indices.size),
            "rmsd_after_global_alignment_angstrom": round(rmsd(aligned[indices], reference[indices]), 6),
            "rmsd_after_independent_domain_alignment_angstrom": round(rmsd(independent, reference[indices]), 6),
            "mean_global_deviation_angstrom": round(float(deviations[indices].mean()), 6),
            "max_global_deviation_angstrom": round(float(deviations[indices].max()), 6),
        }

    largest = sorted(
        (
            {
                "auth_chain": "A",
                "auth_seq_id": key[0],
                "insertion_code": key[1] or None,
                "residue": reference_rows[key]["residue"],
                "ca_deviation_angstrom": round(float(deviations[i]), 6),
            }
            for i, key in enumerate(shared)
        ),
        key=lambda row: row["ca_deviation_angstrom"],
        reverse=True,
    )[:12]

    result = {
        "schema_version": 1,
        "showcase_id": "structure-rmsd-alignment",
        "run_date": "2026-08-30",
        "sources": [file_record(REFERENCE, "4AKE"), file_record(MOBILE, "1AKE")],
        "method": {
            "reference": "4AKE chain A",
            "mobile": "1AKE chain A",
            "atom_selection": "ATOM records named CA; blank/A alternate location; occupancy > 0",
            "correspondence": "same author residue number, insertion code, and residue name",
            "superposition": "unweighted Kabsch least-squares rigid fit over all paired C-alpha atoms",
            "domain_definition": "CORE 1-29,68-117,161-214; NMP 30-67; LID 118-160",
        },
        "result": {
            "reference_ca_count": len(reference_rows),
            "mobile_ca_count": len(mobile_rows),
            "paired_ca_count": len(shared),
            "pre_alignment_rmsd_angstrom": round(rmsd(mobile, reference), 6),
            "post_alignment_rmsd_angstrom": round(rmsd(aligned, reference), 6),
            "rotation_matrix_row_vector_convention": [[round(float(v), 10) for v in row] for row in rotation],
            "translation_angstrom_row_vector_convention": [round(float(v), 10) for v in translation],
            "domains": domains,
            "largest_ca_deviations": largest,
        },
        "interpretation_scope": "Coordinate comparison only; RMSD is not an energy, kinetic rate, or conformational population.",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
