# FASTQ QC workflow readiness

![FASTQ QC workflow readiness](previews/ngs-fastq-qc.svg)

## Scientific objective

Assess paired FASTQ integrity, per-base quality, adapter evidence, and whether trimming is scientifically justified.

## Verified observations

- Bundled workflow: `oai_fastq_qc`
- Active version: `version-8e0c15a605d394be27a4e68246a061ef`
- Workflow source digest: `sha256:705bf609376de4193dafbb50a8967b75bc30ffeb5c17e1849a56cafe949db201`
- The local target is currently unable to launch this Snakemake workflow, and the configured Ubuntu target was unreachable.
- The registered run list was empty; no dataset was fetched and no analysis result exists.

## Proposed analysis

See `outputs/analysis-plan.md` for the assay-aware design. `outputs/readiness-review.md` separates observed runtime facts from unknown scientific results.

## Interpretation

This case demonstrates live workflow discovery and an evidence-labelled scientific plan. It does not report QC, expression, cell types, or differential biology.
