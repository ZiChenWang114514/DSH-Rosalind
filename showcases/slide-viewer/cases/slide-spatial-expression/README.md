# Mouse-brain spatial expression

![Spatial expression summary](previews/spatial-expression.svg)

## Scientific question

Can the spatial matrix be queried reproducibly for two neuronal marker genes, and what can be stated before tissue morphology is visible?

## Source observations

- The licensed public H5AD contains 684 observations and 18,078 genes.
- Matrix `X` is CSR with shape 684 × 18,078; spatial coordinates are present in `obsm/spatial`.
- The indexed genes are Slc17a7 (index 7717) and Gad1 (index 1607).

## Computed results

Across all 684 indexed observations, Slc17a7 was nonzero in 671 with mean 2.711 and maximum 4.055. Gad1 was nonzero in 490 with mean 1.072 and maximum 3.950. The matrix value scale is unspecified, so these are descriptive matrix values rather than raw-count or normalized-expression claims.

## Interpretation

The two genes are queryable over the complete indexed observation set. The viewer did not render a tissue frame, so no anatomical localization, morphology, or co-localization conclusion is made.

## Exploratory analysis operation availability

`outputs/analysis-operation-availability.json` and `outputs/operation-provenance.json` record a fresh capability response for `slide.run_analysis_from_chat`, `slide.get_analysis_from_chat`, and `slide.cancel_analysis_from_chat`. The capability response advertised all three, but the guarded run operation was not callable in this task. No same-session analysis task existed, so get and cancel were not called with a fabricated or borrowed identifier.

## Rosalind Workbench observation

The genuine case-specific `mcp__rosalind__rosalind_open` call completed at `2026-08-29T18:13:03.865Z` and returned exactly `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. Its arguments, timestamps, response, and limitation are retained in `outputs/rosalind-open-observation.json`.

This call opened only the task chooser. It did not query the H5AD, calculate expression summaries, render tissue, or execute a Rosalind scientific job; the public source observations and retained computation remain the evidence for the scientific statements above.

The analysis-operation availability record does not change the retained expression values and supplies no new computation.

## Attribution

Giovanni Palla (2021), *Brain Coronal HnE Adata Crop*, Figshare v1, CC BY 4.0. DOI and original 10x dataset links are retained in `outputs/source-provenance.json`.
