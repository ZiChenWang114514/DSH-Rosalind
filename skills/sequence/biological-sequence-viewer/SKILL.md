---
name: biological-sequence-viewer
description: Open and inspect biological sequence, alignment, annotation, and sequencing artifacts with DSH-Rosalind.
---

# Biological Sequence and Alignment Viewer

Use `sequence_open_from_chat` with an exact authorized local path to create a viewer session. A successful call creates a session but does not prove that the viewer has rendered. Read current state with `sequence_query_viewer` before reporting selection, coordinates, records, metrics, or analysis results.

For an existing viewer card, reuse its session with `sequence_control_viewer`; use its display-mode action to move it to the side pane rather than opening a duplicate. Use `sequence_run_analysis` only for a requested analysis and retain its inputs, selected records, coordinate convention, method, and result identifiers. Use `sequence_cancel_job` only for the exact running job the user asks to stop.

Edits and exports require explicit user intent. Use `sequence_export_artifact` for requested outputs, keep private artifacts private unless an authorized destination is confirmed, and identify the saved artifact and its source revision. Page record, feature, chromatogram, and alignment queries rather than inferring undisplayed content. Preserve imported annotation qualifiers and coordinate provenance.

Do not read raw file bytes merely to open the viewer, do not claim an unsupported viewer comparison, and do not repeat a cancelled action automatically. Record source identity, revision, viewer session, analysis parameters, and generated artifact IDs in scientific reporting.
