---
name: slide-viewer
description: Open, inspect, analyze, and export slide and spatial data with DSH-Rosalind.
---

# Slide Viewer

Open an authorized slide or spatial source, then use `slide_get_viewer_state` before stating viewport, selected region, layer, annotation, measurement, or workflow status. Reuse the current session with `slide_control_viewer` for display changes instead of opening another viewer.

Use `slide_query_scientific_layer`, `slide_list_scientific_layers`, and `slide_get_scientific_entity` for paged source-backed queries. Use `slide_run_analysis_from_chat` or `slide_run_pathology` only for a requested workflow. Read progress with `slide_get_workflow` or `slide_get_pathology`; use `slide_read_workflow_artifact` for an identified result.

Only explicit user intent permits stopping work: use `slide_cancel_workflow` or `slide_cancel_pathology` with the exact active identity. Use `slide_resume_workflow` or `slide_resume_pathology` only when the recorded workflow supports resumption. Preserve source revision, selected region, parameters, model or method version, workflow identity, generated artifact identifiers, and result limitations. Do not automatically switch to another source or analysis service when a requested service is unavailable.
