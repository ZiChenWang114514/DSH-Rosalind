# Codex showcase lesson: SSH compute target configuration

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `ngs-ssh-target` (SSH compute target configuration). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `ngs-ssh-target`
- Plugin: `ngs-analysis-workbench` (NGS Analysis Workbench v0.2.16)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `interface`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `ngs-compute.configure_ssh_target`, `ngs-compute.list_compute_targets`, `ngs-compute.inspect_compute_target`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `mcp__ngs_compute__configure_ssh_target`, `mcp__ngs_compute__list_compute_targets`, `mcp__ngs_compute__inspect_compute_target`, `OpenSSH for Windows`, `Docker CLI`, `mcp__rosalind__rosalind_open`
- Summary: How can nonsecret SSH and workspace references be registered for a remote target?
- Recorded next step: Repeat the OpenSSH BatchMode inspection and verify that only nonsecret host and workspace references appear in the registered target.
- Plugin guide: `showcases/ngs-analysis-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/README.md`
- case manifest: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/showcase.json`
- teaching prompt: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/prompt.md`
- input: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/inputs/ssh-probe-plan.md`
- output: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/outputs/ssh-target-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/outputs/remote-runtime.csv`
- output: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/outputs/ssh-probe.txt`
- output: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/outputs/configure-ssh-target-receipt.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/outputs/provenance.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/outputs/rosalind-open-observation.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/outputs/operation-evidence.json`
- output: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/outputs/session-bundle.md`
- preview: `showcases/ngs-analysis-workbench/cases/ngs-ssh-target/previews/preview.svg`

## Public sources

- https://www.openssh.com/
- installed-plugin://ngs-analysis-workbench/0.2.16/tool-contract
- installed-plugin://rosalind-workbench/tool-contract

## Retained case guide

# SSH compute target registration and inspection

![Saved SSH target inspection](../previews/preview.svg)

## Question

Can the authorized SSH compute target be registered through NGS Analysis Workbench, and what runtime facts remain after environment-specific connection fields are removed?

## Observed result

- OpenSSH BatchMode connected successfully with a 15-second timeout; no credential prompt was permitted.
- The remote platform reported Ubuntu 24.04.4 LTS, x86_64, 64 logical CPUs, 314.5 GiB of memory, and four NVIDIA GeForce RTX 4090 GPUs.
- Python 3.12.3, Java 21.0.12, Docker 29.3.0, and Git 2.43.0 were visible. The Docker server answered a read-only metadata query.
- Nextflow, Snakemake, FastQC, MultiQC, Samtools, `sbatch`, and `squeue` were not found on the noninteractive `PATH`; the Snakemake and MultiQC Python modules were also not runnable.
- `ngs-compute.configure_ssh_target` registered a case-owned target reference with the local-process executor and a temporary workspace reference.
- A post-registration inspection reached the target. The configured workspace did not yet exist, Python, Java, and Docker were ready, and Nextflow, Snakemake, FastQC, MultiQC, and Samtools were missing.

The exact safe arguments, response fields, timestamps, and omitted sensitive categories are retained in `outputs/configure-ssh-target-receipt.json`. The earlier sanitized probe remains in `outputs/ssh-target-observation.json`, and command availability is tabulated in `outputs/remote-runtime.csv`.

## Rosalind Workbench invocation

`mcp__rosalind__rosalind_open` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready: true`. The exact response and timestamps are retained in `outputs/rosalind-open-observation.json`. This operation opened only the task chooser; it does not show that a Rosalind scientific task, remote workflow, or computation was selected or executed.

## Interpretation

The target registration succeeded and the alias is now callable through Workbench. The missing temporary workspace and absent workflow controllers still prevent this observation from supporting a plan or engine run.

## Limitations

An unactivated environment may contain additional software. Scheduler workers, filesystem sharing, container images, references, task software, and input data were not tested. The public receipts omit credentials, private addresses, usernames, host fingerprints, and host-specific executable paths.

## Reproduce

Follow `inputs/ssh-probe-plan.md`, register only the case-owned target ID, and compare the safe response fields with `outputs/configure-ssh-target-receipt.json`. Do not broaden inspection to file, process, user, container, image, or environment-variable listings.

## 2026-08-30 operation evidence review

The current review retains only operations with explicit successful responses as capabilities. The case-specific machine-readable record is `outputs/operation-evidence.json`.

- Successful operations: `ngs-compute.configure_ssh_target`, `ngs-compute.list_compute_targets`, `ngs-compute.inspect_compute_target`.
- Failed operations: `mcp__ngs_compute__configure_ssh_target`.
- Operations not executed: none.
- SSH and runtime responses are stored without private device names, user paths, task identifiers, or credentials.

## Retained execution prompt

# Saved SSH target inspection

Inspect the authorized SSH compute target with a bounded, read-only BatchMode probe, then call `ngs-compute.configure_ssh_target` for a case-owned neutral target reference. Retain the exact non-identifying registration arguments, response fields, and timestamps in `outputs/configure-ssh-target-receipt.json`; omit aliases, credentials, private addresses, usernames, host fingerprints, host-specific executable paths, and environment-specific workspace paths. Inspect the registered target and state whether its temporary workspace and workflow controllers are available.

Call `mcp__rosalind__rosalind_open` for this case and retain its exact launcher response with UTC and local timestamps in `outputs/rosalind-open-observation.json`. State plainly that the operation opens only the Rosalind task chooser and provides no evidence that a scientific task ran.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
