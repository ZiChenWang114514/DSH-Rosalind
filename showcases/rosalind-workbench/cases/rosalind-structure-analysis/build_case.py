#!/usr/bin/env python3
"""Build a compact, reproducible KRAS G12C structure-quality case."""

from __future__ import annotations

import csv
import json
import math
import urllib.request
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE_URL = "https://files.rcsb.org/download/6OIM.pdb"
ENTRY_URL = "https://www.rcsb.org/structure/6OIM"


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else float("nan")


def main() -> None:
    inputs = ROOT / "inputs"
    outputs = ROOT / "outputs"
    previews = ROOT / "previews"
    inputs.mkdir(exist_ok=True)
    outputs.mkdir(exist_ok=True)
    previews.mkdir(exist_ok=True)

    with urllib.request.urlopen(SOURCE_URL, timeout=60) as response:
        pdb_bytes = response.read()
    (inputs / "6OIM.pdb").write_bytes(pdb_bytes)
    text = pdb_bytes.decode("ascii")

    residues: dict[tuple[str, int, str, str], list[tuple[float, float, float, float]]] = defaultdict(list)
    ligand_atoms: list[tuple[float, float, float]] = []
    resolution = None
    for line in text.splitlines():
        if line.startswith("REMARK   2 RESOLUTION."):
            resolution = float(line.split()[3])
        if not line.startswith(("ATOM  ", "HETATM")) or line[16] not in (" ", "A"):
            continue
        record = line[:6].strip()
        resname = line[17:20].strip()
        chain = line[21]
        try:
            residue_number = int(line[22:26])
            xyz = (float(line[30:38]), float(line[38:46]), float(line[46:54]))
            b_factor = float(line[60:66])
        except ValueError:
            continue
        if record == "ATOM" and chain == "A":
            residues[(chain, residue_number, line[26].strip(), resname)].append((*xyz, b_factor))
        elif record == "HETATM" and resname == "MOV":
            ligand_atoms.append(xyz)

    cys12_atoms = [atom[:3] for key, atoms in residues.items() if key[1] == 12 for atom in atoms]
    if not cys12_atoms or not ligand_atoms:
        raise RuntimeError("6OIM did not contain chain-A Cys12 and MOV coordinates")

    rows = []
    for (_, number, insertion, resname), atoms in sorted(residues.items(), key=lambda item: (item[0][1], item[0][2])):
        coords = [atom[:3] for atom in atoms]
        min_to_cys12 = min(math.dist(a, b) for a in coords for b in cys12_atoms)
        min_to_mov = min(math.dist(a, b) for a in coords for b in ligand_atoms)
        rows.append({
            "residue": f"{number}{insertion}",
            "resname": resname,
            "atom_count": len(atoms),
            "mean_b_factor_a2": round(mean([atom[3] for atom in atoms]), 3),
            "min_distance_to_cys12_a": round(min_to_cys12, 3),
            "min_distance_to_mov_a": round(min_to_mov, 3),
        })

    with (outputs / "residue-quality-metrics.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    by_number = {int(row["residue"]): row for row in rows if row["residue"].isdigit()}
    observed = sorted(by_number)
    regions = {
        "P-loop (10-17)": range(10, 18),
        "switch I (30-38)": range(30, 39),
        "switch II (60-76)": range(60, 77),
        "alpha5/C-terminal observed segment (150-166)": range(150, 167),
    }
    region_metrics = {}
    for name, numbers in regions.items():
        values = [float(by_number[n]["mean_b_factor_a2"]) for n in numbers if n in by_number]
        region_metrics[name] = {"observed_residues": len(values), "mean_b_factor_a2": round(mean(values), 3)}

    summary = {
        "schema": "rosalind.kras-structure-review/v1",
        "pdb_id": "6OIM",
        "method": "X-ray diffraction",
        "resolution_a": resolution,
        "chain": "A",
        "observed_residue_count": len(rows),
        "observed_residue_range": [observed[0], observed[-1]],
        "unobserved_within_1_189": [number for number in range(1, 190) if number not in by_number],
        "cys12_mean_b_factor_a2": by_number[12]["mean_b_factor_a2"],
        "cys12_min_distance_to_mov_a": by_number[12]["min_distance_to_mov_a"],
        "residues_within_4a_of_mov": [row["residue"] for row in rows if float(row["min_distance_to_mov_a"]) <= 4.0],
        "region_metrics": region_metrics,
        "interpretive_rule": "Higher crystallographic B factors and absent coordinates identify regions that deserve extra caution when a prediction is interpreted; they are not prediction confidence scores.",
    }
    (outputs / "structure-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    provenance = {
        "schema": "public-structure-source/v1",
        "pdb_id": "6OIM",
        "entry_url": ENTRY_URL,
        "coordinate_url": SOURCE_URL,
        "retrieved_at_utc": "2026-08-29T18:19:00Z",
        "selection": "asymmetric-unit chain A and covalent ligand MOV from the deposited PDB coordinates",
    }
    (inputs / "source-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")

    switch_i = region_metrics["switch I (30-38)"]["mean_b_factor_a2"]
    switch_ii = region_metrics["switch II (60-76)"]["mean_b_factor_a2"]
    missing = len(summary["unobserved_within_1_189"])
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">KRAS G12C experimental-reference review</title><desc id="desc">6OIM structure metrics used to identify regions requiring caution in prediction interpretation.</desc>
<rect width="1200" height="675" fill="#071522"/><circle cx="1080" cy="70" r="220" fill="#22d3ee" opacity=".14"/>
<style>.k{{font:600 22px Segoe UI,Arial;fill:#67e8f9}}.t{{font:700 43px Segoe UI,Arial;fill:#f8fafc}}.b{{font:24px Segoe UI,Arial;fill:#cbd5e1}}.m{{font:700 35px Segoe UI,Arial;fill:#f8fafc}}.s{{font:18px Segoe UI,Arial;fill:#94a3b8}}</style>
<text x="70" y="85" class="k">PUBLIC PDB 6OIM · 1.65 Å X-RAY STRUCTURE</text><text x="70" y="150" class="t">KRAS G12C structure-quality review</text>
<rect x="70" y="215" width="320" height="280" rx="20" fill="#0f2538" stroke="#155e75"/><text x="105" y="270" class="b">Observed residues</text><text x="105" y="320" class="m">{len(rows)}</text><text x="105" y="385" class="b">Absent in 1–189</text><text x="105" y="435" class="m">{missing}</text>
<rect x="440" y="215" width="690" height="280" rx="20" fill="#0f2538" stroke="#155e75"/><text x="480" y="275" class="b">Mean crystallographic B factor</text><text x="480" y="340" class="b">Switch I (30–38)</text><text x="900" y="340" class="m">{switch_i:.1f} Å²</text><text x="480" y="415" class="b">Switch II (60–76)</text><text x="900" y="415" class="m">{switch_ii:.1f} Å²</text>
<text x="70" y="580" class="b">Cys12–MOV nearest atom distance: {summary['cys12_min_distance_to_mov_a']:.2f} Å</text><text x="70" y="625" class="s">Experimental B factors guide caution; they are not predicted confidence values.</text>
</svg>'''
    (previews / "preview.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
