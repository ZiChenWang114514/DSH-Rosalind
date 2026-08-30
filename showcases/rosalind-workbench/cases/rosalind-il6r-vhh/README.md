# IL-6R VHH candidate design

This ready teaching case grounds its discussion in the reviewed human IL-6R alpha record. It documents receptor context and reproducibility without generating an antibody candidate.

![IL-6R VHH candidate design](previews/preview.svg)

## Scientific question

How can an IL-6R extracellular-domain sequence guide a reproducible VHH design lesson?

## Source observations

- UniProt P08887 is the reviewed human interleukin-6 receptor subunit alpha entry, also named IL6R and CD126.
- The entry annotates residues 20–365 as extracellular, residues 366–386 as transmembrane, and residues 387–468 as cytoplasmic.
- These annotations define target identity and extracellular-domain scope. The retained case contains no VHH sequence, epitope model, complex prediction, affinity estimate, or ranking.

The dated, case-specific source summary is stored in `outputs/verification-receipt.json`; acquisition details are in `inputs/public-source.md`.

## Rosalind Workbench observation

One genuine `mcp__rosalind__rosalind_open` call was made with this case's task context at `2026-08-29T18:23:14.139Z`. It returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. Exact arguments, UTC and local timestamps, and `scientific_job_executed=false` are retained in `outputs/rosalind-open-observation.json` and cited by `outputs/provenance.json`.

The launcher observation establishes only that the task chooser was ready. It does not establish a scientific run and did not retrieve a sequence, generate a VHH, or predict binding.

## Interpretation

P08887 supplies a clear, reviewed reference for receptor identity and topology. Any later antibody sequence, epitope, or performance statement requires separate inputs, computation, and experimental evidence.

## Reproduce

1. Read `prompt.md` and `inputs/public-source.md`.
2. Inspect the current UniProt P08887 record and compare it with `outputs/verification-receipt.json`.
3. Verify `outputs/rosalind-open-observation.json` separately from the receptor annotations.
4. Use `outputs/session-bundle.md` as the teaching index and review the preview.

## Limitations

- The full P08887 sequence is not retained as an input artifact.
- No sequence creation, structural modeling, docking, optimization, or ranking was performed.
- The source record may change after the recorded date.
