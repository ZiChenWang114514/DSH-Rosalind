# oai_scrnaseq_fastq_to_count

`oai_scrnaseq_fastq_to_count` accepts 10x-style paired reads, runs FastQC, and uses STARsolo to write a filtered gene-count matrix. In the supplied configuration, R1 is the barcode/UMI read and R2 is the cDNA read; change the read paths or STARsolo coordinates for another chemistry.

## Requirements

- Snakemake 8 or later on Linux or a compatible container
- `fastqc`, `STAR`, and `multiqc` on `PATH`
- A STAR genome index, a STARsolo barcode whitelist, and paired gzipped FASTQ files

`read_files_command: zcat` is appropriate for gzipped reads. Set it to the command required by your source data before an actual run. The barcode and UMI coordinates are passed directly to STARsolo and must be confirmed for the chosen assay.

## Run the scientific workflow

Edit `config/config.yaml`, then execute from this directory:

```bash
snakemake -s workflow/Snakefile --configfile config/config.yaml --dry-run --cores 8
snakemake -s workflow/Snakefile --configfile config/config.yaml --cores 8
```

The workflow creates `results/starsolo/<sample>/Solo.out/Gene/filtered/` with `matrix.mtx`, `barcodes.tsv`, and `features.tsv`, plus `results/multiqc/multiqc_report.html`. Missing FASTQ, reference index, or whitelist paths remain visible as a Snakemake `MissingInputException`; no count matrix is fabricated.

## Self-contained engineering smoke test

```bash
snakemake -s workflow/Snakefile --configfile config/smoke.yaml --cores 1
```

Only `results-smoke/smoke/ENGINEERING_TEST_ONLY.txt` is created in smoke mode. It contains no sequence reads, alignment, barcode processing, or count matrix.
