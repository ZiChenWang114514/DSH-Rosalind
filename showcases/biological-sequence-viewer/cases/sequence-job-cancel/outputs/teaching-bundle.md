# Codex showcase lesson: Sequence job cancellation

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `sequence-job-cancel` (Sequence job cancellation). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `sequence-job-cancel`
- Plugin: `biological-sequence-viewer` (Biological Sequence & Alignment Viewer v0.1.43)
- Status: `ready`
- Domain: `structure-and-sequence`
- Case type: `recovery`
- Difficulty: `intermediate`
- Evidence level: `computed-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Rosalind Workbench mcp__rosalind__rosalind_open`, `UniProt REST and local Python subprocess`, `Biological Sequence & Alignment Viewer 0.1.43 diagnostic attempts recorded in outputs/viewer-operation-evidence.json`
- Summary: How can a disposable analysis job be cancelled and its status inspected?
- Recorded next step: Launch the disposable KRAS-window analysis, cancel it, and compare the retained pre-cancel and terminal-state records.
- Plugin guide: `showcases/biological-sequence-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/README.md`
- case manifest: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/showcase.json`
- teaching prompt: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/prompt.md`
- input: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/build_case.py`
- input: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/inputs/public-source.md`
- input: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/inputs/P01116.fasta`
- input: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/inputs/source-provenance.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/outputs/pre-cancel-state.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/outputs/post-cancel-state.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/outputs/cancellation-receipt.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/outputs/rosalind-open-observation.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/outputs/teaching-bundle.md`
- output: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/outputs/viewer-operation-evidence.json`
- preview: `showcases/biological-sequence-viewer/cases/sequence-job-cancel/previews/preview.svg`

## Public sources

- https://rest.uniprot.org/uniprotkb/P01116.fasta

## Retained case guide

# Safe cancellation of a local KRAS analysis job

![Cancellation state transition](../previews/preview.svg)

## Scientific question

Can a running sequence calculation be stopped without changing its source or leaving a partial result that could be mistaken for a completed analysis?

## Source observations

- The source is reviewed human KRAS `P01116`, sequence version 1, acquired from the official UniProtKB FASTA endpoint.
- The 269-byte FASTA contains one 189-residue sequence and is retained with a Codex-authored provenance record.

## Executed local cancellation

`build_case.py` starts a Python subprocess inside a temporary directory. The child computes the first 32 of 181 possible 9-residue sliding windows, writes a temporary partial table, records a running state, and waits. The parent observes that state, terminates the child, removes the temporary directory, verifies that no completed output exists, and checks that the source digest is unchanged.

The exact source-independent state is retained in:

- `outputs/pre-cancel-state.json`
- `outputs/post-cancel-state.json`
- `outputs/cancellation-receipt.json`

## Viewer workflow status

The local subprocess termination was actually executed. No successful Viewer analysis, cancellation, or job-query response was found, so those operations are not listed as case capabilities.

## Observed Rosalind Workbench invocation

`mcp__rosalind__rosalind_open` was actually invoked for this case at `2026-08-29T17:59:09.785Z` (`2026-08-30T01:59:09+08:00`). Its exact message was `Rosalind Workbench is ready. Choose a research task in the app.` and the returned launcher state had `ready=true`. The required case-specific record is `outputs/rosalind-open-observation.json`. This operation only opens the Rosalind task chooser and does not prove scientific task execution; the local subprocess state files remain the scientific evidence for cancellation.

## Interpretation

This case demonstrates a conservative cancellation property for a disposable local calculation: the source remains unchanged, the partial workspace is removed, and no final artifact is presented. It does not establish the behavior of a mounted Sequence Viewer job.

## Limitations

- The local 9-residue hydrophobic-count scan is a small teaching calculation, not a biological prediction.
- Operating-system process termination is tested through Python's `terminate()` method; the receipt intentionally omits process IDs, temporary paths, and wall-clock timing.
- Sequence Viewer cancellation remains unexecuted until repeated against an exact running viewer job ID.
- The observed Rosalind response confirms only task-chooser readiness; it contains no scientific job or result.

## Exact reproduction

From the repository root:

```powershell
python showcases/biological-sequence-viewer/cases/sequence-job-cancel/build_case.py
python scripts/showcase_session.py bundle sequence-job-cancel
```

The build exits only after it has observed the pre-cancel files, stopped the child, removed the temporary directory, verified source identity, regenerated the SVG, and refreshed manifest byte counts and digests.

## Viewer operation review (2026-08-30)

No Sequence Viewer operation is recorded as successful. Server sessions were created for the relevant local public files, but subsequent queries or controls were not acknowledged. `outputs/viewer-operation-evidence.json` separates failed calls from actions that were not attempted after the prerequisite confirmation failed. It omits session identifiers, private paths, and internal resource URIs.

## Retained execution prompt

# Safe cancellation of a local KRAS analysis job

Using the versioned public KRAS `P01116` FASTA, run a disposable 9-residue window calculation in a temporary local subprocess. Capture the running state, stop the process after 32 of 181 windows, remove partial files, verify that no final output exists and that the source digest is unchanged, and retain explicit pre- and post-cancel records. Invoke `mcp__rosalind__rosalind_open` once, retain the exact task-chooser response with UTC and local timestamps in `outputs/rosalind-open-observation.json`, and state that it does not prove a Rosalind scientific run. Treat Sequence Viewer job operations as rehearsed unless a mounted viewer supplies a running job ID.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
