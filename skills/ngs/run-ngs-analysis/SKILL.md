---
name: run-ngs-analysis
description: Prepare, authorize, observe, cancel, and interpret an NGS workflow run.
---

# Run NGS Analysis

## When to use

Use this Skill when a user has selected a concrete Nextflow or Snakemake workflow and wants a compute-ready, observable execution. Fixed reference: `ngs-analysis-workbench-0.2.16/skills/run-ngs-analysis/SKILL.md`. The DSH mapping preserves the fixed-version workflow and uses DSH-Rosalind's registered tools.

## Tool call sequence

1. Inspect `ngs_list_compute_targets`, `ngs_inspect_compute_target`, `ngs_get_runtime_environment`, the workflow, and its exact revision.
2. Call `ngs_check_nextflow_readiness` or `ngs_check_snakemake_readiness`, then create the matching `ngs_plan_nextflow` or `ngs_plan_snakemake` using target, run directory, inputs, references, and configuration.
3. Call `ngs_execute_plan` only with the exact plan_id, plan_name, and plan_checksum returned by that planner.
4. Read `ngs_get_ngs_run`, observe with `ngs_observe_ngs_run`, then write an interpretation using `ngs_update_ngs_run_analysis_summary` only after examining outputs and logs.

## Success and viewer state

The run record provides registry_run_id, workflow revision, target, run directory, lifecycle, outputs, and execution evidence. Only completed verified outputs support a scientific conclusion; partial, failed, cancelled, and orphaned runs retain their distinct states.

## Failure, authorization, and cancellation

Readiness and planning do not authorize setup or execution. `ngs_execute_plan` requires host approval for the exact plan. On denial or unavailable compute, retain diagnostics and wait for a user-directed change. Use `ngs_cancel_ngs_run` only for the specified registry_run_id; do not automatically restart a cancelled run.

## Provenance

Keep workflow/revision, target, run directory, plan checksum, inputs, reference, configuration, preparation, registry_run_id, observation logs, artifacts, and result limitations together.
