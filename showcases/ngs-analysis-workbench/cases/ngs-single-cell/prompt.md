# Single-cell RNA-seq workflow design

Design a FASTQ-to-count single-cell RNA-seq analysis with explicit chemistry, reference, cell-calling, and quality-review requirements.

Use the retained Workbench catalogue and runtime observations without claiming that reads, chemistry metadata, or matrices were inspected. Keep count generation, cell-level QC, annotation, and replicate-aware downstream comparisons as separately reviewed analyses.

Call `mcp__rosalind__rosalind_open` with the case-specific `task_context` retained in `outputs/rosalind-open-observation.json`. Preserve the exact response and timestamps, cite the observation from `outputs/provenance.json`, and state that the launcher call did not execute a Rosalind scientific job.
