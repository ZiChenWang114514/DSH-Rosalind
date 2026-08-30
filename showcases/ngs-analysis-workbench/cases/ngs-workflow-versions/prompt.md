# Compare and activate workflow versions

Update the case-owned workflow `showcase_fastq_qc_lifecycle_20260830` from version 1 to the retained version 2 definition. Inspect the unified diff, list both immutable Workbench versions, activate version 1 once, and restore version 2 as the final active version. Do not start a run.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.
