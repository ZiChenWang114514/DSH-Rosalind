# Codex showcase lesson: Local DICOM whole-slide series

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `slide-local-dicom` (Local DICOM whole-slide series). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `slide-local-dicom`
- Plugin: `slide-viewer` (Slide Viewer v0.1.56)
- Status: `ready`
- Summary: How is a local DICOM WSI series inspected and opened with frame-aware metadata?
- Recorded next step: Open the case README and inspect the public source, receipt, preview, interpretation, and limitations.
- Plugin guide: `showcases/slide-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/slide-viewer/cases/slide-local-dicom/README.md`
- case manifest: `showcases/slide-viewer/cases/slide-local-dicom/showcase.json`
- teaching prompt: `showcases/slide-viewer/cases/slide-local-dicom/prompt.md`
- input: `showcases/slide-viewer/cases/slide-local-dicom/inputs/public-source.md`
- output: `showcases/slide-viewer/cases/slide-local-dicom/outputs/verification-receipt.json`
- output: `showcases/slide-viewer/cases/slide-local-dicom/outputs/rosalind-open-observation.json`
- output: `showcases/slide-viewer/cases/slide-local-dicom/outputs/teaching-bundle.md`
- preview: `showcases/slide-viewer/cases/slide-local-dicom/previews/preview.svg`

## Public sources

- https://huggingface.co/datasets/erikgabr/wsi-testdata/resolve/main/dicom/CMU-1-JP2K-33005/metadata.json
- https://huggingface.co/api/datasets/erikgabr/wsi-testdata/tree/main/dicom/CMU-1-JP2K-33005?recursive=false&expand=false
- https://openslide.cs.cmu.edu/download/openslide-testdata/index.json

## Retained case guide

# Explicit CMU-1 local DICOM series

![Six-member DICOM verification](previews/preview.svg)

## Scientific question

Can the six publicly pinned CMU-1 DICOM WSI members be acquired exactly and admitted by the current Slide Viewer parser?

## Source observations

- The public inventory identifies six named DICOM members totaling 136,926,512 bytes and supplies a SHA-256 for each member.
- All six downloaded files matched the published byte counts and hashes on 2026-08-30.
- The source metadata describes a TILED_FULL JPEG 2000 conversion of the CC0 CMU-1 specimen.
- The current OpenSlide index marks the older source conversion deprecated because its Photometric Interpretation is incorrect; this package does not silently replace it with the newer v2 conversion.

## Actual Slide Viewer check

`mcp__slide_viewer__slide_open_dicom_series` received the six verified paths in order and returned `DICOM source slice thickness must be positive when present.` No viewer session was created. Source renewal and render checks therefore did not apply.

## Calculated result

The deterministic calculation is the sum of the six verified member sizes: 136,926,512 bytes.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with the local DICOM review context. Its exact response and timestamp are retained in `outputs/rosalind-open-observation.json`. The operation opened the Rosalind task chooser only; it did not select or execute a scientific job and supplies no scientific result for this case.

## Scientific interpretation

This case verifies source identity and a reproducible parser rejection. It does not show a DICOM pyramid, frame display, navigation behavior, or tissue morphology.

## Reproduce

1. Read `inputs/public-source.md` and the six-member receipt.
2. Download only the six listed members into an ignored workspace directory.
3. Verify every byte count and SHA-256 before opening.
4. Pass the six explicit paths to `mcp__slide_viewer__slide_open_dicom_series`.
5. Invoke `mcp__rosalind__rosalind_open` with the case-specific task context and retain the chooser response separately from scientific evidence.
6. Record the returned viewer error or, if a future version accepts the source, continue with state and render checks using the newly issued session.

## Retained execution prompt

# Verify an explicit local CMU-1 DICOM series

Acquire only the six named CC0 DICOM members, verify every published byte count and SHA-256, and call `mcp__slide_viewer__slide_open_dicom_series` with the ordered explicit paths. Preserve the exact parser result. Invoke `mcp__rosalind__rosalind_open` with a task context specific to this local DICOM review and cite `outputs/rosalind-open-observation.json`; treat its chooser response only as proof that Rosalind Workbench opened, never as a scientific task run. If no viewer session is returned, do not request renewal, state, render, navigation, or image interpretation.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
