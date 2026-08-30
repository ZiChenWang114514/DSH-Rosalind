# Antibody breadth across target variants

This ready teaching case demonstrates how to test whether public evidence is specific enough for a residue-conservation claim. The retained materials do not define a target or support antibody design.

![Antibody breadth across target variants](previews/preview.svg)

## Scientific question

Which conserved target residues should be retained when proposing broader antibody recognition?

## Source observations

- The retained source is the UniProt service homepage.
- No target accession, sequence version, variant set, alignment, residue mapping, antibody record, or experimental breadth measurement is retained.
- Consequently, the current artifacts do not support a reproducible claim about conserved target residues.

The dated, case-specific source-sufficiency review is stored in `outputs/verification-receipt.json`; acquisition details are in `inputs/public-source.md`.

## Rosalind Workbench observation

One genuine `mcp__rosalind__rosalind_open` call was made with this case's task context at `2026-08-29T18:23:14.162Z`. It returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. Exact arguments, UTC and local timestamps, and `scientific_job_executed=false` are retained in `outputs/rosalind-open-observation.json` and cited by `outputs/provenance.json`.

The launcher observation establishes only that the task chooser was ready. It does not establish a scientific run and supplied no target, sequence comparison, conservation calculation, or antibody result.

## Interpretation

This case makes absence of evidence inspectable. A defensible breadth analysis would first need named public targets and variants, stable sequence versions, an explicit comparison method, residue mapping, and orthogonal binding measurements.

## Reproduce

1. Read `prompt.md` and `inputs/public-source.md`.
2. Confirm that the retained source lacks the identifiers and artifacts needed for a residue-level claim.
3. Verify `outputs/rosalind-open-observation.json` separately from the source-sufficiency review.
4. Use `outputs/session-bundle.md` as the teaching index and review the preview.

## Limitations

- No target protein, pathogen, antibody, or variant set is identified.
- No sequence analysis or experimental breadth assessment was performed.
- The case supports a reproducibility lesson and no biological design conclusion.
