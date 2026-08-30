#!/usr/bin/env python3
"""Retain a compact, inspectable snapshot of the verified Boltz-2 repeat run."""

from __future__ import annotations

import argparse
import csv
import json
import shutil
from pathlib import Path


CASE_DIR = Path(__file__).resolve().parent


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def copy_text(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    text = source.read_text(encoding="utf-8")
    destination.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-root", required=True, type=Path)
    args = parser.parse_args()
    root = args.evidence_root.resolve()
    deliverables = root / "deliverables"

    required = [
        root / "candidates.csv",
        deliverables / "top5_ensemble_ranking.csv",
        deliverables / "top5_ensemble_details.json",
    ]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise RuntimeError(f"Missing prior-run evidence: {missing}")

    copy_text(root / "candidates.csv", CASE_DIR / "inputs" / "candidates.csv")
    copy_text(deliverables / "top5_ensemble_ranking.csv", CASE_DIR / "outputs" / "top5-ensemble-ranking.csv")
    details = json.loads((deliverables / "top5_ensemble_details.json").read_text(encoding="utf-8"))
    if len(details) != 5 or any(len(candidate["models"]) != 5 for candidate in details):
        raise RuntimeError("Expected five candidates with five models each")
    details_export = {
        "showcase_id": "rosalind-boltz-repeats",
        "source_file": "deliverables/top5_ensemble_details.json",
        "candidate_count": len(details),
        "models_per_candidate": 5,
        "candidates": details,
    }
    write_text(CASE_DIR / "outputs" / "top5-ensemble-details.json", json.dumps(details_export, indent=2) + "\n")

    confidence_records = []
    structure_records = []
    for candidate in details:
        for model in candidate["models"]:
            original_structure = root / model["structure_path"]
            packaged_structure = deliverables / "all_structures" / f"{candidate['candidate']}_model_{model['model']}.cif"
            structure = original_structure if original_structure.is_file() else packaged_structure
            original_confidence = original_structure.with_name(
                f"confidence_{candidate['candidate']}_model_{model['model']}.json"
            )
            packaged_confidence = deliverables / "all_confidence" / f"confidence_{candidate['candidate']}_model_{model['model']}.json"
            confidence = original_confidence if original_confidence.is_file() else packaged_confidence
            if not structure.is_file() or not confidence.is_file():
                raise RuntimeError(f"Missing paired evidence for {candidate['candidate']} model {model['model']}")
            confidence_records.append(
                {
                    "candidate": candidate["candidate"],
                    "model": model["model"],
                    "run_relative_path": str(original_confidence.relative_to(root)),
                    "source_bytes": confidence.stat().st_size,
                    "payload": json.loads(confidence.read_text(encoding="utf-8")),
                }
            )
            structure_records.append(
                {
                    "candidate": candidate["candidate"],
                    "model": model["model"],
                    "run_relative_path": model["structure_path"],
                    "source_bytes": structure.stat().st_size,
                }
            )
    confidence_export = {
        "showcase_id": "rosalind-boltz-repeats",
        "record_count": len(confidence_records),
        "records": confidence_records,
    }
    write_text(CASE_DIR / "outputs" / "top5-confidence-records.json", json.dumps(confidence_export, indent=2) + "\n")

    candidate_rows = list(csv.DictReader((root / "candidates.csv").open(encoding="utf-8", newline="")))
    ranking_rows = list(csv.DictReader((deliverables / "top5_ensemble_ranking.csv").open(encoding="utf-8", newline="")))
    evidence = {
        "showcase_id": "rosalind-boltz-repeats",
        "inspection_date": "2026-08-30",
        "model": "Boltz-2",
        "historical_execution": "Locally managed GPU run completed before this public case snapshot",
        "hardware_reported_by_prior_run": "four RTX 4090 GPUs",
        "cost": "local open-source execution; no paid API",
        "initial_screen": {"candidates": len(candidate_rows), "successful_predictions": 20},
        "ensemble_confirmation": {
            "candidates": len(details),
            "diffusion_samples_per_candidate": 5,
            "seed": 20260829,
            "successful_predictions": len(confidence_records),
        },
        "retained_raw_confidence_records": len(confidence_records),
        "structure_files_observed_during_source_run_inspection": len(structure_records),
        "structure_files_copied_into_showcase": 0,
        "top_five": [
            {
                "rank": int(row["rank"]),
                "candidate": row["candidate"],
                "mutation": row["mutations"],
                "ensemble_score_mean": float(row["ensemble_score_mean"]),
                "ensemble_score_sd": float(row["ensemble_score_sd"]),
                "protein_iptm_mean": float(row["protein_iptm_mean"]),
                "severe_clash_models": int(row["severe_clash_models"]),
            }
            for row in ranking_rows
        ],
        "current_action": "retained and inspected prior evidence; Boltz was not rerun for this showcase update",
    }
    write_text(CASE_DIR / "outputs" / "run-evidence.json", json.dumps(evidence, indent=2) + "\n")

    source_note = f'''# Public inputs and prior execution provenance

- Human PD-L1 extracellular domain: UniProt Q9NZQ7, residues 18–239, https://www.uniprot.org/uniprotkb/Q9NZQ7/entry
- KN035–PD-L1 structural reference: PDB 5JDS, https://www.rcsb.org/structure/5JDS
- Boltz source and documentation: https://github.com/jwohlwend/boltz
- Retained target sequence: `PDL1_Q9NZQ7_18-239.fasta`
- Portable YAML generator: `../prepare_boltz_inputs.py`

The parent VHH and 19 interface variants are retained in `candidates.csv`. A completed local GPU run supplied the historical result snapshot. During case preparation, 25 confidence JSON files, 25 paired CIF files, and the final ensemble summaries were inspected. The public case retains all 25 confidence payloads and the complete per-model metric table. It also contains public sequences, a portable input generator, a portable five-sample command, and scoring code for a fresh free local rerun. The historical CIF coordinates were not copied into this repository snapshot.
'''
    write_text(CASE_DIR / "inputs" / "source-and-run-provenance.md", source_note)

    rows = evidence["top_five"]
    table = []
    for index, row in enumerate(rows):
        y = 280 + index * 58
        width = 470 * row["ensemble_score_mean"]
        table.append(f'<text x="92" y="{y+24}" class="b">{row["rank"]}. {row["candidate"]}</text>')
        table.append(f'<rect x="405" y="{y}" width="{width:.1f}" height="34" rx="9" fill="#22d3ee" opacity="{1-index*0.1:.1f}"/>')
        table.append(f'<text x="895" y="{y+24}" class="n">{row["ensemble_score_mean"]:.4f} ± {row["ensemble_score_sd"]:.4f}</text>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Boltz-2 repeated-sampling evidence</title><desc id="desc">Five PD-L1 nanobody candidates ranked from five Boltz-2 diffusion samples each.</desc>
<rect width="1200" height="675" fill="#071522"/><style>.k{{font:600 21px Segoe UI,Arial;fill:#67e8f9}}.t{{font:700 42px Segoe UI,Arial;fill:#f8fafc}}.b{{font:21px Segoe UI,Arial;fill:#cbd5e1}}.n{{font:18px Consolas,monospace;fill:#f8fafc}}.s{{font:17px Segoe UI,Arial;fill:#94a3b8}}</style>
<text x="64" y="72" class="k">BOLTZ-2 · PD-L1 / KN035 VARIANTS</text><text x="64" y="130" class="t">Five-sample ensemble ranking</text>
<text x="64" y="188" class="b">Fixed seed 20260829 · 25/25 ensemble predictions retained as confidence records</text>{''.join(table)}
<text x="64" y="625" class="s">Model-confidence prioritization only · no measured affinity · Boltz was not rerun during this showcase update</text>
</svg>'''
    write_text(CASE_DIR / "previews" / "preview.svg", svg + "\n")


if __name__ == "__main__":
    main()
