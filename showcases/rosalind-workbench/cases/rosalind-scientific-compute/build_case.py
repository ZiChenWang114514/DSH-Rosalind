#!/usr/bin/env python3
"""Build the bounded GB1 variant embedding evidence package."""

from __future__ import annotations

import argparse
import csv
import json
import platform
import statistics
import time
from collections import Counter
from pathlib import Path
from zipfile import ZipFile


CASE_DIR = Path(__file__).resolve().parent
MEMBER = "DMS_ProteinGym_substitutions/SPG1_STRSG_Wu_2016.csv"
SOURCE_URL = "https://marks.hms.harvard.edu/proteingym/ProteinGym_v1.3/DMS_ProteinGym_substitutions.zip"
SITES = (265, 266, 267, 280)
REFERENCE = "VDGV"
AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY"


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True, type=Path)
    args = parser.parse_args()
    started = time.perf_counter()

    with ZipFile(args.archive) as archive:
        info = archive.getinfo(MEMBER)
        with archive.open(MEMBER) as raw:
            reader = csv.DictReader((line.decode("utf-8") for line in raw))
            rows = []
            for index, row in enumerate(reader):
                if index >= 500:
                    break
                sequence = row["mutated_sequence"]
                residues = "".join(sequence[position - 1] for position in SITES)
                mutation_count = sum(left != right for left, right in zip(residues, REFERENCE))
                rows.append(
                    {
                        "variant_index": index + 1,
                        "mutant": row["mutant"],
                        "mutated_sequence": sequence,
                        "DMS_score": row["DMS_score"],
                        "DMS_score_bin": row["DMS_score_bin"],
                        "mutation_count": mutation_count,
                        "site_265": residues[0],
                        "site_266": residues[1],
                        "site_267": residues[2],
                        "site_280": residues[3],
                    }
                )

    if len(rows) != 500:
        raise RuntimeError(f"Expected 500 variants, found {len(rows)}")

    input_path = CASE_DIR / "inputs" / "gb1-variants-first-500.csv"
    input_fields = list(rows[0])
    input_path.parent.mkdir(parents=True, exist_ok=True)
    with input_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=input_fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    embedding_path = CASE_DIR / "outputs" / "gb1-four-site-one-hot.csv"
    embedding_fields = ["variant_index", "mutant", "DMS_score", "mutation_count"] + [
        f"site_{site}_{amino_acid}" for site in SITES for amino_acid in AMINO_ACIDS
    ]
    with embedding_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=embedding_fields, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            encoded = {
                "variant_index": row["variant_index"],
                "mutant": row["mutant"],
                "DMS_score": row["DMS_score"],
                "mutation_count": row["mutation_count"],
            }
            for site in SITES:
                residue = row[f"site_{site}"]
                for amino_acid in AMINO_ACIDS:
                    encoded[f"site_{site}_{amino_acid}"] = int(residue == amino_acid)
            writer.writerow(encoded)

    scores = [float(row["DMS_score"]) for row in rows]
    depth_counts = Counter(int(row["mutation_count"]) for row in rows)
    summary = {
        "showcase_id": "rosalind-scientific-compute",
        "assay": "SPG1_STRSG_Wu_2016",
        "selection": "first 500 data rows in the ProteinGym v1.3 archive member",
        "variant_count": len(rows),
        "full_sequence_length": len(rows[0]["mutated_sequence"]),
        "variable_positions_1_based": list(SITES),
        "reference_residues": REFERENCE,
        "embedding": {
            "kind": "four-site categorical one-hot",
            "dimensions": len(SITES) * len(AMINO_ACIDS),
            "amino_acid_order": AMINO_ACIDS,
            "esm_executed": False,
        },
        "mutation_depth_counts": {str(depth): depth_counts.get(depth, 0) for depth in range(5)},
        "DMS_score": {
            "minimum": min(scores),
            "maximum": max(scores),
            "mean": statistics.fmean(scores),
            "median": statistics.median(scores),
        },
        "positive_bin_count": sum(int(row["DMS_score_bin"]) for row in rows),
    }
    write_text(CASE_DIR / "outputs" / "embedding-summary.json", json.dumps(summary, indent=2) + "\n")

    elapsed = time.perf_counter() - started
    run = {
        "command": "python build_case.py --archive <ProteinGym_v1.3 archive>",
        "python": platform.python_version(),
        "platform": platform.platform(),
        "wall_seconds": elapsed,
        "variant_count": 500,
        "embedding_rows": 500,
        "embedding_dimensions": 80,
        "exit_status": 0,
        "note": "Wall time describes this local run and is hardware dependent.",
    }
    write_text(CASE_DIR / "outputs" / "run-metrics.json", json.dumps(run, indent=2) + "\n")

    provenance = {
        "source_name": "ProteinGym v1.3 substitution benchmark",
        "source_url": SOURCE_URL,
        "archive_member": MEMBER,
        "archive_bytes": args.archive.stat().st_size,
        "member_uncompressed_bytes": info.file_size,
        "retrieved": "2026-08-30",
        "selection_rule": "retain the first 500 data rows in archive order",
        "transformation": "extract the four assayed residues and encode each as a 20-state one-hot vector",
        "software": "Python standard library only",
    }
    write_text(CASE_DIR / "inputs" / "source-provenance.json", json.dumps(provenance, indent=2) + "\n")

    bars = []
    colors = ["#38bdf8", "#2dd4bf", "#a78bfa", "#fbbf24", "#fb7185"]
    for depth in range(5):
        height = 220 * depth_counts.get(depth, 0) / max(depth_counts.values())
        x = 530 + depth * 105
        bars.append(f'<rect x="{x}" y="{505-height:.1f}" width="64" height="{height:.1f}" rx="8" fill="{colors[depth]}"/>')
        bars.append(f'<text x="{x+32}" y="535" text-anchor="middle" class="small">{depth}</text>')
        bars.append(f'<text x="{x+32}" y="{485-height:.1f}" text-anchor="middle" class="small">{depth_counts.get(depth, 0)}</text>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">GB1 four-site variant embedding</title><desc id="desc">A verified 500-variant ProteinGym subset encoded as 80-dimensional categorical vectors, with mutation-depth counts.</desc>
<rect width="1200" height="675" fill="#071522"/><circle cx="1100" cy="60" r="220" fill="#0e7490" opacity=".22"/>
<style>.label{{font:600 22px Segoe UI,Arial;fill:#67e8f9}}.title{{font:700 44px Segoe UI,Arial;fill:#f8fafc}}.body{{font:24px Segoe UI,Arial;fill:#cbd5e1}}.metric{{font:700 36px Segoe UI,Arial;fill:#f8fafc}}.small{{font:18px Segoe UI,Arial;fill:#cbd5e1}}</style>
<text x="70" y="82" class="label">PROTEINGYM · SPG1_STRSG_WU_2016</text><text x="70" y="145" class="title">GB1 variant embedding</text>
<rect x="70" y="205" width="360" height="330" rx="22" fill="#0f2538" stroke="#164e63"/>
<text x="105" y="260" class="body">Retained public variants</text><text x="105" y="310" class="metric">500</text>
<text x="105" y="370" class="body">Categorical dimensions</text><text x="105" y="420" class="metric">80</text>
<text x="105" y="480" class="body">DMS score range</text><text x="105" y="520" class="metric">{min(scores):.3f} – {max(scores):.3f}</text>
<text x="520" y="240" class="body">Mutation depth in the selected rows</text>{''.join(bars)}
<text x="70" y="610" class="small">Local deterministic encoding · no ESM model run · wall time {elapsed:.3f} s on this machine</text>
</svg>'''
    write_text(CASE_DIR / "previews" / "preview.svg", svg + "\n")


if __name__ == "__main__":
    main()
