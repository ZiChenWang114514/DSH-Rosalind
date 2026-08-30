#!/usr/bin/env python3
"""Prepare the shared public FASTQ fixture and run the transparent QC core."""

from __future__ import annotations

import difflib
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
CASES = ROOT / "showcases" / "ngs-analysis-workbench" / "cases"
SAVE = CASES / "ngs-workflow-save"
VERSIONS = CASES / "ngs-workflow-versions"
EXECUTION = CASES / "ngs-run-execution"
OBSERVATION = CASES / "ngs-run-observation"
SOURCE = ROOT / "showcases" / "biological-sequence-viewer" / "cases" / "sequence-fastq-qc" / "inputs" / "DRR037765-first-500.fastq"
FIXTURE_NAME = "DRR037765-first-24.fastq"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_fixture() -> Path:
    lines = SOURCE.read_bytes().splitlines(keepends=True)
    if len(lines) < 24 * 4:
        raise RuntimeError("source fixture has fewer than 24 complete records")
    destination = SAVE / "inputs" / FIXTURE_NAME
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(b"".join(lines[: 24 * 4]))
    execution_fixture = EXECUTION / "inputs" / FIXTURE_NAME
    execution_fixture.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destination, execution_fixture)
    provenance = {
        "source": "European Nucleotide Archive",
        "run_accession": "DRR037765",
        "source_url": "https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz",
        "upstream_repository_fixture": "showcases/biological-sequence-viewer/cases/sequence-fastq-qc/inputs/DRR037765-first-500.fastq",
        "upstream_subset_sha256": sha256(SOURCE),
        "subset_rule": "first 24 complete records from the retained 500-record public subset; bytes preserved",
        "records": 24,
        "bytes": destination.stat().st_size,
        "sha256": sha256(destination)
    }
    (SAVE / "outputs" / "fixture-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    return destination


def copy_execution_workflow() -> None:
    source = VERSIONS / "workflow" / "v2"
    destination = EXECUTION / "workflow"
    for relative in (Path("Snakefile"), Path("config/config.json"), Path("scripts/qc_core.py")):
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / relative, target)
    config_path = destination / "config" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config.update({
        "fastq": "inputs/DRR037765-first-24.fastq",
        "summary": "outputs/qc-summary.json",
        "read_metrics": "outputs/read-metrics.csv",
        "cycle_metrics": "outputs/cycle-quality.csv"
    })
    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def write_version_diff() -> None:
    chunks = []
    for relative in (Path("Snakefile"), Path("config/config.json"), Path("scripts/qc_core.py")):
        old_path = SAVE / "workflow" / "v1" / relative
        new_path = VERSIONS / "workflow" / "v2" / relative
        chunks.extend(difflib.unified_diff(
            old_path.read_text(encoding="utf-8").splitlines(keepends=True),
            new_path.read_text(encoding="utf-8").splitlines(keepends=True),
            fromfile=f"v1/{relative.as_posix()}",
            tofile=f"v2/{relative.as_posix()}"
        ))
    (VERSIONS / "outputs" / "workflow-version.diff").write_text("".join(chunks), encoding="utf-8")


def run_core() -> None:
    timeline = OBSERVATION / "outputs" / "local-run-timeline.jsonl"
    timeline.unlink(missing_ok=True)
    command = [
        sys.executable,
        "workflow/scripts/qc_core.py",
        "--input", f"inputs/{FIXTURE_NAME}",
        "--summary", "outputs/qc-summary.json",
        "--reads", "outputs/read-metrics.csv",
        "--cycles", "outputs/cycle-quality.csv",
        "--q20", "20",
        "--q30", "30",
        "--timeline", str(timeline.resolve()),
        "--log", "outputs/run-log.txt"
    ]
    completed = subprocess.run(command, cwd=EXECUTION, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr or completed.stdout)
    summary = json.loads((EXECUTION / "outputs" / "qc-summary.json").read_text(encoding="utf-8"))
    receipt = {
        "execution_mode": "local scientific-core execution with rehearsed Workbench lifecycle",
        "workbench_execute_plan_performed": False,
        "workflow_engine_performed": False,
        "scientific_core_performed": True,
        "command": command,
        "cwd": "showcases/ngs-analysis-workbench/cases/ngs-run-execution",
        "python": sys.version.split()[0],
        "exit_code": completed.returncode,
        "input": {
            "path": f"inputs/{FIXTURE_NAME}",
            "bytes": (EXECUTION / "inputs" / FIXTURE_NAME).stat().st_size,
            "sha256": sha256(EXECUTION / "inputs" / FIXTURE_NAME)
        },
        "outputs": {
            name: {"bytes": (EXECUTION / "outputs" / name).stat().st_size, "sha256": sha256(EXECUTION / "outputs" / name)}
            for name in ("qc-summary.json", "read-metrics.csv", "cycle-quality.csv", "run-log.txt")
        },
        "metrics": summary,
        "registry_run_id": None
    }
    (EXECUTION / "outputs" / "local-run-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    events = [json.loads(line) for line in timeline.read_text(encoding="utf-8").splitlines()]
    observation = {
        "observation_mode": "bounded local state-machine rehearsal",
        "workbench_observe_ngs_run_performed": False,
        "registry_run_id": None,
        "event_count": len(events),
        "states": [event["state"] for event in events],
        "terminal_state": events[-1]["state"],
        "output_metrics_observed": {
            "records": summary["records"],
            "bases": summary["bases"],
            "gc_percent": summary["gc_percent"],
            "mean_phred": summary["mean_phred"],
            "q20_percent": summary["q20_percent"],
            "q30_percent": summary["q30_percent"]
        },
        "evidence_paths": [
            "../ngs-run-execution/outputs/qc-summary.json",
            "../ngs-run-execution/outputs/read-metrics.csv",
            "../ngs-run-execution/outputs/cycle-quality.csv",
            "outputs/local-run-timeline.jsonl"
        ]
    }
    (OBSERVATION / "outputs" / "observed-metrics.json").write_text(json.dumps(observation, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    create_fixture()
    copy_execution_workflow()
    write_version_diff()
    run_core()
    print("prepared fixture, version diff, local QC outputs, and bounded timeline")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
