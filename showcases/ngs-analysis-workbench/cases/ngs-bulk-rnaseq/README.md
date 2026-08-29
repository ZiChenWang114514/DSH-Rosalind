# Bulk RNA-seq workflow design

![Bulk RNA-seq workflow design](previews/ngs-bulk-rnaseq.svg)

## Scientific objective

Design a compact bulk RNA-seq counts-and-QC analysis while preserving sample design, reference identity, and reproducible workflow evidence.

## Verified observations

- Bundled workflow: `oai_bulk_rnaseq_counts_qc`
- Active version: `version-a99d0908ddacd176e3b77e9ec2e482f3`
- Workflow source digest: `sha256:eddf2cd523b62c20b3fa4496c4d441b9dfb48a303de9c5b922bad30d7e30f9cc`
- The local target is currently unable to launch this Snakemake workflow, and the configured Ubuntu target was unreachable.
- The registered run list was empty; no dataset was fetched and no analysis result exists.

## Proposed analysis

See `outputs/analysis-plan.md` for the assay-aware design. `outputs/readiness-review.md` separates observed runtime facts from unknown scientific results.

## Interpretation

This case demonstrates live workflow discovery and an evidence-labelled scientific plan. It does not report QC, expression, cell types, or differential biology.
