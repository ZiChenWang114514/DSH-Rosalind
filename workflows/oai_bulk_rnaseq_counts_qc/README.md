# oai_bulk_rnaseq_counts_qc

`oai_bulk_rnaseq_counts_qc` performs FastQC on paired reads, quantifies transcripts with Salmon, exports the Salmon `NumReads` field into a transcript-by-sample TSV, and creates a combined MultiQC report. The TSV contains transcript-level estimated read counts; it is not a gene-level differential-expression result.

## Requirements

- Snakemake 8 or later on Linux or a compatible container
- `fastqc`, `salmon`, and `multiqc` on `PATH`
- A prebuilt Salmon transcriptome index and paired FASTQ files

The `library_type` values are passed directly to Salmon. Confirm them against the library preparation before execution.

## Run the scientific workflow

Edit `config/config.yaml` with actual paired reads and the Salmon index, then run from this directory:

```bash
snakemake -s workflow/Snakefile --configfile config/config.yaml --dry-run --cores 4
snakemake -s workflow/Snakefile --configfile config/config.yaml --cores 4
```

Normal outputs are `results/salmon/<sample>/quant.sf`, `results/counts/transcript_read_counts.tsv`, and `results/multiqc/multiqc_report.html`. Missing reads or an absent Salmon index produce Snakemake's `MissingInputException`; the workflow does not write substitute quantification or count files.

## Self-contained engineering smoke test

```bash
snakemake -s workflow/Snakefile --configfile config/smoke.yaml --cores 1
```

The smoke configuration emits only `results-smoke/smoke/ENGINEERING_TEST_ONLY.txt`. It does not invoke FastQC, Salmon, or MultiQC and does not represent RNA-seq processing.
