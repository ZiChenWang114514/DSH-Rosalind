# Disposable run cancellation

Demonstrate local cancellation only with the case-owned Python child created by `scripts/run_cancellation_demo.py`. Retain its running state, cancellation request, terminal process state, stopped-child check, and temporary-directory cleanup in `outputs/cancellation-observation.json`. Separately call `ngs-analysis-workbench.cancel_ngs_run` only for the reserved temporary verification identity or a genuinely registered temporary run created for this case. Preserve exact arguments, response, and timestamps in `outputs/cancel-ngs-run-receipt.json`, and state plainly whether any registered run was affected.

Call `mcp__rosalind__rosalind_open` with the case-specific `task_context` retained in `outputs/rosalind-open-observation.json`. Preserve the exact response and timestamps, cite the observation from `outputs/provenance.json`, and state that the launcher call did not start or cancel a Rosalind scientific job.
