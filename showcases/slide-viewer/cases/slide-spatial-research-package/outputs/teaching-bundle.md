# Codex showcase lesson: Spatial research package

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `slide-spatial-research-package` (Spatial research package). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `slide-spatial-research-package`
- Plugin: `slide-viewer` (Slide Viewer v0.1.56)
- Status: `ready`
- Summary: Which artifacts preserve spatial observations, layers, workflow receipts, and source references?
- Recorded next step: Open the case README and inspect the public source, receipt, preview, interpretation, and limitations.
- Plugin guide: `showcases/slide-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/slide-viewer/cases/slide-spatial-research-package/README.md`
- case manifest: `showcases/slide-viewer/cases/slide-spatial-research-package/showcase.json`
- teaching prompt: `showcases/slide-viewer/cases/slide-spatial-research-package/prompt.md`
- input: `showcases/slide-viewer/cases/slide-spatial-research-package/inputs/public-source.md`
- output: `showcases/slide-viewer/cases/slide-spatial-research-package/outputs/research-package-inventory.json`
- output: `showcases/slide-viewer/cases/slide-spatial-research-package/outputs/package-validation.json`
- output: `showcases/slide-viewer/cases/slide-spatial-research-package/outputs/rosalind-open-observation.json`
- output: `showcases/slide-viewer/cases/slide-spatial-research-package/outputs/teaching-bundle.md`
- preview: `showcases/slide-viewer/cases/slide-spatial-research-package/previews/preview.svg`

## Public sources

- https://exampledata.scverse.org/squidpy/visium_hne_adata_crop.h5ad
- https://doi.org/10.6084/m9.figshare.13604177.v1
- https://www.10xgenomics.com/datasets/mouse-brain-section-coronal-1-standard-1-1-0

## Retained case guide

# Spatial research package

![Spatial research package inventory](previews/preview.svg)

## Scientific question

Which retained artifacts make the licensed mouse-brain spatial observations, selected expression values, source-associated geometry, and scientific-layer mapping independently inspectable?

## Package contents

`outputs/research-package-inventory.json` references ten existing artifacts by repository path, byte count, SHA-256, role, and source association:

- the shared 94,259,482-byte H5AD source;
- source provenance, matrix metadata, and expression summaries;
- the complete 684-row observation CSV and export provenance;
- three demonstration GeoJSON polygons and their provenance;
- the scientific-layer source map and its action-status receipt.

The large H5AD, CSV, and GeoJSON stay in their original locations. The inventory is a reproducibility manifest, not a second data bundle.

## Verification

`outputs/package-validation.json` records that all ten paths existed on 2026-08-30 and matched the inventoried byte counts and hashes. It also records common H5AD and matrix identities where applicable.

## Interpretation

The inventory preserves the information needed to locate and verify the source, full spot table, selected values, demonstration geometry, and proposed scientific-layer mapping. It is useful for review, teaching, or a later authorized viewer session.

## Rosalind Workbench observation

The genuine case-specific `mcp__rosalind__rosalind_open` call completed at `2026-08-29T18:13:03.871Z` and returned exactly `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. `outputs/rosalind-open-observation.json` retains the arguments, timestamps, response, and limitation.

This call opened only the task chooser. It did not assemble or export the package, inspect source pixels, run a workflow, or execute a Rosalind scientific job.

## Action status and omissions

- The existing expression and export artifacts came from guarded indexed reads; the tissue frame was not rendered.
- The scientific-layer import, polling, listing, and entity queries remain rehearsed contracts.
- No supported workflow was run, so there is no workflow job or workflow artifact receipt.
- No portable project or annotation ZIP was produced.
- No current user source-image capture permission was recorded, and no source-image pixels were exported.

## Scientific limits

- Visium observations are capture spots, not single cells.
- Matrix `X` has an unknown value scale.
- The three polygons are demonstration annotations, not biological segmentation.
- The inventory does not establish visible tissue alignment or anatomical interpretation.

## Reproduce

1. Resolve each repository path in `research-package-inventory.json` from the project root.
2. Compare current bytes and SHA-256 with the recorded values.
3. Check that H5AD hash and matrix revision associations agree across the retained JSON and GeoJSON files.
4. Treat any later workflow, layer import, project export, or source-image export as a new execution with its own receipt.

## Retained execution prompt

# Spatial research package

Assemble an inspectable inventory for the licensed mouse-brain spatial source, complete observation export, source-associated demonstration geometry, matrix summaries, and scientific-layer mapping. Verify every repository path, byte count, and SHA-256; record missing workflow results and source-image exports plainly rather than inventing them. Inspect `outputs/rosalind-open-observation.json` as the exact record of the genuine case-specific `mcp__rosalind__rosalind_open` call and explain that its task-chooser response is not evidence of package assembly, viewer export, workflow execution, source-image permission, or a Rosalind scientific job.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
