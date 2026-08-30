#!/usr/bin/env python3
"""Map operational CDR ranges to the HER2 interface in public PDB 1N8Z."""

from __future__ import annotations

import csv
import json
import math
import urllib.request
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE_URL = "https://files.rcsb.org/download/1N8Z.pdb"
ENTRY_URL = "https://www.rcsb.org/structure/1N8Z"
CDR_RANGES = {
    "A": [("L1", 24, 34), ("L2", 50, 56), ("L3", 89, 97)],
    "B": [("H1", 31, 35), ("H2", 50, 65), ("H3", 95, 102)],
}
CONSERVATIVE = {"ALA": "SER", "SER": "THR", "THR": "SER", "GLN": "ASN", "ASN": "GLN", "ASP": "GLU", "GLU": "ASP", "VAL": "ILE", "ILE": "VAL", "LEU": "ILE", "TYR": "PHE", "PHE": "TYR", "ARG": "LYS", "LYS": "ARG", "HIS": "ASN", "TRP": "PHE"}


def main() -> None:
    inputs = ROOT / "inputs"
    outputs = ROOT / "outputs"
    previews = ROOT / "previews"
    inputs.mkdir(exist_ok=True)
    outputs.mkdir(exist_ok=True)
    previews.mkdir(exist_ok=True)
    with urllib.request.urlopen(SOURCE_URL, timeout=60) as response:
        pdb_bytes = response.read()
    (inputs / "1N8Z.pdb").write_bytes(pdb_bytes)
    text = pdb_bytes.decode("ascii")

    residues: dict[tuple[str, int, str], list[tuple[float, float, float, float]]] = defaultdict(list)
    resolution = None
    for line in text.splitlines():
        if line.startswith("REMARK   2 RESOLUTION."):
            resolution = float(line.split()[3])
        if not line.startswith("ATOM  ") or line[16] not in (" ", "A"):
            continue
        try:
            key = (line[21], int(line[22:26]), line[17:20].strip())
            atom = (float(line[30:38]), float(line[38:46]), float(line[46:54]), float(line[60:66]))
        except ValueError:
            continue
        residues[key].append(atom)

    her2 = [(key, atom[:3]) for key, atoms in residues.items() if key[0] == "C" for atom in atoms]
    rows = []
    for chain, ranges in CDR_RANGES.items():
        for loop, start, end in ranges:
            for (candidate_chain, number, resname), atoms in sorted(residues.items()):
                if candidate_chain != chain or not start <= number <= end:
                    continue
                coords = [atom[:3] for atom in atoms]
                nearest = min(math.dist(a, b) for a in coords for _, b in her2)
                contacting_her2 = sorted({f"{key[2]}{key[1]}" for key, b in her2 if min(math.dist(a, b) for a in coords) <= 4.5})
                rows.append({
                    "chain": chain,
                    "cdr": loop,
                    "residue_number": number,
                    "resname": resname,
                    "min_distance_to_her2_a": round(nearest, 3),
                    "her2_contact_residue_count_4_5a": len(contacting_her2),
                    "her2_contact_residues": ";".join(contacting_her2),
                    "mean_b_factor_a2": round(sum(atom[3] for atom in atoms) / len(atoms), 3),
                })
    with (outputs / "cdr-contact-metrics.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    candidates = []
    for row in rows:
        if row["min_distance_to_her2_a"] < 8.0 or row["resname"] not in CONSERVATIVE:
            continue
        candidates.append({
            "priority": 0,
            "chain": row["chain"],
            "cdr": row["cdr"],
            "position": row["residue_number"],
            "proposal": f"{row['resname']}->{CONSERVATIVE[row['resname']]}",
            "min_distance_to_her2_a": row["min_distance_to_her2_a"],
            "rationale": "conservative exploration at a CDR position at least 8 Å from HER2 in 1N8Z",
        })
    candidates.sort(key=lambda row: (-row["min_distance_to_her2_a"], row["chain"], row["position"]))
    for index, row in enumerate(candidates[:12], 1):
        row["priority"] = index
    candidates = candidates[:12]
    with (outputs / "conservative-exploration-set.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(candidates[0]))
        writer.writeheader()
        writer.writerows(candidates)

    contact_rows = [row for row in rows if row["min_distance_to_her2_a"] <= 4.5]
    summary = {
        "schema": "rosalind.trastuzumab-cdr-interface/v1",
        "pdb_id": "1N8Z",
        "method": "X-ray diffraction",
        "resolution_a": resolution,
        "antibody_chains": {"light": "A", "heavy": "B"},
        "her2_chain": "C",
        "operational_cdr_definition": CDR_RANGES,
        "cdr_residues_analyzed": len(rows),
        "cdr_residues_within_4_5a_of_her2": len(contact_rows),
        "contact_positions": [f"{row['chain']}:{row['resname']}{row['residue_number']}" for row in contact_rows],
        "conservative_noncontact_proposals": len(candidates),
        "interpretation_rule": "Protect direct-contact residues first. Treat non-contact conservative substitutions as hypotheses for later structure, developability, and binding tests, not as improvements established by this structure.",
    }
    (outputs / "interface-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    provenance = {
        "schema": "public-structure-source/v1",
        "pdb_id": "1N8Z",
        "entry_url": ENTRY_URL,
        "coordinate_url": SOURCE_URL,
        "retrieved_at_utc": "2026-08-29T18:20:00Z",
        "selection": "PDB asymmetric-unit antibody chains A/B and HER2 chain C; explicit operational CDR ranges recorded in the analysis summary",
    }
    (inputs / "source-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")

    loop_counts = {loop: sum(row["cdr"] == loop and row["min_distance_to_her2_a"] <= 4.5 for row in rows) for ranges in CDR_RANGES.values() for loop, _, _ in ranges}
    bars = []
    colors = ["#38bdf8", "#2dd4bf", "#a78bfa", "#fbbf24", "#fb7185", "#22d3ee"]
    for index, (loop, count) in enumerate(loop_counts.items()):
        x = 510 + index * 100
        height = count * 40
        bars.append(f'<rect x="{x}" y="{500-height}" width="58" height="{height}" rx="7" fill="{colors[index]}"/><text x="{x+29}" y="535" text-anchor="middle" class="s">{loop}</text><text x="{x+29}" y="{480-height}" text-anchor="middle" class="n">{count}</text>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">Trastuzumab CDR interface map</title><desc id="desc">Direct HER2 contacts in PDB 1N8Z across six operational CDR ranges.</desc><rect width="1200" height="675" fill="#071522"/><circle cx="1080" cy="70" r="220" fill="#0e7490" opacity=".25"/><style>.k{{font:600 22px Segoe UI,Arial;fill:#67e8f9}}.t{{font:700 43px Segoe UI,Arial;fill:#f8fafc}}.b{{font:24px Segoe UI,Arial;fill:#cbd5e1}}.m{{font:700 39px Segoe UI,Arial;fill:#f8fafc}}.s{{font:18px Segoe UI,Arial;fill:#cbd5e1}}.n{{font:700 20px Segoe UI,Arial;fill:#f8fafc}}</style><text x="70" y="85" class="k">PUBLIC PDB 1N8Z · 2.52 Å X-RAY STRUCTURE</text><text x="70" y="150" class="t">Trastuzumab CDR–HER2 interface</text><rect x="70" y="215" width="360" height="320" rx="20" fill="#0f2538" stroke="#155e75"/><text x="105" y="275" class="b">CDR residues analyzed</text><text x="105" y="325" class="m">{len(rows)}</text><text x="105" y="400" class="b">Within 4.5 Å of HER2</text><text x="105" y="450" class="m">{len(contact_rows)}</text><text x="500" y="245" class="b">Direct-contact residues by operational CDR</text>{''.join(bars)}<text x="70" y="620" class="s">Non-contact conservative proposals are testable hypotheses, not validated affinity improvements.</text></svg>'''
    (previews / "preview.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
