# Codex showcase lesson: Nextflow readiness report

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `ngs-nextflow-readiness` (Nextflow readiness report). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `ngs-nextflow-readiness`
- Plugin: `ngs-analysis-workbench` (NGS Analysis Workbench v0.2.16)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `ngs-analysis-workbench.list_workflows`, `ngs-analysis-workbench.get_runtime_environment`, `ngs-analysis-workbench.check_nextflow_readiness`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `mcp__ngs_analysis_workbench__list_workflows`, `mcp__ngs_analysis_workbench__get_runtime_environment`, `mcp__ngs_analysis_workbench__check_nextflow_readiness`, `Python 3.14`, `mcp__rosalind__rosalind_open`
- Summary: Is a selected workflow and compute target ready for an immediate Nextflow plan?
- Recorded next step: Recheck nf-core and target readiness, then compare the blocked Nextflow result with the retained Python FASTQ reference metrics.
- Plugin guide: `showcases/ngs-analysis-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/README.md`
- case manifest: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/showcase.json`
- teaching prompt: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/prompt.md`
- input: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/inputs/source-and-fixture.md`
- input: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/inputs/public-fixture.fastq`
- input: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/inputs/samplesheet.csv`
- input: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/inputs/params.json`
- input: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/workflow/main.nf`
- input: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/scripts/reference_fastq_stats.py`
- output: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/outputs/readiness.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/outputs/reference-fastq-stats.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/outputs/native-check.txt`
- output: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/outputs/rosalind-open-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/outputs/operation-evidence.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/outputs/session-bundle.md`
- preview: `showcases/ngs-analysis-workbench/cases/ngs-nextflow-readiness/previews/preview.svg`

## Public sources

- installed-plugin://ngs-analysis-workbench/0.2.16/tool-contract
- installed-plugin://rosalind-workbench/tool-contract
- https://github.com/nf-core/demo/tree/1.2.0
- https://raw.githubusercontent.com/nf-core/test-datasets/5f09ab078a7459db38c1ec86712a98d369cf7863/illumina/amplicon/sample1_R1.fastq.gz

## Retained case guide

# Nextflow readiness report

![Nextflow readiness report](../previews/preview.svg)

## Question

Can the repaired local SSH target execute the retained FASTQ statistics workflow through Nextflow, and can Workbench prepare the catalogued Docker-profile workflow?

## Workbench readiness result

The repaired Linux target exposes Nextflow 26.04.6, Java 21.0.12, Docker 29.7.2, and a reachable Linux Docker daemon. A refreshed `get_runtime_environment` call returned an active Nextflow controller candidate. The later `check_nextflow_readiness` call still failed before readiness evaluation because the Windows-hosted plugin converted the remote POSIX run directory to a backslash-prefixed path. No immutable plan or registered Workbench run was created.

The sanitized response is retained in `outputs/readiness.json`. `workflow/main.nf` is the exact minimal native definition used for this case's offline FASTQ structural-statistics test; `inputs/params.json` and `inputs/samplesheet.csv` retain its input contract.

## Direct reference computation

After correcting `workflow/main.nf` so its script and fixture paths resolve from the `workflow/` directory, Nextflow executed `FASTQ_STATS` successfully with one completed task and exit code 0. The same fixture contains two complete 301-base records: 602 total bases, 36.213% GC, 62.791% Q30 bases under a Phred+33 assumption, and mean Phred 29.402. These values confirm parser behavior for the tiny fixture only.

## Rosalind Workbench invocation

`mcp__rosalind__rosalind_open` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true`. The exact response and timestamps are retained in `outputs/rosalind-open-observation.json`. This operation opened only the task chooser; it does not show that a Rosalind scientific task, Nextflow workflow, or computation was selected or executed.

## Interpretation

The case now demonstrates a native Nextflow run of the retained minimal FASTQ statistics workflow. It does not demonstrate a successful Workbench readiness decision, plan, registered run, FastQC, MultiQC, adapter detection, trimming, or scientific QC acceptance.

## Limitations

The two-record prefix is too small and nonrepresentative for library-quality inference. The completed native workflow is a structural-statistics check and does not replace the catalogued nf-core workflow. Its task did not use a container image.

## Reproduce

1. Refresh `get_runtime_environment` for the registered Linux SSH target.
2. Run `check_nextflow_readiness` for `fastq_qc`, the same target, Docker profile, controller candidate, and a new absolute POSIX run directory.
3. Run `nextflow run workflow/main.nf` from a temporary Linux launch directory and record its exit status.
4. Run `python scripts/reference_fastq_stats.py inputs/public-fixture.fastq` and compare the JSON with `outputs/reference-fastq-stats.json`.

## 2026-08-30 operation evidence review

The current review retains only operations with explicit successful responses as capabilities. The case-specific machine-readable record is `outputs/operation-evidence.json`.

- Successful operations: `ngs-analysis-workbench.list_workflows`, `ngs-analysis-workbench.get_runtime_environment`, `ngs-analysis-workbench.check_nextflow_readiness`.
- Additional verified action: native Nextflow 26.04.6 completed the retained `FASTQ_STATS` process with exit code 0.
- Failed operations: `mcp__ngs_analysis_workbench__check_nextflow_readiness` (invalid local path and later POSIX-path conversion), `mcp__ngs_analysis_workbench__plan_nextflow`.
- Operations not executed: `mcp__ngs_analysis_workbench__execute_plan`.
- SSH and runtime responses are stored without private device names, user paths, task identifiers, or credentials.

## Retained execution prompt

# Nextflow readiness report

Check the current `fastq_qc` catalogue binding on the local target with the Docker profile. Retain the exact workflow identity and a minimal native Nextflow definition. If Nextflow is absent, record the observed reason, do not create a plan or run, and execute the shared Python FASTQ reference computation on the public two-record fixture.

Call `mcp__rosalind__rosalind_open` for this case and retain its exact launcher response with UTC and local timestamps in `outputs/rosalind-open-observation.json`. State plainly that the operation opens only the Rosalind task chooser and provides no evidence that a scientific task ran.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
