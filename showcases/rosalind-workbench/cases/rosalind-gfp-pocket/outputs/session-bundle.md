# Codex showcase lesson: GFP chromophore pocket

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-gfp-pocket` (GFP chromophore pocket). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-gfp-pocket`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `structure-and-sequence`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `RCSB PDB public record inspection`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: Which residues form the local environment of the mature GFP chromophore?
- Recorded next step: Inspect PDB 1EMA and identify the coordinate analysis needed to define the mature GFP chromophore environment.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-gfp-pocket/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-gfp-pocket/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-gfp-pocket/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-gfp-pocket/inputs/public-source.md`
- output: `showcases/rosalind-workbench/cases/rosalind-gfp-pocket/outputs/verification-receipt.json`
- output: `showcases/rosalind-workbench/cases/rosalind-gfp-pocket/outputs/provenance.json`
- output: `showcases/rosalind-workbench/cases/rosalind-gfp-pocket/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-gfp-pocket/outputs/session-bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-gfp-pocket/previews/preview.svg`

## Public sources

- https://www.rcsb.org/structure/1EMA
- installed-plugin://rosalind-workbench/tool-contract

## Retained case guide

# GFP chromophore pocket

This ready teaching case records public structural context for the GFP chromophore and explains what a reproducible pocket query would need. It does not alter a sequence or calculate a pocket.

![GFP chromophore pocket](../previews/preview.svg)

## Scientific question

Which residues form the local environment of the mature GFP chromophore?

## Source observations

- RCSB PDB 1EMA is a 1.90 Å X-ray structure of an *Aequorea victoria* GFP variant.
- The linked primary report describes an 11-stranded beta barrel with a coaxial helix, chromophore formation from residues 65–67, and Thr203 adjacent to the chromophore.
- The retained case contains no coordinate-derived contact list or distance cutoff. It therefore does not define the complete chromophore pocket.

The dated, case-specific source summary is stored in `outputs/verification-receipt.json`; acquisition details are in `inputs/public-source.md`.

## Rosalind Workbench observation

One genuine `mcp__rosalind__rosalind_open` call was made with this case's task context at `2026-08-29T18:23:14.204Z`. It returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. Exact arguments, UTC and local timestamps, and `scientific_job_executed=false` are retained in `outputs/rosalind-open-observation.json` and cited by `outputs/provenance.json`.

The launcher observation establishes only that the task chooser was ready. It does not establish a scientific run and did not retrieve coordinates, calculate a pocket, alter a sequence, or predict fluorescence.

## Interpretation

PDB 1EMA is a strong teaching reference for planning a transparent pocket query. A computed residue list would need an explicit chromophore representation, chain and residue mapping, atom-selection rule, distance cutoff, and retained output.

## Reproduce

1. Read `prompt.md` and `inputs/public-source.md`.
2. Inspect the current RCSB PDB 1EMA record and compare it with `outputs/verification-receipt.json`.
3. Verify `outputs/rosalind-open-observation.json` separately from the structural evidence.
4. Use `outputs/session-bundle.md` as the teaching index and review the preview.

## Limitations

- No coordinate query or complete pocket residue list is retained.
- No sequence change, structural optimization, or fluorescence prediction was produced.
- The source record may change after the recorded date.

## Retained execution prompt

# GFP chromophore pocket

Review public PDB 1EMA as structural context for a future chromophore-pocket query. Keep source observations separate from any unperformed coordinate calculation, and state the atom-selection and distance criteria that such a query would require. Do not create, mutate, optimize, rank, or propose protein sequences.

Cite `outputs/verification-receipt.json` for the retained source summary and `outputs/rosalind-open-observation.json` for the genuine case-specific `mcp__rosalind__rosalind_open` response. The launcher observation records only a ready task chooser and does not establish that a scientific job ran.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
