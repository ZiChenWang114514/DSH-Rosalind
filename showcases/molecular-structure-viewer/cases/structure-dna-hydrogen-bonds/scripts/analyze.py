#!/usr/bin/env python3
"""Screen protein-DNA donor/acceptor geometry in RCSB 1LMB."""

from __future__ import annotations

import json
import math
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
SOURCE = CASE / "inputs" / "1LMB.pdb"
OUTPUT = CASE / "outputs" / "protein-dna-hydrogen-bonds.json"
PREVIEW = CASE / "previews" / "preview.svg"
AA = {"ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE", "LEU", "LYS", "MET", "PHE", "PRO", "SER", "THR", "TRP", "TYR", "VAL"}
DNA = {"DA", "DC", "DG", "DT"}


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
            "altloc": altloc.strip() or None, "occupancy": occupancy, "resname": line[17:20].strip(),
            "chain": line[21].strip(), "resseq": int(line[22:26]), "icode": line[26].strip() or None,
            "element": element, "xyz": [float(line[30:38]), float(line[38:46]), float(line[46:54])],
        })
    return result


PROTEIN_DONORS = {
    "N": ["CA"], "ARG:NE": ["CD", "CZ"], "ARG:NH1": ["CZ"], "ARG:NH2": ["CZ"],
    "ASN:ND2": ["CG"], "GLN:NE2": ["CD"], "HIS:ND1": ["CG", "CE1"], "HIS:NE2": ["CD2", "CE1"],
    "LYS:NZ": ["CE"], "SER:OG": ["CB"], "THR:OG1": ["CB"], "TRP:NE1": ["CD1", "CE2"],
    "TYR:OH": ["CZ"], "CYS:SG": ["CB"],
}
DNA_DONORS = {"DA:N6": ["C6"], "DC:N4": ["C4"], "DG:N1": ["C2", "C6"], "DG:N2": ["C2"], "DT:N3": ["C2", "C4"]}
PROTEIN_ACCEPTORS = {
    "O", "OXT", "ASP:OD1", "ASP:OD2", "GLU:OE1", "GLU:OE2", "ASN:OD1", "GLN:OE1",
    "HIS:ND1", "HIS:NE2", "SER:OG", "THR:OG1", "TYR:OH", "CYS:SG", "MET:SD",
}
DNA_ACCEPTORS = {
    "DA:N1", "DA:N3", "DA:N7", "DC:O2", "DC:N3", "DG:O6", "DG:N3", "DG:N7", "DT:O2", "DT:O4",
    "O1P", "O2P", "OP1", "OP2", "O3'", "O4'", "O5'",
}


def role_key(atom: dict) -> str:
    return f"{atom['resname']}:{atom['atom']}"


def donor_antecedents(atom: dict) -> list[str] | None:
    if atom["resname"] in AA:
        if atom["atom"] == "N" and atom["resname"] != "PRO":
            return PROTEIN_DONORS["N"]
        return PROTEIN_DONORS.get(role_key(atom))
    if atom["resname"] in DNA:
        return DNA_DONORS.get(role_key(atom))
    return None


def is_acceptor(atom: dict) -> bool:
    if atom["resname"] in AA:
        return atom["atom"] in {"O", "OXT"} or role_key(atom) in PROTEIN_ACCEPTORS
    if atom["resname"] in DNA:
        return atom["atom"] in DNA_ACCEPTORS or role_key(atom) in DNA_ACCEPTORS
    return False


def kind(atom: dict) -> str | None:
    if atom["resname"] in AA:
        return "protein"
    if atom["resname"] in DNA:
        return "DNA"
    return None


def angle(a: list[float], vertex: list[float], c: list[float]) -> float:
    u = [a[i] - vertex[i] for i in range(3)]
    v = [c[i] - vertex[i] for i in range(3)]
    cosine = sum(u[i] * v[i] for i in range(3)) / math.sqrt(sum(x * x for x in u) * sum(x * x for x in v))
    return math.degrees(math.acos(max(-1.0, min(1.0, cosine))))


all_atoms = parse(SOURCE)
residue_atoms: dict[tuple, dict[str, dict]] = {}
for atom in all_atoms:
    key = (atom["chain"], atom["resseq"], atom["icode"], atom["resname"])
    residue_atoms.setdefault(key, {})[atom["atom"]] = atom

donors = [(a, donor_antecedents(a)) for a in all_atoms if donor_antecedents(a)]
acceptors = [a for a in all_atoms if is_acceptor(a)]
distance_min, distance_max, angle_min = 2.2, 3.5, 90.0
candidates = []
for donor, antecedent_names in donors:
    for acceptor in acceptors:
        if kind(donor) == kind(acceptor) or kind(donor) is None or kind(acceptor) is None:
            continue
        if donor["altloc"] and acceptor["altloc"] and donor["altloc"] != acceptor["altloc"]:
            continue
        d = math.dist(donor["xyz"], acceptor["xyz"])
        if not distance_min <= d <= distance_max:
            continue
        key = (donor["chain"], donor["resseq"], donor["icode"], donor["resname"])
        antecedents = [residue_atoms[key][name] for name in antecedent_names if name in residue_atoms[key]]
        if not antecedents:
            continue
        best_antecedent, best_angle = max(((a, angle(a["xyz"], donor["xyz"], acceptor["xyz"])) for a in antecedents), key=lambda item: item[1])
        if best_angle < angle_min:
            continue
        candidates.append({
            "donor_side": kind(donor),
            "donor": {"chain": donor["chain"], "residue_number": donor["resseq"], "residue_name": donor["resname"], "atom": donor["atom"], "serial": donor["serial"]},
            "acceptor_side": kind(acceptor),
            "acceptor": {"chain": acceptor["chain"], "residue_number": acceptor["resseq"], "residue_name": acceptor["resname"], "atom": acceptor["atom"], "serial": acceptor["serial"]},
            "donor_acceptor_distance_angstrom": round(d, 3),
            "antecedent_donor_acceptor_angle_degrees": round(best_angle, 1),
            "antecedent": {"atom": best_antecedent["atom"], "serial": best_antecedent["serial"]},
        })
candidates.sort(key=lambda row: (row["donor_acceptor_distance_angstrom"], -row["antecedent_donor_acceptor_angle_degrees"], row["donor"]["serial"], row["acceptor"]["serial"]))

protein_chains = sorted({a["chain"] for a in all_atoms if a["resname"] in AA})
dna_chains = sorted({a["chain"] for a in all_atoms if a["resname"] in DNA})
result = {
    "showcase_id": "structure-dna-hydrogen-bonds",
    "source": {"pdb_id": "1LMB", "download_url": "https://files.rcsb.org/download/1LMB.pdb", "coordinate_file": "inputs/1LMB.pdb", "experiment": "X-ray diffraction", "reported_resolution_angstrom": 1.8},
    "selection": {
        "model": 1, "protein_chains": protein_chains, "dna_chains": dna_chains,
        "atom_filter": "non-hydrogen atoms with positive occupancy; blank or A alternate location",
        "scope": "cross-interface protein-DNA pairs only",
    },
    "geometry_screen": {
        "distance_range_angstrom_inclusive": [distance_min, distance_max],
        "minimum_antecedent_donor_acceptor_angle_degrees": angle_min,
        "hydrogen_handling": "No hydrogens are present; the donor direction is approximated with a named covalent heavy-atom antecedent and the largest available antecedent-donor-acceptor angle.",
        "candidate_count": len(candidates), "candidates": candidates,
    },
    "interpretation": "Each row satisfies an explicit heavy-atom donor/acceptor geometry screen in the deposited model; the rows are plausible hydrogen-bond geometries, not measured bond strengths.",
    "limitations": [
        "Hydrogen positions, protonation states, tautomer states, and water-mediated bridges are not resolved by this screen.",
        "The 90° antecedent-donor-acceptor rule is a transparent heuristic and is not equivalent to a hydrogen-resolved donor-H-acceptor angle.",
        "Only deposited model 1 is evaluated; coordinate uncertainty, dynamics, and crystal packing are not sampled.",
    ],
}
OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")

rows = candidates[:4]
row_svg = "".join(
    f'<text x="90" y="{330 + i * 55}" fill="#dbeafe" font-family="Consolas,monospace" font-size="19">{r["donor"]["residue_name"]} {r["donor"]["chain"]}:{r["donor"]["residue_number"]}/{r["donor"]["atom"]} → {r["acceptor"]["residue_name"]} {r["acceptor"]["chain"]}:{r["acceptor"]["residue_number"]}/{r["acceptor"]["atom"]}  {r["donor_acceptor_distance_angstrom"]:.3f} Å  {r["antecedent_donor_acceptor_angle_degrees"]:.1f}°</text>'
    for i, r in enumerate(rows)
)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Protein-DNA hydrogen-bond geometry screen</title><desc id="desc">Heavy-atom donor and acceptor geometry candidates in RCSB 1LMB.</desc>
<rect width="1200" height="675" fill="#07142b"/><text x="70" y="75" fill="#93c5fd" font-family="Segoe UI,Arial" font-size="27">RCSB 1LMB · protein chains {', '.join(protein_chains)} · DNA chains {', '.join(dna_chains)}</text>
<text x="70" y="155" fill="#f8fafc" font-family="Segoe UI,Arial" font-size="46" font-weight="700">Protein–DNA geometry screen</text>
<text x="70" y="220" fill="#bfdbfe" font-family="Segoe UI,Arial" font-size="26">{len(candidates)} candidates · 2.2–3.5 Å · antecedent–donor–acceptor ≥ 90°</text>
<rect x="65" y="270" width="1070" height="285" rx="18" fill="#0f2747"/>{row_svg}
<text x="70" y="620" fill="#94a3b8" font-family="Segoe UI,Arial" font-size="20">Hydrogens are unresolved; candidates are geometric hypotheses, not bond-strength measurements.</text>
</svg>
'''
PREVIEW.write_text(svg, encoding="utf-8", newline="\n")
print(json.dumps({"protein_chains": protein_chains, "dna_chains": dna_chains, "candidates": len(candidates), "output": str(OUTPUT)}))
