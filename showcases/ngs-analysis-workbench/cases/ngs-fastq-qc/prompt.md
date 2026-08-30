# FASTQ QC workflow readiness

Assess paired FASTQ integrity, per-base quality, adapter evidence, and whether trimming is scientifically justified.

Use the retained Workbench catalogue and runtime observations without claiming that FASTQ files were inspected or that a workflow ran. Keep the assay-aware plan distinct from unavailable QC results.

Call `mcp__rosalind__rosalind_open` with the case-specific `task_context` retained in `outputs/rosalind-open-observation.json`. Preserve the exact response and timestamps, cite the observation from `outputs/provenance.json`, and state that the launcher call did not execute a Rosalind scientific job.
