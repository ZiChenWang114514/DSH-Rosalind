#!/usr/bin/env python3
"""Calculate the 1MBN heme contact shell and iron geometry."""

from __future__ import annotations

import json
import math
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
SOURCE = CASE / "inputs" / "1MBN.pdb"
OUTPUT = CASE / "outputs" / "heme-geometry.json"
PREVIEW = CASE / "previews" / "preview.svg"


def parse(path: Path) -> list[dict]:
    result = []
    for line in path.read_text(encoding="ascii").splitlines():
        if line.startswith("ENDMDL"):
            break
        if not line.startswith(("ATOM  ", "HETATM")):
            continue
        altloc = line[16]
        occupancy = float(line[54:60] or 0)
        element = (line[76:78].strip() or line[12:16].strip()[0]).upper()
        if altloc not in {" ", "A"} or occupancy <= 0 or element == "H":
            continue
        result.append({
            "record": line[:6].strip(), "serial": int(line[6:11]), "atom": line[12:16].strip(),
            "resname": line[17:20].strip(), "chain": line[21].strip(), "resseq": int(line[22:26]),
            "icode": line[26].strip() or None, "element": element,
            "xyz": [float(line[30:38]), float(line[38:46]), float(line[46:54])],
        })
    return result


def dist(a: dict, b: dict) -> float:
    return math.dist(a["xyz"], b["xyz"])


def sub(a: list[float], b: list[float]) -> list[float]:
    return [a[i] - b[i] for i in range(3)]


def cross(a: list[float], b: list[float]) -> list[float]:
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


all_atoms = parse(SOURCE)
heme = [a for a in all_atoms if a["record"] == "HETATM" and a["resname"] == "HEM" and a["chain"] == "A" and a["resseq"] == 155]
if len(heme) != 43:
    raise SystemExit(f"Expected 43 heavy atoms for HEM A:155, found {len(heme)}")
fe = next(a for a in heme if a["atom"] == "FE")
n_by_name = {a["atom"]: a for a in heme if a["atom"] in {"NA", "NB", "NC", "ND"}}
if set(n_by_name) != {"NA", "NB", "NC", "ND"}:
    raise SystemExit("Heme pyrrole nitrogens were not found")

contact_cutoff = 4.0
protein = [a for a in all_atoms if a["record"] == "ATOM" and a["chain"] == "A"]
by_residue: dict[tuple, list[dict]] = {}
for atom in protein:
    by_residue.setdefault((atom["chain"], atom["resseq"], atom["icode"], atom["resname"]), []).append(atom)
contacts = []
for (chain, resseq, icode, resname), residue_atoms in by_residue.items():
    candidates = sorted(
        ((dist(pa, ha), pa, ha) for pa in residue_atoms for ha in heme),
        key=lambda item: (item[0], item[1]["atom"], item[2]["atom"]),
    )
    d, pa, ha = candidates[0]
    if d <= contact_cutoff:
        contacts.append({
            "author_chain": chain, "author_residue_number": resseq, "insertion_code": icode,
            "residue_name": resname, "closest_distance_angstrom": round(d, 3),
            "protein_atom": pa["atom"], "protein_atom_serial": pa["serial"],
            "heme_atom": ha["atom"], "heme_atom_serial": ha["serial"],
        })
contacts.sort(key=lambda row: (row["closest_distance_angstrom"], row["author_residue_number"]))

fe_n = {name: round(dist(fe, atom), 3) for name, atom in sorted(n_by_name.items())}
na_nc = sub(n_by_name["NC"]["xyz"], n_by_name["NA"]["xyz"])
nb_nd = sub(n_by_name["ND"]["xyz"], n_by_name["NB"]["xyz"])
normal = cross(na_nc, nb_nd)
normal_length = math.sqrt(sum(v * v for v in normal))
centroid = [sum(a["xyz"][i] for a in n_by_name.values()) / 4 for i in range(3)]
fe_offset = abs(sum(sub(fe["xyz"], centroid)[i] * normal[i] for i in range(3))) / normal_length

near_fe = []
for atom in all_atoms:
    if atom in heme:
        continue
    d = dist(fe, atom)
    if d <= 3.0:
        near_fe.append({
            "record": atom["record"], "author_chain": atom["chain"], "author_residue_number": atom["resseq"],
            "residue_name": atom["resname"], "atom": atom["atom"], "atom_serial": atom["serial"],
            "fe_distance_angstrom": round(d, 3),
        })
near_fe.sort(key=lambda row: (row["fe_distance_angstrom"], row["atom_serial"]))

result = {
    "showcase_id": "structure-heme-contacts",
    "source": {
        "pdb_id": "1MBN", "download_url": "https://files.rcsb.org/download/1MBN.pdb",
        "coordinate_file": "inputs/1MBN.pdb", "experiment": "X-ray diffraction", "reported_resolution_angstrom": 2.0,
    },
    "selection": {
        "model": 1,
        "heme": {"record": "HETATM", "component_id": "HEM", "author_chain": "A", "author_residue_number": 155},
        "protein_partner": {"record": "ATOM", "author_chain": "A"},
        "atom_filter": "non-hydrogen atoms with positive occupancy; blank or A alternate location",
        "contact_cutoff_angstrom": contact_cutoff,
    },
    "contact_shell": {"residue_count": len(contacts), "residues": contacts},
    "iron_geometry": {
        "fe_atom_serial": fe["serial"],
        "fe_to_heme_nitrogen_distances_angstrom": fe_n,
        "mean_fe_n_distance_angstrom": round(sum(fe_n.values()) / 4, 3),
        "fe_offset_from_n4_diagonal_plane_angstrom": round(fe_offset, 3),
        "plane_definition": "centroid of NA/NB/NC/ND with normal cross(NA→NC, NB→ND)",
        "non_heme_atoms_within_3_angstrom_of_fe": near_fe,
    },
    "interpretation": "The contact list and iron distances describe the deposited coordinate geometry; they do not measure binding energy or redox state.",
    "limitations": [
        "The 4.0 Å contact shell is cutoff-dependent and does not assign chemical bond order.",
        "The diagonal N4 plane is an explicit geometric construction, not a refinement-derived porphyrin distortion analysis.",
        "Only model 1 and author chain A are analyzed; crystal packing and dynamics are not sampled.",
    ],
}
OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")

label_rows = [
    " · ".join(f"{r['residue_name']} {r['author_residue_number']} ({r['closest_distance_angstrom']:.3f} Å)" for r in contacts[:3]),
    " · ".join(f"{r['residue_name']} {r['author_residue_number']} ({r['closest_distance_angstrom']:.3f} Å)" for r in contacts[3:6]),
]
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Myoglobin heme geometry</title><desc id="desc">Coordinate-derived heme contact shell and iron geometry in RCSB 1MBN.</desc>
<rect width="1200" height="675" fill="#160b16"/><text x="70" y="75" fill="#fda4af" font-family="Segoe UI,Arial" font-size="27">RCSB 1MBN · HEM A:155 · model 1</text>
<text x="70" y="155" fill="#fff7ed" font-family="Segoe UI,Arial" font-size="48" font-weight="700">Heme contact environment</text>
<circle cx="315" cy="340" r="145" fill="#7f1d1d" stroke="#fb7185" stroke-width="4"/><circle cx="315" cy="340" r="45" fill="#f97316"/><text x="315" y="351" text-anchor="middle" fill="#1f1300" font-family="Segoe UI,Arial" font-size="31" font-weight="700">Fe</text>
<text x="560" y="265" fill="#f8fafc" font-family="Segoe UI,Arial" font-size="31">{len(contacts)} protein residues within 4.0 Å</text>
<text x="560" y="325" fill="#fecdd3" font-family="Segoe UI,Arial" font-size="27">mean Fe–N = {sum(fe_n.values()) / 4:.3f} Å</text>
<text x="560" y="375" fill="#fecdd3" font-family="Segoe UI,Arial" font-size="27">Fe offset from N4 plane = {fe_offset:.3f} Å</text>
<rect x="70" y="495" width="1060" height="110" rx="16" fill="#2a1627"/><text x="95" y="540" fill="#ffe4e6" font-family="Consolas,monospace" font-size="19">{label_rows[0]}</text><text x="95" y="575" fill="#ffe4e6" font-family="Consolas,monospace" font-size="19">{label_rows[1]}</text>
<text x="70" y="635" fill="#a8a29e" font-family="Segoe UI,Arial" font-size="19">Closest-heavy-atom geometry only; no energetic, affinity, or redox claim.</text>
</svg>
'''
PREVIEW.write_text(svg, encoding="utf-8", newline="\n")
print(json.dumps({"contacts": len(contacts), "mean_fe_n_angstrom": round(sum(fe_n.values()) / 4, 3), "output": str(OUTPUT)}))
