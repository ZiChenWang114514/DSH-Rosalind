#!/usr/bin/env python3
"""Create and verify a compact subset of the public AdK equilibrium trajectory."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

import MDAnalysis as mda
import numpy as np


EXPECTED = {
    "topology": {
        "bytes": 789917,
        "sha256": "1aa947d58fb41b6805dc1e7be4dbe65c6a8f4690f0bd7fc2ae03e7bd437085f4",
    },
    "trajectory": {
        "bytes": 168200440,
        "sha256": "598fcbcfcc425f6eafbe9997238320fcacc6a4613ecce061e1521732bab734bf",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def identity(path: Path) -> dict[str, object]:
    return {"bytes": path.stat().st_size, "sha256": sha256(path)}


def kabsch_rmsd(mobile: np.ndarray, reference: np.ndarray) -> float:
    mobile_centered = mobile - mobile.mean(axis=0)
    reference_centered = reference - reference.mean(axis=0)
    covariance = mobile_centered.T @ reference_centered
    u, _, vt = np.linalg.svd(covariance)
    rotation = vt.T @ u.T
    if np.linalg.det(rotation) < 0:
        vt[-1] *= -1
        rotation = vt.T @ u.T
    fitted = (rotation @ mobile_centered.T).T
    difference = fitted - reference_centered
    return float(np.sqrt(np.mean(np.sum(difference * difference, axis=1))))


def centroid_distance(group_a, group_b) -> float:
    return float(np.linalg.norm(group_a.positions.mean(axis=0) - group_b.positions.mean(axis=0)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--topology", type=Path, required=True)
    parser.add_argument("--trajectory", type=Path, required=True)
    parser.add_argument("--subset", type=Path, required=True)
    parser.add_argument("--frame0-pdb", type=Path, required=True)
    parser.add_argument("--json-output", type=Path, required=True)
    parser.add_argument("--csv-output", type=Path, required=True)
    args = parser.parse_args()

    topology_identity = identity(args.topology)
    trajectory_identity = identity(args.trajectory)
    if topology_identity != EXPECTED["topology"]:
        raise SystemExit(f"topology identity mismatch: {topology_identity}")
    if trajectory_identity != EXPECTED["trajectory"]:
        raise SystemExit(f"trajectory identity mismatch: {trajectory_identity}")

    universe = mda.Universe(str(args.topology), str(args.trajectory))
    protein = universe.select_atoms("protein")
    ca = universe.select_atoms("protein and name CA")
    core = universe.select_atoms("protein and name CA and (resid 1:29 or resid 60:121 or resid 160:214)")
    nmp = universe.select_atoms("protein and name CA and resid 30:59")
    lid = universe.select_atoms("protein and name CA and resid 122:159")
    frame_count = len(universe.trajectory)
    frame_indices = sorted({0, frame_count // 4, frame_count // 2, (3 * frame_count) // 4, frame_count - 1})

    universe.trajectory[0]
    reference_ca = ca.positions.copy()
    rows: list[dict[str, object]] = []
    source_coordinates: list[np.ndarray] = []
    for frame_index in frame_indices:
        ts = universe.trajectory[frame_index]
        source_coordinates.append(universe.atoms.positions.copy())
        rmsd = kabsch_rmsd(ca.positions.copy(), reference_ca)
        if abs(rmsd) < 1e-5:
            rmsd = 0.0
        rows.append(
            {
                "source_frame": frame_index,
                "time_ps": round(float(ts.time), 6),
                "ca_kabsch_rmsd_to_frame0_angstrom": round(rmsd, 6),
                "protein_radius_of_gyration_angstrom": round(float(protein.radius_of_gyration()), 6),
                "core_to_nmp_centroid_angstrom": round(centroid_distance(core, nmp), 6),
                "core_to_lid_centroid_angstrom": round(centroid_distance(core, lid), 6),
            }
        )

    args.subset.parent.mkdir(parents=True, exist_ok=True)
    with mda.Writer(str(args.subset), n_atoms=universe.atoms.n_atoms, dt=universe.trajectory.dt) as writer:
        for frame_index in frame_indices:
            universe.trajectory[frame_index]
            writer.write(universe.atoms)

    universe.trajectory[0]
    args.frame0_pdb.parent.mkdir(parents=True, exist_ok=True)
    with mda.Writer(str(args.frame0_pdb), n_atoms=universe.atoms.n_atoms) as writer:
        writer.write(universe.atoms)

    subset_universe = mda.Universe(str(args.topology), str(args.subset))
    errors: list[float] = []
    for subset_index, expected_coordinates in enumerate(source_coordinates):
        subset_universe.trajectory[subset_index]
        errors.append(float(np.max(np.abs(subset_universe.atoms.positions - expected_coordinates))))

    args.csv_output.parent.mkdir(parents=True, exist_ok=True)
    with args.csv_output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    payload = {
        "verification_kind": "executed local topology-and-trajectory inspection",
        "software": {
            "MDAnalysis": mda.__version__,
            "numpy": np.__version__,
        },
        "public_source_identity": {
            "topology": topology_identity,
            "full_trajectory": trajectory_identity,
            "matches_mdanalysisdata_accession_checksums": True,
        },
        "topology_trajectory_compatibility": {
            "load_succeeded": True,
            "topology_format": "PSF",
            "trajectory_format": "DCD",
            "atom_count": universe.atoms.n_atoms,
            "protein_atom_count": protein.n_atoms,
            "residue_count": universe.residues.n_residues,
            "chain_a_ca_count": ca.n_atoms,
            "full_frame_count": frame_count,
            "dt_ps": round(float(universe.trajectory.dt), 6),
            "coordinates_finite_for_sampled_frames": bool(
                all(np.isfinite(coords).all() for coords in source_coordinates)
            ),
        },
        "retained_subset": {
            "path": "inputs/adk-equilibrium-5frames.dcd",
            "selected_source_frames": frame_indices,
            "frame_count": len(subset_universe.trajectory),
            "atom_count": subset_universe.atoms.n_atoms,
            "bytes": args.subset.stat().st_size,
            "sha256": sha256(args.subset),
            "reload_succeeded": True,
            "maximum_absolute_coordinate_roundtrip_error_angstrom": round(max(errors), 9),
            "time_axis_note": "The compact DCD stores five frames in source order. Original source frame indices and times are retained in sampled-frame-metrics.csv; playback frame spacing is presentational.",
        },
        "mount_structure": {
            "path": "inputs/adk-frame0.pdb",
            "role": "supported coordinate file for opening a viewer before loading the PSF plus DCD pair",
            "atom_records": sum(1 for line in args.frame0_pdb.read_text(encoding="ascii").splitlines() if line.startswith(("ATOM", "HETATM"))),
            "bytes": args.frame0_pdb.stat().st_size,
            "sha256": sha256(args.frame0_pdb),
            "metadata_limitations": [
                "The source PSF lacks PDB chain IDs, so MDAnalysis writes chain X in the derived PDB.",
                "Occupancy, temperature factor, element, alternate-location, and insertion-code fields use writer defaults when the PSF does not supply them.",
                "Use the retained PSF, rather than the derived PDB, as the topology identity for trajectory work."
            ],
        },
        "sampled_frame_metrics": rows,
        "scientific_scope": {
            "rmsd": "ordinary least-squares Kabsch RMSD over 214 protein C-alpha atoms relative to source frame 0",
            "radius_of_gyration": "mass-weighted protein radius of gyration",
            "domain_centroids": {
                "CORE": "C-alpha atoms of residues 1-29, 60-121, and 160-214",
                "NMP": "C-alpha atoms of residues 30-59",
                "LID": "C-alpha atoms of residues 122-159",
            },
        },
        "viewer_execution": {
            "trajectory_load": "not executed",
            "playback": "not executed",
            "movie_render": "not executed",
            "export": "not executed",
            "qualification": "The retained viewer requests are rehearsed contracts awaiting a mounted Structure Viewer session.",
        },
    }
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
