# Codex showcase lesson: Lambda genome annotation and cI translation

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `sequence-lambda-annotation` (Lambda genome annotation and cI translation). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `sequence-lambda-annotation`
- Plugin: `biological-sequence-viewer` (Biological Sequence & Alignment Viewer v0.1.43)
- Status: `ready`
- Domain: `structure-and-sequence`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `computed-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Rosalind Workbench mcp__rosalind__rosalind_open`, `Biological Sequence & Alignment Viewer 0.1.43 diagnostic attempts recorded in outputs/viewer-operation-evidence.json`
- Summary: Versioned NCBI genome annotation with an independently verified reverse-strand cI translation.
- Recorded next step: Recompute the reverse-strand NC_001416.1 cI translation and confirm its 714 bases produce the annotated 237-residue protein.
- Plugin guide: `showcases/biological-sequence-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/README.md`
- case manifest: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/showcase.json`
- teaching prompt: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/prompt.md`
- input: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/inputs/NC_001416.1.gb`
- output: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/outputs/analysis.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/outputs/source-provenance.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/outputs/provenance.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/outputs/rosalind-open-observation.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/outputs/viewer-operation-evidence.json`
- preview: `showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/previews/lambda-annotation.svg`

## Public sources

- https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_001416.1&rettype=gbwithparts&retmode=text

## Retained case guide

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

## Retained execution prompt

# Prompt

Open the versioned NCBI GenBank record NC_001416.1, inspect the right-operator region, and independently verify the reverse-strand cI CDS translation. Invoke `mcp__rosalind__rosalind_open` with this case's task context, cite `outputs/rosalind-open-observation.json`, and state that its ready task-chooser response did not inspect the record or execute the translation.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
