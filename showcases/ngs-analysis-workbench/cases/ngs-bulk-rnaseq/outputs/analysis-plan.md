# Analysis plan

## Objective

Design a compact bulk RNA-seq counts-and-QC analysis while preserving sample design, reference identity, and reproducible workflow evidence.

## Proposed steps

1. Confirm organism, library layout, strandedness, biological replicates, contrasts, and batch variables.
2. Pin transcriptome and annotation versions and verify sample-to-file mapping.
3. Generate quantification and sample-level QC, then inspect library size, mapping or assignment, composition, and outliers.
4. Only after QC approval, define normalization and differential-expression models aligned with the study design.
