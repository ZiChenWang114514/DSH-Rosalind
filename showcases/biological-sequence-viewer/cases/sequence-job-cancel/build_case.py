#!/usr/bin/env python3
"""Run and document a safe disposable local sequence-job cancellation."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
FASTA = ROOT / "inputs" / "P01116.fasta"
PROVENANCE = ROOT / "inputs" / "source-provenance.json"
PRE_STATE = ROOT / "outputs" / "pre-cancel-state.json"
POST_STATE = ROOT / "outputs" / "post-cancel-state.json"
RECEIPT = ROOT / "outputs" / "cancellation-receipt.json"
PREVIEW = ROOT / "previews" / "preview.svg"
EXPECTED_RESPONSE_SHA256 = "be58c42a464baafed08805898078839b0b47b559cec93fdb3cd7f8d95ab95ea6"
EXPECTED_SEQUENCE_SHA256 = "1d5a9ab11f64cb886d8ffa08a153c412b2d190fcf70e5690cd4b4c7efcdee53a"

CHILD = r'''
import csv
import json
import sys
import time
from pathlib import Path

workspace = Path(sys.argv[1])
sequence = sys.argv[2]
window = 9
limit = 32
hydrophobic = set("AILMFWVY")
partial = workspace / "partial-windows.csv"
with partial.open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle, lineterminator="\n")
    writer.writerow(["window_index", "start_1based", "end_1based", "hydrophobic_count"])
    for index in range(limit):
        fragment = sequence[index:index + window]
        writer.writerow([index + 1, index + 1, index + window, sum(residue in hydrophobic for residue in fragment)])
state = {
    "job_id": "local-p01116-window-scan",
    "status": "running",
    "analysis": "9-residue sliding-window hydrophobic residue count",
    "window_size": window,
    "completed_windows": limit,
    "total_windows": len(sequence) - window + 1,
    "temporary_partial_present": partial.is_file(),
    "final_output_present": (workspace / "final-windows.csv").is_file()
}
(workspace / "job-state.json").write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8", newline="\n")
print("READY", flush=True)
while True:
    time.sleep(0.25)
'''


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def parse_source() -> tuple[str, bytes]:
    data = FASTA.read_bytes()
    assert len(data) == 269
    assert sha256(data) == EXPECTED_RESPONSE_SHA256
    lines = data.decode("utf-8").splitlines()
    assert lines[0].startswith(">sp|P01116|") and lines[0].endswith("SV=1")
    sequence = "".join(lines[1:])
    assert len(sequence) == 189
    assert sha256(sequence.encode("ascii")) == EXPECTED_SEQUENCE_SHA256
    return sequence, data


def render_svg() -> str:
    return '''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Safe local sequence-job cancellation</title><desc id="desc">Running and cancelled state records for a disposable KRAS window calculation</desc>
<style>.title{font:700 42px Segoe UI,Arial;fill:#f8fafc}.sub{font:21px Segoe UI,Arial;fill:#bae6fd}.head{font:700 24px Segoe UI,Arial;fill:#f8fafc}.text{font:19px Segoe UI,Arial;fill:#cbd5e1}.mono{font:700 20px Consolas,monospace;fill:#f8fafc}</style>
<rect width="1200" height="675" fill="#071726"/><text x="70" y="80" class="sub">P01116 · LOCAL PYTHON SUBPROCESS · VIEWER ACTION REHEARSED</text><text x="70" y="145" class="title">Cancellation preserves source identity</text>
<rect x="70" y="205" width="430" height="330" rx="22" fill="#15324a" stroke="#38bdf8"/><text x="105" y="260" class="head">Pre-cancel</text><text x="105" y="315" class="mono">status: running</text><text x="105" y="360" class="text">32 / 181 windows computed</text><text x="105" y="405" class="text">partial table present: true</text><text x="105" y="450" class="text">final output present: false</text>
<path d="M520 365 H660" stroke="#f59e0b" stroke-width="12"/><path d="M650 335 L700 365 L650 395 Z" fill="#f59e0b"/><text x="540" y="330" class="text">terminate()</text>
<rect x="700" y="205" width="430" height="330" rx="22" fill="#15324a" stroke="#34d399"/><text x="735" y="260" class="head">Post-cancel</text><text x="735" y="315" class="mono">status: cancelled</text><text x="735" y="360" class="text">process stopped: true</text><text x="735" y="405" class="text">temporary workspace removed: true</text><text x="735" y="450" class="text">source unchanged: true</text><text x="735" y="495" class="text">final output present: false</text>
<text x="70" y="605" class="text">Actual: local cancellation + Rosalind task chooser; Sequence Viewer run/cancel/query are rehearsed.</text>
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
    source_digest_before = sha256(source_bytes)
    write_json(PROVENANCE, {
        "schema_version": 1,
        "author": "Codex",
        "database": "UniProtKB/Swiss-Prot",
        "official_endpoint": "https://rest.uniprot.org/uniprotkb/P01116.fasta",
        "retrieved_on": "2026-08-30",
        "accession": "P01116",
        "sequence_version": 1,
        "response_bytes": len(source_bytes),
        "response_sha256": source_digest_before,
        "sequence_length": len(sequence),
        "sequence_sha256": sha256(sequence.encode("ascii")),
        "note": "Codex-authored provenance; no Sequence Viewer receipt is claimed."
    })

    with tempfile.TemporaryDirectory(prefix="sequence-job-cancel-") as temporary:
        workspace = Path(temporary)
        process = subprocess.Popen(
            [sys.executable, "-c", CHILD, str(workspace), sequence],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        assert process.stdout is not None
        ready = process.stdout.readline().strip()
        if ready != "READY":
            stderr = process.stderr.read() if process.stderr else ""
            process.kill()
            raise RuntimeError(f"child did not become ready: {ready!r} {stderr}")
        pre = json.loads((workspace / "job-state.json").read_text(encoding="utf-8"))
        partial_bytes = (workspace / "partial-windows.csv").read_bytes()
        assert pre["status"] == "running"
        assert pre["completed_windows"] == 32
        assert pre["total_windows"] == 181
        assert pre["temporary_partial_present"] is True
        assert pre["final_output_present"] is False
        process.terminate()
        process.wait(timeout=10)
        assert process.poll() is not None
        post = {
            "job_id": pre["job_id"],
            "status": "cancelled",
            "completed_windows_before_cancel": pre["completed_windows"],
            "total_windows": pre["total_windows"],
            "process_stopped": True,
            "temporary_partial_present_before_cleanup": True,
            "final_output_present_before_cleanup": False,
            "temporary_workspace_removed": True,
            "source_unchanged": sha256(FASTA.read_bytes()) == source_digest_before,
            "final_output_retained": False
        }
    assert not workspace.exists()
    assert post["source_unchanged"] is True
    write_json(PRE_STATE, pre)
    write_json(POST_STATE, post)
    write_json(RECEIPT, {
        "schema_version": 1,
        "showcase_id": "sequence-job-cancel",
        "execution_kind": "actual local subprocess cancellation",
        "source": {"accession": "P01116", "sequence_version": 1, "response_sha256": source_digest_before},
        "analysis": {"method": "9-residue sliding-window hydrophobic residue count", "total_windows": 181, "completed_before_cancel": 32},
        "pre_cancel_state": "outputs/pre-cancel-state.json",
        "post_cancel_state": "outputs/post-cancel-state.json",
        "partial_table_sha256_before_cleanup": sha256(partial_bytes),
        "checks": {
            "running_state_observed": True,
            "child_process_stopped": True,
            "temporary_workspace_removed": True,
            "source_digest_unchanged": True,
            "completed_output_absent": True
        },
        "viewer_workflow": {
            "status": "rehearsed",
            "capabilities": [
                "sequence-viewer.sequence_run_analysis",
                "sequence-viewer.sequence_cancel_job",
                "sequence-viewer.sequence_query_viewer"
            ],
            "note": "No Sequence Viewer job was created or cancelled in this task."
        }
    })
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW.write_text(render_svg(), encoding="utf-8", newline="\n")
    refresh_manifest()


if __name__ == "__main__":
    main()
