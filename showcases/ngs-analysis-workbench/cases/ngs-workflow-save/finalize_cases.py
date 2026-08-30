#!/usr/bin/env python3
"""Write the five case guides, previews, and byte-accurate manifests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
CASES = ROOT / "showcases" / "ngs-analysis-workbench" / "cases"
SOURCE_URL = "https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz"
WORKFLOW_ID = "showcase_fastq_qc_lifecycle_20260830"
V1 = "version-172b18afc3346b8b037416f67893a9f5"
V2 = "version-d88ed31c58ebee8c5667ddee257b846f"


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8", newline="\n")


def artifact(case_dir: Path, relative: str) -> dict:
    path = case_dir / relative
    payload = path.read_bytes().replace(b"\r\n", b"\n") if path.suffix.lower() in {".csv", ".json", ".md", ".svg", ".txt"} else path.read_bytes()
    return {"path": relative, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


def svg(title: str, subtitle: str, rows: list[tuple[str, str]], footer: str) -> str:
    cards = []
    for index, (label, value) in enumerate(rows):
        x = 70 + (index % 2) * 535
        y = 250 + (index // 2) * 145
        cards.append(
            f'<rect x="{x}" y="{y}" width="495" height="112" rx="18" fill="#10293a" stroke="#2dd4bf"/>'
            f'<text x="{x + 24}" y="{y + 36}" fill="#7dd3fc" font-family="Segoe UI,Arial" font-size="18">{label}</text>'
            f'<text x="{x + 24}" y="{y + 78}" fill="#f8fafc" font-family="Segoe UI,Arial" font-size="27" font-weight="700">{value}</text>'
        )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">{title}</title><desc id="desc">{subtitle}</desc>
<rect width="1200" height="675" fill="#061925"/><circle cx="1080" cy="80" r="220" fill="#0e7490" opacity=".28"/>
<text x="70" y="72" fill="#5eead4" font-family="Segoe UI,Arial" font-size="22" font-weight="700">NGS ANALYSIS WORKBENCH · FASTQ QC LIFECYCLE</text>
<text x="70" y="135" fill="#f8fafc" font-family="Segoe UI,Arial" font-size="44" font-weight="700">{title}</text>
<text x="70" y="182" fill="#cbd5e1" font-family="Segoe UI,Arial" font-size="22">{subtitle}</text>
{''.join(cards)}
<text x="70" y="632" fill="#94a3b8" font-family="Segoe UI,Arial" font-size="17">{footer}</text>
</svg>'''


def rosalind_section(case_dir: Path) -> str:
    receipt = json.loads((case_dir / "outputs/rosalind-open-observation.json").read_text(encoding="utf-8"))
    return f'''## Rosalind Workbench invocation

The case called `mcp__rosalind__rosalind_open` at {receipt["observed_at_utc"]} ({receipt["observed_at_local"]}) with the case-specific `task_context` retained in the observation file. The exact response was `{receipt["response_message"]}` with `ready: true` and `view: launcher`.

This operation only opened the Rosalind task chooser. It did not select or execute a Rosalind scientific task and does not support a scientific-result claim. `outputs/rosalind-open-observation.json` retains the exact response and the case-specific context.'''


def manifest(case_id: str, title: str, case_type: str, evidence_level: str, capabilities: list[str], actual_tools: list[str], implementation: str, inputs: list[str], outputs: list[str], observations: list[str], interpretation: list[str], limitations: list[str], reproduction: list[str]) -> dict:
    case_dir = CASES / case_id
    capabilities = [*capabilities, "rosalind.rosalind_open"]
    actual_tools = [*actual_tools, "Rosalind Workbench mcp__rosalind__rosalind_open"]
    implementation = implementation + " A case-specific Rosalind task-chooser invocation is retained; no Rosalind scientific task ran."
    observations = [*observations, "rosalind.rosalind_open returned ready true with view launcher for this case-specific context."]
    limitations = [*limitations, "rosalind_open only opened the task chooser and does not establish Rosalind scientific execution."]
    return {
        "id": case_id,
        "plugin_id": "ngs-analysis-workbench",
        "plugin_version": "0.2.16",
        "status": "ready",
        "run_date": "2026-08-30",
        "domain": "genomics-and-pathology",
        "case_type": case_type,
        "difficulty": "advanced" if case_id.startswith("ngs-run") else "intermediate",
        "evidence_level": evidence_level,
        "capabilities": capabilities,
        "rosalind_tasks": [],
        "execution": {
            "actual_tools": actual_tools,
            "device": "local Windows amd64",
            "implementation": implementation,
            "status": "verified"
        },
        "prompt": "prompt.md",
        "inputs": [artifact(case_dir, path) for path in inputs],
        "outputs": [artifact(case_dir, path) for path in outputs],
        "previews": [artifact(case_dir, "previews/preview.svg")],
        "sources": [SOURCE_URL],
        "observations": observations,
        "interpretation": interpretation,
        "limitations": limitations,
        "provenance": [{
            "sources": [SOURCE_URL],
            "inputs": inputs,
            "outputs": outputs,
            "previews": ["previews/preview.svg"],
            "note": "The retained source note identifies the public run and subset rule; workflow files and machine-readable outputs support the scientific observations. outputs/rosalind-open-observation.json records the separate case-specific launcher invocation and its explicit limitation."
        }],
        "reproduction": reproduction,
        "environment": {"cost": "free", "data": "public", "device": "local Windows amd64"}
    }


def build_save() -> None:
    case_dir = CASES / "ngs-workflow-save"
    write(case_dir / "prompt.md", f'''# Save a transparent FASTQ QC workflow

Using the retained public FASTQ fixture and version 1 workflow files, register the new case-owned workflow `{WORKFLOW_ID}` in NGS Analysis Workbench without starting a run. Record the returned workflow version and source digest.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.''')
    write(case_dir / "inputs/public-source.md", f'''# Public FASTQ fixture

- ENA run: `DRR037765`
- Public object: {SOURCE_URL}
- Retained upstream source: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/inputs/DRR037765-first-500.fastq`
- Fixture rule: copy the first 24 complete records byte for byte.
- Fixture state: raw public FASTQ subset; no trimming or sequence rewriting.
- Intended use: a small integrity and Phred+33 quality demonstration, not a run-wide QC assessment.''')
    write(case_dir / "README.md", f'''# Saved FASTQ QC workflow

![Saved workflow evidence](previews/preview.svg)

## Scientific question

Can a transparent FASTQ QC definition be registered for reuse while keeping the public reads and generated results outside the saved workflow root?

## Source observations

The retained fixture contains the first 24 complete records from ENA run `DRR037765`. `outputs/fixture-provenance.json` records its 23,031 bytes and SHA-256 identity. Version 1 contains one `Snakefile`, one JSON configuration, and a standard-library Python QC core.

## Workbench observation

`ngs-analysis-workbench.save_workflow` created `{WORKFLOW_ID}` as a new user-catalog object. Workbench copied the workflow definition into version `{V1}` and reported source digest `sha256:4fb0dec6401816294637a3100800dcebef20c9a8376f3b9e4fa86849864cb2ea`. It did not start a run.

{rosalind_section(case_dir)}

## Interpretation

The saved definition keeps the engine instructions reproducible while the FASTQ fixture remains a separate input. Registration confirms catalogue persistence and identity; it does not confirm execution readiness or scientific quality.

## Limitations

- The 24-record fixture is a compact demonstration and cannot represent the complete ENA run.
- Saving a workflow does not validate the controller, task environment, or outputs.
- No sequence transformation, adapter classification, or contamination analysis was performed.

## Reproduce

1. Run `python showcases/ngs-analysis-workbench/cases/ngs-workflow-save/build_cases.py` from the repository root to recreate the fixture and local QC evidence.
2. Inspect `workflow/v1/Snakefile`, `workflow/v1/config/config.json`, and `workflow/v1/scripts/qc_core.py`.
3. Call `ngs-analysis-workbench.save_workflow` with workflow ID `{WORKFLOW_ID}`, engine `snakemake`, local root `workflow/v1`, and entrypoint `Snakefile` only when recreating this disposable showcase object.
4. Compare the returned version and digest with `outputs/workbench-save.json`. Do not reuse the identifier when it already exists.''')
    write(case_dir / "previews/preview.svg", svg(
        "Saved FASTQ QC workflow",
        "New case-owned catalogue object · no run started",
        [("PUBLIC FIXTURE", "24 reads · 23,031 bytes"), ("WORKFLOW", "Snakemake + Python core"), ("SAVED VERSION", "version-172b18af…"), ("SOURCE DIGEST", "4fb0dec64018…")],
        "Registration observed in NGS Analysis Workbench 0.2.16 · fixture retained separately"
    ))
    inputs = [
        "inputs/public-source.md", "inputs/DRR037765-first-24.fastq", "build_cases.py", "finalize_cases.py",
        "workflow/v1/Snakefile", "workflow/v1/config/config.json", "workflow/v1/scripts/qc_core.py"
    ]
    outputs = ["outputs/fixture-provenance.json", "outputs/workbench-save.json", "outputs/rosalind-open-observation.json", "outputs/session-bundle.md"]
    data = manifest(
        "ngs-workflow-save", "Saved FASTQ QC workflow", "workflow", "multi-tool-result",
        ["ngs-analysis-workbench.list_workflows", "ngs-analysis-workbench.save_workflow"],
        ["NGS Analysis Workbench 0.2.16", "Python 3.14 standard library"],
        "A new case-owned local Snakemake definition was saved in Workbench; the public 24-read fixture was prepared locally and no run was started.",
        inputs, outputs,
        ["The 24-record fixture is 23,031 bytes and has SHA-256 1091da980ce003fd7b3981c9ea1fc002a399eb030553adfb395c277046e61ff4.", f"Workbench saved the new workflow as {V1} with a source digest.", "No workflow execution was requested by the save action."],
        ["The workflow definition and public reads are separated, so saving the definition does not copy the FASTQ into the Workbench catalogue."],
        ["The fixture is too small for run-wide QC conclusions.", "Catalogue registration does not establish runtime readiness.", "No adapter, contamination, or assay-specific analysis was performed."],
        ["Run build_cases.py from the repository root.", "Inspect the three version 1 workflow files and fixture provenance.", "For a fresh disposable identifier, call save_workflow with the documented local root and compare the receipt."]
    )
    write(case_dir / "showcase.json", json.dumps(data, indent=2))


def build_versions() -> None:
    case_dir = CASES / "ngs-workflow-versions"
    write(case_dir / "prompt.md", f'''# Compare and activate workflow versions

Update the case-owned workflow `{WORKFLOW_ID}` from version 1 to the retained version 2 definition. Inspect the unified diff, list both immutable Workbench versions, activate version 1 once, and restore version 2 as the final active version. Do not start a run.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.''')
    write(case_dir / "inputs/public-source.md", '''# Version comparison input

The public FASTQ identity is inherited from the saved-workflow case. Version 2 changes only the workflow definition: it adds explicit Q20/Q30 thresholds, stronger FASTQ validation, N-base and mean-quality fields, per-read threshold fractions, per-cycle threshold fractions, and local timeline support. `outputs/workflow-version.diff` is the complete text diff against version 1.''')
    write(case_dir / "README.md", f'''# FASTQ QC workflow versions

![Workflow version evidence](previews/preview.svg)

## Scientific question

Can a workflow revision add reviewable QC evidence while preserving both immutable Workbench versions and a visible text diff?

## Observed changes

`outputs/workflow-version.diff` compares every versioned workflow file. Version 2 adds configurable Q20/Q30 thresholds, validates the Phred+33 range, records N fraction and mean quality, adds per-read and per-cycle threshold fractions, and emits three local state events when the core runs directly.

## Workbench observations

`update_workflow` created `{V2}` with digest `sha256:e45290e57e1babf0336acb0fd9a6657f3df69188f501cdbab2d62c806924f0cb`. `list_workflow_versions` returned both immutable versions. The case activated version 1 and then reactivated version 2, which remained the final active version. No run was started.

{rosalind_section(case_dir)}

## Interpretation

The revision changes both QC measurements and validation behavior, so it is scientifically meaningful rather than a metadata-only edit. The retained diff explains the change independently of Workbench identifiers.

## Limitations

- The Workbench digest identifies its saved copy; the text diff explains the human-reviewable change.
- Neither version was launched by a workflow engine in this case.
- Additional assay-specific QC would be required before using these metrics for a biological decision.

## Reproduce

1. Run the saved case's `build_cases.py` to recreate `outputs/workflow-version.diff`.
2. Inspect version 1 under `../ngs-workflow-save/workflow/v1` and version 2 under `workflow/v2`.
3. On a fresh disposable workflow, call `update_workflow`, `list_workflow_versions`, and `activate_workflow_version` with the returned identifiers.
4. Confirm that version 2 is active and compare the response with `outputs/workbench-version-lifecycle.json`.''')
    write(case_dir / "previews/preview.svg", svg(
        "FASTQ QC workflow versions",
        "Immutable v1 → v2 update with a complete 8.3 KB text diff",
        [("VERSION 1", "172b18af · basic QC"), ("VERSION 2", "d88ed31c · active"), ("SCIENTIFIC CHANGE", "Q20/Q30 + validation"), ("DIFF", "8,295 bytes retained")],
        "Both Workbench versions listed · v1 activation checked · v2 restored as active"
    ))
    inputs = ["inputs/public-source.md", "workflow/v2/Snakefile", "workflow/v2/config/config.json", "workflow/v2/scripts/qc_core.py"]
    outputs = ["outputs/workflow-version.diff", "outputs/workbench-version-lifecycle.json", "outputs/rosalind-open-observation.json", "outputs/session-bundle.md"]
    data = manifest(
        "ngs-workflow-versions", "FASTQ QC workflow versions", "workflow", "multi-tool-result",
        ["ngs-analysis-workbench.update_workflow", "ngs-analysis-workbench.list_workflow_versions", "ngs-analysis-workbench.activate_workflow_version"],
        ["NGS Analysis Workbench 0.2.16", "Python 3.14 difflib"],
        "Workbench created and listed two immutable versions of the case-owned workflow; a complete local diff records the QC and validation changes.",
        inputs, outputs,
        [f"Workbench retained {V1} and {V2} for the same case-owned workflow.", "Version 2 has a distinct source digest and is the final active version.", "The 8,295-byte unified diff records changes to the Snakefile, configuration, and Python core."],
        ["Version 2 materially expands the QC evidence by making thresholds explicit and adding read-level, cycle-level, and integrity measurements."],
        ["No engine execution occurred during version management.", "The compact fixture does not support run-wide inference.", "A workflow digest alone does not explain scientific differences without the retained diff."],
        ["Run build_cases.py to regenerate the diff.", "Review every hunk in workflow-version.diff.", "On a fresh disposable object, repeat update, list, and activation calls and compare the identifiers."]
    )
    write(case_dir / "showcase.json", json.dumps(data, indent=2))


def build_archive() -> None:
    case_dir = CASES / "ngs-workflow-archive"
    write(case_dir / "prompt.md", f'''# Archive and restore a disposable workflow

Archive only the case-created workflow `{WORKFLOW_ID}`, confirm its archived state with `list_workflows(include_archived=true)`, restore it immediately, and confirm that version 2 and its source digest were preserved. Never archive another workflow.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.''')
    write(case_dir / "inputs/public-source.md", f'''# Disposable object definition

- Workflow ID: `{WORKFLOW_ID}`
- Ownership: created by this showcase through `save_workflow`.
- Active version before archive: `{V2}`.
- Permitted action: archive this exact case-owned object, observe the state, then restore it.
- Excluded objects: all bundled workflows and all other user-catalog workflows.''')
    write(case_dir / "README.md", f'''# Archive and restore the case workflow

![Archive and restore evidence](previews/preview.svg)

## Scientific question

Can a disposable saved workflow be hidden and restored without losing its active version identity?

## Workbench observations

The case archived only `{WORKFLOW_ID}`, an object created moments earlier for these showcases. The archived listing returned `archived: true` while preserving `{V2}` and its source digest. Restoration returned `archived: false` with the same version and digest.

{rosalind_section(case_dir)}

## Interpretation

The observed lifecycle shows that archive changes discovery visibility while the saved version remains identifiable. The action neither ran the workflow nor altered public FASTQ data.

## Limitations

- This evidence applies to the disposable showcase object only.
- The case does not test deletion, cross-device transfer, concurrency, or engine execution.
- The final Workbench state is restored, so reproducing the archived interval requires repeating the safe sequence on a fresh case-owned object.

## Reproduce

1. Confirm that the exact workflow ID was created by the saved-workflow case.
2. Call `archive_workflow` for that identifier only.
3. Call `list_workflows(include_archived=true)` and retain the matching record.
4. Call `restore_workflow` immediately and list again.
5. Compare archived state, restored state, version ID, and digest with `outputs/workbench-archive-restore.json`.''')
    write(case_dir / "previews/preview.svg", svg(
        "Workflow archive and restore",
        "One case-owned object · version identity preserved",
        [("START", "active · d88ed31c"), ("ARCHIVE", "archived = true"), ("RESTORE", "archived = false"), ("VERSION", "digest unchanged")],
        "No bundled or pre-existing user workflow was modified · no execution started"
    ))
    inputs = ["inputs/public-source.md"]
    outputs = ["outputs/workbench-archive-restore.json", "outputs/rosalind-open-observation.json", "outputs/session-bundle.md"]
    data = manifest(
        "ngs-workflow-archive", "Workflow archive and restore", "recovery", "multi-tool-result",
        ["ngs-analysis-workbench.archive_workflow", "ngs-analysis-workbench.list_workflows", "ngs-analysis-workbench.restore_workflow"],
        ["NGS Analysis Workbench 0.2.16"],
        "The case-created workflow was archived, observed in the archived listing, restored immediately, and observed as active with the same version digest.",
        inputs, outputs,
        ["The exact case-owned workflow changed from archived false to true and back to false.", f"The active version remained {V2} throughout the archive and restore sequence.", "No other workflow was selected for mutation."],
        ["Archiving changed workflow discovery state while retaining the immutable version identity."],
        ["This sequence does not establish behavior for deletion or concurrent clients.", "The case did not execute the workflow.", "Only the newly created showcase object was eligible for the archive action."],
        ["Verify ownership of the exact disposable workflow ID.", "Archive, list with archived entries, restore, and list again.", "Compare state and version identity with the retained receipt."]
    )
    write(case_dir / "showcase.json", json.dumps(data, indent=2))


def build_execution() -> None:
    case_dir = CASES / "ngs-run-execution"
    summary = json.loads((case_dir / "outputs/qc-summary.json").read_text(encoding="utf-8"))
    write(case_dir / "prompt.md", '''# Execute the transparent QC core locally

Inspect the local runtime. If neither Snakemake nor Nextflow is available, do not claim an engine or Workbench run. Execute the retained Python QC core directly on the 24-record public FASTQ fixture, preserve the command, exit code, output identities, and metrics, and label the Workbench execution lifecycle as rehearsed.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.''')
    write(case_dir / "inputs/public-source.md", '''# Execution input

`inputs/DRR037765-first-24.fastq` is a byte-identical copy of the fixture documented in the saved-workflow case. The workflow directory is a self-contained copy of version 2 with paths adjusted for this case. Raw reads remain unchanged; all generated tables are written under `outputs/`.''')
    write(case_dir / "README.md", f'''# Local FASTQ QC core execution

![Local execution evidence](previews/preview.svg)

## Scientific question

What integrity, composition, and bounded Phred-quality measurements are produced when the transparent version 2 QC core runs on the compact public fixture?

## Runtime observation

NGS Analysis Workbench runtime inspection found both `snakemake` and `nextflow` missing from the local target, no controller candidates, and an unreachable Docker daemon. Consequently, `execute_plan` and a workflow engine were not invoked. `outputs/runtime-snapshot.json` preserves the concise runtime evidence.

{rosalind_section(case_dir)}

## Actual local computation

Python 3.14 executed `workflow/scripts/qc_core.py` directly and exited with code 0. The parser confirmed 24 unique complete records and 11,304 bases, all 471 bases long. GC was {summary['gc_percent']:.2f}%, mean Phred was {summary['mean_phred']:.2f}, Q20 was {summary['q20_percent']:.2f}%, Q30 was {summary['q30_percent']:.2f}%, and N content was 0.00%. Per-read and per-cycle tables are retained.

## Interpretation

This small fixture has high base-call quality under the recorded Phred+33 interpretation, and its FASTQ structure is internally consistent. These measurements describe only the retained 24 records. They do not support a claim about the entire run, sample identity, adapters, contaminants, or downstream suitability.

## Limitations

- Workbench execution and Snakemake execution were rehearsed only; there is no registry run ID.
- The first 24 records may not represent later records or the full run.
- No FastQC, MultiQC, adapter classification, contamination screen, pairing check, or assay-specific QC was performed.
- Direct Python execution tests the scientific core but does not establish engine readiness.

## Reproduce

From `showcases/ngs-analysis-workbench/cases/ngs-run-execution`, run:

```powershell
python workflow/scripts/qc_core.py --input inputs/DRR037765-first-24.fastq --summary outputs/qc-summary.json --reads outputs/read-metrics.csv --cycles outputs/cycle-quality.csv --q20 20 --q30 30 --timeline ../ngs-run-observation/outputs/local-run-timeline.jsonl --log outputs/run-log.txt
```

Then compare the exit code, file identities, summary JSON, read table, and cycle table with `outputs/local-run-receipt.json`.''')
    write(case_dir / "previews/preview.svg", svg(
        "Local FASTQ QC core execution",
        "Actual Python computation · Workbench and Snakemake lifecycle rehearsed",
        [("INTEGRITY", "24 / 24 records passed"), ("BASES", "11,304 · 471 nt/read"), ("COMPOSITION", "GC 28.85% · N 0.00%"), ("QUALITY", "mean Q 37.30 · Q30 96.79%")],
        "Exit 0 · per-read CSV + 471-cycle CSV retained · registry run ID: none"
    ))
    inputs = [
        "inputs/public-source.md", "inputs/DRR037765-first-24.fastq", "workflow/Snakefile",
        "workflow/config/config.json", "workflow/scripts/qc_core.py"
    ]
    outputs = [
        "outputs/runtime-snapshot.json", "outputs/qc-summary.json", "outputs/read-metrics.csv",
        "outputs/cycle-quality.csv", "outputs/run-log.txt", "outputs/local-run-receipt.json", "outputs/rosalind-open-observation.json", "outputs/session-bundle.md"
    ]
    data = manifest(
        "ngs-run-execution", "Local FASTQ QC core execution", "workflow", "computed-result",
        ["ngs-analysis-workbench.get_runtime_environment", "ngs-analysis-workbench.execute_plan"],
        ["NGS Analysis Workbench 0.2.16 runtime inspection", "Python 3.14 standard library"],
        "The Python QC core executed locally with retained metrics; Workbench execute_plan and Snakemake execution were rehearsed because no controller was available.",
        inputs, outputs,
        ["Runtime inspection observed missing Snakemake and Nextflow controllers on the local target.", "The Python QC core exited 0 after validating 24 unique records and 11,304 bases.", "The computed GC fraction is 28.8482% and Q30 fraction is 96.7887%."],
        ["The retained subset has internally consistent FASTQ structure and high base-call quality under Phred+33, within the limited 24-record sample."],
        ["There is no Workbench registry run or engine execution.", "The compact subset cannot represent the entire run.", "Adapter, contamination, pairing, and assay-specific QC were not performed."],
        ["Run build_cases.py or the exact Python command in README.md.", "Verify exit code and all output hashes in local-run-receipt.json.", "Inspect the summary, per-read table, and per-cycle table before quoting metrics."]
    )
    write(case_dir / "showcase.json", json.dumps(data, indent=2))


def build_observation() -> None:
    case_dir = CASES / "ngs-run-observation"
    observed = json.loads((case_dir / "outputs/observed-metrics.json").read_text(encoding="utf-8"))
    events = [json.loads(line) for line in (case_dir / "outputs/local-run-timeline.jsonl").read_text(encoding="utf-8").splitlines()]
    event_times = [event["observed_at"].split("T", 1)[1] for event in events]
    write(case_dir / "prompt.md", '''# Observe a bounded local run timeline

Read the retained local JSONL state events in order, confirm that the terminal event is completed, then verify its records, bases, and Q30 values against the scientific output tables. State plainly that `observe_ngs_run` was not called because no Workbench run exists.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.''')
    write(case_dir / "inputs/public-source.md", '''# Observation input

The observation uses the local execution case's retained summary and tables plus `outputs/local-run-timeline.jsonl`. Each JSONL record was written during the direct Python run. The sequence `prepared → running → completed` is a local state-machine rehearsal and has no Workbench registry identity.''')
    write(case_dir / "README.md", f'''# Bounded local run observation

![Local observation evidence](previews/preview.svg)

## Scientific question

Can a short state timeline be checked against the actual QC artifacts without presenting it as a Workbench run?

## Observed timeline

`outputs/local-run-timeline.jsonl` contains exactly three ordered events: `prepared`, `running`, and `completed`. The terminal event records exit code 0, 24 records, 11,304 bases, Q30 {observed['output_metrics_observed']['q30_percent']:.6f}%, and the summary path. `outputs/observed-metrics.json` verifies the terminal state against the local QC summary.

{rosalind_section(case_dir)}

## Interpretation

The local state sequence and output metrics agree, so the direct Python computation completed and produced inspectable QC artifacts. The timeline supports only this local process claim. It is not evidence of `execute_plan`, `observe_ngs_run`, a workflow-engine controller, lineage, recovery, or Workbench persistence.

## Limitations

- `observe_ngs_run` and `get_ngs_run` were not called because no registered run exists.
- Millisecond timestamps describe a very small local fixture and are not performance benchmarks.
- The terminal event confirms process completion; scientific interpretation still depends on the retained summary and tables.
- The subset limitations from the execution case still apply.

## Reproduce

1. Run `../ngs-workflow-save/build_cases.py` from the repository root; it recreates the timeline while executing the QC core.
2. Read the JSONL events in file order and require the final state to be `completed` with exit code 0.
3. Compare records, bases, and Q30 in the terminal event with `../ngs-run-execution/outputs/qc-summary.json`.
4. Inspect the per-read and per-cycle CSV files for the underlying measurements.
5. Do not substitute a local event identifier for a Workbench registry run ID.''')
    write(case_dir / "previews/preview.svg", svg(
        "Bounded local run observation",
        "Three real local events · no Workbench registry run",
        [(event_times[0], "prepared"), (event_times[1], "running"), (event_times[2], "completed · exit 0"), ("TERMINAL METRICS", "24 reads · Q30 96.79%")],
        "Timeline cross-checked with qc-summary.json · observe_ngs_run performed: false"
    ))
    inputs = ["inputs/public-source.md"]
    outputs = ["outputs/local-run-timeline.jsonl", "outputs/observed-metrics.json", "outputs/rosalind-open-observation.json", "outputs/session-bundle.md"]
    data = manifest(
        "ngs-run-observation", "Bounded local run observation", "analysis", "multi-tool-result",
        ["ngs-analysis-workbench.get_ngs_run", "ngs-analysis-workbench.observe_ngs_run"],
        ["Python 3.14 local JSONL state timeline", "Python 3.14 QC output inspection"],
        "A three-event local state-machine timeline was recorded and checked against real QC outputs; Workbench run observation was rehearsed because no registry run exists.",
        inputs, outputs,
        ["The retained event order is prepared, running, completed.", "The terminal event has exit code 0 and matches 24 records, 11,304 bases, and Q30 96.788747% in the QC summary.", "No Workbench registry run ID exists for these local events."],
        ["The direct Python process completed and its terminal metrics agree with the retained scientific output, while Workbench lifecycle claims remain unavailable."],
        ["No get_ngs_run or observe_ngs_run action was performed.", "Timeline duration is not a performance benchmark.", "Process completion does not establish run-wide data quality or downstream suitability."],
        ["Run build_cases.py to recreate the timeline.", "Read JSONL events in order and verify the terminal event.", "Compare terminal metrics with the execution case's summary and CSV tables."]
    )
    write(case_dir / "showcase.json", json.dumps(data, indent=2))


def main() -> int:
    build_save()
    build_versions()
    build_archive()
    build_execution()
    build_observation()
    print("finalized five case-specific guides, previews, and manifests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
