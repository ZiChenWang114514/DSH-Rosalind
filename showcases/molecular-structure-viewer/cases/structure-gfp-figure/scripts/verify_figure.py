#!/usr/bin/env python3
"""Verify the retained 1EMA source, chromophore contacts, and PNG provenance."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
PDB = CASE / "inputs" / "1EMA.pdb"
PNG = CASE / "previews" / "gfp.png"
SIDECAR = CASE / "previews" / "gfp.png.render.json"
CONTACTS = CASE / "outputs" / "chromophore-contacts.json"
OPERATION_EVIDENCE = CASE / "outputs" / "structure-operation-evidence.json"


def identity(path: Path) -> dict[str, object]:
    payload = path.read_bytes()
    return {
        "path": path.relative_to(CASE).as_posix(),
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def read_atoms() -> list[dict[str, object]]:
    atoms: list[dict[str, object]] = []
    for line in PDB.read_text(encoding="ascii").splitlines():
        if line.startswith("ENDMDL"):
            break
        if not line.startswith(("ATOM  ", "HETATM")):
            continue
        altloc = line[16]
        occupancy = float(line[54:60] or 0)
        element = (line[76:78].strip() or line[12:16].strip()[0]).upper()
        if altloc not in {" ", "A"} or occupancy <= 0 or element == "H":
            continue
        atoms.append(
            {
                "record": line[:6].strip(),
                "serial": int(line[6:11]),
                "atom": line[12:16].strip(),
                "residue": line[17:20].strip(),
                "chain": line[21].strip(),
                "residue_number": int(line[22:26]),
                "insertion_code": line[26].strip() or None,
                "xyz": [float(line[30:38]), float(line[38:46]), float(line[46:54])],
            }
        )
    return atoms


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    pdb_identity = identity(PDB)
    png_identity = identity(PNG)
    sidecar_identity = identity(SIDECAR)
    sidecar = json.loads(SIDECAR.read_text(encoding="utf-8"))

    source_digest = sidecar["provenance"]["source"]["sha256"]
    artifact = sidecar["artifact"]
    if source_digest != pdb_identity["sha256"]:
        raise SystemExit("The retained 1EMA file does not match the render provenance source digest.")
    if artifact["sha256"] != png_identity["sha256"] or artifact["byteLength"] != png_identity["bytes"]:
        raise SystemExit("The retained PNG does not match its render provenance record.")

    atoms = read_atoms()
    chromophore = [
        atom
        for atom in atoms
        if atom["record"] == "HETATM"
        and atom["residue"] == "CRO"
        and atom["chain"] == "A"
        and atom["residue_number"] == 66
    ]
    protein = [atom for atom in atoms if atom["record"] == "ATOM" and atom["chain"] == "A"]
    if len(chromophore) != 22:
        raise SystemExit(f"Expected 22 admitted CRO A:66 atoms, found {len(chromophore)}.")

    residues: dict[tuple[str, int, str | None, str], list[dict[str, object]]] = {}
    for atom in protein:
        key = (
            str(atom["chain"]),
            int(atom["residue_number"]),
            atom["insertion_code"],
            str(atom["residue"]),
        )
        residues.setdefault(key, []).append(atom)

    cutoff = 4.0
    contact_rows: list[dict[str, object]] = []
    atom_pair_count = 0
    for (chain, residue_number, insertion_code, residue_name), residue_atoms in residues.items():
        pairs = sorted(
            (
                (math.dist(atom["xyz"], cro_atom["xyz"]), atom, cro_atom)
                for atom in residue_atoms
                for cro_atom in chromophore
            ),
            key=lambda row: (row[0], row[1]["serial"], row[2]["serial"]),
        )
        within = [row for row in pairs if row[0] <= cutoff]
        if not within:
            continue
        atom_pair_count += len(within)
        distance, atom, cro_atom = within[0]
        contact_rows.append(
            {
                "author_chain": chain,
                "author_residue_number": residue_number,
                "insertion_code": insertion_code,
                "residue_name": residue_name,
                "closest_distance_angstrom": round(distance, 3),
                "protein_atom": atom["atom"],
                "protein_atom_serial": atom["serial"],
                "chromophore_atom": cro_atom["atom"],
                "chromophore_atom_serial": cro_atom["serial"],
                "atom_pairs_within_cutoff": len(within),
            }
        )
    contact_rows.sort(key=lambda row: (row["closest_distance_angstrom"], row["author_residue_number"]))

    contact_payload = {
        "schema": "structure-gfp-figure.chromophore-contacts/v1",
        "case_id": "structure-gfp-figure",
        "source": {
            **pdb_identity,
            "accession": "1EMA",
            "url": "https://files.rcsb.org/download/1EMA.pdb",
            "method": "X-ray diffraction",
            "reported_resolution_angstrom": 1.9,
            "matches_render_source_digest": True,
        },
        "selection": {
            "model": 1,
            "chromophore": {
                "component_id": "CRO",
                "author_chain": "A",
                "author_residue_number": 66,
                "heavy_atom_count": len(chromophore),
            },
            "protein_partner": {"record": "ATOM", "author_chain": "A"},
            "atom_filter": "non-hydrogen atoms with positive occupancy; blank or A alternate location",
            "contact_cutoff_angstrom": cutoff,
        },
        "result": {
            "protein_residue_count": len(contact_rows),
            "protein_chromophore_atom_pair_count": atom_pair_count,
            "residues": contact_rows,
        },
        "interpretation": "The rows report deposited closest-heavy-atom distances, not bond energies or affinities.",
        "limitations": [
            "PHE A:64 and VAL A:68 are covalently linked to CRO and must not be described as ordinary noncovalent contacts.",
            "The result uses one deposited coordinate model and does not represent coordinate uncertainty or dynamics.",
        ],
    }
    write_json(CONTACTS, contact_payload)

    operation_payload = {
        "schema": "structure-viewer.operation-evidence/v1",
        "case_id": "structure-gfp-figure",
        "operation_receipts": [
            {
                "operation": "structure_render_image",
                "operation_succeeded": True,
                "completed_at_utc": sidecar["createdAt"],
                "evidence_kind": "viewer-written PNG and render provenance sidecar",
                "response": {
                    "artifact": png_identity,
                    "sidecar": sidecar_identity,
                    "renderer": sidecar["renderer"],
                    "width": sidecar["provenance"]["output"]["width"],
                    "height": sidecar["provenance"]["output"]["height"],
                    "source_sha256": source_digest,
                    "source_matches_retained_public_input": True,
                },
            }
        ],
        "visual_inspection": {
            "complete_protein_cartoon_visible": True,
            "chromophore_sticks_visible": True,
            "dark_background_visible": True,
            "chromophore_label_visible": False,
        },
        "unverified_operations": [
            "structure_open_from_chat",
            "structure_analyze",
            "structure_apply_scene",
            "structure_validate_render",
        ],
        "blocked_operations": {
            "structure_browse_related_data": "The retained attempt returned available=false.",
            "structure_load_background": "Not invoked because no authenticated image token was returned.",
        },
        "sanitization": "No session, render-job, caller, command, resource, or local-user identifiers are retained.",
    }
    write_json(OPERATION_EVIDENCE, operation_payload)

    print(
        json.dumps(
            {
                "pdb": pdb_identity,
                "png": png_identity,
                "contact_residues": len(contact_rows),
                "render_evidence": "verified",
            }
        )
    )


if __name__ == "__main__":
    main()
