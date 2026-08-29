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

## Attribution

Giovanni Palla (2021), *Brain Coronal HnE Adata Crop*, Figshare v1, CC BY 4.0. DOI and original 10x dataset links are retained in `outputs/source-provenance.json`.
