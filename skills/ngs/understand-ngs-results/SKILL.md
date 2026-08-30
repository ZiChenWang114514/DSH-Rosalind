---
name: understand-ngs-results
description: Interpret observed NGS outputs and execution history without inventing unsupported claims.
---

# Understand NGS Results

## When to use

Use this Skill when the user needs to interpret completed, partial, failed, cancelled, or historical NGS output. Fixed reference: `ngs-analysis-workbench-0.2.16/skills/understand-ngs-results/SKILL.md`. The DSH mapping preserves the fixed-version workflow and uses DSH-Rosalind's registered tools.

## Tool call sequence

1. Call `ngs_get_ngs_run` using the exact registry_run_id and read `ngs_observe_ngs_run` for the current lifecycle.
2. Inspect only declared output paths, logs, configuration, workflow revision, reference, and result projection relevant to the question.
3. Write `ngs_update_ngs_run_analysis_summary` with observed findings, limitations, and the next permitted action.

## Success and viewer state

The result summary connects the question, assay, method, verified artifacts, findings, and limitations. A terminal run state is still insufficient without examining the stated outputs.

## Failure, authorization, and cancellation

Do not re-run a workflow merely to obtain an interpretation. Preserve partial, failed, cancelled, or orphaned states and their diagnostics; cancellation applies only to a currently running exact registry_run_id.

## Provenance

Record registry_run_id, workflow revision, target, run directory, configuration and reference hashes, logs, inspected artifact paths, and the summary revision.
