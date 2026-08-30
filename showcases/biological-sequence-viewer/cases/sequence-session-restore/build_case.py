#!/usr/bin/env python3
"""Build and round-trip a portable, viewer-independent session manifest."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parent
FASTA = ROOT / "inputs" / "P01116.fasta"
PROVENANCE = ROOT / "inputs" / "source-provenance.json"
PORTABLE = ROOT / "inputs" / "portable-session.json"
RESTORED = ROOT / "outputs" / "restored-session.json"
EQUIVALENCE = ROOT / "outputs" / "restoration-equivalence.json"
PREVIEW = ROOT / "previews" / "preview.svg"
EXPECTED_RESPONSE_SHA256 = "be58c42a464baafed08805898078839b0b47b559cec93fdb3cd7f8d95ab95ea6"
EXPECTED_SEQUENCE_SHA256 = "1d5a9ab11f64cb886d8ffa08a153c412b2d190fcf70e5690cd4b4c7efcdee53a"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def parse_source() -> tuple[str, bytes]:
    data = FASTA.read_bytes()
    assert len(data) == 269 and sha256(data) == EXPECTED_RESPONSE_SHA256
    lines = data.decode("utf-8").splitlines()
    assert lines[0].startswith(">sp|P01116|") and lines[0].endswith("SV=1")
    sequence = "".join(lines[1:])
    assert len(sequence) == 189 and sha256(sequence.encode("ascii")) == EXPECTED_SEQUENCE_SHA256
    return sequence, data


def field(payload: dict, dotted: str):
    value = payload
    for part in dotted.split("."):
        value = value[part]
    return value


def render_svg(check_count: int, digest: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Portable KRAS session restoration</title><desc id="desc">Twelve equivalent session fields and identical serialized manifests</desc>
<style>.title{{font:700 42px Segoe UI,Arial;fill:#f8fafc}}.sub{{font:21px Segoe UI,Arial;fill:#bae6fd}}.head{{font:700 24px Segoe UI,Arial;fill:#f8fafc}}.text{{font:19px Segoe UI,Arial;fill:#cbd5e1}}.mono{{font:700 19px Consolas,monospace;fill:#f8fafc}}</style>
<rect width="1200" height="675" fill="#071726"/><text x="65" y="80" class="sub">P01116 · PORTABLE RELATIVE-PATH MANIFEST · VIEWER STEPS REHEARSED</text><text x="65" y="145" class="title">Local restoration equivalence</text>
<rect x="65" y="210" width="410" height="315" rx="22" fill="#15324a" stroke="#38bdf8"/><text x="100" y="265" class="head">Saved manifest</text><text x="100" y="320" class="text">source: inputs/P01116.fasta</text><text x="100" y="365" class="text">record: P01116 · SV=1</text><text x="100" y="410" class="text">selection: 10–17</text><text x="100" y="455" class="mono">GAGGVGKS</text>
<path d="M495 370 H650" stroke="#a78bfa" stroke-width="12"/><path d="M640 340 L690 370 L640 400 Z" fill="#a78bfa"/><text x="510" y="335" class="text">JSON round trip</text>
<rect x="690" y="210" width="445" height="315" rx="22" fill="#15324a" stroke="#34d399"/><text x="725" y="265" class="head">Restored state</text><text x="725" y="320" class="text">named fields equal: {check_count}/{check_count}</text><text x="725" y="365" class="text">serialized bytes equal: true</text><text x="725" y="410" class="text">source digest equal: true</text><text x="725" y="455" class="mono">sha256 {digest[:16]}…</text>
<text x="65" y="590" class="text">Actual: local JSON round trip + Rosalind task chooser; Sequence Viewer session steps are rehearsed.</text>
</svg>'''


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
        "note": "Codex-authored source provenance; the portable session is also Codex-authored."
    })
    portable = {
        "schema_version": 1,
        "session_kind": "portable-view-state-rehearsal",
        "source": {
            "relative_path": "inputs/P01116.fasta",
            "accession": "P01116",
            "sequence_version": 1,
            "molecule": "protein",
            "sequence_length": 189,
            "response_sha256": sha256(source_bytes),
            "sequence_sha256": sha256(sequence.encode("ascii"))
        },
        "view_state": {
            "mode": "sequence",
            "record_id": "P01116",
            "orientation": "forward",
            "residue_palette": "protein-clustal",
            "wrap_width": 60,
            "features_visible": True,
            "translations_visible": False,
            "selected_range": {"start_1based": 10, "end_1based": 17, "sequence": "GAGGVGKS"}
        },
        "analysis_state": {"scope": "full-record", "coordinate_system": "1-based inclusive"},
        "viewer_workflow": {
            "status": "rehearsed",
            "capabilities": [
                "sequence-viewer.sequence_open_from_chat",
                "sequence-viewer.sequence_save_session",
                "sequence-viewer.sequence_restore_session",
                "sequence-viewer.sequence_query_viewer"
            ]
        }
    }
    write_json(PORTABLE, portable)
    restored = json.loads(PORTABLE.read_text(encoding="utf-8"))
    relative = PurePosixPath(restored["source"]["relative_path"])
    assert not relative.is_absolute() and ".." not in relative.parts
    resolved_source = ROOT.joinpath(*relative.parts).resolve()
    assert resolved_source.is_relative_to(ROOT.resolve())
    assert sha256(resolved_source.read_bytes()) == restored["source"]["response_sha256"]
    selected = restored["view_state"]["selected_range"]
    assert sequence[selected["start_1based"] - 1:selected["end_1based"]] == selected["sequence"]
    write_json(RESTORED, restored)

    fields = [
        "schema_version",
        "session_kind",
        "source.relative_path",
        "source.accession",
        "source.sequence_version",
        "source.sequence_length",
        "source.response_sha256",
        "view_state.mode",
        "view_state.record_id",
        "view_state.orientation",
        "view_state.residue_palette",
        "view_state.selected_range"
    ]
    checks = [{"field": name, "equal": field(portable, name) == field(restored, name)} for name in fields]
    input_bytes = PORTABLE.read_bytes()
    output_bytes = RESTORED.read_bytes()
    assert all(item["equal"] for item in checks)
    assert input_bytes == output_bytes
    write_json(EQUIVALENCE, {
        "schema_version": 1,
        "showcase_id": "sequence-session-restore",
        "restoration_kind": "local JSON round trip with source revalidation",
        "portable_manifest": "inputs/portable-session.json",
        "restored_manifest": "outputs/restored-session.json",
        "input_bytes": len(input_bytes),
        "restored_bytes": len(output_bytes),
        "input_sha256": sha256(input_bytes),
        "restored_sha256": sha256(output_bytes),
        "serialized_bytes_equal": True,
        "source_revalidated": True,
        "selected_sequence_revalidated": True,
        "field_checks": checks,
        "all_fields_equal": True,
        "viewer_workflow_status": "rehearsed"
    })
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW.write_text(render_svg(len(checks), sha256(input_bytes)), encoding="utf-8", newline="\n")
    refresh_manifest()


if __name__ == "__main__":
    main()
