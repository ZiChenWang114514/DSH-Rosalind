# Codex showcase lesson: Source-aligned spatial annotation overlay

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `slide-segmentation-overlay` (Source-aligned spatial annotation overlay). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `slide-segmentation-overlay`
- Plugin: `slide-viewer` (Slide Viewer v0.1.56)
- Status: `ready`
- Summary: Create provenance-bearing GeoJSON demonstration geometry from exact spatial coordinates.
- Recorded next step: Open the case README to inspect the GeoJSON, coordinate association, and recorded rendering limitation.
- Plugin guide: `showcases/slide-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/slide-viewer/cases/slide-segmentation-overlay/README.md`
- case manifest: `showcases/slide-viewer/cases/slide-segmentation-overlay/showcase.json`
- teaching prompt: `showcases/slide-viewer/cases/slide-segmentation-overlay/prompt.md`
- output: `showcases/slide-viewer/cases/slide-segmentation-overlay/outputs/source-aligned-annotations.geojson`
- output: `showcases/slide-viewer/cases/slide-segmentation-overlay/outputs/overlay-provenance.json`
- output: `showcases/slide-viewer/cases/slide-segmentation-overlay/outputs/rosalind-open-observation.json`
- output: `showcases/slide-viewer/cases/slide-segmentation-overlay/outputs/teaching-bundle.md`
- preview: `showcases/slide-viewer/cases/slide-segmentation-overlay/previews/segmentation-overlay.svg`

## Public sources

- https://exampledata.scverse.org/squidpy/visium_hne_adata_crop.h5ad
- https://doi.org/10.6084/m9.figshare.13604177.v1

## Retained case guide

# Source-aligned spatial annotation overlay

![Source-aligned annotation summary](previews/segmentation-overlay.svg)

## Scientific question

Can a spatially compatible annotation artifact be produced from exact H5AD coordinates while retaining source association and scientific meaning?

## Source observations

- The public H5AD contains 684 Visium observations registered through obsm/spatial to its H&amp;E image.
- Observation indices 0, 1, and 2 have exact coordinates (1575, 98), (2538, 1774), and (1850, 98).

## Computed results

outputs/source-aligned-annotations.geojson contains three 16-segment circular polygons with a 55-pixel radius around those coordinates. Dataset hash, matrix revision, coordinate frame, observation identifiers, and construction method are retained with the artifact.

## Interpretation

The artifact demonstrates reproducible source-associated overlay geometry. It is an annotation example derived from spot coordinates and does not represent cell segmentation, anatomical regions, or biological classifications.

## Rosalind Workbench observation

The genuine case-specific `mcp__rosalind__rosalind_open` call completed at `2026-08-29T18:13:03.866Z` and returned exactly `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. `outputs/rosalind-open-observation.json` retains the arguments, timestamps, response, and limitation.

The operation opened only the task chooser. It did not create, import, render, or classify the GeoJSON overlay and did not execute a Rosalind scientific job.

## Limitations

The viewer remained pending and did not expose an annotation import action during this run, so the GeoJSON was inspected structurally but was not rendered over the tissue image.

## Retained execution prompt

Create a source-associated GeoJSON demonstration overlay from exact spatial observation coordinates in the licensed mouse-brain H&amp;E H5AD. Preserve coordinate provenance and do not describe the polygons as biological segmentation. Inspect `outputs/rosalind-open-observation.json`, which records the genuine case-specific `mcp__rosalind__rosalind_open` call and exact launcher response. Treat that response only as evidence that the task chooser opened; no Rosalind scientific job or overlay operation ran.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
