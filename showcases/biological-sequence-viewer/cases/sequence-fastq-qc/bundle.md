# Codex showcase lesson: Public-read FASTQ quality exploration

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `sequence-fastq-qc` (Public-read FASTQ quality exploration). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `sequence-fastq-qc`
- Plugin: `biological-sequence-viewer` (Biological Sequence & Alignment Viewer v0.1.43)
- Status: `ready`
- Domain: `structure-and-sequence`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `computed-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Rosalind Workbench mcp__rosalind__rosalind_open`, `Biological Sequence & Alignment Viewer 0.1.43 diagnostic attempts recorded in outputs/viewer-operation-evidence.json`
- Summary: Deterministic 500-read ENA subset with sequence and Phred-quality metrics.
- Recorded next step: Recalculate read count, total bases, and Q30 fraction for the first 500 DRR037765 records while retaining the subset limitation.
- Plugin guide: `showcases/biological-sequence-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/README.md`
- case manifest: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/showcase.json`
- teaching prompt: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/prompt.md`
- output: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/outputs/quality-summary.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/outputs/source-provenance.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/outputs/provenance.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/outputs/rosalind-open-observation.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/outputs/viewer-operation-evidence.json`
- preview: `showcases/biological-sequence-viewer/cases/sequence-fastq-qc/previews/fastq-qc.svg`

## Public sources

- https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz

## Retained case guide

# Public-read FASTQ quality exploration

![FASTQ QC summary](previews/fastq-qc.svg)

## Scientific question

What sequence composition and base-quality profile appears in a deterministic subset of a public long-read run?

## Source and method

The source is ENA run `DRR037765`. The preparation script reads the first 500 complete records, verifies sequence/quality length equality, and writes a canonical local subset. Large read files remain outside Git; `outputs/source-provenance.json` records the public URL, ENA MD5, transformation rule, byte count, and subset SHA-256.

## Computed results

- 500 reads and 235,490 bases
- length 469–471 bases
- GC 28.85%
- Q30 95.40%

These values describe this bounded subset only. They do not establish run-wide quality or suitability for a downstream assay.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with this case's task context at `2026-08-29T18:14:15.199Z`. It returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The arguments, UTC and local timestamps, response, and `scientific_job_executed=false` are retained in `outputs/rosalind-open-observation.json` and cited by `outputs/provenance.json`. The call opened only the task chooser; the local preparation script produced the subset and quality metrics.

## Reproduce

Download the documented ENA object to the case input path and run `python scripts/prepare_sequence_examples.py`.

## Limitation

The current open attempt created a server session, but the bounded quality query timed out without acknowledgement. The visual is a project-owned numerical summary.

## Viewer operation review (2026-08-30)

No Sequence Viewer operation is recorded as successful. Server sessions were created for the relevant local public files, but subsequent queries or controls were not acknowledged. `outputs/viewer-operation-evidence.json` separates failed calls from actions that were not attempted after the prerequisite confirmation failed. It omits session identifiers, private paths, and internal resource URIs.

## Retained execution prompt

# Prompt

Acquire public ENA run DRR037765, create a deterministic 500-read subset, and report bounded sequence and Phred-quality metrics. Invoke `mcp__rosalind__rosalind_open` with this case's task context, cite `outputs/rosalind-open-observation.json`, and state that its ready task-chooser response did not read the run or calculate quality metrics.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
