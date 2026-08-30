# Rosalind genomics launcher

![Rosalind genomics launcher](previews/rosalind-genomics.svg)

## Observed interface state

Rosalind Workbench returned schema `life-sciences.launcher/v1`, reported `ready: true`, and displayed its launcher. The visible scientific areas included molecular design, structure analysis, genomics, and scientific compute.

## Retained data and replay route

Reproduce opens the genomics area, then passes the shared three-row human RAS alignment to the local Sequence service and recomputes alignment metrics. Replay includes the retained RAS metrics and exploratory neighbor-joining tree from `sequence-ras-alignment`.

## Limitation

The original launcher observation did not expose the underlying task list or task descriptions. The RAS tree uses uncorrected p-distance and has no substitution model or support assessment.
