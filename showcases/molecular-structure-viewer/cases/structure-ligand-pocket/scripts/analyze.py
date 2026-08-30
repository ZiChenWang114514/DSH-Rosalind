#!/usr/bin/env python3
"""Calculate the bound STI contact shell in chain A of RCSB 1IEP."""

from __future__ import annotations

import json
import math
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
SOURCE = CASE / "inputs" / "1IEP.pdb"
OUTPUT = CASE / "outputs" / "ligand-contact-shell.json"
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
            "altloc": altloc.strip() or None, "resname": line[17:20].strip(), "chain": line[21].strip(),
            "resseq": int(line[22:26]), "icode": line[26].strip() or None, "element": element,
            "xyz": [float(line[30:38]), float(line[38:46]), float(line[46:54])],
        })
    return result


atoms = parse(SOURCE)
ligand = [a for a in atoms if a["record"] == "HETATM" and a["resname"] == "STI" and a["chain"] == "A" and a["resseq"] == 201]
protein = [a for a in atoms if a["record"] == "ATOM" and a["chain"] == "A"]
if len(ligand) != 37:
    raise SystemExit(f"Expected 37 heavy atoms for STI A:201, found {len(ligand)}")

cutoff = 4.0
by_residue: dict[tuple, list[dict]] = {}
for atom in protein:
    by_residue.setdefault((atom["chain"], atom["resseq"], atom["icode"], atom["resname"]), []).append(atom)

contacts = []
pair_count = 0
for (chain, resseq, icode, resname), residue_atoms in by_residue.items():
    pairs = sorted(
        ((math.dist(pa["xyz"], la["xyz"]), pa, la) for pa in residue_atoms for la in ligand),
        key=lambda item: (item[0], item[1]["atom"], item[2]["atom"]),
    )
    within = [item for item in pairs if item[0] <= cutoff]
    if not within:
        continue
    pair_count += len(within)
    d, pa, la = within[0]
    contacts.append({
        "author_chain": chain, "author_residue_number": resseq, "insertion_code": icode, "residue_name": resname,
        "closest_distance_angstrom": round(d, 3), "protein_atom": pa["atom"], "protein_atom_serial": pa["serial"],
        "ligand_atom": la["atom"], "ligand_atom_serial": la["serial"], "atom_pairs_within_cutoff": len(within),
    })
contacts.sort(key=lambda row: (row["closest_distance_angstrom"], row["author_residue_number"]))

result = {
    "showcase_id": "structure-ligand-pocket",
    "source": {"pdb_id": "1IEP", "download_url": "https://files.rcsb.org/download/1IEP.pdb", "coordinate_file": "inputs/1IEP.pdb", "experiment": "X-ray diffraction", "reported_resolution_angstrom": 2.1},
    "selection": {
        "model": 1,
        "ligand": {"record": "HETATM", "component_id": "STI", "author_chain": "A", "author_residue_number": 201, "heavy_atom_count": len(ligand)},
        "protein_partner": {"record": "ATOM", "author_chain": "A"},
        "atom_filter": "non-hydrogen atoms with positive occupancy; blank or A alternate location",
        "contact_cutoff_angstrom": cutoff,
        "excluded_copy": "The independent STI B:202 / protein chain B copy is not included.",
    },
    "contact_shell": {"residue_count": len(contacts), "atom_pair_count_within_cutoff": pair_count, "residues": contacts},
    "interpretation": "The shell identifies protein residues whose deposited heavy atoms lie within 4.0 Å of STI A:201; it is a geometric neighborhood, not an affinity or potency ranking.",
    "limitations": [
        "The residue list changes if the distance cutoff, alternate-location policy, or independent crystallographic copy changes.",
        "Hydrogen atoms, protonation, solvent mediation, dynamics, and interaction energies are not evaluated.",
        "The deposited complex demonstrates a bound pose in this crystal model and does not by itself establish cellular or clinical effects.",
    ],
}
OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")

label_rows = [
    " · ".join(f"{r['residue_name']} {r['author_residue_number']} ({r['closest_distance_angstrom']:.3f} Å)" for r in contacts[:3]),
    " · ".join(f"{r['residue_name']} {r['author_residue_number']} ({r['closest_distance_angstrom']:.3f} Å)" for r in contacts[3:6]),
]
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">STI contact shell in ABL kinase</title><desc id="desc">Protein residues within four angstroms of STI A 201 in RCSB 1IEP.</desc>
<rect width="1200" height="675" fill="#071726"/><text x="70" y="75" fill="#5eead4" font-family="Segoe UI,Arial" font-size="27">RCSB 1IEP · STI A:201 · protein chain A</text>
<text x="70" y="155" fill="#f8fafc" font-family="Segoe UI,Arial" font-size="48" font-weight="700">Bound-ligand contact shell</text>
<circle cx="300" cy="355" r="120" fill="#0f766e" stroke="#5eead4" stroke-width="5"/><text x="300" y="370" text-anchor="middle" fill="#ecfeff" font-family="Consolas,monospace" font-size="38">STI</text>
<text x="520" y="300" fill="#f8fafc" font-family="Segoe UI,Arial" font-size="32">{len(contacts)} residues within 4.0 Å</text>
<text x="520" y="355" fill="#cbd5e1" font-family="Segoe UI,Arial" font-size="25">{pair_count} protein–ligand atom pairs</text>
<rect x="70" y="495" width="1060" height="110" rx="16" fill="#0f2d36"/><text x="95" y="540" fill="#ccfbf1" font-family="Consolas,monospace" font-size="18">{label_rows[0]}</text><text x="95" y="575" fill="#ccfbf1" font-family="Consolas,monospace" font-size="18">{label_rows[1]}</text>
<text x="70" y="635" fill="#94a3b8" font-family="Segoe UI,Arial" font-size="19">Closest-heavy-atom geometry only; no affinity, potency, or clinical inference.</text>
</svg>
'''
PREVIEW.write_text(svg, encoding="utf-8", newline="\n")
print(json.dumps({"contact_residues": len(contacts), "atom_pairs": pair_count, "output": str(OUTPUT)}))
