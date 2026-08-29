# oai_fastq_qc

`oai_fastq_qc` runs FastQC on paired FASTQ files and consolidates those reports with MultiQC. It is a small, reusable workflow source, not a bundled dataset or a claim about read quality.

## Requirements

- Snakemake 8 or later on a Linux host or in a compatible container
- `fastqc` and `multiqc` available on `PATH`
- One readable `r1` and `r2` FASTQ path for every sample in `config/config.yaml`

Sample identifiers must be filesystem-safe (`A-Z`, `a-z`, `0-9`, `.`, `_`, `-`). `results_dir` is relative to the directory from which Snakemake is launched unless you supply an absolute path.

## Run the scientific workflow

From this directory, edit `config/config.yaml` to point to real reads, then inspect the planned work:

```bash
snakemake -s workflow/Snakefile --configfile config/config.yaml --dry-run --cores 2
```

Run the same command without `--dry-run` only after FastQC and MultiQC are installed. Results are written to `results/fastqc/<sample>/` and `results/multiqc/multiqc_report.html`.

If an input path is absent, Snakemake should stop with `MissingInputException`; that diagnostic is intentional and does not create a QC report.

## Self-contained engineering smoke test

```bash
snakemake -s workflow/Snakefile --configfile config/smoke.yaml --cores 1
```

This writes only `results-smoke/smoke/ENGINEERING_TEST_ONLY.txt`. It invokes no bioinformatics tools, reads no sequencing data, and must never be interpreted as a scientific quality-control result.
