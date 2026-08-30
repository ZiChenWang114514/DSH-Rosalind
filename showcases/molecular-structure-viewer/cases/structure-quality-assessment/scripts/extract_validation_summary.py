#!/usr/bin/env python3
"""Extract named global metrics from the retained wwPDB 4V1W PDF report."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import fitz


CASE = Path(__file__).resolve().parents[1]
PDF = CASE / "inputs" / "4v1w_full_validation.pdf"
CIF = CASE / "inputs" / "4V1W.cif"
OUTPUT = CASE / "outputs" / "quality-assessment.json"


def require(pattern: str, text: str, label: str) -> re.Match[str]:
    match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        raise SystemExit(f"Could not extract {label}")
    return match


def file_record(path: Path, url: str) -> dict:
    payload = path.read_bytes()
    return {
        "path": path.relative_to(CASE).as_posix(),
        "url": url,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def main() -> None:
    document = fitz.open(PDF)
    text = "\n".join(page.get_text() for page in document)

    report_date = require(r"([A-Z][a-z]{2} \d{1,2}, \d{4}\s+[–-]\s+\d{2}:\d{2} [AP]M UTC)", text, "report date").group(1)
    resolution = float(require(r"Resolution\s*:\s*(\d+\.\d+) Å", text, "resolution").group(1))
    contour = float(require(r"Recommended contour level\s*(\d+\.\d+)", text, "contour").group(1))
    clashscore = int(require(r"all-atom clashscore for this structure is\s*(\d+)", text, "clashscore").group(1))
    clash_count = int(require(r"All \((\d+)\) close contacts", text, "clash count").group(1))
    bond_length_outliers = int(require(r"All \((\d+)\) bond length outliers", text, "bond length outliers").group(1))
    bond_angle_outliers = int(require(r"All \((\d+)\) bond angle outliers", text, "bond angle outliers").group(1))
    rama_outliers = int(require(r"All \((\d+)\) Ramachandran outliers", text, "Ramachandran outliers").group(1))
    sidechain_outliers = int(require(r"All \((\d+)\) residues with a non-rotameric sidechain", text, "sidechain outliers").group(1))
    flipped_sidechains = int(require(r"All \((\d+)\)\s*such sidechains", text, "sidechain flips").group(1))
    inclusion = require(r"At the recommended contour level,\s*(\d+)% of all backbone atoms,\s*(\d+)% of all non-hydrogen atoms", text, "atom inclusion")
    fit = require(r"All\s*(0\.\d+)\s*(0\.\d+)\s*A\s*(0\.\d+)\s*(0\.\d+)", text, "map-model summary")

    result = {
        "schema_version": 1,
        "showcase_id": "structure-quality-assessment",
        "retrieval_date": "2026-08-30",
        "sources": [
            file_record(CIF, "https://files.rcsb.org/download/4V1W.cif"),
            file_record(PDF, "https://files.rcsb.org/validation/view/4v1w_full_validation.pdf"),
        ],
        "report": {
            "pdb_id": "4V1W",
            "emdb_id": "EMD-2788",
            "report_generated": report_date,
            "page_count": len(document),
            "reported_resolution_angstrom": resolution,
            "recommended_contour_level": contour,
            "software": {
                "wwpdb_validation_pipeline": "2.49",
                "molprobity": "4-5-2 with Phenix2.0",
                "mapq": "1.9.13",
            },
        },
        "global_metrics": {
            "clashscore_per_1000_atoms_including_hydrogens": clashscore,
            "close_contact_count": clash_count,
            "bond_length_outlier_count_abs_z_gt_5": bond_length_outliers,
            "bond_angle_outlier_count_abs_z_gt_5": bond_angle_outliers,
            "ramachandran_outlier_count": rama_outliers,
            "non_rotameric_sidechain_count": sidechain_outliers,
            "suggested_sidechain_flip_count": flipped_sidechains,
            "chirality_outliers": 0,
            "planarity_outliers": 0,
        },
        "map_model_fit": {
            "backbone_atoms_inside_map_percent": int(inclusion.group(1)),
            "all_non_hydrogen_atoms_inside_map_percent": int(inclusion.group(2)),
            "whole_model_atom_inclusion": float(fit.group(1)),
            "whole_model_q_score": float(fit.group(2)),
            "chain_a_atom_inclusion": float(fit.group(3)),
            "chain_a_q_score": float(fit.group(4)),
        },
        "repeated_residue_observation": {
            "ramachandran_outlier": "GLY 156",
            "affected_chains": list("ABCDEFGHIJKLMNOPQRSTUVWX"),
            "affected_chain_count": 24,
            "evidence": "The report lists one GLY 156 Ramachandran outlier in every deposited chain.",
        },
        "interpretation_scope": "These are wwPDB validation observations for the deposited 4.70 Å EM model and linked map. They identify review targets, not automatically incorrect residues.",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
