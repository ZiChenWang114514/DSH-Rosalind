# Codex showcase lesson: Run analysis summary

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `ngs-run-summary` (Run analysis summary). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `ngs-run-summary`
- Plugin: `ngs-analysis-workbench` (NGS Analysis Workbench v0.2.16)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `analysis`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `ngs-analysis-workbench.list_workflow_versions`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `mcp__ngs_analysis_workbench__list_workflow_versions`, `Python 3.14 standard library`, `mcp__rosalind__rosalind_open`
- Summary: How can a completed run receive an evidence-linked scientific summary?
- Recorded next step: Recompute the FASTQ reference metrics and reassess each scientific summary statement against the retained evidence.
- Plugin guide: `showcases/ngs-analysis-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/README.md`
- case manifest: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/showcase.json`
- teaching prompt: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/prompt.md`
- input: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/inputs/source-and-fixture.md`
- input: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/inputs/public-fixture.fastq.txt`
- input: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/scripts/reference_fastq_stats.py`
- output: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/outputs/reference-fastq-stats.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/outputs/reference-computation-receipt.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/outputs/analysis-summary.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/outputs/provenance.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/outputs/update-analysis-summary-receipt.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/outputs/rosalind-open-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/outputs/session-bundle.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/outputs/operation-evidence.json`
- preview: `showcases/ngs-analysis-workbench/cases/ngs-run-summary/previews/preview.svg`

## Public sources

- installed-plugin://ngs-analysis-workbench/0.2.16/tool-contract
- installed-plugin://rosalind-workbench/tool-contract
- https://raw.githubusercontent.com/nf-core/test-datasets/5f09ab078a7459db38c1ec86712a98d369cf7863/illumina/amplicon/sample1_R1.fastq.gz

## Retained case guide

# Run analysis summary

![Run analysis summary](../previews/preview.svg)

## Scientific question

What happens when an evidence-linked scientific summary is submitted while no registered Workbench run exists?

## Source and local reference computation

`inputs/source-and-fixture.md` identifies a public nf-core test-dataset file and the retained two-record prefix. Local Python processed the two complete 301-base records and wrote `outputs/reference-fastq-stats.json`: 602 total bases, 36.213% GC, 62.791% Q30 under a Phred+33 assumption, and mean Phred 29.402. `outputs/reference-computation-receipt.json` records the command and makes clear that this was a local reference computation, not an NGS Analysis Workbench engine run.

## Model-authored review

`outputs/analysis-summary.md` follows the NGS Analysis Workbench review structure: a short takeaway, a plain-language lifecycle paragraph, evidence-linked findings, artifact groups, limitations, and a justified next action. `ngs-analysis-workbench.update_ngs_run_analysis_summary` was called with the reserved temporary identity `verification-temp-no-run-20260830`. Workbench returned `run does not exist: verification-temp-no-run-20260830`, so the summary was not saved and no existing run was modified. The exact safe arguments, response, and timestamps are retained in `outputs/update-analysis-summary-receipt.json` and cited by `outputs/provenance.json`.

## Rosalind Workbench observation

One case-specific `mcp__rosalind__rosalind_open` call returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true`. The exact arguments, response, and timestamps are retained in `outputs/rosalind-open-observation.json` and cited by `outputs/provenance.json`. This call opened only the task chooser; it did not create a run, inspect the FASTQ, or submit the summary to Workbench history.

## Limitations

- The two-record prefix is a parser fixture and cannot represent the full public library.
- No FastQC, MultiQC, adapter analysis, trimming, workflow engine, immutable plan, registered run, or Workbench summary submission occurred.
- The genuine summary operation was rejected because no registered temporary run existed; its failure does not convert the local reference computation into a Workbench run.
- The Rosalind launcher observation provides no scientific result.

## Reproduce

1. Run `python scripts/reference_fastq_stats.py inputs/public-fixture.fastq.txt outputs/reference-fastq-stats.json`.
2. Compare the result with the values and evidence paths in `outputs/analysis-summary.md`.
3. Call `mcp__rosalind__rosalind_open` with the case-specific `task_context` retained in `outputs/rosalind-open-observation.json` and compare the exact response.
4. Call `update_ngs_run_analysis_summary` only with a temporary verification identity or a genuinely registered run owned by the task, and compare the response with `outputs/update-analysis-summary-receipt.json`.
5. Generate `outputs/session-bundle.md` with the repository showcase-session script and inspect every listed artifact.

## 2026-08-30 operation evidence review

The current review retains only operations with explicit successful responses as capabilities. The case-specific machine-readable record is `outputs/operation-evidence.json`.

- Successful operations: `ngs-analysis-workbench.list_workflow_versions`.
- Failed operations: `mcp__ngs_analysis_workbench__update_ngs_run_analysis_summary`.
- Operations not executed: `registered run lifecycle`.
- SSH and runtime responses are stored without private device names, user paths, task identifiers, or credentials.

## Retained execution prompt

# Run analysis summary

Use the public two-record FASTQ fixture to produce a deterministic local reference result and write an evidence-linked scientific review. Call `ngs-analysis-workbench.update_ngs_run_analysis_summary` with the reserved temporary verification identity, retaining the exact safe arguments, response, and timestamps in `outputs/update-analysis-summary-receipt.json`. Keep the completed local computation distinct from an NGS Analysis Workbench engine run, and state plainly whether the summary was saved. Quote only retained metrics and state which library-quality and biological conclusions remain unsupported.

Call `mcp__rosalind__rosalind_open` with the case-specific `task_context` retained in `outputs/rosalind-open-observation.json`. Preserve the exact response and timestamps, cite the observation from `outputs/provenance.json`, and state that the launcher call did not execute a Rosalind scientific job or submit a Workbench analysis summary.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
