# Codex showcase lesson: Single-cell RNA-seq workflow design

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `ngs-single-cell` (Single-cell RNA-seq workflow design). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `ngs-single-cell`
- Plugin: `ngs-analysis-workbench` (NGS Analysis Workbench v0.2.16)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `ngs-analysis-workbench.list_workflows`, `ngs-analysis-workbench.check_nextflow_readiness`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `mcp__ngs_analysis_workbench__list_workflows`, `mcp__ngs_analysis_workbench__check_nextflow_readiness`, `mcp__rosalind__rosalind_open`
- Summary: Live bundled-workflow evidence and a chemistry-aware FASTQ-to-count plan.
- Recorded next step: Recheck the oai_scrnaseq_fastq_to_count version and chemistry-aware sample plan before generating a count matrix.
- Plugin guide: `showcases/ngs-analysis-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/README.md`
- case manifest: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/showcase.json`
- teaching prompt: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/prompt.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/outputs/workflow-evidence.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/outputs/analysis-plan.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/outputs/readiness-review.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/outputs/provenance.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/outputs/rosalind-open-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/outputs/session-bundle.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/outputs/operation-evidence.json`
- preview: `showcases/ngs-analysis-workbench/cases/ngs-single-cell/previews/ngs-single-cell.svg`

## Public sources

- https://nf-co.re/
- installed-plugin://ngs-analysis-workbench/0.2.16/tool-contract
- installed-plugin://rosalind-workbench/tool-contract

## Retained case guide

# Single-cell RNA-seq workflow design

![Single-cell RNA-seq workflow design](../previews/ngs-single-cell.svg)

## Scientific objective

Design a FASTQ-to-count single-cell RNA-seq analysis with explicit chemistry, reference, cell-calling, and quality-review requirements.

## Verified observations

- Bundled workflow: `oai_scrnaseq_fastq_to_count`
- Active version: `version-f3c773924a7ebc534c3adc131d4356ec`
- Workflow source digest: `sha256:6f7aa0dcf4ed6fdb6e187ff0f8d1128b6ffa93504bc688aee341fe250a893510`
- The local target is currently unable to launch this Snakemake workflow, and the configured Ubuntu target was unreachable.
- The registered run list was empty; no dataset was fetched and no analysis result exists.

## Proposed analysis

See `outputs/analysis-plan.md` for the assay-aware design. `outputs/readiness-review.md` separates observed runtime facts from unknown scientific results.

## Rosalind Workbench observation

One case-specific `mcp__rosalind__rosalind_open` call returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true`. The exact arguments, response, and timestamps are retained in `outputs/rosalind-open-observation.json`; `outputs/provenance.json` identifies it separately from the earlier NGS Workbench observations. The call opened only the task chooser and did not generate a count matrix, call cells, or execute a scientific job.

## Interpretation

This case demonstrates live workflow discovery and an evidence-labelled scientific plan. It does not report QC, expression, cell types, or differential biology.

## Teaching bundle

`outputs/session-bundle.md` indexes the case guide, prompt, retained evidence, provenance, launcher observation, and preview for a reproducible lesson.

## 2026-08-30 operation evidence review

The current review retains only operations with explicit successful responses as capabilities. The case-specific machine-readable record is `outputs/operation-evidence.json`.

- Successful operations: `ngs-analysis-workbench.list_workflows`, `ngs-analysis-workbench.check_nextflow_readiness`.
- Failed operations: `mcp__ngs_analysis_workbench__plan_nextflow`.
- Operations not executed: `mcp__ngs_analysis_workbench__execute_plan`.
- SSH and runtime responses are stored without private device names, user paths, task identifiers, or credentials.

## Retained execution prompt

# Single-cell RNA-seq workflow design

Design a FASTQ-to-count single-cell RNA-seq analysis with explicit chemistry, reference, cell-calling, and quality-review requirements.

Use the retained Workbench catalogue and runtime observations without claiming that reads, chemistry metadata, or matrices were inspected. Keep count generation, cell-level QC, annotation, and replicate-aware downstream comparisons as separately reviewed analyses.

Call `mcp__rosalind__rosalind_open` with the case-specific `task_context` retained in `outputs/rosalind-open-observation.json`. Preserve the exact response and timestamps, cite the observation from `outputs/provenance.json`, and state that the launcher call did not execute a Rosalind scientific job.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
