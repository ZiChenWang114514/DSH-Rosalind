#!/usr/bin/env python3
"""Measure an exact closest-heavy-atom residue distance in RCSB 1LYZ."""

from __future__ import annotations

import json
import math
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
SOURCE = CASE / "inputs" / "1LYZ.pdb"
OUTPUT = CASE / "outputs" / "residue-distance.json"
PREVIEW = CASE / "previews" / "preview.svg"


def atoms(path: Path) -> list[dict]:
    parsed = []
    for line in path.read_text(encoding="ascii").splitlines():
        if line.startswith("ENDMDL"):
            break
        if not line.startswith(("ATOM  ", "HETATM")):
            continue
        altloc = line[16]
        occupancy = float(line[54:60] or 0)
        element = line[76:78].strip() or line[12:16].strip()[0]
        if altloc not in {" ", "A"} or occupancy <= 0 or element.upper() == "H":
            continue
        parsed.append(
            {
                "record": line[:6].strip(),
                "serial": int(line[6:11]),
                "atom": line[12:16].strip(),
                "altloc": altloc.strip() or None,
                "resname": line[17:20].strip(),
                "chain": line[21].strip(),
                "resseq": int(line[22:26]),
                "icode": line[26].strip() or None,
                "occupancy": occupancy,
                "element": element.upper(),
                "xyz": [float(line[30:38]), float(line[38:46]), float(line[46:54])],
            }
        )
    return parsed


def distance(a: dict, b: dict) -> float:
    return math.dist(a["xyz"], b["xyz"])


all_atoms = atoms(SOURCE)
left = [a for a in all_atoms if a["record"] == "ATOM" and a["chain"] == "A" and a["resseq"] == 35]
right = [a for a in all_atoms if a["record"] == "ATOM" and a["chain"] == "A" and a["resseq"] == 52]
if {a["resname"] for a in left} != {"GLU"} or {a["resname"] for a in right} != {"ASP"}:
    raise SystemExit("Expected GLU A:35 and ASP A:52 in 1LYZ")

ranked = sorted(
    ((distance(a, b), a, b) for a in left for b in right),
    key=lambda item: (item[0], item[1]["atom"], item[2]["atom"]),
)
closest, atom_a, atom_b = ranked[0]

result = {
    "showcase_id": "structure-residue-selection",
    "source": {
        "pdb_id": "1LYZ",
        "download_url": "https://files.rcsb.org/download/1LYZ.pdb",
        "coordinate_file": "inputs/1LYZ.pdb",
        "experiment": "X-ray diffraction",
        "reported_resolution_angstrom": 2.0,
    },
    "selection": {
        "model": 1,
        "left": {"record": "ATOM", "author_chain": "A", "author_residue_number": 35, "residue_name": "GLU"},
        "right": {"record": "ATOM", "author_chain": "A", "author_residue_number": 52, "residue_name": "ASP"},
        "atom_filter": "non-hydrogen atoms with positive occupancy; blank or A alternate location",
        "left_atom_count": len(left),
        "right_atom_count": len(right),
    },
    "calculation": {
        "method": "minimum Euclidean distance over all selected heavy-atom pairs",
        "pair_count": len(ranked),
        "closest_distance_angstrom": round(closest, 3),
        "closest_pair": {
            "left_atom": atom_a["atom"],
            "left_serial": atom_a["serial"],
            "right_atom": atom_b["atom"],
            "right_serial": atom_b["serial"],
        },
    },
    "interpretation": "The number is a coordinate-derived separation between two exact residue selections, not evidence of a bond or interaction energy.",
    "limitations": [
        "The calculation uses the deposited model-1 coordinates and does not model coordinate uncertainty or dynamics.",
        "Hydrogen atoms are absent from this deposited model and are excluded from the selection.",
    ],
}
OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Exact lysozyme residue distance</title><desc id="desc">Closest-heavy-atom distance between GLU A 35 and ASP A 52 in RCSB 1LYZ.</desc>
<rect width="1200" height="675" fill="#071726"/><text x="70" y="80" fill="#67e8f9" font-family="Segoe UI,Arial" font-size="27">RCSB 1LYZ · model 1 · author numbering</text>
<text x="70" y="170" fill="#f8fafc" font-family="Segoe UI,Arial" font-size="48" font-weight="700">Exact residue selection</text>
<rect x="70" y="235" width="420" height="170" rx="24" fill="#0f766e"/><rect x="710" y="235" width="420" height="170" rx="24" fill="#1d4ed8"/>
<text x="280" y="305" text-anchor="middle" fill="#ecfeff" font-family="Consolas,monospace" font-size="34">GLU A:35</text><text x="280" y="355" text-anchor="middle" fill="#ccfbf1" font-family="Segoe UI,Arial" font-size="22">{len(left)} heavy atoms</text>
<text x="920" y="305" text-anchor="middle" fill="#eff6ff" font-family="Consolas,monospace" font-size="34">ASP A:52</text><text x="920" y="355" text-anchor="middle" fill="#dbeafe" font-family="Segoe UI,Arial" font-size="22">{len(right)} heavy atoms</text>
<line x1="490" y1="320" x2="710" y2="320" stroke="#fbbf24" stroke-width="5" stroke-dasharray="12 10"/><text x="600" y="295" text-anchor="middle" fill="#fde68a" font-family="Segoe UI,Arial" font-size="25">{closest:.3f} Å</text>
<text x="600" y="470" text-anchor="middle" fill="#e2e8f0" font-family="Consolas,monospace" font-size="23">{atom_a['atom']} (serial {atom_a['serial']}) ↔ {atom_b['atom']} (serial {atom_b['serial']})</text>
<text x="70" y="585" fill="#94a3b8" font-family="Segoe UI,Arial" font-size="22">Minimum Euclidean distance across {len(ranked)} heavy-atom pairs; no bond or energy is inferred.</text>
</svg>
'''
PREVIEW.write_text(svg, encoding="utf-8", newline="\n")
print(json.dumps({"output": str(OUTPUT), "preview": str(PREVIEW), "distance_angstrom": round(closest, 3)}))
