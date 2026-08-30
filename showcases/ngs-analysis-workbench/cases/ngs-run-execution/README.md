# Local FASTQ QC core execution

![Local execution evidence](previews/preview.svg)

## Scientific question

What integrity, composition, and bounded Phred-quality measurements are produced when the transparent version 2 QC core runs on the compact public fixture?

## Runtime observation

NGS Analysis Workbench runtime inspection found both `snakemake` and `nextflow` missing from the local target, no controller candidates, and an unreachable Docker daemon. Consequently, `execute_plan` and a workflow engine were not invoked. `outputs/runtime-snapshot.json` preserves the concise runtime evidence.

## Rosalind Workbench invocation

The case called `mcp__rosalind__rosalind_open` at 2026-08-29T17:56:41.600Z (2026-08-30 01:56:41.600 +08:00) with the case-specific `task_context` retained in the observation file. The exact response was `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true` and `view: launcher`.

This operation only opened the Rosalind task chooser. It did not select or execute a Rosalind scientific task and does not support a scientific-result claim. `outputs/rosalind-open-observation.json` retains the exact response and the case-specific context.

## Actual local computation

Python 3.14 executed `workflow/scripts/qc_core.py` directly and exited with code 0. The public receipt uses only the interpreter name and repository-relative paths. The parser confirmed 24 unique complete records and 11,304 bases, all 471 bases long. GC was 28.85%, mean Phred was 37.30, Q20 was 99.27%, Q30 was 96.79%, and N content was 0.00%. Per-read and per-cycle tables are retained.

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

Then compare the exit code, file identities, summary JSON, read table, and cycle table with `outputs/local-run-receipt.json`.

## 2026-08-30 operation evidence review

The current review retains only operations with explicit successful responses as capabilities. The case-specific machine-readable record is `outputs/operation-evidence.json`.

- Successful operations: `ngs-analysis-workbench.get_runtime_environment`.
- Failed operations: none.
- Operations not executed: `mcp__ngs_analysis_workbench__execute_plan`.
- SSH and runtime responses are stored without private device names, user paths, task identifiers, or credentials.
