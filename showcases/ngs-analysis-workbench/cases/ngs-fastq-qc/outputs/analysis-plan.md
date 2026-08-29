# Analysis plan

## Objective

Assess paired FASTQ integrity, per-base quality, adapter evidence, and whether trimming is scientifically justified.

## Proposed steps

1. Verify sample identity, pairing, compression, and complete-record structure.
2. Run pre-trimming QC and inspect per-base quality, length, duplication, GC, and adapter modules.
3. Choose trimming only when an observed problem and downstream requirement justify it.
4. Repeat QC after any transformation and retain before/after reports plus exact parameters.
