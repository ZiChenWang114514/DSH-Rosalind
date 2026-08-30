#!/usr/bin/env python3
"""Build direct QC evidence and workflow-readiness records."""

from __future__ import annotations

import argparse
import json
import platform
import shutil
from pathlib import Path

from qc_core import compute


CASE_DIR = Path(__file__).resolve().parent


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-fastq", type=Path)
    args = parser.parse_args()

    input_path = CASE_DIR / "inputs" / "DRR037765-first-500.fastq"
    input_path.parent.mkdir(parents=True, exist_ok=True)
    source_fastq = args.source_fastq.resolve() if args.source_fastq else input_path
    if source_fastq != input_path.resolve():
        shutil.copyfile(source_fastq, input_path)
    metrics = compute(input_path)
    if metrics["records"] != 500:
        raise RuntimeError(f"Expected 500 FASTQ records, found {metrics['records']}")
    write_text(CASE_DIR / "outputs" / "reference-qc.json", json.dumps(metrics, indent=2) + "\n")

    availability = {}
    for command in ("nextflow", "snakemake"):
        executable = shutil.which(command)
        availability[command] = {
            "available": executable is not None,
            "executable_name": Path(executable).name if executable else None,
        }
    readiness = {
        "inspection_date": "2026-08-30",
        "platform": platform.platform(),
        "python": platform.python_version(),
        "engines": availability,
        "nextflow_executed": False,
        "snakemake_executed": False,
        "direct_qc_core_executed": True,
        "reason": "Neither workflow-engine command was available on PATH; the shared Python computation was run directly.",
    }
    write_text(CASE_DIR / "outputs" / "readiness.json", json.dumps(readiness, indent=2) + "\n")

    contract = {
        "input": "inputs/DRR037765-first-500.fastq",
        "shared_program": "qc_core.py",
        "canonical_fields": list(metrics),
        "nextflow_definition": "workflows/nextflow/main.nf",
        "snakemake_definition": "workflows/snakemake/Snakefile",
        "comparison_rule": "Integer values must match exactly; floating-point values from the same qc_core implementation must match exactly after JSON parsing.",
        "engine_result_status": "unexecuted",
        "reference_result": "outputs/reference-qc.json",
        "planned_engine_outputs": ["outputs/nextflow/qc.json", "outputs/snakemake/qc.json"],
    }
    write_text(CASE_DIR / "outputs" / "workflow-contract.json", json.dumps(contract, indent=2) + "\n")

    provenance = {
        "source": "European Nucleotide Archive",
        "run": "DRR037765",
        "url": "https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz",
        "subset_rule": "first 500 complete records from the public ENA FASTQ, retained with this case",
        "retained_input": "inputs/DRR037765-first-500.fastq",
        "copied_on": "2026-08-30",
        "input_bytes": input_path.stat().st_size,
    }
    write_text(CASE_DIR / "inputs" / "source-provenance.json", json.dumps(provenance, indent=2) + "\n")

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Nextflow and Snakemake workflow definitions</title><desc id="desc">Two unexecuted workflow definitions call one verified Python FASTQ quality computation.</desc>
<rect width="1200" height="675" fill="#071522"/><style>.k{{font:600 21px Segoe UI,Arial;fill:#67e8f9}}.t{{font:700 42px Segoe UI,Arial;fill:#f8fafc}}.h{{font:700 25px Segoe UI,Arial;fill:#f8fafc}}.b{{font:20px Segoe UI,Arial;fill:#cbd5e1}}.s{{font:17px Segoe UI,Arial;fill:#94a3b8}}</style>
<text x="64" y="72" class="k">DRR037765 · FIRST 500 READS</text><text x="64" y="130" class="t">One computation, two workflow definitions</text>
<rect x="64" y="205" width="285" height="230" rx="22" fill="#0f2538" stroke="#22d3ee"/><text x="105" y="265" class="h">Nextflow DSL2</text><text x="105" y="315" class="b">main.nf retained</text><text x="105" y="355" class="b">engine unavailable</text><text x="105" y="395" class="s">workflow unexecuted</text>
<rect x="458" y="205" width="285" height="230" rx="22" fill="#0f2538" stroke="#a78bfa"/><text x="500" y="265" class="h">Shared qc_core</text><text x="500" y="315" class="b">500 reads</text><text x="500" y="355" class="b">{metrics['total_bases']:,} bases</text><text x="500" y="395" class="s">direct Python run verified</text>
<rect x="852" y="205" width="285" height="230" rx="22" fill="#0f2538" stroke="#2dd4bf"/><text x="894" y="265" class="h">Snakemake</text><text x="894" y="315" class="b">Snakefile retained</text><text x="894" y="355" class="b">engine unavailable</text><text x="894" y="395" class="s">workflow unexecuted</text>
<path d="M349 320 H458 M743 320 H852" stroke="#64748b" stroke-width="4" stroke-dasharray="10 8"/>
<text x="64" y="520" class="b">GC {metrics['GC_percent']:.2f}% · Q30 {metrics['Q30_percent']:.2f}% · read length {metrics['minimum_read_length']}–{metrics['maximum_read_length']} bp</text>
<text x="64" y="600" class="s">The numerical result comes from direct qc_core execution; no workflow-engine run record exists.</text>
</svg>'''
    write_text(CASE_DIR / "previews" / "preview.svg", svg + "\n")


if __name__ == "__main__":
    main()
