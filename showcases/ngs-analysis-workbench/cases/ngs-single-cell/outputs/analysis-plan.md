# Analysis plan

## Objective

Design a FASTQ-to-count single-cell RNA-seq analysis with explicit chemistry, reference, cell-calling, and quality-review requirements.

## Proposed steps

1. Confirm assay chemistry, read structure, barcode and UMI layout, sample multiplexing, and expected cells.
2. Pin genome and gene annotation versions before count generation.
3. Inspect barcode ranks, detected cells, reads per cell, genes per cell, mitochondrial fraction, ambient RNA, and doublet evidence.
4. Delay clustering and cell-type interpretation until count-generation and cell-level QC are reviewed.
