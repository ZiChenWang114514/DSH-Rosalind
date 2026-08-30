# Codex showcase lesson: Workflow version lifecycle

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `ngs-workflow-versions` (Workflow version lifecycle). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `ngs-workflow-versions`
- Plugin: `ngs-analysis-workbench` (NGS Analysis Workbench v0.2.16)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `workflow`
- Difficulty: `intermediate`
- Evidence level: `multi-tool-result`
- Covered operations: `ngs-analysis-workbench.update_workflow`, `ngs-analysis-workbench.list_workflow_versions`, `ngs-analysis-workbench.activate_workflow_version`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `mcp__ngs_analysis_workbench__update_workflow`, `mcp__ngs_analysis_workbench__list_workflow_versions`, `mcp__ngs_analysis_workbench__activate_workflow_version`, `Python 3.14 difflib`, `mcp__rosalind__rosalind_open`
- Summary: How are workflow versions listed, updated, and activated with inspectable identifiers?
- Recorded next step: Compare the two immutable workflow versions and verify the retained diff for quality-control and validation changes.
- Plugin guide: `showcases/ngs-analysis-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/README.md`
- case manifest: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/showcase.json`
- teaching prompt: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/prompt.md`
- input: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/inputs/public-source.md`
- input: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/workflow/v2/Snakefile`
- input: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/workflow/v2/config/config.json`
- input: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/workflow/v2/scripts/qc_core.py`
- output: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/outputs/workflow-version.diff`
- output: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/outputs/workbench-version-lifecycle.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/outputs/rosalind-open-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/outputs/session-bundle.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/outputs/operation-evidence.json`
- preview: `showcases/ngs-analysis-workbench/cases/ngs-workflow-versions/previews/preview.svg`

## Public sources

- https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz

## Retained case guide

# FASTQ QC workflow versions

![Workflow version evidence](../previews/preview.svg)

## Scientific question

Can a workflow revision add reviewable QC evidence while preserving both immutable Workbench versions and a visible text diff?

## Observed changes

`outputs/workflow-version.diff` compares every versioned workflow file. Version 2 adds configurable Q20/Q30 thresholds, validates the Phred+33 range, records N fraction and mean quality, adds per-read and per-cycle threshold fractions, and emits three local state events when the core runs directly.

## Workbench observations

`update_workflow` created `version-d88ed31c58ebee8c5667ddee257b846f` with digest `sha256:e45290e57e1babf0336acb0fd9a6657f3df69188f501cdbab2d62c806924f0cb`. `list_workflow_versions` returned both immutable versions. The case activated version 1 and then reactivated version 2, which remained the final active version. No run was started.

## Rosalind Workbench invocation

The case called `mcp__rosalind__rosalind_open` at 2026-08-29T17:56:41.522Z (2026-08-30 01:56:41.522 +08:00) with the case-specific `task_context` retained in the observation file. The exact response was `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true` and `view: launcher`.

This operation only opened the Rosalind task chooser. It did not select or execute a Rosalind scientific task and does not support a scientific-result claim. `outputs/rosalind-open-observation.json` retains the exact response and the case-specific context.

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
4. Confirm that version 2 is active and compare the response with `outputs/workbench-version-lifecycle.json`.

## 2026-08-30 operation evidence review

The current review retains only operations with explicit successful responses as capabilities. The case-specific machine-readable record is `outputs/operation-evidence.json`.

- Successful operations: `ngs-analysis-workbench.update_workflow`, `ngs-analysis-workbench.list_workflow_versions`, `ngs-analysis-workbench.activate_workflow_version`.
- Failed operations: none.
- Operations not executed: none.
- SSH and runtime responses are stored without private device names, user paths, task identifiers, or credentials.

## Retained execution prompt

# Compare and activate workflow versions

Update the case-owned workflow `showcase_fastq_qc_lifecycle_20260830` from version 1 to the retained version 2 definition. Inspect the unified diff, list both immutable Workbench versions, activate version 1 once, and restore version 2 as the final active version. Do not start a run.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
