#!/usr/bin/env python3
"""Inspect the public 1GFL CCP4 map and sample it at residues 65-67."""

from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path

import numpy as np


CASE = Path(__file__).resolve().parents[1]
MAP = CASE / "inputs" / "1gfl.ccp4"
PDB = CASE / "inputs" / "1GFL.pdb"
SF = CASE / "inputs" / "1GFL-sf.cif"
OUTPUT = CASE / "outputs" / "density-map-inspection.json"


def file_record(path: Path, url: str) -> dict:
    payload = path.read_bytes()
    return {
        "path": path.relative_to(CASE).as_posix(),
        "url": url,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def read_header(payload: bytes) -> dict:
    ints = struct.unpack("<256i", payload[:1024])
    floats = struct.unpack("<256f", payload[:1024])
    return {
        "dimensions_columns_rows_sections": list(ints[0:3]),
        "mode": ints[3],
        "start_columns_rows_sections": list(ints[4:7]),
        "sampling_grid_xyz": list(ints[7:10]),
        "cell_lengths_angstrom": [round(float(v), 6) for v in floats[10:13]],
        "cell_angles_degrees": [round(float(v), 6) for v in floats[13:16]],
        "axis_mapping_columns_rows_sections": list(ints[16:19]),
        "header_min_max_mean": [round(float(v), 9) for v in floats[19:22]],
        "space_group_number": ints[22],
        "symmetry_bytes": ints[23],
        "origin_angstrom": [round(float(v), 6) for v in floats[49:52]],
        "map_signature": payload[208:212].decode("ascii"),
        "machine_stamp_hex": payload[212:216].hex(),
        "header_rms": round(float(floats[54]), 9),
        "label_count": ints[55],
    }


def read_atoms() -> list[dict]:
    atoms = []
    for line in PDB.read_text(encoding="ascii").splitlines():
        if not line.startswith("ATOM  ") or line[21] != "A" or line[16] not in {" ", "A"}:
            continue
        seq = int(line[22:26])
        if seq not in {65, 66, 67}:
            continue
        atoms.append(
            {
                "auth_chain": "A",
                "auth_seq_id": seq,
                "residue": line[17:20].strip(),
                "atom": line[12:16].strip(),
                "xyz": np.array([float(line[30:38]), float(line[38:46]), float(line[46:54])]),
            }
        )
    return atoms


def trilinear(data: np.ndarray, xyz_grid: np.ndarray) -> float:
    # CCP4 data are stored as sections, rows, columns. This map declares X/Y/Z = columns/rows/sections.
    x, y, z = xyz_grid
    x0, y0, z0 = np.floor([x, y, z]).astype(int)
    dx, dy, dz = x - x0, y - y0, z - z0
    nx, ny, nz = data.shape[2], data.shape[1], data.shape[0]
    value = 0.0
    for oz, wz in ((0, 1 - dz), (1, dz)):
        for oy, wy in ((0, 1 - dy), (1, dy)):
            for ox, wx in ((0, 1 - dx), (1, dx)):
                value += wz * wy * wx * float(data[(z0 + oz) % nz, (y0 + oy) % ny, (x0 + ox) % nx])
    return value


def main() -> None:
    payload = MAP.read_bytes()
    header = read_header(payload)
    if header["mode"] != 2 or header["axis_mapping_columns_rows_sections"] != [1, 2, 3]:
        raise SystemExit("This retained calculation supports little-endian float32 CCP4 maps with X/Y/Z axis order only.")
    if any(abs(angle - 90.0) > 1e-6 for angle in header["cell_angles_degrees"]):
        raise SystemExit("This retained calculation supports an orthogonal unit cell only.")

    nc, nr, ns = header["dimensions_columns_rows_sections"]
    offset = 1024 + header["symmetry_bytes"]
    data = np.frombuffer(payload, dtype="<f4", count=nc * nr * ns, offset=offset).reshape((ns, nr, nc))
    cell = np.array(header["cell_lengths_angstrom"])
    grid = np.array(header["sampling_grid_xyz"])
    start = np.array(header["start_columns_rows_sections"])
    rms = header["header_rms"]

    sampled = []
    for atom in read_atoms():
        fractional = (atom["xyz"] / cell) % 1.0
        xyz_grid = fractional * grid - start
        value = trilinear(data, xyz_grid)
        sampled.append(
            {
                "auth_chain": atom["auth_chain"],
                "auth_seq_id": atom["auth_seq_id"],
                "residue": atom["residue"],
                "atom": atom["atom"],
                "map_value": round(value, 9),
                "map_value_over_header_rms": round(value / rms, 6),
            }
        )

    by_residue = []
    for seq in (65, 66, 67):
        rows = [row for row in sampled if row["auth_seq_id"] == seq]
        values = np.array([row["map_value"] for row in rows])
        sigmas = np.array([row["map_value_over_header_rms"] for row in rows])
        by_residue.append(
            {
                "auth_chain": "A",
                "auth_seq_id": seq,
                "residue": rows[0]["residue"],
                "atom_count": len(rows),
                "mean_map_value": round(float(values.mean()), 9),
                "min_map_value": round(float(values.min()), 9),
                "max_map_value": round(float(values.max()), 9),
                "mean_map_value_over_header_rms": round(float(sigmas.mean()), 6),
                "atoms_at_or_above_one_header_rms": int((sigmas >= 1.0).sum()),
            }
        )

    result = {
        "schema_version": 1,
        "showcase_id": "structure-density-map",
        "run_date": "2026-08-30",
        "sources": [
            file_record(PDB, "https://files.rcsb.org/download/1GFL.pdb"),
            file_record(SF, "https://files.rcsb.org/download/1GFL-sf.cif"),
            file_record(MAP, "https://www.ebi.ac.uk/pdbe/coordinates/files/1gfl.ccp4"),
        ],
        "map_header": header,
        "computed_array_statistics": {
            "voxel_count": int(data.size),
            "minimum": round(float(data.min()), 9),
            "maximum": round(float(data.max()), 9),
            "mean": round(float(data.mean()), 12),
            "rms_about_zero": round(float(np.sqrt(np.mean(data.astype(np.float64) ** 2))), 9),
        },
        "sampling_method": {
            "selection": "1GFL author chain A residues 65-67, ATOM records, blank/A alternate location",
            "coordinate_mapping": "orthogonal unit-cell fractional coordinates with periodic wrapping",
            "interpolation": "trilinear interpolation on the CCP4 X/Y/Z grid",
            "normalization": "sampled value divided by the CCP4 header RMS; no contour optimization",
        },
        "residue_summary": by_residue,
        "atom_samples": sampled,
        "interpretation_scope": "Atom-sampled map support is a local descriptive statistic, not a crystallographic refinement score or proof of a chemical mechanism.",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
