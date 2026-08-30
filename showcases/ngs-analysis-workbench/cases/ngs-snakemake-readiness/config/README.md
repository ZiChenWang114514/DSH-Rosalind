# Configuration

`config.json` points the retained minimal workflow to the two-record public FASTQ prefix. The output path is separate from the retained direct-reference result. A native dry run would use:

```text
snakemake --snakefile workflow/Snakefile --configfile config/config.json --cores 1 --dry-run
```

The configuration does not download data, install software, or alter the public fixture.
