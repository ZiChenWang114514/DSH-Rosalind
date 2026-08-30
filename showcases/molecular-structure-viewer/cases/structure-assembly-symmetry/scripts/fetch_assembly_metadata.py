#!/usr/bin/env python3
"""Retain a compact, dated RCSB assembly/symmetry record for 4V1W."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen


CASE = Path(__file__).resolve().parents[1]
INPUT = CASE / "inputs" / "4V1W.cif"
OUTPUT = CASE / "outputs" / "assembly-symmetry.json"
ASSEMBLY_URL = "https://data.rcsb.org/rest/v1/core/assembly/4V1W/1"
ENTRY_URL = "https://data.rcsb.org/rest/v1/core/entry/4V1W"


def fetch(url: str) -> dict:
    request = Request(url, headers={"User-Agent": "GPT-Science-showcase/2.0"})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def main() -> None:
    assembly = fetch(ASSEMBLY_URL)
    entry = fetch(ENTRY_URL)
    symmetry = assembly["rcsb_struct_symmetry"][0]
    assembly_info = assembly["rcsb_assembly_info"]
    em = entry["em_3d_reconstruction"][0]
    cif = INPUT.read_bytes()

    axes_by_order: dict[str, int] = {}
    for axis in symmetry.get("rotation_axes", []):
        key = str(axis["order"])
        axes_by_order[key] = axes_by_order.get(key, 0) + 1

    result = {
        "schema_version": 1,
        "showcase_id": "structure-assembly-symmetry",
        "retrieval_date": "2026-08-30",
        "source": {
            "coordinate": {
                "accession": "4V1W",
                "path": "inputs/4V1W.cif",
                "url": "https://files.rcsb.org/download/4V1W.cif",
                "bytes": len(cif),
                "sha256": hashlib.sha256(cif).hexdigest(),
            },
            "entry_api": ENTRY_URL,
            "assembly_api": ASSEMBLY_URL,
            "emdb": "https://www.ebi.ac.uk/emdb/EMD-2788",
        },
        "entry_observations": {
            "experimental_method": entry["rcsb_entry_info"]["experimental_method"],
            "reported_resolution_angstrom": entry["rcsb_entry_info"]["resolution_combined"][0],
            "linked_emdb_id": "EMD-2788",
            "em_reconstruction_method": em.get("details"),
            "particle_count": em.get("num_particles"),
            "pixel_size_angstrom": em.get("actual_pixel_size"),
        },
        "assembly_1": {
            "assembly_id": assembly_info["assembly_id"],
            "polymer_composition": assembly_info["polymer_composition"],
            "polymer_entity_instance_count": assembly_info["polymer_entity_instance_count"],
            "polymer_atom_count": assembly_info["polymer_atom_count"],
            "modeled_polymer_monomer_count": assembly_info["modeled_polymer_monomer_count"],
            "unmodeled_polymer_monomer_count": assembly_info["unmodeled_polymer_monomer_count"],
            "total_interfaces": assembly_info["num_interfaces"],
            "total_assembly_buried_surface_area_square_angstrom": assembly_info["total_assembly_buried_surface_area"],
        },
        "symmetry_record": {
            "kind": symmetry["kind"],
            "type": symmetry["type"],
            "symbol": symmetry["symbol"],
            "oligomeric_state": symmetry["oligomeric_state"],
            "stoichiometry": symmetry["stoichiometry"],
            "rotation_axis_count": len(symmetry.get("rotation_axes", [])),
            "rotation_axes_by_order": axes_by_order,
            "cluster_count": len(symmetry.get("clusters", [])),
            "cluster_member_count": len(symmetry["clusters"][0]["members"]),
            "cluster_average_rmsd_angstrom": symmetry["clusters"][0]["avg_rmsd"],
            "rotation_axes": symmetry.get("rotation_axes", []),
            "members": symmetry["clusters"][0]["members"],
        },
        "interpretation_scope": "The record describes RCSB biological assembly 1 and its archive-derived global symmetry annotation; it does not establish behavior under every solution condition.",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
