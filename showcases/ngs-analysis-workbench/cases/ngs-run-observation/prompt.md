# Observe a bounded local run timeline

Call `ngs-analysis-workbench.list_ngs_runs` and `ngs-analysis-workbench.list_ngs_run_lineages` with a bounded limit, retaining their exact arguments, responses, and timestamps in `outputs/run-history-receipt.json`. Then read the retained local JSONL state events in order, confirm that the terminal event is completed, and verify its records, bases, and Q30 values against the scientific output tables. Keep the empty Workbench history distinct from the completed local reference process.

Call `mcp__rosalind__rosalind_open` with a case-specific `task_context` and retain the exact launcher observation in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened.
