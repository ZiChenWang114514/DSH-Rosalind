# Execute the transparent QC core locally

Inspect the local runtime. If neither Snakemake nor Nextflow is available, do not claim an engine or Workbench run. Execute the retained Python QC core directly on the 24-record public FASTQ fixture, preserve the command, exit code, output identities, and metrics, and label the Workbench execution lifecycle as rehearsed. Publish only the interpreter name and repository-relative paths; do not retain local absolute paths.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.
