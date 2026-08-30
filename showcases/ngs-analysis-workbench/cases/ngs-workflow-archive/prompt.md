# Archive and restore a disposable workflow

Archive only the case-created workflow `showcase_fastq_qc_lifecycle_20260830`, confirm its archived state with `list_workflows(include_archived=true)`, restore it immediately, and confirm that version 2 and its source digest were preserved. Never archive another workflow.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.
