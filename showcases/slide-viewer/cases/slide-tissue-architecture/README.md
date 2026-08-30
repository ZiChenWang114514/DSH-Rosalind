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
