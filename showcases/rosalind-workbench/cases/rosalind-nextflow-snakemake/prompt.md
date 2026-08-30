# Nextflow and Snakemake comparison

Represent the same seven-field FASTQ quality computation in Nextflow DSL2 and Snakemake using one shared `qc_core.py`. Check local engine availability, run the shared computation directly on the retained 500-read public subset, and keep planned engine outputs clearly separate from executed results. Inspect `outputs/rosalind-open-observation.json` as the genuine chooser-readiness record; it is independent of both the direct QC calculation and workflow-engine execution status.
