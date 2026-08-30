---
name: slide-viewer
description: Open, inspect, analyze, and export slide and spatial data with DSH-Rosalind.
---

# Slide Viewer

## When to use

Use this Skill when an authorized whole-slide, OME, DICOM, spatial-expression, annotation, segmentation, or pathology workflow source needs inspection or analysis. Fixed reference: `slide-viewer-0.1.56/skills/slide-viewer/SKILL.md`. The DSH mapping preserves the fixed-version workflow and uses DSH-Rosalind's registered tools.

## Tool call sequence

1. Open the authorized source with the appropriate `slide_open_*` tool, then call `slide_get_viewer_state` before reporting viewport, region, layer, annotation, measurement, or workflow state.
2. Reuse the session through `slide_control_viewer`; use `slide_list_scientific_layers`, `slide_query_scientific_layer`, and `slide_get_scientific_entity` for source-backed data.
3. Start `slide_run_analysis_from_chat`, `slide_run_pathology`, or `slide_run_workflow` only for the requested method; monitor with `slide_get_workflow` or `slide_get_pathology` and read a named artifact with `slide_read_workflow_artifact`.

## Success and viewer state

Viewer state establishes source revision and selected regions/layers. Present spatial or pathology results only after the matching job/result artifact is available and identify any model or method version.

## Failure, authorization, and cancellation

Source authorization, imports, and file writes follow the host approval flow. Use `slide_cancel_workflow` or `slide_cancel_pathology` only for the exact active identity; resume only with `slide_resume_workflow` or `slide_resume_pathology` when the recorded job allows it. Do not choose a different source or service automatically.

## Provenance

Keep source/revision, session, visible region and geometry, selected matrix/gene/layer, analysis or pathology request, model/method version, job identity, artifact IDs, and limitations.
