# Codex showcase lesson: Scientific layer import

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `slide-scientific-layers` (Scientific layer import). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `slide-scientific-layers`
- Plugin: `slide-viewer` (Slide Viewer v0.1.56)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `slide-viewer.slide_open_from_chat`, `slide-viewer.slide_spatial_indexed`, `slide-viewer.slide_import_scientific_layer`, `slide-viewer.slide_get_scientific_layer_import`, `slide-viewer.slide_cancel_scientific_layer_import`, `slide-viewer.slide_list_scientific_layers`, `slide-viewer.slide_get_scientific_entity`, `slide-viewer.slide_renew_scientific_layer_authorization`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `local JSON, GeoJSON, CSV, and source-pin verification`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: How are source tables mapped into a source-aligned scientific layer?
- Recorded next step: Open the case README and inspect the public source, receipt, preview, interpretation, and limitations.
- Plugin guide: `showcases/slide-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/slide-viewer/cases/slide-scientific-layers/README.md`
- case manifest: `showcases/slide-viewer/cases/slide-scientific-layers/showcase.json`
- teaching prompt: `showcases/slide-viewer/cases/slide-scientific-layers/prompt.md`
- input: `showcases/slide-viewer/cases/slide-scientific-layers/inputs/public-source.md`
- output: `showcases/slide-viewer/cases/slide-scientific-layers/outputs/layer-source-map.json`
- output: `showcases/slide-viewer/cases/slide-scientific-layers/outputs/scientific-layer-receipt.json`
- output: `showcases/slide-viewer/cases/slide-scientific-layers/outputs/rosalind-open-observation.json`
- output: `showcases/slide-viewer/cases/slide-scientific-layers/outputs/teaching-bundle.md`
- output: `showcases/slide-viewer/cases/slide-scientific-layers/outputs/scientific-layer-cancellation-evidence.json`
- output: `showcases/slide-viewer/cases/slide-scientific-layers/outputs/operation-provenance.json`
- preview: `showcases/slide-viewer/cases/slide-scientific-layers/previews/preview.svg`

## Public sources

- https://exampledata.scverse.org/squidpy/visium_hne_adata_crop.h5ad
- https://doi.org/10.6084/m9.figshare.13604177.v1

## Retained case guide

# Source-associated scientific layer

![Scientific-layer preview](../previews/preview.svg)

## Scientific question

Can the retained mouse-brain observation table and demonstration geometry be mapped to the correct source, coordinate frame, matrix revision, and entity semantics before viewer import?

## Source observations

- The verified CC BY 4.0 H5AD has 684 observations, 18,078 genes, and spatial coordinates in `obsm/spatial`.
- The reused CSV has 684 unique observation identifiers and complete source-indexed coverage.
- The reused GeoJSON has three polygons tied to exact observation identifiers and the same H5AD SHA-256 and matrix revision.

## Verified mapping

`outputs/layer-source-map.json` assigns the table rows to `visium_capture_spot` entities, maps x/y to registered source-image pixels, preserves the JSON-protected observation identifier, and records the exact matrix selector and revision. The GeoJSON is retained as companion demonstration annotation geometry; it is not cell segmentation.

`outputs/scientific-layer-receipt.json` records byte counts, hashes, row and feature counts, and the earlier status of each viewer action. `outputs/scientific-layer-cancellation-evidence.json` and `outputs/operation-provenance.json` retain a later temporary import, cancellation request, and status follow-up with portable task aliases and exact response text.

## Interpretation

The temporary GeoJSON import returned a real task in its authorizing phase. The subsequent `slide_cancel_scientific_layer_import` request returned `UNAVAILABLE`, and the follow-up reported revoked read authorization. The plugin did not provide a settled cancellation confirmation or a published layer descriptor.

## Rosalind Workbench observation

The genuine case-specific `mcp__rosalind__rosalind_open` call completed at `2026-08-29T18:13:03.868Z` and returned exactly `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. Its arguments, timestamps, response, and limitation are retained in `outputs/rosalind-open-observation.json`.

The call opened only the task chooser. It did not import, list, render, or query a scientific layer and did not execute a Rosalind scientific job.

## Limitations

- Visium observations are capture spots, not single cells.
- Matrix `X` has an unknown value scale.
- The three GeoJSON polygons are demonstration neighborhoods, not biological regions or segmentation.
- A temporary import, cancellation request, and status follow-up were called; cancellation completion was not confirmed.
- Layer listing, entity lookup, and authorization renewal were not called in the fresh session.
- No tissue frame was rendered, so no spatial pattern or morphology is interpreted.

## Reproduce

1. Verify all three reused artifacts against `inputs/public-source.md` and the receipt.
2. Check that CSV identifiers and coordinates match the declared H5AD association.
3. Validate the GeoJSON source hash, matrix revision, feature count, and coordinate frame.
4. In a later mounted session, import a fresh authorized layer and record returned IDs and status separately.
5. Read `outputs/scientific-layer-cancellation-evidence.json` before describing the temporary task; do not convert its `UNAVAILABLE` response into a completed cancellation claim.

## Retained execution prompt

# Source-associated scientific layer

Map the retained 684-row Visium observation table to a source-associated capture-spot layer, preserve the exact H5AD and matrix revision, and inspect the companion demonstration GeoJSON. Read `outputs/scientific-layer-cancellation-evidence.json`, `outputs/operation-provenance.json`, and `outputs/teaching-bundle.md`; report that the temporary import returned a real task, while cancellation returned `UNAVAILABLE` and the follow-up reported revoked read authorization. Do not claim a published layer, settled cancellation, tissue alignment, or image permission. Preserve `outputs/rosalind-open-observation.json` as task-chooser evidence only.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
