# Codex showcase lesson: CMU-1 whole-slide source and pyramid

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `slide-tissue-architecture` (CMU-1 whole-slide source and pyramid). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `slide-tissue-architecture`
- Plugin: `slide-viewer` (Slide Viewer v0.1.56)
- Status: `ready`
- Summary: Verify a pinned CC0 Aperio slide and its multiresolution TIFF structure.
- Recorded next step: Open the case README to inspect the verified source, pyramid metadata, and viewer execution status.
- Plugin guide: `showcases/slide-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/slide-viewer/cases/slide-tissue-architecture/README.md`
- case manifest: `showcases/slide-viewer/cases/slide-tissue-architecture/showcase.json`
- teaching prompt: `showcases/slide-viewer/cases/slide-tissue-architecture/prompt.md`
- output: `showcases/slide-viewer/cases/slide-tissue-architecture/outputs/source-provenance.json`
- output: `showcases/slide-viewer/cases/slide-tissue-architecture/outputs/pyramid-metadata.json`
- output: `showcases/slide-viewer/cases/slide-tissue-architecture/outputs/viewer-state-receipt.json`
- output: `showcases/slide-viewer/cases/slide-tissue-architecture/outputs/rosalind-open-observation.json`
- output: `showcases/slide-viewer/cases/slide-tissue-architecture/outputs/teaching-bundle.md`
- preview: `showcases/slide-viewer/cases/slide-tissue-architecture/previews/tissue-architecture.svg`

## Public sources

- https://openslide.cs.cmu.edu/download/openslide-testdata/Aperio/CMU-1-JP2K-33005.svs
- https://openslide.cs.cmu.edu/download/openslide-testdata/index.json

## Retained case guide

# CMU-1 source, pyramid, and viewer state

![CMU-1 source and state summary](previews/tissue-architecture.svg)

## Scientific question

Can the pinned CC0 CMU-1 slide be verified and its pyramid described independently of whether the current viewer mounts and renders it?

## Source observations

- The local ignored copy matches OpenSlide's published 132,565,343 bytes and SHA-256 `9a1923cd9bcb260ba4d99d64f8d6e32550648c332ba48817f920662f3a513420`.
- `tiffinfo 4.7.1` reports a 46,000 × 32,893 tiled RGB main image, 240 × 240 tiles, 20× objective metadata, and 0.499 µm/pixel metadata.
- Two reduced whole-slide TIFF directories measure 11,500 × 8,223 and 2,875 × 2,055. Thumbnail, label, and macro associated images are also present.

## Calculated results

The X dimension gives exact downsample factors of 1, 4, and 16. The Y ratios are approximately 1, 4.00012, and 16.00633 because the reduced dimensions are rounded integers. These calculations describe TIFF geometry, not biological registration.

## Actual viewer evidence

The open operation authorized the source and issued a fresh session. `slide_get_viewer_state` still reported `awaiting-viewer`, `stateRevision=null`, and no snapshot. Capabilities did not report fit, viewport, layer visibility, or viewer queries as supported. State, layer, and microscopy-scene queries timed out. Render wait was not called because it requires an actual state revision.

## Rehearsed viewer actions

Fit, pan, zoom, and one supported layer or display-option change remain a future sequence. Each step requires a mounted viewer, a current revision, an applied acknowledgement, a subsequent state read, and a synchronized render receipt. None of those actions is described as completed here.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with the verified CMU-1 source and pyramid context. Its exact response and timestamp are retained in `outputs/rosalind-open-observation.json`. The operation opened the Rosalind task chooser only; it did not select or execute a scientific job and supplies no tissue-analysis result for this case.

## Scientific interpretation

The verified source and pyramid are suitable for future navigation tests. No current tissue pixels were presented for inspection, so there is no tissue-architecture, morphology, or diagnostic interpretation.

## Reproduce

1. Compare the exact public index entry with the local byte count and digest.
2. Run `tiffinfo` and compare all retained dimensions and associated-image records.
3. Recalculate X and Y downsample ratios.
4. Invoke `mcp__rosalind__rosalind_open` with the case-specific task context and retain the chooser response separately from scientific evidence.
5. Open the source once and follow the returned session through state, capability, query, and render checks.
6. Apply navigation or layer actions only after the current capability response supports them.

## Retained execution prompt

# Verify CMU-1 source, pyramid, and current viewer state

Verify the pinned public CMU-1 SVS byte count and SHA-256, inspect TIFF directories with `tiffinfo`, and calculate downsample ratios from the recorded dimensions. Invoke `mcp__rosalind__rosalind_open` with a task context specific to the CMU-1 review and cite `outputs/rosalind-open-observation.json`; its chooser response does not prove a Rosalind scientific task. Open the exact local source once, then read viewer state and capabilities. Query state, layers, and microscopy scenes only through the returned session. Call render wait only when a current state revision exists. Fit, pan, zoom, layer, and display-option steps are rehearsal instructions until the viewer reports that those actions are supported and returns synchronized state evidence.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
