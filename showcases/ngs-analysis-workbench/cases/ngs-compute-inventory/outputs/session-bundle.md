# Codex showcase lesson: Compute target inventory

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `ngs-compute-inventory` (Compute target inventory). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `ngs-compute-inventory`
- Plugin: `ngs-analysis-workbench` (NGS Analysis Workbench v0.2.16)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `interface`
- Difficulty: `intermediate`
- Evidence level: `multi-tool-result`
- Covered operations: `ngs-compute.list_compute_targets`, `ngs-compute.inspect_compute_target`, `ngs-analysis-workbench.get_runtime_environment`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `mcp__ngs_compute__list_compute_targets`, `mcp__ngs_compute__inspect_compute_target`, `mcp__ngs_analysis_workbench__get_runtime_environment`, `OpenSSH for Windows`, `mcp__rosalind__rosalind_open`
- Summary: Which local and SSH compute targets are registered and inspectable?
- Recorded next step: Refresh the local and SSH target inventory, then compare the recorded runtime facts and bounded OpenSSH observations.
- Plugin guide: `showcases/ngs-analysis-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/README.md`
- case manifest: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/showcase.json`
- teaching prompt: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/prompt.md`
- input: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/inputs/inventory-method.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/outputs/compute-target-inventory.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/outputs/target-status.csv`
- output: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/outputs/inspection-notes.txt`
- output: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/outputs/rosalind-open-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/outputs/operation-evidence.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/outputs/session-bundle.md`
- preview: `showcases/ngs-analysis-workbench/cases/ngs-compute-inventory/previews/preview.svg`

## Public sources

- installed-plugin://ngs-analysis-workbench/0.2.16/tool-contract
- installed-plugin://rosalind-workbench/tool-contract
- https://www.openssh.com/

## Retained case guide

# Compute target inventory

![Compute target inventory](../previews/preview.svg)

## Question

Which local and SSH compute contexts are currently visible, registered, and inspectable for NGS work?

## Observed inventory

- NGS Analysis Workbench listed three registered contexts: the local controller, one previously registered SSH context, and the authorized SSH compute target used for this verification.
- The local runtime snapshot completed on Windows amd64.
- The registered WSL SSH target could not be reached during inspection.
- The authorized SSH compute target accepted a read-only BatchMode probe, was registered successfully, and was reached by bounded Workbench inspection.
- The registration created only a nonsecret target reference. No workspace, workflow plan, or workflow run was created.

`outputs/compute-target-inventory.json` preserves the structured inventory, `outputs/target-status.csv` supports direct comparison, and `outputs/inspection-notes.txt` records the attempted operations.

## Rosalind Workbench invocation

`mcp__rosalind__rosalind_open` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true`. The exact response and timestamps are retained in `outputs/rosalind-open-observation.json`. This operation opened only the task chooser; it does not show that a Rosalind scientific task, NGS workflow, or computation was selected or executed.

## Interpretation

The local controller and the newly registered authorized SSH compute target both have bounded runtime observations. The earlier registered SSH context remains unavailable in this observation. The authorized target still lacks Snakemake and Nextflow, so registration alone does not support workflow execution.

## Limitations

The inventory establishes registration and bounded reachability only. It does not establish engine, workflow, task-software, scheduler-worker, shared-filesystem, or scientific readiness.

## Reproduce

1. Run `ngs-compute.list_compute_targets` and retain only nonsecret target metadata.
2. Run `ngs-analysis-workbench.get_runtime_environment` for `local`.
3. Attempt `ngs-compute.inspect_compute_target` for registered SSH targets.
4. Probe the authorized SSH compute target with BatchMode and a short timeout, omitting aliases and identifying connection fields from the retained output.
5. Compare the new observations with the dated JSON and CSV files.

## 2026-08-30 operation evidence review

The current review retains only operations with explicit successful responses as capabilities. The case-specific machine-readable record is `outputs/operation-evidence.json`.

- Successful operations: `ngs-compute.list_compute_targets`, `ngs-compute.inspect_compute_target`, `ngs-analysis-workbench.get_runtime_environment`.
- Failed operations: none.
- Operations not executed: none.
- SSH and runtime responses are stored without private device names, user paths, task identifiers, or credentials.

## Retained execution prompt

# Compute target inventory

Inventory the compute contexts visible to NGS Analysis Workbench and compare them with the authorized SSH compute target. Report registration, reachability, runtime observation, and workflow readiness as distinct facts. Use neutral labels and do not retain aliases, hostnames, usernames, addresses, fingerprints, SSH configuration, or credentials.

Call `mcp__rosalind__rosalind_open` for this case and retain its exact launcher response with UTC and local timestamps in `outputs/rosalind-open-observation.json`. State plainly that the operation opens only the Rosalind task chooser and provides no evidence that a scientific task ran.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
