#!/usr/bin/env python3
"""Compute transparent local 4AKE/1AKE conformation metrics."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parent
OPEN = ROOT / "inputs" / "4AKE.pdb"
CLOSED = ROOT / "inputs" / "1AKE.pdb"
SUMMARY = ROOT / "outputs" / "conformation-summary.json"
TABLE = ROOT / "outputs" / "domain-distance-comparison.csv"
EXPECTED_SHA256 = {
    "4AKE": "ff798ee8791878eb58bac1c6bed32042f51b455512ac93b50bda8fa0ff0e7f78",
    "1AKE": "651e952f55f1317f50f4e82b7f0e99053397032cd8da5b2896f79d0af9f619a9",
}
DOMAINS = {
    "CORE": tuple(range(1, 30)) + tuple(range(60, 122)) + tuple(range(160, 215)),
    "NMP": tuple(range(30, 60)),
    "LID": tuple(range(122, 160)),
}


def records(path: Path) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    for line in path.read_text(encoding="ascii").splitlines():
        if line[:6].strip() not in {"ATOM", "HETATM"} or line[16] not in {" ", "A"}:
            continue
        result.append(
            {
                "record": line[:6].strip(),
                "name": line[12:16].strip(),
                "resname": line[17:20].strip(),
                "chain": line[21].strip(),
                "resid": int(line[22:26]),
                "icode": line[26].strip(),
                "xyz": np.array([float(line[30:38]), float(line[38:46]), float(line[46:54])]),
            }
        )
    return result


def chain_a_ca(atoms: list[dict[str, object]]) -> dict[tuple[int, str, str], np.ndarray]:
    return {
        (int(a["resid"]), str(a["icode"]), str(a["resname"])): a["xyz"]
        for a in atoms
        if a["record"] == "ATOM" and a["chain"] == "A" and a["name"] == "CA"
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


def centroid(ca: dict[tuple[int, str, str], np.ndarray], residues: tuple[int, ...]) -> np.ndarray:
    return np.vstack([xyz for (resid, _, _), xyz in ca.items() if resid in residues]).mean(axis=0)


def atom_lines(path: Path) -> int:
    return sum(line[:6].strip() in {"ATOM", "HETATM"} for line in path.read_text(encoding="ascii").splitlines())


def main() -> None:
    digests = {"4AKE": hashlib.sha256(OPEN.read_bytes()).hexdigest(), "1AKE": hashlib.sha256(CLOSED.read_bytes()).hexdigest()}
    if digests != EXPECTED_SHA256:
        raise ValueError(f"source digest mismatch: {digests}")
    open_atoms, closed_atoms = records(OPEN), records(CLOSED)
    open_ca, closed_ca = chain_a_ca(open_atoms), chain_a_ca(closed_atoms)
    keys = sorted(set(open_ca) & set(closed_ca))
    reference = np.vstack([open_ca[key] for key in keys])
    mobile = np.vstack([closed_ca[key] for key in keys])
    rotation, translation, fitted = kabsch(mobile, reference)
    residuals = np.linalg.norm(fitted - reference, axis=1)

    open_centroids = {name: centroid(open_ca, residues) for name, residues in DOMAINS.items()}
    closed_centroids_native = {name: centroid(closed_ca, residues) for name, residues in DOMAINS.items()}
    closed_centroids = {name: rotation @ value + translation for name, value in closed_centroids_native.items()}
    distances = {
        "open_4AKE": {
            "CORE_to_NMP": float(np.linalg.norm(open_centroids["CORE"] - open_centroids["NMP"])),
            "CORE_to_LID": float(np.linalg.norm(open_centroids["CORE"] - open_centroids["LID"])),
        },
        "AP5_bound_1AKE_after_global_fit": {
            "CORE_to_NMP": float(np.linalg.norm(closed_centroids["CORE"] - closed_centroids["NMP"])),
            "CORE_to_LID": float(np.linalg.norm(closed_centroids["CORE"] - closed_centroids["LID"])),
        },
    }
    ap5 = [a for a in closed_atoms if a["record"] == "HETATM" and a["chain"] == "A" and a["resname"] == "AP5"]
    payload = {
        "schema": "rosalind.adenylate-kinase-comparison/v1",
        "case_id": "rosalind-adenylate-kinase",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "Digest-verified public RCSB coordinates were retained and transformed into the conformation comparison.",
        },
        "sources": {
            "4AKE": {"path": "inputs/4AKE.pdb", "bytes": OPEN.stat().st_size, "sha256": digests["4AKE"], "atom_records": atom_lines(OPEN), "chain_a_ca": len(open_ca)},
            "1AKE": {"path": "inputs/1AKE.pdb", "bytes": CLOSED.stat().st_size, "sha256": digests["1AKE"], "atom_records": atom_lines(CLOSED), "chain_a_ca": len(closed_ca), "AP5_chain_a_primary_conformer_atoms": len(ap5)},
        },
        "local_alignment": {
            "method": "ordinary least-squares Kabsch superposition over matched chain-A C-alpha atoms",
            "matched_atoms": len(keys),
            "rmsd_angstrom": round(float(np.sqrt(np.mean(residuals**2))), 6),
            "maximum_ca_residual_angstrom": round(float(residuals.max()), 6),
            "qualification": "This all-correspondence local fit is distinct from TM-align and from any Rosalind Workbench analysis.",
        },
        "domain_definition": {name: list(values) for name, values in DOMAINS.items()},
        "domain_centroid_distances_angstrom": {state: {key: round(value, 6) for key, value in values.items()} for state, values in distances.items()},
        "interpretation_scope": "The shorter fitted 1AKE CORE-to-NMP and CORE-to-LID distances describe domain closure in this coordinate comparison; they are not kinetic or binding measurements.",
    }
    SUMMARY.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")
    with TABLE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["state", "CORE_to_NMP_angstrom", "CORE_to_LID_angstrom"])
        for state, values in distances.items():
            writer.writerow([state, f"{values['CORE_to_NMP']:.6f}", f"{values['CORE_to_LID']:.6f}"])
    check = json.loads(SUMMARY.read_text(encoding="utf-8"))
    assert check["local_alignment"]["matched_atoms"] == 214
    assert check["sources"]["1AKE"]["AP5_chain_a_primary_conformer_atoms"] == 57
    print(f"PASS rosalind-adenylate-kinase: RMSD {check['local_alignment']['rmsd_angstrom']:.6f} A")


if __name__ == "__main__":
    main()
