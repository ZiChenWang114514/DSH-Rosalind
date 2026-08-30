# Codex showcase lesson: Nextflow and Snakemake comparison

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-nextflow-snakemake` (Nextflow and Snakemake comparison). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-nextflow-snakemake`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `scientific-computing`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `computed-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Python 3.14 standard library`, `Nextflow DSL2 and Snakemake definitions retained without engine execution`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: How do two workflow engines represent an equivalent small scientific computation?
- Recorded next step: Compare the retained Nextflow DSL2 and Snakemake definitions against the directly executed Python FASTQ quality computation.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/build_case.py`
- input: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/qc_core.py`
- input: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/inputs/DRR037765-first-500.fastq`
- input: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/inputs/source-provenance.json`
- input: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/workflows/nextflow/main.nf`
- input: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/workflows/snakemake/Snakefile`
- output: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/outputs/reference-qc.json`
- output: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/outputs/readiness.json`
- output: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/outputs/workflow-contract.json`
- output: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/outputs/teaching-bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/previews/preview.svg`

## Public sources

- https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz
- https://www.nextflow.io/docs/latest/
- https://snakemake.readthedocs.io/

## Retained case guide

# Nextflow and Snakemake definitions for one FASTQ computation

![Workflow definition comparison](../previews/preview.svg)

## Scientific question

Can Nextflow DSL2 and Snakemake describe the same bounded FASTQ quality calculation while sharing one scientific implementation and one output contract?

## Public input

The input is the first 500 reads from ENA run `DRR037765`. `inputs/source-provenance.json` records the public ENA URL, subset rule, repository-relative retained path, and byte count; it contains no workstation path.

## Shared computation

`qc_core.py` validates every four-line FASTQ record and reports read count, total bases, minimum, maximum, and mean read length, GC percentage, and Q30 percentage. The retained direct Python result contains 500 reads and 235,490 bases, with GC 28.85% and Q30 95.40%.

Both workflow definitions call this same script:

- `workflows/nextflow/main.nf`
- `workflows/snakemake/Snakefile`

## Rosalind Workbench observation

A genuine `mcp__rosalind__rosalind_open` call with the FASTQ workflow-comparison context returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The exact arguments and timestamps are stored in `outputs/rosalind-open-observation.json`.

This launcher observation did not run either workflow engine or the shared QC code. The numerical QC result came from the direct local Python execution recorded in `outputs/reference-qc.json`; `outputs/readiness.json` continues to record both engine runs as unexecuted.

## Execution status

The local readiness check found neither `nextflow` nor `snakemake` on `PATH`. Therefore, the two definitions and their output contract are inspectable plans, while `outputs/reference-qc.json` is the only executed numerical result. No dry run, workflow run, cache/resume test, engine timing, or engine output is claimed.

## Interpretation

The retained files demonstrate equivalent intended inputs, program, and output fields. They do not demonstrate that the two engines executed successfully or that their operational behavior is equivalent.

## Limitations

- Workflow-engine execution remains pending in an environment with the two engines installed.
- A 500-read subset is too small for throughput comparison.
- Sharing one Python program isolates orchestration syntax; it does not compare each engine's broader ecosystem.

## Reproduce

1. Run `python build_case.py` from this case directory to verify the retained public subset, direct computation, and readiness record. Use `--source-fastq <path>` only when replacing the retained subset with another independently acquired copy.
2. Inspect both workflow definitions and `outputs/workflow-contract.json`.
3. In a prepared environment, run each engine from a clean work directory and retain its version, command, logs, canonical output, and run record.
4. Inspect `outputs/rosalind-open-observation.json` independently from the direct QC result and workflow readiness record.
5. Compare engine outputs field by field before adding any claim of execution equivalence.

## Retained execution prompt

# Nextflow and Snakemake comparison

Represent the same seven-field FASTQ quality computation in Nextflow DSL2 and Snakemake using one shared `qc_core.py`. Check local engine availability, run the shared computation directly on the retained 500-read public subset, and keep planned engine outputs clearly separate from executed results. Inspect `outputs/rosalind-open-observation.json` as the genuine chooser-readiness record; it is independent of both the direct QC calculation and workflow-engine execution status.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
