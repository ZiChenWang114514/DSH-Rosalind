---
name: structure-viewer
description: Open, inspect, analyze, and export molecular structure sessions with DSH-Rosalind.
---

# Molecular Structure Viewer

## When to use

Use this Skill when an authorized molecular structure needs visual inspection, selection, measurement, analysis, comparison, scene work, rendering, or export. Fixed reference: `structure-viewer-0.1.80/skills/structure-viewer/SKILL.md`. The DSH mapping preserves the fixed-version workflow and uses DSH-Rosalind's registered tools.

## Tool call sequence

1. Call `structure_open_from_chat` with one authorized structure path, then read `structure_get_state` before reporting atoms, residues, chains, selections, objects, or render state.
2. Reuse the session with `structure_control_viewer`, `structure_query`, `structure_analyze`, `structure_measure`, or `structure_align_structures` as requested.
3. Use scene, render, animation, and export tools only for the specific requested output.

## Success and viewer state

Report a viewer as ready only from the returned live state. Measurements and analyses retain their method and parameters; a rendered scene or empty selection is an observation, not structural proof.

## Failure, authorization, and cancellation

Keep source, renderer, and analysis diagnostics explicit. Cancel a render only via `structure_cancel_render` with its exact job identity and explicit user request. `structure_export` needs host approval; do not substitute a viewer or external service when one is unavailable.

## Provenance

Keep source/revision, session, object/model/chain selection, selection expression, analysis method/parameters, scene revision, render job, and output artifact IDs.
