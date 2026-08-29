---
name: structure-viewer
description: Open, inspect, analyze, and export molecular structure sessions with DSH-Rosalind.
---

# Molecular Structure Viewer

Open an authorized structure with `structure_open_from_chat` and inspect the active session with `structure_get_state`. Use current session state before reporting selections, residue numbering, chains, calculated properties, render status, or scene contents. Reuse a mounted session rather than opening a duplicate to move or change the display.

Use registered `structure_` operations for requested selection, analysis, scene styling, rendering, animation, and export. Preserve source identity, revision, model and chain selection, calculation parameters, scene state, and output artifact IDs. Export only when requested and only to an authorized destination.

Render and analysis jobs may be cancelled only with their exact active job identity and explicit user instruction. Do not turn an unavailable source, viewer, or service into an automatic provider substitution. Treat an unfinished render, an empty selection, or a visual scene as observation rather than structural proof.
