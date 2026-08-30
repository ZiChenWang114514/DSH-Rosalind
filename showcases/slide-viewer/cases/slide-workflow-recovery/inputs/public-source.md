# Public spatial source used by the recovery rehearsal

- Dataset: Giovanni Palla (2021), *Brain Coronal HnE Adata Crop*, Figshare v1
- DOI: https://doi.org/10.6084/m9.figshare.13604177.v1
- H5AD URL: https://exampledata.scverse.org/squidpy/visium_hne_adata_crop.h5ad
- License: CC BY 4.0
- Published byte count: `94259482`
- Published SHA-256: `9c9b277bde9f34a022df7f3e35b35ce7ecc80f006d6640b0786f4ace6f6eb5dd`

The retained before/after manifests are self-contained rehearsal fixtures. They contain no local path, credential, bearer token, signed URL, private host, or live source handle. The source identity and matrix selector remain fixed while the authorization alias and attempt identity change.

The retained before/after manifests do not claim a live Slide Viewer recovery. A later, separate temporary operation check imported the small case-owned TSV source and admitted two region-QC tasks; both failed before producing an artifact. Those calls are recorded in `../outputs/workflow-operation-evidence.json` and do not validate the fixture recovery sequence.
