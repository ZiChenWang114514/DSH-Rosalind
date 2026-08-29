# Public-read FASTQ quality exploration

![FASTQ QC summary](previews/fastq-qc.svg)

## Scientific question

What sequence composition and base-quality profile appears in a deterministic subset of a public long-read run?

## Source and method

The source is ENA run `DRR037765`. The preparation script reads the first 500 complete records, verifies sequence/quality length equality, and writes a canonical local subset. Large read files remain outside Git; `outputs/source-provenance.json` records the public URL, ENA MD5, transformation rule, byte count, and subset SHA-256.

## Computed results

- 500 reads and 235,490 bases
- length 469–471 bases
- GC 28.85%
- Q30 95.40%

These values describe this bounded subset only. They do not establish run-wide quality or suitability for a downstream assay.

## Reproduce

Download the documented ENA object to the case input path and run `python scripts/prepare_sequence_examples.py`.

## Limitation

The viewer session was created but did not render, so the visual is a project-owned numerical summary.
