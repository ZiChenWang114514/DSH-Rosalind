# Codex showcase lesson: IL-6R VHH candidate design

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-il6r-vhh` (IL-6R VHH candidate design). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-il6r-vhh`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `protein-and-antibody-design`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `UniProt REST public record inspection`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: How can an IL-6R extracellular-domain sequence guide a reproducible VHH design lesson?
- Recorded next step: Review the UniProt P08887 extracellular-domain sequence and state what additional evidence is needed before proposing VHH candidates.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-il6r-vhh/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-il6r-vhh/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-il6r-vhh/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-il6r-vhh/inputs/public-source.md`
- output: `showcases/rosalind-workbench/cases/rosalind-il6r-vhh/outputs/verification-receipt.json`
- output: `showcases/rosalind-workbench/cases/rosalind-il6r-vhh/outputs/provenance.json`
- output: `showcases/rosalind-workbench/cases/rosalind-il6r-vhh/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-il6r-vhh/outputs/session-bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-il6r-vhh/previews/preview.svg`

## Public sources

- https://www.uniprot.org/uniprotkb/P08887/entry
- https://rest.uniprot.org/uniprotkb/P08887.json
- installed-plugin://rosalind-workbench/tool-contract

## Retained case guide

# IL-6R VHH candidate design

This ready teaching case grounds its discussion in the reviewed human IL-6R alpha record. It documents receptor context and reproducibility without generating an antibody candidate.

![IL-6R VHH candidate design](../previews/preview.svg)

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

## Retained execution prompt

# IL-6R VHH candidate design

Review UniProt P08887 as an evidence-led teaching case for human IL-6R alpha identity and extracellular-domain scope. Keep the reviewed receptor annotations separate from any hypothetical antibody work. Do not create, mutate, optimize, rank, or propose VHH sequences.

Cite `outputs/verification-receipt.json` for the retained source summary and `outputs/rosalind-open-observation.json` for the genuine case-specific `mcp__rosalind__rosalind_open` response. The launcher observation records only a ready task chooser and does not establish that a scientific job ran.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
