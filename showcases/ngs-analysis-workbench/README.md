# NGS Analysis Workbench

Version tracked by this framework: `0.2.16`.

## Ready showcases

1. `ngs-fastq-qc` — live workflow discovery, QC design, and runtime-readiness evidence.
2. `ngs-bulk-rnaseq` — study-design-aware counts-and-QC plan with workflow provenance.
3. `ngs-single-cell` — chemistry-aware FASTQ-to-count plan with workflow provenance.

The current packages truthfully record that no workflow was executed: the local target lacked a runnable Snakemake setup, the Docker daemon was unavailable, and the configured Ubuntu target could not be reached. Each case separates observed workflow/runtime evidence from unavailable QC and biological results.
