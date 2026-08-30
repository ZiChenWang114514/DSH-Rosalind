# Codex showcase lesson: FASTQ QC workflow readiness

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `ngs-fastq-qc` (FASTQ QC workflow readiness). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `ngs-fastq-qc`
- Plugin: `ngs-analysis-workbench` (NGS Analysis Workbench v0.2.16)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `ngs-analysis-workbench.list_workflows`, `ngs-analysis-workbench.get_runtime_environment`, `ngs-analysis-workbench.check_nextflow_readiness`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `mcp__ngs_analysis_workbench__list_workflows`, `mcp__ngs_analysis_workbench__get_runtime_environment`, `mcp__ngs_analysis_workbench__check_nextflow_readiness`, `mcp__rosalind__rosalind_open`
- Summary: Live workflow discovery, assay-aware QC design, and verified compute-readiness report.
- Recorded next step: Refresh the oai_fastq_qc workflow and compute-readiness evidence before retrieving reads or starting quality control.
- Plugin guide: `showcases/ngs-analysis-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/README.md`
- case manifest: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/showcase.json`
- teaching prompt: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/prompt.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/outputs/workflow-evidence.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/outputs/analysis-plan.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/outputs/readiness-review.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/outputs/provenance.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/outputs/rosalind-open-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/outputs/session-bundle.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/outputs/operation-evidence.json`
- preview: `showcases/ngs-analysis-workbench/cases/ngs-fastq-qc/previews/ngs-fastq-qc.svg`

## Public sources

- https://nf-co.re/
- installed-plugin://ngs-analysis-workbench/0.2.16/tool-contract
- installed-plugin://rosalind-workbench/tool-contract

## Retained case guide

# FASTQ QC workflow readiness

![FASTQ QC workflow readiness](../previews/ngs-fastq-qc.svg)

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

## Retained execution prompt

# FASTQ QC workflow readiness

Assess paired FASTQ integrity, per-base quality, adapter evidence, and whether trimming is scientifically justified.

Use the retained Workbench catalogue and runtime observations without claiming that FASTQ files were inspected or that a workflow ran. Keep the assay-aware plan distinct from unavailable QC results.

Call `mcp__rosalind__rosalind_open` with the case-specific `task_context` retained in `outputs/rosalind-open-observation.json`. Preserve the exact response and timestamps, cite the observation from `outputs/provenance.json`, and state that the launcher call did not execute a Rosalind scientific job.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
