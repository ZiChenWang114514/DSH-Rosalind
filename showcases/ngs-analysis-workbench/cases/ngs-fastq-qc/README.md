# FASTQ QC workflow readiness

![FASTQ QC workflow readiness](previews/ngs-fastq-qc.svg)

## Scientific objective

Assess paired FASTQ integrity, per-base quality, adapter evidence, and whether trimming is scientifically justified.

## Verified observations

- Bundled workflow: `oai_fastq_qc`
- Active version: `version-8e0c15a605d394be27a4e68246a061ef`
- Workflow source digest: `sha256:705bf609376de4193dafbb50a8967b75bc30ffeb5c17e1849a56cafe949db201`
- The local target is currently unable to launch this Snakemake workflow, and the configured Ubuntu target was unreachable.
- The registered run list was empty; no dataset was fetched and no analysis result exists.

## Proposed analysis

See `outputs/analysis-plan.md` for the assay-aware design. `outputs/readiness-review.md` separates observed runtime facts from unknown scientific results.

## Rosalind Workbench observation

One case-specific `mcp__rosalind__rosalind_open` call returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true`. The exact arguments, response, and timestamps are retained in `outputs/rosalind-open-observation.json`; `outputs/provenance.json` identifies it separately from the earlier NGS Workbench observations. The call opened only the task chooser and did not inspect FASTQ data or execute a scientific job.

## Interpretation

This case demonstrates live workflow discovery and an evidence-labelled scientific plan. It does not report QC, expression, cell types, or differential biology.

## Teaching bundle

`outputs/session-bundle.md` indexes the case guide, prompt, retained evidence, provenance, launcher observation, and preview for a reproducible lesson.

## 2026-08-30 operation evidence review

The current review retains only operations with explicit successful responses as capabilities. The case-specific machine-readable record is `outputs/operation-evidence.json`.

- Successful operations: `ngs-analysis-workbench.list_workflows`, `ngs-analysis-workbench.get_runtime_environment`, `ngs-analysis-workbench.check_nextflow_readiness`.
- Failed operations: `mcp__ngs_analysis_workbench__plan_nextflow`.
- Operations not executed: `mcp__ngs_analysis_workbench__execute_plan`.
- SSH and runtime responses are stored without private device names, user paths, task identifiers, or credentials.
