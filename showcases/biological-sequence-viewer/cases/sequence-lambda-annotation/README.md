# Lambda genome annotation and cI translation

![Lambda annotation summary](previews/lambda-annotation.svg)

## Scientific question

Does the versioned λ genome record encode cI on the reverse strand exactly as annotated, and where are the three right-operator elements recorded?

## Source observations

- NCBI record `NC_001416.1` contains a 48,502-base genome.
- The cI CDS is `complement(37227..37940)`, uses translation table 11, and names protein `NP_040628.1`.
- The record annotates OR3, OR2, and OR1 at 37951–37967, 37974–37990, and 37998–38014.

## Computed result

`scripts/prepare_sequence_examples.py` extracted the 714-base interval, reverse-complemented it, translated it, removed the terminal stop, and recovered 237 residues. The sequence matches the GenBank translation exactly. Exact sequence digests are retained in `outputs/analysis.json`.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with this case's task context at `2026-08-29T18:14:15.156Z`. It returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The arguments, UTC and local timestamps, response, and `scientific_job_executed=false` are retained in `outputs/rosalind-open-observation.json` and cited by `outputs/provenance.json`. The call opened only the task chooser; the local preparation script produced the cI verification.

## Reproduce

Run `python scripts/prepare_sequence_examples.py`, then inspect `outputs/analysis.json` and the source record in `inputs/NC_001416.1.gb`.

## Limitation

The current open attempt created a server session, but the records query timed out without acknowledgement. The preview is a verified project summary and is not a captured viewer image.

## Viewer operation review (2026-08-30)

No Sequence Viewer operation is recorded as successful. Server sessions were created for the relevant local public files, but subsequent queries or controls were not acknowledged. `outputs/viewer-operation-evidence.json` separates failed calls from actions that were not attempted after the prerequisite confirmation failed. It omits session identifiers, private paths, and internal resource URIs.
