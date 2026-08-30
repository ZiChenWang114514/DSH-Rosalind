# Codex showcase lesson: Public FASTQ quality workflow

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-fastq-qc` (Public FASTQ quality workflow). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-fastq-qc`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `workflow`
- Difficulty: `intermediate`
- Evidence level: `computed-result`
- Covered operations: `rosalind-workbench.public-evidence`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Rosalind Workbench mcp__rosalind__rosalind_open`, `European Nucleotide Archive DRR037765 and local Python standard library`
- Summary: Which bounded quality metrics can be reproduced from a small public read subset?
- Recorded next step: Recompute quality metrics for the first 500 complete ENA DRR037765 reads and compare them with the retained result.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/build_case.py`
- input: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/inputs/public-source.md`
- input: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/inputs/DRR037765.fastq.gz`
- output: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/outputs/quality-summary.json`
- output: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/outputs/per-cycle-quality.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/outputs/provenance.json`
- output: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-fastq-qc/previews/preview.svg`

## Public sources

- https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz

## Retained case guide

# Deterministic FASTQ quality summary

![Deterministic FASTQ quality summary](previews/preview.svg)

## Scientific question

Which sequence and base-quality metrics are reproducible from the first 500 complete reads of public ENA run `DRR037765`?

## Public source and subset rule

The case retains the 127,526-byte ENA gzip object with MD5 `81735432a6f578b332aae58cdbd95231`. `build_case.py` validates the compressed source, reads the first 500 complete FASTQ records, checks sequence/quality length equality, retains the first header token, normalizes the plus line to `+`, and uses LF endings for the canonical in-memory subset.

## Executed deterministic analysis

- 500 reads and 235,490 bases
- read lengths 469–471 bases; mean 470.98 bases
- 28.846236% GC
- 95.397681% of bases at Q30 or greater
- canonical subset: 480,372 bytes, SHA-256 `46bd72991d9c9c2bf64751e88e52548d852d5fa021da4815ee6f6517a51b18b9`

`outputs/per-cycle-quality.csv` contains all 471 cycle summaries. Cycle 1 has mean Phred 37.834 and 99.4% Q30; the lowest mean occurs at cycle 277 (25.636, 35.6% Q30); cycle 471 includes 491 reads and has mean Phred 37.142566.

These metrics describe the deterministic subset only. They do not establish the quality of the complete run or its suitability for a specific downstream assay.

## Observed Rosalind Workbench invocation

`mcp__rosalind__rosalind_open` was genuinely invoked at `2026-08-29T18:21:00.272Z`. It returned exactly `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The 894-byte `outputs/rosalind-open-observation.json` retains the case-specific arguments, timestamps, response, and `scientific_job_executed=false`.

The launcher call did not receive the reads. The retained ENA object and local Python script produced the QC outputs.

## Limitations

- A 500-read prefix can differ from the full-run quality distribution.
- No adapter, contamination, taxonomic, duplication, or assay-specific assessment was performed.
- Phred+33 is used for the retained quality strings.
- No Rosalind FASTQ analysis or wet-lab work was executed.

## Reproduce

```powershell
python showcases/rosalind-workbench/cases/rosalind-fastq-qc/build_case.py
python scripts/showcase_session.py bundle rosalind-fastq-qc --output showcases/rosalind-workbench/cases/rosalind-fastq-qc/bundle.md
```

## Retained execution prompt

# Deterministic FASTQ quality summary

Validate the retained public ENA `DRR037765.fastq.gz`, reproduce the first-500-record canonical subset, and report read count, bases, length distribution, GC, Q30, subset digest, and every per-cycle quality row. State that the subset does not represent a full-run QC review. Invoke `mcp__rosalind__rosalind_open` only to open the task chooser; cite the exact 894-byte `outputs/rosalind-open-observation.json` and state that no reads were uploaded to Rosalind.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
