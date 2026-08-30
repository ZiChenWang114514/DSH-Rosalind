# Bulk RNA-seq workflow design

Design a compact bulk RNA-seq counts-and-QC analysis while preserving sample design, reference identity, and reproducible workflow evidence.

Use the retained Workbench catalogue and runtime observations without claiming that reads, counts, or sample metadata were inspected. Keep quantification planning distinct from differential-expression testing, which requires an identifiable replicate-aware design and suitable count representation.

Call `mcp__rosalind__rosalind_open` with the case-specific `task_context` retained in `outputs/rosalind-open-observation.json`. Preserve the exact response and timestamps, cite the observation from `outputs/provenance.json`, and state that the launcher call did not execute a Rosalind scientific job.
