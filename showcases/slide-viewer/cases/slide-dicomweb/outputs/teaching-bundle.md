# Codex showcase lesson: DICOMweb whole-slide query

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `slide-dicomweb` (DICOMweb whole-slide query). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `slide-dicomweb`
- Plugin: `slide-viewer` (Slide Viewer v0.1.56)
- Status: `ready`
- Summary: How can a bounded DICOMweb query identify a tiled WSI instance before opening it?
- Recorded next step: Open the case README and inspect the public source, receipt, preview, interpretation, and limitations.
- Plugin guide: `showcases/slide-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/slide-viewer/cases/slide-dicomweb/README.md`
- case manifest: `showcases/slide-viewer/cases/slide-dicomweb/showcase.json`
- teaching prompt: `showcases/slide-viewer/cases/slide-dicomweb/prompt.md`
- input: `showcases/slide-viewer/cases/slide-dicomweb/inputs/public-source.md`
- output: `showcases/slide-viewer/cases/slide-dicomweb/outputs/verification-receipt.json`
- output: `showcases/slide-viewer/cases/slide-dicomweb/outputs/dicomweb-representation-manifest.json`
- output: `showcases/slide-viewer/cases/slide-dicomweb/outputs/rosalind-open-observation.json`
- output: `showcases/slide-viewer/cases/slide-dicomweb/outputs/teaching-bundle.md`
- preview: `showcases/slide-viewer/cases/slide-dicomweb/previews/preview.svg`

## Public sources

- https://raw.githubusercontent.com/ImagingDataCommons/wg26-2026-connectathon-idc/main/data/manifest/wg26_selection.json
- https://learn.canceridc.dev/portal/proxy-policy

## Retained case guide

# IDC DICOMweb WSI: complete response pins

![IDC DICOMweb evidence summary](previews/preview.svg)

## Scientific question

Can a public IDC WSI selection with three SM instances be identified, completely pinned at its selected delivery representations, and opened by the current Slide Viewer DICOMweb adapter?

## Source observations

- The IDC v24 selection manifest records three SM instances for an FFPE H&E series under CC BY 4.0.
- A direct anonymous QIDO request returned the expected three SOP Instance UIDs.
- Instance metadata reported 12, 1, and 1 frames. The 12-frame VOLUME object uses 256 × 256 JPEG Baseline tiles for an 853 × 693 matrix; the two single-frame associated objects use native Explicit VR Little Endian delivery.
- The three metadata and fourteen frame responses all returned HTTP 200, with no ETags.

## Deterministic result

The compact manifest pins all 17 required resources: three metadata documents and fourteen exact multipart payloads. The frame payloads total 3,791,810 bytes. Every size and SHA-256 is retained in `outputs/dicomweb-representation-manifest.json`.

## Actual Slide Viewer checks

The guarded QIDO call rejected the server response as not honoring its bounded request. A single-instance inspection reported a source-change condition. Opening the three pinned SOPs then rejected the selection because the current adapter does not register LABEL, OVERVIEW, or THUMBNAIL objects as pyramid levels. No viewer session or rendered frame was returned.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with the pinned IDC response context. Its exact response and timestamp are retained in `outputs/rosalind-open-observation.json`. The operation opened the Rosalind task chooser only; it did not select or execute a scientific job and supplies no scientific result for this case.

## Scientific interpretation

The retained package demonstrates selected-response identity and an explicit adapter compatibility result. It does not demonstrate a displayed slide or validate morphology.

## Reproduce

1. Read the IDC selection and proxy-policy records.
2. Repeat the exact anonymous QIDO and three metadata requests.
3. Retrieve every declared frame with its recorded Accept representation; hash the extracted multipart payload, not the variable MIME envelope.
4. Compare all 17 pins with the retained representation manifest.
5. Invoke `mcp__rosalind__rosalind_open` with the case-specific task context and retain the chooser response separately from scientific evidence.
6. Repeat the guarded Slide Viewer calls and preserve any changed admission result without inferring rendering.

## Retained execution prompt

# Verify one IDC DICOMweb WSI selection

Use the exact study, series, and three SOP Instance UIDs in the retained IDC source note. Repeat the bounded QIDO and metadata checks, acquire all fourteen explicitly represented frames, rebuild their payload SHA manifest, and compare it with the retained manifest. Invoke `mcp__rosalind__rosalind_open` with a task context specific to the IDC DICOMweb review and cite `outputs/rosalind-open-observation.json`; its chooser response confirms only that Rosalind Workbench opened. Invoke only applicable Slide Viewer operations and record all rejections exactly. Do not claim a Rosalind scientific job, viewer session, pyramid, or rendered tissue without direct execution evidence.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
