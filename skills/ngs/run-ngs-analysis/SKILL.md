---
name: run-ngs-analysis
description: Prepare, authorize, observe, cancel, and interpret an NGS workflow run.
---

# Run NGS Analysis

Inspect registered compute targets with `ngs_list_compute_targets`, `ngs_inspect_compute_target`, and `ngs_get_runtime_environment`. Inspect candidate workflows and their exact revisions before selection. Discovery, catalog inspection, and readiness checks do not authorize installation, downloads, setup hooks, workflow execution, or a dry run.

After a user-selected workflow is available, use `ngs_check_nextflow_readiness` or `ngs_check_snakemake_readiness`, then create a matching plan with `ngs_plan_nextflow` or `ngs_plan_snakemake`. Preserve target, absolute run directory, workflow revision, inputs, reference material, configuration, samplesheet, and preparation records. Keep unknown requirements distinct from missing ones.

Call `ngs_execute_plan` only with the exact identity returned by the planner. The host-native approval request is the only authorization for preparation and execution; prose or a structured prompt cannot authorize it. After a denial, wait for a new user request. Do not change service, compute target, workflow, or revision silently when a selected option is unavailable.

After start, retain `registry_run_id`, target, and run directory. Read the current in-process run record with `ngs_get_ngs_run`, then observe with `ngs_observe_ngs_run` until a terminal state. This record remains available only while the current DSH plugin instance is running; keep external workflow outputs in the declared run directory. Use `ngs_cancel_ngs_run` only when the user explicitly requests cancellation and with the exact run identity. Do not start another run after an unavailable observation or cancellation.

For completed, partial, failed, cancelled, or orphaned work, inspect actual outputs and logs before interpretation. Record workflow, sample, method, configuration, reference, run, result, and failure provenance. Write the requested analysis summary through `ngs_update_ngs_run_analysis_summary`; a status page or file list alone is not a scientific conclusion.
