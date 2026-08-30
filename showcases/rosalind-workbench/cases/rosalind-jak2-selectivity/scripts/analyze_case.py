#!/usr/bin/env python3
"""Compute reproducible protein-contact and molecular-descriptor tables."""

from __future__ import annotations

import csv
import json
import math
import textwrap
from itertools import combinations
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from rdkit import Chem, rdBase
from rdkit.Chem import Crippen, Descriptors, Lipinski, rdMolDescriptors


CASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = CASE_DIR / "inputs" / "case-config.json"
OUTPUT_DIR = CASE_DIR / "outputs"
PREVIEW_DIR = CASE_DIR / "previews"
AA3_TO_1 = {
    "ALA": "A", "ARG": "R", "ASN": "N", "ASP": "D", "CYS": "C",
    "GLN": "Q", "GLU": "E", "GLY": "G", "HIS": "H", "ILE": "I",
    "LEU": "L", "LYS": "K", "MET": "M", "PHE": "F", "PRO": "P",
    "SER": "S", "THR": "T", "TRP": "W", "TYR": "Y", "VAL": "V",
    "PTR": "Y",
}


def parse_atom(line: str) -> dict[str, object]:
    return {
        "record": line[0:6].strip(),
        "atom": line[12:16].strip(),
        "altloc": line[16:17].strip(),
        "resname": line[17:20].strip(),
        "chain": line[21:22].strip(),
        "resseq": line[22:26].strip(),
        "icode": line[26:27].strip(),
        "x": float(line[30:38]),
        "y": float(line[38:46]),
        "z": float(line[46:54]),
        "element": line[76:78].strip() or line[12:14].strip(),
    }


def atom_distance(a: dict[str, object], b: dict[str, object]) -> float:
    return math.sqrt(
        (float(a["x"]) - float(b["x"])) ** 2
        + (float(a["y"]) - float(b["y"])) ** 2
        + (float(a["z"]) - float(b["z"])) ** 2
    )


def align_residue_labels(first: dict[str, object], second: dict[str, object]) -> dict[str, str]:
    """Needleman-Wunsch mapping for two retained protein-chain sequences."""
    seq_a = str(first["protein_sequence"])
    seq_b = str(second["protein_sequence"])
    labels_a = list(first["protein_residue_order"])
    labels_b = list(second["protein_residue_order"])
    rows, columns = len(seq_a) + 1, len(seq_b) + 1
    score = [[0] * columns for _ in range(rows)]
    trace = [[""] * columns for _ in range(rows)]
    for i in range(1, rows):
        score[i][0] = -2 * i
        trace[i][0] = "up"
    for j in range(1, columns):
        score[0][j] = -2 * j
        trace[0][j] = "left"
    for i in range(1, rows):
        for j in range(1, columns):
            diagonal = score[i - 1][j - 1] + (2 if seq_a[i - 1] == seq_b[j - 1] else -1)
            upward = score[i - 1][j] - 2
            leftward = score[i][j - 1] - 2
            best = max(diagonal, upward, leftward)
            score[i][j] = best
            trace[i][j] = "diag" if best == diagonal else ("up" if best == upward else "left")
    mapping: dict[str, str] = {}
    i, j = len(seq_a), len(seq_b)
    while i or j:
        direction = trace[i][j]
        if direction == "diag":
            mapping[labels_a[i - 1]] = labels_b[j - 1]
            i -= 1
            j -= 1
        elif direction == "up":
            i -= 1
        else:
            j -= 1
    return mapping


def load_structure(spec: dict[str, object], cutoff: float) -> tuple[list[dict[str, object]], dict[str, object]]:
    path = CASE_DIR / str(spec["file"])
    lines = path.read_text(encoding="ascii", errors="replace").splitlines()
    atoms = [parse_atom(line) for line in lines if line.startswith(("ATOM  ", "HETATM"))]
    atoms = [atom for atom in atoms if atom["altloc"] in ("", "A")]
    protein_atoms = [
        atom for atom in atoms
        if atom["record"] == "ATOM" and atom["chain"] == spec["protein_chain"]
    ]
    if spec["ligand_mode"] == "hetero":
        ligand_atoms = [
            atom for atom in atoms
            if atom["record"] == "HETATM"
            and atom["resname"] == spec["ligand_resname"]
            and atom["chain"] == spec["ligand_chain"]
        ]
    else:
        ligand_atoms = [
            atom for atom in atoms
            if atom["record"] == "ATOM" and atom["chain"] == spec["ligand_chain"]
        ]
    if not protein_atoms or not ligand_atoms:
        raise ValueError(f"Missing protein or ligand atoms for {spec['label']}")

    residue_atoms: dict[tuple[str, str, str], list[dict[str, object]]] = {}
    for atom in protein_atoms:
        key = (str(atom["resname"]), str(atom["resseq"]), str(atom["icode"]))
        residue_atoms.setdefault(key, []).append(atom)
    residue_order = [f"{name}{number}{icode}" for name, number, icode in residue_atoms]
    protein_sequence = "".join(AA3_TO_1.get(name, "X") for name, _, _ in residue_atoms)

    contacts: list[dict[str, object]] = []
    for (resname, resseq, icode), residue in residue_atoms.items():
        nearest = min(
            ((atom_distance(pa, la), pa, la) for pa in residue for la in ligand_atoms),
            key=lambda item: item[0],
        )
        distance, protein_atom, ligand_atom = nearest
        if distance <= cutoff:
            contacts.append({
                "structure": spec["label"],
                "pdb_id": spec["pdb_id"],
                "ligand": spec["ligand_resname"],
                "protein_chain": spec["protein_chain"],
                "protein_residue": f"{resname}{resseq}{icode}",
                "protein_resname": resname,
                "protein_resseq": resseq,
                "nearest_protein_atom": protein_atom["atom"],
                "nearest_ligand_residue": f"{ligand_atom['resname']}{ligand_atom['resseq']}{ligand_atom['icode']}",
                "nearest_ligand_atom": ligand_atom["atom"],
                "min_distance_angstrom": round(distance, 3),
                "distance_class": "close" if distance <= 3.5 else "near",
            })
    contacts.sort(key=lambda row: (float(row["min_distance_angstrom"]), str(row["protein_residue"])))

    title = " ".join(line[10:].strip() for line in lines if line.startswith("TITLE"))
    resolution_line = next((line for line in lines if line.startswith("REMARK   2 RESOLUTION.")), "")
    links = [line.rstrip() for line in lines if line.startswith("LINK") and str(spec["ligand_resname"]) in line]
    metadata = {
        "label": spec["label"],
        "pdb_id": spec["pdb_id"],
        "title_from_pdb": title,
        "resolution_record": resolution_line.strip(),
        "protein_atom_count": len(protein_atoms),
        "ligand_atom_count": len(ligand_atoms),
        "contact_residue_count": len(contacts),
        "covalent_link_records": links,
        "contact_residues": [row["protein_residue"] for row in contacts],
        "protein_residue_order": residue_order,
        "protein_sequence": protein_sequence,
    }
    return contacts, metadata


def load_descriptor(compound: dict[str, object]) -> dict[str, object]:
    path = CASE_DIR / "inputs" / f"pubchem-{compound['slug']}.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    record = payload["PropertyTable"]["Properties"][0]
    smiles = record.get("ConnectivitySMILES") or record.get("CanonicalSMILES") or record.get("SMILES")
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"RDKit could not parse PubChem SMILES for {compound['name']}")
    return {
        "compound": compound["name"],
        "role": compound["role"],
        "pubchem_cid": compound["pubchem_cid"],
        "molecular_formula_pubchem": record.get("MolecularFormula"),
        "molecular_weight_pubchem": record.get("MolecularWeight"),
        "xlogp_pubchem": record.get("XLogP"),
        "tpsa_pubchem": record.get("TPSA"),
        "hbond_donors_pubchem": record.get("HBondDonorCount"),
        "hbond_acceptors_pubchem": record.get("HBondAcceptorCount"),
        "rotatable_bonds_pubchem": record.get("RotatableBondCount"),
        "molecular_weight_rdkit": round(Descriptors.MolWt(mol), 3),
        "clogp_rdkit": round(Crippen.MolLogP(mol), 3),
        "tpsa_rdkit": round(rdMolDescriptors.CalcTPSA(mol), 3),
        "hbond_donors_rdkit": Lipinski.NumHDonors(mol),
        "hbond_acceptors_rdkit": Lipinski.NumHAcceptors(mol),
        "rotatable_bonds_rdkit": Lipinski.NumRotatableBonds(mol),
        "canonical_smiles_rdkit": Chem.MolToSmiles(mol, canonical=True),
        "inchi_key_pubchem": record.get("InChIKey"),
    }


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        raise ValueError(f"No rows for {path.name}")
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def make_preview(config: dict[str, object], structures: list[dict[str, object]], descriptors: list[dict[str, object]]) -> None:
    labels = [str(record["label"]) for record in structures]
    counts = [int(record["contact_residue_count"]) for record in structures]
    colors = ["#22c55e" if record["covalent_link_records"] else "#38bdf8" for record in structures]

    plt.rcParams["svg.hashsalt"] = config["showcase_id"]
    fig = plt.figure(figsize=(12, 6.75), dpi=100, facecolor="#071726")
    grid = fig.add_gridspec(2, 2, height_ratios=[2.2, 1.2], hspace=0.42, wspace=0.34)
    ax_contacts = fig.add_subplot(grid[0, 0])
    ax_props = fig.add_subplot(grid[0, 1])
    ax_notes = fig.add_subplot(grid[1, :])
    for ax in (ax_contacts, ax_props, ax_notes):
        ax.set_facecolor("#0f2235")
        ax.tick_params(colors="#dbeafe")
        for spine in ax.spines.values():
            spine.set_color("#36526b")

    positions = np.arange(len(labels))
    ax_contacts.barh(positions, counts, color=colors)
    ax_contacts.set_yticks(positions, labels=[textwrap.fill(label.replace("-", " "), 18) for label in labels])
    ax_contacts.invert_yaxis()
    ax_contacts.set_xlabel("Protein residues within 4.0 Å", color="#dbeafe")
    ax_contacts.set_title("")
    ax_contacts.grid(axis="x", alpha=0.16)
    ax_contacts.set_xlim(0, max(counts) * 1.08)
    for index, (count, record) in enumerate(zip(counts, structures)):
        suffix = " • covalent" if record["covalent_link_records"] else ""
        ax_contacts.text(count - 0.18, index, f"{count}{suffix}", ha="right", va="center", color="#071726", fontsize=9, weight="bold")

    property_names = ["molecular_weight_rdkit", "clogp_rdkit", "tpsa_rdkit", "hbond_acceptors_rdkit", "rotatable_bonds_rdkit"]
    display_names = ["MW", "cLogP", "TPSA", "HBA", "RotB"]
    scales = np.array([650.0, 6.0, 140.0, 12.0, 14.0])
    matrix = np.array([[float(row[name]) for name in property_names] for row in descriptors]) / scales
    image = ax_props.imshow(matrix, cmap="viridis", vmin=0, vmax=1, aspect="auto")
    ax_props.set_xticks(np.arange(len(display_names)), labels=display_names)
    ax_props.set_yticks(np.arange(len(descriptors)), labels=[row["compound"] for row in descriptors])
    ax_props.set_title("")
    for row_index, row in enumerate(descriptors):
        for column_index, name in enumerate(property_names):
            value = row[name]
            ax_props.text(column_index, row_index, f"{value}", ha="center", va="center", color="white", fontsize=8)
    colorbar = fig.colorbar(image, ax=ax_props, fraction=0.046, pad=0.04)
    colorbar.ax.tick_params(colors="#dbeafe")

    ax_notes.axis("off")
    ax_notes.set_xlim(0, 1)
    ax_notes.set_ylim(0, 1)
    for index, record in enumerate(structures[:3]):
        residues = ", ".join(record["contact_residues"][:12])
        if len(record["contact_residues"]) > 12:
            residues += ", …"
        y = 0.84 - index * 0.29
        ax_notes.text(0.02, y, record["label"], color="#67e8f9", fontsize=9, weight="bold", va="top")
        ax_notes.text(0.30, y, residues, color="#e2e8f0", fontsize=8.5, va="top")
    fig.subplots_adjust(top=0.80, bottom=0.08, left=0.17, right=0.91)
    fig.suptitle(config["title"], color="white", fontsize=18, weight="bold", y=0.965)
    fig.text(0.5, 0.905, config["question"], color="#cbd5e1", fontsize=9.5, ha="center")
    fig.text(0.33, 0.82, "Coordinate-derived contact counts", color="white", fontsize=12, weight="bold", ha="center")
    fig.text(0.73, 0.82, "RDKit descriptors (scaled for display)", color="white", fontsize=12, weight="bold", ha="center")
    fig.text(0.17, 0.035, "Experimental coordinates analyzed; no new docking or biological experiment was run.", color="#fbbf24", fontsize=9.5, weight="bold")
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    metadata = {"Date": config["retrieved_on"], "Title": config["title"]}
    fig.savefig(PREVIEW_DIR / "preview.png", dpi=100, facecolor=fig.get_facecolor(), metadata=metadata)
    fig.savefig(PREVIEW_DIR / "preview.svg", facecolor=fig.get_facecolor(), metadata=metadata)
    plt.close(fig)


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    cutoff = float(config["contact_cutoff_angstrom"])
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    all_contacts: list[dict[str, object]] = []
    structure_summaries: list[dict[str, object]] = []
    for spec in config["structures"]:
        contacts, summary = load_structure(spec, cutoff)
        all_contacts.extend(contacts)
        structure_summaries.append(summary)
    descriptors = [load_descriptor(compound) for compound in config["compounds"]]

    overlap_rows: list[dict[str, object]] = []
    for first, second in combinations(structure_summaries, 2):
        first_set = set(first["contact_residues"])
        second_set = set(second["contact_residues"])
        shared = sorted(first_set & second_set)
        union = first_set | second_set
        aligned_mapping = align_residue_labels(first, second)
        shared_homologous = sorted(
            (source, aligned_mapping[source])
            for source in first_set
            if source in aligned_mapping and aligned_mapping[source] in second_set
        )
        homologous_union_count = len(first_set) + len(second_set) - len(shared_homologous)
        overlap_rows.append({
            "structure_a": first["label"],
            "structure_b": second["label"],
            "contacts_a": len(first_set),
            "contacts_b": len(second_set),
            "shared_exact_residue_labels": len(shared),
            "jaccard_exact_residue_labels": round(len(shared) / len(union), 4) if union else 0.0,
            "shared_residues": ";".join(shared),
            "shared_homologous_contact_positions": len(shared_homologous),
            "jaccard_homology_mapped_contacts": round(len(shared_homologous) / homologous_union_count, 4) if homologous_union_count else 0.0,
            "shared_homologous_contacts": ";".join(f"{a}<->{b}" for a, b in shared_homologous),
            "comparison_note": "Exact residue labels are directly comparable only when residue numbering follows the same reference system.",
        })

    write_csv(OUTPUT_DIR / "contacts.csv", all_contacts)
    write_csv(OUTPUT_DIR / "descriptors.csv", descriptors)
    write_csv(OUTPUT_DIR / "contact-overlap.csv", overlap_rows)
    summary = {
        "showcase_id": config["showcase_id"],
        "question": config["question"],
        "method": {
            "coordinates": "RCSB PDB experimental coordinate files retained under inputs/",
            "contact_definition": f"minimum heavy-atom distance <= {cutoff:.1f} angstrom between ligand/partner and protein residue",
            "descriptors": "RDKit descriptors recomputed from PubChem CID-based canonical structure records",
            "docking": "No new docking was run; deposited experimental poses were analyzed.",
        },
        "software": {
            "python": __import__("sys").version.split()[0],
            "rdkit": rdBase.rdkitVersion,
            "matplotlib": plt.matplotlib.__version__,
        },
        "structures": structure_summaries,
        "contact_overlap": overlap_rows,
        "descriptor_compounds": [row["compound"] for row in descriptors],
        "interpretive_scope": "Geometric contact inventories and molecular descriptors support comparison; they do not measure affinity, selectivity, cellular response, or clinical efficacy.",
    }
    (OUTPUT_DIR / "analysis-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    make_preview(config, structure_summaries, descriptors)
    print(f"WROTE {len(all_contacts)} contacts, {len(overlap_rows)} pairwise comparisons, and {len(descriptors)} descriptor rows")


if __name__ == "__main__":
    main()
