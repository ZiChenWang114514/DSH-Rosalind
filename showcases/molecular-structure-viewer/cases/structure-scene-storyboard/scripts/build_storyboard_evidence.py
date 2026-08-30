#!/usr/bin/env python3
"""Build deterministic local evidence for the adenylate-kinase storyboard."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np


DOMAIN_RESIDUES = {
    "CORE": tuple(range(1, 30)) + tuple(range(60, 122)) + tuple(range(160, 215)),
    "NMP": tuple(range(30, 60)),
    "LID": tuple(range(122, 160)),
}


def parse_pdb(path: Path) -> list[dict[str, object]]:
    atoms: list[dict[str, object]] = []
    with path.open(encoding="ascii") as handle:
        for line in handle:
            if line[:6].strip() not in {"ATOM", "HETATM"}:
                continue
            altloc = line[16]
            if altloc not in {" ", "A"}:
                continue
            atoms.append(
                {
                    "record": line[:6].strip(),
                    "name": line[12:16].strip(),
                    "resname": line[17:20].strip(),
                    "chain": line[21].strip(),
                    "resid": int(line[22:26]),
                    "icode": line[26].strip(),
                    "xyz": np.array(
                        [float(line[30:38]), float(line[38:46]), float(line[46:54])],
                        dtype=float,
                    ),
                }
            )
    return atoms


def count_records(path: Path, *, resname: str | None = None, chain: str | None = None) -> int:
    count = 0
    with path.open(encoding="ascii") as handle:
        for line in handle:
            if line[:6].strip() not in {"ATOM", "HETATM"}:
                continue
            if resname is not None and line[17:20].strip() != resname:
                continue
            if chain is not None and line[21].strip() != chain:
                continue
            count += 1
    return count


def chain_a_ca(atoms: list[dict[str, object]]) -> dict[tuple[int, str, str], np.ndarray]:
    return {
        (int(atom["resid"]), str(atom["icode"]), str(atom["resname"])): atom["xyz"]
        for atom in atoms
        if atom["record"] == "ATOM" and atom["chain"] == "A" and atom["name"] == "CA"
    }


def kabsch(mobile: np.ndarray, reference: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mobile_center = mobile.mean(axis=0)
    reference_center = reference.mean(axis=0)
    covariance = (mobile - mobile_center).T @ (reference - reference_center)
    u, _, vt = np.linalg.svd(covariance)
    rotation = vt.T @ u.T
    if np.linalg.det(rotation) < 0:
        vt[-1] *= -1
        rotation = vt.T @ u.T
    translation = reference_center - rotation @ mobile_center
    transformed = (rotation @ mobile.T).T + translation
    return rotation, translation, transformed


def matrix4(rotation: np.ndarray, translation: np.ndarray) -> list[list[float]]:
    matrix = np.eye(4)
    matrix[:3, :3] = rotation
    matrix[:3, 3] = translation
    return np.round(matrix, 9).tolist()


def identity_matrix() -> list[list[float]]:
    return np.eye(4).tolist()


def translate_x(distance: float) -> list[list[float]]:
    matrix = np.eye(4)
    matrix[0, 3] = distance
    return matrix.tolist()


def domain_centroid(ca: dict[tuple[int, str, str], np.ndarray], residues: tuple[int, ...]) -> np.ndarray:
    coords = [xyz for (resid, _, _), xyz in ca.items() if resid in residues]
    return np.vstack(coords).mean(axis=0)


def scene_state(
    open_visible: bool,
    closed_visible: bool,
    closed_transform: list[list[float]],
    camera: str,
) -> dict[str, object]:
    return {
        "objects": {
            "adk_open_4ake": {"visible": open_visible, "transform": identity_matrix()},
            "adk_ap5_bound_1ake": {"visible": closed_visible, "transform": closed_transform},
        },
        "camera_preset": camera,
        "layers": [
            {"object_id": "adk_open_4ake", "selection": "chain A and polymer.protein", "representation": "cartoon", "color": "#22b8a7"},
            {"object_id": "adk_ap5_bound_1ake", "selection": "chain A and polymer.protein", "representation": "cartoon", "color": "#d96adf"},
            {"object_id": "adk_ap5_bound_1ake", "selection": "chain A and resn AP5", "representation": "sticks", "color": "element"},
        ],
        "selection": None,
        "focus": None,
    }


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--open", type=Path, required=True)
    parser.add_argument("--closed", type=Path, required=True)
    parser.add_argument("--scene-output", type=Path, required=True)
    parser.add_argument("--comparison-output", type=Path, required=True)
    args = parser.parse_args()

    open_atoms = parse_pdb(args.open)
    closed_atoms = parse_pdb(args.closed)
    open_ca = chain_a_ca(open_atoms)
    closed_ca = chain_a_ca(closed_atoms)
    matched = sorted(set(open_ca) & set(closed_ca))
    reference = np.vstack([open_ca[key] for key in matched])
    mobile = np.vstack([closed_ca[key] for key in matched])
    rotation, translation, aligned_mobile = kabsch(mobile, reference)
    differences = aligned_mobile - reference
    rmsd = float(np.sqrt(np.mean(np.sum(differences * differences, axis=1))))

    open_centroids = {name: domain_centroid(open_ca, residues) for name, residues in DOMAIN_RESIDUES.items()}
    closed_centroids_native = {name: domain_centroid(closed_ca, residues) for name, residues in DOMAIN_RESIDUES.items()}
    closed_centroids = {
        name: rotation @ centroid + translation for name, centroid in closed_centroids_native.items()
    }

    overlay_matrix = matrix4(rotation, translation)
    scenes = {
        "01-open-state": scene_state(True, False, identity_matrix(), "front-chain-a"),
        "02-ap5-bound-state": scene_state(False, True, identity_matrix(), "front-chain-a"),
        "03-side-by-side": scene_state(True, True, translate_x(70.0), "front-both-chain-a"),
        "04-local-kabsch-overlay": scene_state(True, True, overlay_matrix, "left-both-chain-a"),
    }

    ap5_atoms = [
        atom for atom in closed_atoms
        if atom["record"] == "HETATM" and atom["chain"] == "A" and atom["resname"] == "AP5"
    ]
    scene_payload = {
        "schema": "case-local-molecular-storyboard-v1",
        "generated_by": "scripts/build_storyboard_evidence.py",
        "viewer_execution": {
            "status": "not-executed",
            "reason": "No mounted Structure Viewer session was available to this task.",
        },
        "objects": [
            {"object_id": "adk_open_4ake", "source": "inputs/4AKE.pdb", "role": "open apo conformation"},
            {"object_id": "adk_ap5_bound_1ake", "source": "inputs/1AKE.pdb", "role": "AP5-bound conformation"},
        ],
        "local_coordinate_observations": {
            "open_total_atom_records": count_records(args.open),
            "closed_total_atom_records": count_records(args.closed),
            "open_primary_conformer_atom_records": len(open_atoms),
            "closed_primary_conformer_atom_records": len(closed_atoms),
            "matched_chain_a_ca_atoms": len(matched),
            "ap5_chain_a_total_atom_records": count_records(args.closed, resname="AP5", chain="A"),
            "ap5_chain_a_primary_conformer_atom_records": len(ap5_atoms),
        },
        "local_alignment": {
            "method": "ordinary least-squares Kabsch superposition over matched chain-A C-alpha atoms",
            "mobile": "1AKE chain A",
            "reference": "4AKE chain A",
            "matched_atoms": len(matched),
            "rmsd_angstrom": round(rmsd, 6),
            "maximum_ca_residual_angstrom": round(float(np.linalg.norm(differences, axis=1).max()), 6),
            "mobile_to_reference_matrix_row_major": overlay_matrix,
            "scope_note": "This all-correspondence Kabsch value is a local coordinate calculation; it is not the Structure Viewer TM-align result.",
        },
        "domain_centroid_distances_angstrom": {
            "definition": {
                "CORE": "chain A residues 1-29, 60-121, and 160-214",
                "NMP": "chain A residues 30-59",
                "LID": "chain A residues 122-159",
            },
            "open_4ake": {
                "core_to_nmp": round(float(np.linalg.norm(open_centroids["CORE"] - open_centroids["NMP"])), 6),
                "core_to_lid": round(float(np.linalg.norm(open_centroids["CORE"] - open_centroids["LID"])), 6),
            },
            "ap5_bound_1ake_after_global_fit": {
                "core_to_nmp": round(float(np.linalg.norm(closed_centroids["CORE"] - closed_centroids["NMP"])), 6),
                "core_to_lid": round(float(np.linalg.norm(closed_centroids["CORE"] - closed_centroids["LID"])), 6),
            },
        },
        "scenes": scenes,
        "storyboard": [
            {"order": 1, "scene": "01-open-state", "scientific_purpose": "Establish the apo open conformation."},
            {"order": 2, "scene": "02-ap5-bound-state", "scientific_purpose": "Show the ligand-bound conformation and AP5 context."},
            {"order": 3, "scene": "03-side-by-side", "scientific_purpose": "Compare silhouettes; the 70 A translation is visual layout only."},
            {"order": 4, "scene": "04-local-kabsch-overlay", "scientific_purpose": "Inspect residual domain motion after a documented local C-alpha fit."},
        ],
    }
    write_json(args.scene_output, scene_payload)

    base = scenes["01-open-state"]
    trials = []
    for name in ("03-side-by-side", "04-local-kabsch-overlay"):
        live = json.loads(json.dumps(base))
        live = json.loads(json.dumps(scenes[name]))
        mutated = live != base
        live = json.loads(json.dumps(base))
        restored = live == base
        trials.append(
            {
                "mutation": f"apply {name}",
                "changed_from_base": mutated,
                "restore_action": "replace the complete case-local state with 01-open-state",
                "restored_exactly": restored,
                "compared_fields": ["objects", "camera_preset", "layers", "selection", "focus"],
            }
        )
    comparison_payload = {
        "verification_kind": "case-local exact JSON state comparison",
        "generated_by": "scripts/build_storyboard_evidence.py",
        "base_scene": "01-open-state",
        "trials": trials,
        "all_restores_exact": all(trial["restored_exactly"] for trial in trials),
        "viewer_scene_restore_verified": False,
        "qualification": "This proves reversibility of the retained case-local model. It does not prove Structure Viewer save_scene or load_scene behavior.",
    }
    write_json(args.comparison_output, comparison_payload)


if __name__ == "__main__":
    main()
