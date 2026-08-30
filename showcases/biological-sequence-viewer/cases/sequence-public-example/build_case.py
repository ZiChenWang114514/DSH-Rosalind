#!/usr/bin/env python3
"""Rebuild the versioned UniProt KRAS acquisition showcase."""

from __future__ import annotations

import csv
import hashlib
import io
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
FASTA = ROOT / "inputs" / "P01116.fasta"
PROVENANCE = ROOT / "inputs" / "source-provenance.json"
ANALYSIS = ROOT / "outputs" / "acquisition-analysis.json"
COMPOSITION = ROOT / "outputs" / "residue-composition.csv"
PREVIEW = ROOT / "previews" / "preview.svg"
EXPECTED_HEADER = ">sp|P01116|RASK_HUMAN GTPase KRas OS=Homo sapiens OX=9606 GN=KRAS PE=1 SV=1"
EXPECTED_RESPONSE_SHA256 = "be58c42a464baafed08805898078839b0b47b559cec93fdb3cd7f8d95ab95ea6"
EXPECTED_SEQUENCE_SHA256 = "1d5a9ab11f64cb886d8ffa08a153c412b2d190fcf70e5690cd4b4c7efcdee53a"
CANONICAL = "ACDEFGHIKLMNPQRSTVWY"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def parse_fasta() -> tuple[str, str, bytes]:
    data = FASTA.read_bytes()
    assert len(data) == 269, len(data)
    assert sha256(data) == EXPECTED_RESPONSE_SHA256
    lines = data.decode("utf-8").splitlines()
    assert lines[0] == EXPECTED_HEADER
    sequence = "".join(lines[1:])
    assert len(sequence) == 189
    assert set(sequence) <= set(CANONICAL)
    assert sha256(sequence.encode("ascii")) == EXPECTED_SEQUENCE_SHA256
    return lines[0], sequence, data


def render_svg(sequence: str, counts: Counter[str]) -> str:
    top = counts.most_common(6)
    bars = []
    for index, (residue, count) in enumerate(top):
        y = 365 + index * 38
        width = round(count / top[0][1] * 300)
        bars.append(f'<text x="705" y="{y + 20}" class="mono">{residue}</text>')
        bars.append(f'<rect x="740" y="{y}" width="{width}" height="24" rx="5" fill="#38bdf8"/>')
        bars.append(f'<text x="{755 + width}" y="{y + 20}" class="small">{count}</text>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Versioned KRAS public-record acquisition</title><desc id="desc">UniProt P01116 sequence identity, motif coordinates, and residue composition</desc>
<style>.title{{font:700 42px Segoe UI,Arial;fill:#f8fafc}}.sub{{font:22px Segoe UI,Arial;fill:#bae6fd}}.label{{font:700 20px Segoe UI,Arial;fill:#e2e8f0}}.small{{font:18px Segoe UI,Arial;fill:#cbd5e1}}.mono{{font:700 19px Consolas,monospace;fill:#f8fafc}}</style>
<rect width="1200" height="675" fill="#071726"/><rect x="50" y="45" width="1100" height="585" rx="24" fill="#0b2238" stroke="#155e75"/>
<text x="85" y="112" class="sub">BIOLOGICAL SEQUENCE VIEWER · REHEARSED VIEWER STEPS</text><text x="85" y="175" class="title">UniProt P01116 · KRAS · SV=1</text>
<text x="85" y="220" class="small">Official FASTA response: 269 bytes · protein length: {len(sequence)} aa · residue types observed: {len(counts)}/20</text>
<text x="85" y="285" class="label">Coordinate-pinned sequence checks</text>
<rect x="85" y="315" width="535" height="248" rx="16" fill="#071726"/>
<text x="115" y="360" class="mono">10–17</text><text x="225" y="360" class="mono">GAGGVGKS</text><text x="430" y="360" class="small">P-loop</text>
<text x="115" y="405" class="mono">30–38</text><text x="225" y="405" class="mono">DEYDPTIED</text><text x="430" y="405" class="small">Switch I</text>
<text x="115" y="450" class="mono">60–76</text><text x="225" y="450" class="mono">GQEEYSAMRDQYMRTGE</text><text x="430" y="450" class="small">Switch II</text>
<text x="115" y="495" class="mono">116–119</text><text x="225" y="495" class="mono">NKCD</text><text x="430" y="495" class="small">NKXD</text>
<text x="115" y="540" class="mono">186–189</text><text x="225" y="540" class="mono">CIIM</text><text x="430" y="540" class="small">CAAX</text>
<text x="685" y="325" class="label">Most frequent residues</text>{''.join(bars)}
<text x="85" y="605" class="small">Actual: UniProt + local parsing + Rosalind task chooser · Sequence Viewer: rehearsed</text>
</svg>'''


def refresh_manifest() -> None:
    manifest_path = ROOT / "showcase.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for collection in ("inputs", "outputs", "previews"):
        for item in manifest[collection]:
            data = (ROOT / item["path"]).read_bytes()
            item["bytes"] = len(data)
            item["sha256"] = sha256(data)
    write_json(manifest_path, manifest)


def main() -> None:
    header, sequence, response = parse_fasta()
    counts = Counter(sequence)
    motifs = [
        ("P-loop", 10, 17, "GAGGVGKS"),
        ("Switch I", 30, 38, "DEYDPTIED"),
        ("Switch II", 60, 76, "GQEEYSAMRDQYMRTGE"),
        ("NKXD", 116, 119, "NKCD"),
        ("CAAX", 186, 189, "CIIM"),
    ]
    motif_rows = []
    for name, start, end, expected in motifs:
        observed = sequence[start - 1:end]
        assert observed == expected
        motif_rows.append({"name": name, "start_1based": start, "end_1based": end, "sequence": observed, "matches_expected": True})

    write_json(PROVENANCE, {
        "schema_version": 1,
        "author": "Codex",
        "database": "UniProtKB/Swiss-Prot",
        "official_endpoint": "https://rest.uniprot.org/uniprotkb/P01116.fasta",
        "retrieved_on": "2026-08-30",
        "requested_accession": "P01116",
        "resolved_accession": "P01116",
        "sequence_version": 1,
        "record_name": "RASK_HUMAN",
        "organism": "Homo sapiens",
        "response_bytes": len(response),
        "response_sha256": sha256(response),
        "sequence_length": len(sequence),
        "sequence_sha256": sha256(sequence.encode("ascii")),
        "note": "Codex-authored provenance for an official public response; no viewer receipt is claimed."
    })

    write_json(ANALYSIS, {
        "schema_version": 1,
        "accession": "P01116",
        "sequence_version": 1,
        "header": header,
        "molecule": "protein",
        "sequence_length": len(sequence),
        "canonical_residue_types_observed": len(counts),
        "response_sha256": sha256(response),
        "sequence_sha256": sha256(sequence.encode("ascii")),
        "motif_checks": motif_rows,
        "viewer_workflow": {
            "status": "rehearsed",
            "capabilities": [
                "sequence-viewer.sequence_acquire_public_example",
                "sequence-viewer.sequence_open_from_chat",
                "sequence-viewer.sequence_query_viewer"
            ],
            "reason": "No mounted Sequence Viewer session was used in this task."
        },
        "calculation": {"status": "executed", "engine": "Python standard library", "coordinate_system": "1-based inclusive"}
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
    refresh_manifest()


if __name__ == "__main__":
    main()
