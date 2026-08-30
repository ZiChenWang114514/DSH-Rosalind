# Codex showcase lesson: Bulk RNA-seq workflow design

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `ngs-bulk-rnaseq` (Bulk RNA-seq workflow design). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `ngs-bulk-rnaseq`
- Plugin: `ngs-analysis-workbench` (NGS Analysis Workbench v0.2.16)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `ngs-analysis-workbench.list_workflows`, `ngs-analysis-workbench.check_nextflow_readiness`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `mcp__ngs_analysis_workbench__list_workflows`, `mcp__ngs_analysis_workbench__check_nextflow_readiness`, `mcp__rosalind__rosalind_open`
- Summary: Live bundled-workflow evidence and a study-design-aware bulk RNA-seq plan.
- Recorded next step: Recheck the oai_bulk_rnaseq_counts_qc version and study-design contrasts before retrieving inputs or running quantification.
- Plugin guide: `showcases/ngs-analysis-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/README.md`
- case manifest: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/showcase.json`
- teaching prompt: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/prompt.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/outputs/workflow-evidence.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/outputs/analysis-plan.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/outputs/readiness-review.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/outputs/provenance.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/outputs/rosalind-open-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/outputs/session-bundle.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/outputs/operation-evidence.json`
- preview: `showcases/ngs-analysis-workbench/cases/ngs-bulk-rnaseq/previews/ngs-bulk-rnaseq.svg`

## Public sources

- https://nf-co.re/
- installed-plugin://ngs-analysis-workbench/0.2.16/tool-contract
- installed-plugin://rosalind-workbench/tool-contract

## Retained case guide

# Bulk RNA-seq workflow design

![Bulk RNA-seq workflow design](../previews/ngs-bulk-rnaseq.svg)

## Scientific objective

Design a compact bulk RNA-seq counts-and-QC analysis while preserving sample design, reference identity, and reproducible workflow evidence.

## Verified observations

- Bundled workflow: `oai_bulk_rnaseq_counts_qc`
- Active version: `version-a99d0908ddacd176e3b77e9ec2e482f3`
- Workflow source digest: `sha256:eddf2cd523b62c20b3fa4496c4d441b9dfb48a303de9c5b922bad30d7e30f9cc`
- The local target is currently unable to launch this Snakemake workflow, and the configured Ubuntu target was unreachable.
- The registered run list was empty; no dataset was fetched and no analysis result exists.

## Proposed analysis

See `outputs/analysis-plan.md` for the assay-aware design. `outputs/readiness-review.md` separates observed runtime facts from unknown scientific results.

## Rosalind Workbench observation

One case-specific `mcp__rosalind__rosalind_open` call returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true`. The exact arguments, response, and timestamps are retained in `outputs/rosalind-open-observation.json`; `outputs/provenance.json` identifies it separately from the earlier NGS Workbench observations. The call opened only the task chooser and did not quantify RNA, test a contrast, or execute a scientific job.

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

# Bulk RNA-seq workflow design

Design a compact bulk RNA-seq counts-and-QC analysis while preserving sample design, reference identity, and reproducible workflow evidence.

Use the retained Workbench catalogue and runtime observations without claiming that reads, counts, or sample metadata were inspected. Keep quantification planning distinct from differential-expression testing, which requires an identifiable replicate-aware design and suitable count representation.

Call `mcp__rosalind__rosalind_open` with the case-specific `task_context` retained in `outputs/rosalind-open-observation.json`. Preserve the exact response and timestamps, cite the observation from `outputs/provenance.json`, and state that the launcher call did not execute a Rosalind scientific job.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
