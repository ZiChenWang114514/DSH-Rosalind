---
name: biological-sequence-viewer
description: Open and inspect biological sequence, alignment, annotation, and sequencing artifacts with DSH-Rosalind.
---

# Biological Sequence and Alignment Viewer

## When to use

Use this Skill when the user wants to open, inspect, analyze, safely edit, or export an authorized local FASTA, FASTQ, GenBank, EMBL, alignment, chromatogram, or SnapGene artifact. Fixed reference: `sequence-viewer-0.1.43/skills/biological-sequence-viewer/SKILL.md`. The DSH mapping preserves the fixed-version workflow and uses DSH-Rosalind's registered tools.

## Tool call sequence

1. Resolve one authorized local path and call `sequence_open_from_chat` with that exact path.
2. Read `sequence_query_viewer` using the returned session identity before answering questions about records, coordinates, selection, metrics, or visible tracks.
3. Use `sequence_control_viewer` for the existing session; `sequence_run_analysis` only for a requested translation, QC, distance/tree, or alignment analysis.
4. Use `sequence_edit_copy` and `sequence_export_artifact` only after the user asks to create a copy or output.

## Success and viewer state

Opening confirms session creation, not an already-rendered visual. Report live viewer state, including coordinate conventions and current reference, after a successful state query. Keep the current card/session when moving the viewer to the side pane instead of opening a duplicate.

## Failure, authorization, and cancellation

An unavailable, changed, or unauthorized file must be reported with its diagnostic; do not guess a new source. Use `sequence_cancel_job` only for the exact running job requested by the user. Exports and edits need the host approval for their target path; a cancelled job is never automatically restarted.

## Provenance

Keep source path and revision, viewer session, selected records and coordinate basis, analysis arguments, job/result identifiers, annotation qualifiers, and exported artifact path. A viewer selection alone is not a biological interpretation.
