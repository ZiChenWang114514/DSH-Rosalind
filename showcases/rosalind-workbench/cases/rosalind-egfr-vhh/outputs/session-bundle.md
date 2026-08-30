# Codex showcase lesson: EGFR VHH candidate design

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-egfr-vhh` (EGFR VHH candidate design). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-egfr-vhh`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `protein-and-antibody-design`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `RCSB PDB public record inspection`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: Which public EGFR structural features support a compact VHH design exercise?
- Recorded next step: Inspect the PDB 4KRL EGFR-7D12 interface and identify which recorded structural features could support a VHH design exercise.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-egfr-vhh/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-egfr-vhh/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-egfr-vhh/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-egfr-vhh/inputs/public-source.md`
- output: `showcases/rosalind-workbench/cases/rosalind-egfr-vhh/outputs/verification-receipt.json`
- output: `showcases/rosalind-workbench/cases/rosalind-egfr-vhh/outputs/provenance.json`
- output: `showcases/rosalind-workbench/cases/rosalind-egfr-vhh/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-egfr-vhh/outputs/session-bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-egfr-vhh/previews/preview.svg`

## Public sources

- https://www.rcsb.org/structure/4KRL
- installed-plugin://rosalind-workbench/tool-contract

## Retained case guide

# EGFR VHH candidate design

This ready teaching case uses an existing experimental EGFR–VHH structure. It documents public evidence and reproducibility without generating a new candidate.

![EGFR VHH candidate design](../previews/preview.svg)

## Scientific question

Which public EGFR structural features support a compact VHH design exercise?

## Source observations

- RCSB PDB 4KRL is an X-ray structure of nanobody/VHH 7D12 bound to domain III of the human EGFR extracellular region.
- The record reports 2.85 Å resolution and a heterodimeric assembly containing one VHH chain and one EGFR chain.
- The retained evidence describes a published complex. No new VHH sequence, docking pose, optimization, or ranking is present in this case.

The dated, case-specific source summary is stored in `outputs/verification-receipt.json`; acquisition details are in `inputs/public-source.md`.

## Rosalind Workbench observation

One genuine `mcp__rosalind__rosalind_open` call was made with this case's task context at `2026-08-29T18:23:14.117Z`. It returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. Exact arguments, UTC and local timestamps, and `scientific_job_executed=false` are retained in `outputs/rosalind-open-observation.json` and cited by `outputs/provenance.json`.

The launcher observation establishes only that the task chooser was ready. It does not establish a scientific run and did not analyze the 4KRL interface or generate a VHH candidate.

## Interpretation

PDB 4KRL offers a concrete example for discussing how an experimentally observed EGFR–VHH pose can inform later research questions. Any future residue-level interface analysis or design claim needs its own computation and validation record.

## Reproduce

1. Read `prompt.md` and `inputs/public-source.md`.
2. Inspect the current RCSB PDB 4KRL record and compare it with `outputs/verification-receipt.json`.
3. Verify `outputs/rosalind-open-observation.json` separately from the structural evidence.
4. Use `outputs/session-bundle.md` as the teaching index and review the preview.

## Limitations

- No coordinate analysis, docking, sequence creation, optimization, or ranking was performed.
- The source record may change after the recorded date.
- Experimental structure evidence for 7D12 does not validate a new VHH candidate.

## Retained execution prompt

# EGFR VHH candidate design

Review public PDB 4KRL as an evidence-led teaching case for an already reported EGFR–7D12 VHH complex. Keep the published structure observations separate from any hypothetical design work. Do not create, mutate, optimize, rank, or propose VHH sequences.

Cite `outputs/verification-receipt.json` for the retained source summary and `outputs/rosalind-open-observation.json` for the genuine case-specific `mcp__rosalind__rosalind_open` response. The launcher observation records only a ready task chooser and does not establish that a scientific job ran.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
