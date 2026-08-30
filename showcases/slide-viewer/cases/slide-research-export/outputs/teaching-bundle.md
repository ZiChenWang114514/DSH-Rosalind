# Codex showcase lesson: Source-preserving spatial research export

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `slide-research-export` (Source-preserving spatial research export). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `slide-research-export`
- Plugin: `slide-viewer` (Slide Viewer v0.1.56)
- Status: `ready`
- Summary: Export all 684 observations with coordinates, QC fields, and two indexed genes.
- Recorded next step: Open the case README to inspect the complete CSV, provenance, and matrix-scale limitation.
- Plugin guide: `showcases/slide-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/slide-viewer/cases/slide-research-export/README.md`
- case manifest: `showcases/slide-viewer/cases/slide-research-export/showcase.json`
- teaching prompt: `showcases/slide-viewer/cases/slide-research-export/prompt.md`
- output: `showcases/slide-viewer/cases/slide-research-export/outputs/spatial-observations-expression.csv`
- output: `showcases/slide-viewer/cases/slide-research-export/outputs/export-provenance.json`
- output: `showcases/slide-viewer/cases/slide-research-export/outputs/rosalind-open-observation.json`
- output: `showcases/slide-viewer/cases/slide-research-export/outputs/teaching-bundle.md`
- preview: `showcases/slide-viewer/cases/slide-research-export/previews/research-export.svg`

## Public sources

- https://exampledata.scverse.org/squidpy/visium_hne_adata_crop.h5ad
- https://doi.org/10.6084/m9.figshare.13604177.v1
- https://www.10xgenomics.com/datasets/mouse-brain-section-coronal-1-standard-1-1-0

## Retained case guide

# Source-preserving spatial research export

![Spatial research export summary](previews/research-export.svg)

## Scientific question

Can the complete spatial observation table and selected expression values be exported with sufficient provenance for independent inspection?

## Source observations

- The licensed H5AD exposes 684 observations, 18,078 genes, obsm/spatial coordinates, and CSR matrix X.
- Every observation is marked in tissue; coordinate ranges are x = 130–3433 and y = 98–3330.

## Computed results

outputs/spatial-observations-expression.csv contains 684 data rows with exact observation index and identifier, a JSON-protected identifier companion, coordinates, tissue flag, total_counts, n_genes_by_counts, and indexed Slc17a7 and Gad1 values. Coverage is 684/684. The CSV is 81,802 bytes and matches the SHA-256 in outputs/export-provenance.json.

Independent CSV checks reproduce mean values of 2.711 for Slc17a7 and 1.072 for Gad1. Their maxima are 4.055 and 3.950, respectively.

## Interpretation

The export preserves row identity, spatial coordinates, QC annotations, matrix revision, and gene indices needed to inspect the selected variables. Matrix value scale remains unknown, so the numerical columns are described only as values from X.

## Rosalind Workbench observation

The genuine case-specific `mcp__rosalind__rosalind_open` call completed at `2026-08-29T18:13:03.867Z` and returned exactly `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The arguments, timestamps, response, and limitation are preserved in `outputs/rosalind-open-observation.json`.

The call opened only the task chooser. It did not read the H5AD, create the CSV, export source pixels, or execute a Rosalind scientific job.

## Limitations

The viewer did not expose a native export action during the pending render. The CSV was therefore created from guarded source-indexed reads rather than from a viewer-generated region export, and it contains no user-drawn region.

## Retained execution prompt

Create a source-preserving research export for all spatial observations in the licensed mouse-brain H&amp;E H5AD. Include exact identifiers, coordinates, QC fields, and indexed Slc17a7 and Gad1 values, with complete provenance and an explicit statement that matrix scale is unknown. Inspect `outputs/rosalind-open-observation.json` as the exact record of the genuine case-specific `mcp__rosalind__rosalind_open` call. Explain that it opened only the task chooser and did not read data, create the CSV, export source pixels, or execute a Rosalind scientific job.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
