# Codex showcase lesson: Runtime environment inspection

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `ngs-runtime-inspection` (Runtime environment inspection). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `ngs-runtime-inspection`
- Plugin: `ngs-analysis-workbench` (NGS Analysis Workbench v0.2.16)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `multi-tool-result`
- Covered operations: `ngs-analysis-workbench.get_runtime_environment`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `mcp__ngs_analysis_workbench__get_runtime_environment`, `OpenSSH for Windows`, `mcp__rosalind__rosalind_open`
- Summary: Which executables and environment facts are available on the selected target?
- Recorded next step: Compare the Workbench runtime snapshot with the sanitized remote PATH and Docker availability observations.
- Plugin guide: `showcases/ngs-analysis-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/README.md`
- case manifest: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/showcase.json`
- teaching prompt: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/prompt.md`
- input: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/inputs/runtime-inspection-method.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/outputs/runtime-environment.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/outputs/runtime-comparison.csv`
- output: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/outputs/runtime-probe.txt`
- output: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/outputs/rosalind-open-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/outputs/operation-evidence.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/outputs/session-bundle.md`
- preview: `showcases/ngs-analysis-workbench/cases/ngs-runtime-inspection/previews/preview.svg`

## Public sources

- installed-plugin://ngs-analysis-workbench/0.2.16/tool-contract
- installed-plugin://rosalind-workbench/tool-contract
- https://www.nextflow.io/docs/latest/
- https://snakemake.readthedocs.io/

## Retained case guide

# Runtime environment inspection

![Runtime environment inspection](../previews/preview.svg)

## Question

Which workflow controllers and supporting runtimes are visible on the current local controller and the authorized SSH compute target?

## Local Workbench snapshot

The server-authored local snapshot identified Windows amd64 with Java 21.0.12.1, Docker client 29.7.2, Conda 25.11.1, and Mamba 0.11.3. Nextflow and Snakemake were missing, no compatible controller candidate was returned, and the Docker client could not reach its server. Thirteen managed environments were scanned, with no compatible managed controller found.

## Authorized SSH compute target

After repair, the registered Linux SSH target exposed Python 3.12.3, Java 21.0.12, Nextflow 26.04.6, Snakemake 9.26.0, Micromamba 2.9.0, and Docker 29.7.2. Workbench confirmed two active host-path controller candidates and a reachable local Linux Docker daemon. A cached `hello-world` container completed with exit code 0; environment-specific connection identifiers are not retained.

## Rosalind Workbench invocation

`mcp__rosalind__rosalind_open` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true`. The exact response and timestamps are retained in `outputs/rosalind-open-observation.json`. This operation opened only the task chooser; it does not show that a Rosalind scientific task, runtime inspection, or computation was selected or executed.

## Interpretation

The Windows controller remains unsuitable for direct workflow execution, while the repaired Linux SSH target supplies both workflow controllers and a reachable Docker daemon. A fresh runtime snapshot is still required before each later readiness or planning attempt because snapshot identities expire quickly.

## Limitations

The Workbench snapshot did not exhaustively search unactivated environments. The Docker smoke test used only the public `hello-world` image; no scientific container image or task-software stack was resolved by Workbench.

## Reproduce

1. Call `ngs-analysis-workbench.get_runtime_environment(target_id="local")`.
2. Call it for registered SSH targets and retain any reachability error.
3. When authorized, run the bounded SSH probe from `inputs/runtime-inspection-method.md`.
4. Compare `outputs/runtime-environment.json` and `outputs/runtime-comparison.csv`, treating `missing` as scoped to the observed command context.

## 2026-08-30 operation evidence review

The current review retains only operations with explicit successful responses as capabilities. The case-specific machine-readable record is `outputs/operation-evidence.json`.

- Successful operations: `ngs-analysis-workbench.get_runtime_environment`.
- Failed operations: none.
- Operations not executed: none.
- SSH and runtime responses are stored without private device names, user paths, task identifiers, or credentials.

## Retained execution prompt

# Runtime environment inspection

Inspect the current local Workbench runtime and compare it with the runtime visible through the authorized SSH compute target. Report command state, versions, Docker server reachability, controller candidates, and inspection limitations without claiming workflow readiness. Use neutral public labels and omit aliases, usernames, addresses, fingerprints, and environment-specific paths.

Call `mcp__rosalind__rosalind_open` for this case and retain its exact launcher response with UTC and local timestamps in `outputs/rosalind-open-observation.json`. State plainly that the operation opens only the Rosalind task chooser and provides no evidence that a scientific task ran.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
