# PETase mutation map

This ready teaching case establishes the public PETase reference structure and states exactly what would be needed to map already reported substitutions. It does not propose or introduce a mutation.

![PETase mutation map](previews/preview.svg)

## Scientific question

Where do reported PETase substitutions lie relative to the catalytic region?

## Source observations

- RCSB PDB 5XJH is a 1.54 Å X-ray structure of PETase from *Ideonella sakaiensis*.
- The deposited entity is one 300-residue PETase chain with no mutation; the linked primary report describes a Ser–His–Asp catalytic triad.
- The retained case contains no substitution list or coordinate-distance calculation. It therefore does not establish where any reported substitution lies relative to the catalytic region.
- `map-petase-mutations` is the official Rosalind task that corresponds to this PETase mutation-mapping question. The association records scientific relevance; the retained launcher observation does not show that the task ran.

The dated, case-specific source summary is stored in `outputs/verification-receipt.json`; acquisition details are in `inputs/public-source.md`.

## Rosalind Workbench observation

One genuine `mcp__rosalind__rosalind_open` call was made with this case's task context at `2026-08-29T18:23:14.185Z`. It returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. Exact arguments, UTC and local timestamps, and `scientific_job_executed=false` are retained in `outputs/rosalind-open-observation.json` and cited by `outputs/provenance.json`.

The launcher observation establishes only that the task chooser was ready. It does not establish a scientific run and did not retrieve coordinates, map substitutions, modify a sequence, or estimate activity.

## Interpretation

PDB 5XJH is a suitable public reference for a later, explicitly parameterized distance analysis. Such an analysis would need named published substitutions, a defined catalytic-site representation, chain mapping, and a reported geometric criterion.

## Reproduce

1. Read `prompt.md` and `inputs/public-source.md`.
2. Inspect the current RCSB PDB 5XJH record and compare it with `outputs/verification-receipt.json`.
3. Verify `outputs/rosalind-open-observation.json` separately from the structural evidence.
4. Use `outputs/session-bundle.md` as the teaching index and review the preview.

## Limitations

- No substitution list or coordinate analysis is retained.
- No mutation, sequence change, activity calculation, or ranking was produced.
- The source record may change after the recorded date.
