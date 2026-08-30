# Bundled NGS workflow verification

Date: 2026-08-30

The v0.3.0 candidate includes three project-authored Snakemake workflows whose directory names and runtime identities match the retained showcase evidence:

- `oai_fastq_qc`
- `oai_bulk_rnaseq_counts_qc`
- `oai_scrnaseq_fastq_to_count`

Each workflow contains a Snakefile, normal configuration, engineering smoke configuration, JSON Schema-compatible YAML configuration schema, and README. The DSH runtime reads the packaged Snakefile and calculates an implementation digest from those bytes; the historical catalogue digest remains a separate provenance field.

## Local execution record

Snakemake 8.30.0 was invoked with Python from the local Anaconda installation. All three `config/smoke.yaml` runs completed and wrote only `results-smoke/smoke/ENGINEERING_TEST_ONLY.txt`. Each marker explicitly states that no scientific FASTQ, alignment, quantification, barcode processing, or count result was produced. The generated smoke files and Snakemake working directories were removed after inspection.

The normal configurations were also inspected with `--dry-run`. They stopped with `MissingInputException` because the repository intentionally does not ship sequencing data, Salmon or STAR indexes, or a barcode whitelist. This verifies that the workflows do not invent scientific outputs when inputs are absent.

GitHub Actions repeats the three smoke runs with Snakemake 8.30.0 and requires the normal configurations to report `MissingInputException`. Actual FastQC, MultiQC, Salmon, and STARsolo scientific processing remains dependent on user-provided data, reference resources, installed tools, a reviewed execution plan, and DSH host approval.
