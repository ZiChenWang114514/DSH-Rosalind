#!/usr/bin/env python3
"""Build and verify a deterministic KRAS sequence export package."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import zipfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
FASTA = ROOT / "inputs" / "P01116.fasta"
PROVENANCE = ROOT / "inputs" / "source-provenance.json"
SUMMARY = ROOT / "outputs" / "sequence-summary.json"
COMPOSITION = ROOT / "outputs" / "residue-composition.csv"
PACKAGE = ROOT / "outputs" / "P01116-sequence-export.zip"
EXPORT_MANIFEST = ROOT / "outputs" / "export-manifest.json"
PREVIEW = ROOT / "previews" / "preview.svg"
EXPECTED_RESPONSE_SHA256 = "be58c42a464baafed08805898078839b0b47b559cec93fdb3cd7f8d95ab95ea6"
EXPECTED_SEQUENCE_SHA256 = "1d5a9ab11f64cb886d8ffa08a153c412b2d190fcf70e5690cd4b4c7efcdee53a"
CANONICAL = "ACDEFGHIKLMNPQRSTVWY"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(payload: object) -> bytes:
    return (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json_bytes(payload))


def parse_source() -> tuple[str, bytes]:
    data = FASTA.read_bytes()
    assert len(data) == 269 and sha256(data) == EXPECTED_RESPONSE_SHA256
    lines = data.decode("utf-8").splitlines()
    assert lines[0].startswith(">sp|P01116|") and lines[0].endswith("SV=1")
    sequence = "".join(lines[1:])
    assert len(sequence) == 189 and sha256(sequence.encode("ascii")) == EXPECTED_SEQUENCE_SHA256
    assert set(sequence) <= set(CANONICAL)
    return sequence, data


def render_svg(sequence: str, counts: Counter[str]) -> str:
    top = counts.most_common(5)
    rows = []
    for index, (residue, count) in enumerate(top):
        y = 355 + index * 38
        width = round(230 * count / top[0][1])
        rows.append(f'<text x="790" y="{y + 19}" class="mono">{residue}</text><rect x="825" y="{y}" width="{width}" height="23" rx="5" fill="#38bdf8"/><text x="{840 + width}" y="{y + 19}" class="text">{count}</text>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Deterministic KRAS sequence export package</title><desc id="desc">Six exact ZIP members linking source, analysis, provenance, preview, and manifest</desc>
<style>.title{{font:700 42px Segoe UI,Arial;fill:#f8fafc}}.sub{{font:21px Segoe UI,Arial;fill:#bae6fd}}.head{{font:700 23px Segoe UI,Arial;fill:#f8fafc}}.text{{font:18px Segoe UI,Arial;fill:#cbd5e1}}.mono{{font:700 18px Consolas,monospace;fill:#f8fafc}}</style>
<rect width="1200" height="675" fill="#071726"/><text x="65" y="80" class="sub">P01116 · DETERMINISTIC LOCAL ZIP · VIEWER EXPORT REHEARSED</text><text x="65" y="145" class="title">Exact source-to-package evidence</text>
<rect x="65" y="205" width="645" height="365" rx="22" fill="#15324a" stroke="#a78bfa"/><text x="100" y="260" class="head">P01116-sequence-export.zip · 6 members</text>
<text x="100" y="310" class="mono">exact-source/P01116.fasta</text><text x="540" y="310" class="text">269 B</text>
<text x="100" y="355" class="mono">analysis/sequence-summary.json</text><text x="540" y="355" class="text">motifs + identity</text>
<text x="100" y="400" class="mono">analysis/residue-composition.csv</text><text x="540" y="400" class="text">20 rows</text>
<text x="100" y="445" class="mono">provenance/source-provenance.json</text><text x="540" y="445" class="text">official endpoint</text>
<text x="100" y="490" class="mono">preview/preview.svg</text><text x="540" y="490" class="text">data-rich SVG</text>
<text x="100" y="535" class="mono">MANIFEST.json</text><text x="540" y="535" class="text">bytes + SHA-256</text>
<text x="765" y="285" class="head">Sequence facts</text><text x="765" y="325" class="text">length: {len(sequence)} aa · SV=1</text>{''.join(rows)}
<text x="65" y="620" class="text">Actual: verified local ZIP + Rosalind task chooser · Sequence Viewer export: rehearsed</text>
</svg>'''


def member_record(path: str, data: bytes) -> dict:
    return {"path": path, "bytes": len(data), "sha256": sha256(data)}


def zip_info(path: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_STORED
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    return info


def refresh_manifest() -> None:
    path = ROOT / "showcase.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    for collection in ("inputs", "outputs", "previews"):
        for item in manifest[collection]:
            data = (ROOT / item["path"]).read_bytes()
            item["bytes"] = len(data)
            item["sha256"] = sha256(data)
    write_json(path, manifest)


def main() -> None:
    sequence, source_bytes = parse_source()
    counts = Counter(sequence)
    write_json(PROVENANCE, {
        "schema_version": 1,
        "author": "Codex",
        "database": "UniProtKB/Swiss-Prot",
        "official_endpoint": "https://rest.uniprot.org/uniprotkb/P01116.fasta",
        "retrieved_on": "2026-08-30",
        "accession": "P01116",
        "sequence_version": 1,
        "response_bytes": len(source_bytes),
        "response_sha256": sha256(source_bytes),
        "sequence_length": len(sequence),
        "sequence_sha256": sha256(sequence.encode("ascii")),
        "note": "Codex-authored provenance; no viewer-issued receipt or publication is claimed."
    })
    motifs = [
        {"name": "P-loop", "start_1based": 10, "end_1based": 17, "sequence": "GAGGVGKS"},
        {"name": "Switch I", "start_1based": 30, "end_1based": 38, "sequence": "DEYDPTIED"},
        {"name": "Switch II", "start_1based": 60, "end_1based": 76, "sequence": "GQEEYSAMRDQYMRTGE"},
        {"name": "NKXD", "start_1based": 116, "end_1based": 119, "sequence": "NKCD"},
        {"name": "CAAX", "start_1based": 186, "end_1based": 189, "sequence": "CIIM"}
    ]
    for motif in motifs:
        assert sequence[motif["start_1based"] - 1:motif["end_1based"]] == motif["sequence"]
    write_json(SUMMARY, {
        "schema_version": 1,
        "accession": "P01116",
        "sequence_version": 1,
        "molecule": "protein",
        "sequence_length": len(sequence),
        "response_sha256": sha256(source_bytes),
        "sequence_sha256": sha256(sequence.encode("ascii")),
        "canonical_residue_types_observed": len(counts),
        "coordinate_system": "1-based inclusive",
        "motif_checks": motifs,
        "calculation": {"status": "executed", "engine": "Python standard library"},
        "viewer_workflow_status": "rehearsed"
    })
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["residue", "count", "percent"])
    for residue in CANONICAL:
        writer.writerow([residue, counts[residue], f"{counts[residue] / len(sequence) * 100:.6f}"])
    COMPOSITION.parent.mkdir(parents=True, exist_ok=True)
    COMPOSITION.write_text(buffer.getvalue(), encoding="utf-8", newline="\n")
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW.write_text(render_svg(sequence, counts), encoding="utf-8", newline="\n")

    payloads = [
        ("exact-source/P01116.fasta", FASTA.read_bytes()),
        ("analysis/sequence-summary.json", SUMMARY.read_bytes()),
        ("analysis/residue-composition.csv", COMPOSITION.read_bytes()),
        ("provenance/source-provenance.json", PROVENANCE.read_bytes()),
        ("preview/preview.svg", PREVIEW.read_bytes())
    ]
    payload_records = [member_record(path, data) for path, data in payloads]
    embedded_manifest = {
        "schema_version": 1,
        "package_id": "P01116-sequence-export",
        "source": {"accession": "P01116", "sequence_version": 1},
        "archive": {"format": "ZIP", "compression": "stored", "member_timestamp": "1980-01-01T00:00:00", "member_permissions": "0644", "ordering": "listed order"},
        "payload_members": payload_records,
        "self_reference": "MANIFEST.json is excluded from payload_members to avoid recursive hashing.",
        "viewer_workflow": {
            "status": "rehearsed",
            "capabilities": [
                "sequence-viewer.sequence_open_from_chat",
                "sequence-viewer.sequence_run_analysis",
                "sequence-viewer.sequence_export_artifact",
                "sequence-viewer.sequence_query_viewer"
            ]
        }
    }
    embedded_bytes = json_bytes(embedded_manifest)
    members = payloads + [("MANIFEST.json", embedded_bytes)]
    with zipfile.ZipFile(PACKAGE, "w") as archive:
        for path, data in members:
            archive.writestr(zip_info(path), data)
    with zipfile.ZipFile(PACKAGE, "r") as archive:
        assert archive.namelist() == [path for path, _ in members]
        for path, expected in members:
            assert archive.read(path) == expected
    package_bytes = PACKAGE.read_bytes()
    write_json(EXPORT_MANIFEST, {
        "schema_version": 1,
        "showcase_id": "sequence-export-package",
        "package": {
            "path": "outputs/P01116-sequence-export.zip",
            "format": "ZIP",
            "compression": "stored",
            "bytes": len(package_bytes),
            "sha256": sha256(package_bytes),
            "member_count": len(members),
            "member_order": [path for path, _ in members]
        },
        "members": [member_record(path, data) for path, data in members],
        "post_write_verification": {"ordered_names_match": True, "all_member_bytes_match": True},
        "viewer_workflow_status": "rehearsed",
        "publisher": "Codex local Python"
    })
    refresh_manifest()


if __name__ == "__main__":
    main()
