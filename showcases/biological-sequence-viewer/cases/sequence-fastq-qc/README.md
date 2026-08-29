# Public-read FASTQ quality exploration

![FASTQ QC summary](previews/fastq-qc.svg)

## Scientific question

What sequence composition and base-quality profile appears in a deterministic subset of a public long-read run?

## Source and method

The source is ENA run `DRR037765`. The preparation script reads the first 500 complete records, verifies sequence/quality length equality, and writes the small canonical subset bundled with this lesson. The complete source file remains outside Git; `outputs/source-provenance.json` records the public URL, ENA MD5, transformation rule, byte count, and subset SHA-256.

## Computed results

- 500 reads and 235,490 bases
- length 469–471 bases
- GC 28.85%
- Q30 95.40%

These values describe this bounded subset only. They do not establish run-wide quality or suitability for a downstream assay.

## Reproduce

Open `inputs/DRR037765.first500.fastq` with the Sequence Viewer and run `fastq_qc`. To rebuild the subset from ENA, download the documented source object and apply the transformation in `outputs/source-provenance.json`.

## Limitation

The numerical results are reproducible from the bundled subset. They remain a 500-read sample and should not be interpreted as a complete run assessment.
