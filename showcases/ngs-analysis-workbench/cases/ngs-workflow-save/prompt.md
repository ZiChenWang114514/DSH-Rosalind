# Save a transparent FASTQ QC workflow

Using the retained public FASTQ fixture and version 1 workflow files, register the new case-owned workflow `showcase_fastq_qc_lifecycle_20260830` in NGS Analysis Workbench without starting a run. Record the returned workflow version and source digest.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.
