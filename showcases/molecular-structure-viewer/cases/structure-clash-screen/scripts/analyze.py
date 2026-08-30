#!/usr/bin/env python3
"""Run a transparent heavy-atom overlap diagnostic on RCSB 1CRN."""

from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
SOURCE = CASE / "inputs" / "1CRN.pdb"
OUTPUT = CASE / "outputs" / "clash-screen.json"
PREVIEW = CASE / "previews" / "preview.svg"
VDW = {"C": 1.70, "N": 1.55, "O": 1.52, "S": 1.80, "P": 1.80}
COVALENT = {"C": 0.76, "N": 0.71, "O": 0.66, "S": 1.05, "P": 1.07}


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
        if element not in VDW or element not in COVALENT:
            continue
        result.append({
            "record": line[:6].strip(), "serial": int(line[6:11]), "atom": line[12:16].strip(),
            "altloc": altloc.strip() or None, "resname": line[17:20].strip(), "chain": line[21].strip(),
            "resseq": int(line[22:26]), "icode": line[26].strip() or None, "element": element,
            "xyz": [float(line[30:38]), float(line[38:46]), float(line[46:54])],
        })
    return result


def dist(a: dict, b: dict) -> float:
    return math.dist(a["xyz"], b["xyz"])


atoms = parse(SOURCE)
index_by_serial = {a["serial"]: i for i, a in enumerate(atoms)}
graph = [set() for _ in atoms]


def bond(i: int, j: int) -> None:
    graph[i].add(j)
    graph[j].add(i)


for i, a in enumerate(atoms):
    for j in range(i + 1, len(atoms)):
        b = atoms[j]
        same_residue = (a["chain"], a["resseq"], a["icode"], a["resname"]) == (b["chain"], b["resseq"], b["icode"], b["resname"])
        inferred = same_residue and 0.4 < dist(a, b) <= COVALENT[a["element"]] + COVALENT[b["element"]] + 0.45
        peptide = a["record"] == b["record"] == "ATOM" and a["chain"] == b["chain"] and abs(a["resseq"] - b["resseq"]) == 1 and {a["atom"], b["atom"]} == {"C", "N"} and dist(a, b) <= 1.8
        disulfide = a["atom"] == b["atom"] == "SG" and a["resname"] == b["resname"] == "CYS" and dist(a, b) <= 2.3
        if inferred or peptide or disulfide:
            bond(i, j)


def within_three_bonds(start: int, target: int) -> bool:
    queue = deque([(start, 0)])
    seen = {start}
    while queue:
        node, depth = queue.popleft()
        if depth == 3:
            continue
        for nxt in graph[node]:
            if nxt == target:
                return True
            if nxt not in seen:
                seen.add(nxt)
                queue.append((nxt, depth + 1))
    return False


threshold = 0.4
tested_pairs = 0
clashes = []
for i, a in enumerate(atoms):
    for j in range(i + 1, len(atoms)):
        b = atoms[j]
        if a["altloc"] and b["altloc"] and a["altloc"] != b["altloc"]:
            continue
        if within_three_bonds(i, j):
            continue
        tested_pairs += 1
        d = dist(a, b)
        overlap = VDW[a["element"]] + VDW[b["element"]] - d
        if overlap > threshold:
            clashes.append({
                "overlap_angstrom": round(overlap, 3), "distance_angstrom": round(d, 3),
                "atom_1": {"serial": a["serial"], "chain": a["chain"], "residue_number": a["resseq"], "residue_name": a["resname"], "atom": a["atom"], "element": a["element"]},
                "atom_2": {"serial": b["serial"], "chain": b["chain"], "residue_number": b["resseq"], "residue_name": b["resname"], "atom": b["atom"], "element": b["element"]},
            })
clashes.sort(key=lambda row: (-row["overlap_angstrom"], row["atom_1"]["serial"], row["atom_2"]["serial"]))

result = {
    "showcase_id": "structure-clash-screen",
    "source": {"pdb_id": "1CRN", "download_url": "https://files.rcsb.org/download/1CRN.pdb", "coordinate_file": "inputs/1CRN.pdb", "experiment": "X-ray diffraction", "reported_resolution_angstrom": 1.5},
    "selection": {"model": 1, "scope": "all deposited ATOM/HETATM heavy atoms admitted by the element table", "atom_count": len(atoms), "atom_filter": "positive occupancy; blank or A alternate location"},
    "method": {
        "distance": "Euclidean distance between heavy-atom coordinates",
        "vdw_radii_angstrom": VDW,
        "covalent_radii_angstrom": COVALENT,
        "bond_inference": "within-residue covalent-radius sum + 0.45 Å; peptide C-N ≤ 1.8 Å; CYS SG-SG ≤ 2.3 Å",
        "excluded_pairs": "atoms separated by one, two, or three inferred covalent bonds; incompatible alternate locations",
        "reported_when_overlap_greater_than_angstrom": threshold,
        "tested_nonbonded_pairs": tested_pairs,
    },
    "result": {"clash_count": len(clashes), "clashes": clashes},
    "interpretation": "Reported rows are nonbonded heavy-atom overlap diagnostics under the stated radii and exclusions; they identify coordinates worth inspecting, not automatically erroneous residues.",
    "limitations": [
        "This is not an all-atom MolProbity clashscore: hydrogens are absent and no hydrogen addition or optimization is performed.",
        "Bonding is inferred from deposited geometry and explicit simple rules; unusual chemistry may need a topology-aware analysis.",
        "The asymmetric-unit coordinate set is screened without generating crystallographic symmetry mates.",
    ],
}
OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")

if clashes:
    rows = "".join(
        f'<text x="80" y="{345 + i * 52}" fill="#fecaca" font-family="Consolas,monospace" font-size="20">{r["atom_1"]["residue_name"]} {r["atom_1"]["chain"]}:{r["atom_1"]["residue_number"]}/{r["atom_1"]["atom"]} ↔ {r["atom_2"]["residue_name"]} {r["atom_2"]["chain"]}:{r["atom_2"]["residue_number"]}/{r["atom_2"]["atom"]} · overlap {r["overlap_angstrom"]:.3f} Å</text>'
        for i, r in enumerate(clashes[:4])
    )
else:
    rows = '<text x="80" y="370" fill="#bbf7d0" font-family="Segoe UI,Arial" font-size="28">No overlaps above the stated threshold.</text>'
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Crambin heavy-atom overlap diagnostic</title><desc id="desc">Nonbonded heavy-atom overlap screen for RCSB 1CRN.</desc>
<rect width="1200" height="675" fill="#160b0b"/><text x="70" y="75" fill="#fca5a5" font-family="Segoe UI,Arial" font-size="27">RCSB 1CRN · model 1 · heavy atoms</text>
<text x="70" y="155" fill="#fff7ed" font-family="Segoe UI,Arial" font-size="48" font-weight="700">Nonbonded overlap diagnostic</text>
<text x="70" y="220" fill="#fed7aa" font-family="Segoe UI,Arial" font-size="26">{len(atoms)} atoms · {tested_pairs:,} tested pairs · overlap &gt; {threshold:.1f} Å</text>
<rect x="65" y="280" width="1070" height="265" rx="18" fill="#2b1515"/>{rows}
<text x="70" y="615" fill="#a8a29e" font-family="Segoe UI,Arial" font-size="20">{len(clashes)} diagnostic rows; absence or presence is not a validation verdict.</text>
</svg>
'''
PREVIEW.write_text(svg, encoding="utf-8", newline="\n")
print(json.dumps({"atoms": len(atoms), "tested_pairs": tested_pairs, "clashes": len(clashes), "output": str(OUTPUT)}))
