# Codex showcase lesson: Adenylate kinase conformational comparison

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `structure-adenylate-kinase` (Adenylate kinase conformational comparison). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `structure-adenylate-kinase`
- Plugin: `molecular-structure-viewer` (Molecular Structure Viewer v0.1.80)
- Status: `ready`
- Domain: `structure-and-sequence`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `computed-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `RCSB PDB 4AKE and 1AKE coordinate snapshots`, `Molecular Structure Viewer 0.1.80 starter-example contract`, `local deterministic PDB record and digest checks`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: Align RCSB 4AKE and 1AKE and report structural comparison metrics.
- Recorded next step: Open the case README to inspect the pinned structures, AP5 observations, starter-contract alignment metrics, and viewer execution status.
- Plugin guide: `showcases/molecular-structure-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/README.md`
- case manifest: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/showcase.json`
- teaching prompt: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/prompt.md`
- input: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/inputs/4AKE.pdb`
- input: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/inputs/1AKE.pdb`
- output: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/outputs/results.json`
- output: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/outputs/provenance.json`
- output: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/outputs/rosalind-open-observation.json`
- output: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/outputs/teaching-bundle.md`
- preview: `showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/previews/adenylate-kinase.svg`

## Public sources

- https://www.rcsb.org/structure/4AKE
- https://www.rcsb.org/structure/1AKE
- https://files.rcsb.org/download/4AKE.pdb
- https://files.rcsb.org/download/1AKE.pdb

## Retained case guide

# Adenylate kinase conformational change

This showcase prepares a Codex-native comparison of open adenylate kinase (4AKE) and the AP5-bound closed form (1AKE). The two coordinate files are pinned in `inputs/`, and the preview uses teal for 4AKE, magenta for 1AKE, and amber for AP5.

## Source observations

- The pinned 4AKE file contains 3,459 ATOM/HETATM records and 214 chain-A C-alpha atoms.
- The pinned 1AKE file contains 3,816 ATOM/HETATM records and 214 chain-A C-alpha atoms.
- AP5 is present in 1AKE; the chain-A ligand contains 64 atoms.
- File sizes and digests match the repository's starter contract.

## Alignment result carried by the starter contract

The starter contract specifies Mol* TM-align 5.11.0 using chain-A protein C-alpha atoms: 214 aligned residues, RMSD 8.0437 Å, and TM-scores 0.68385 for both reference and mobile structures. These values are retained as expected results because the current host's preceding structure-viewer session remained in a pending render state. They are not described as a fresh interactive computation.

## Scientific interpretation

The expected alignment is consistent with a shared adenylate-kinase fold undergoing a pronounced domain rearrangement between open and ligand-bound forms. AP5 marks the active-site region in the closed structure. This interpretation should be revisited if a clean viewer rerun produces different metrics.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with this case's task context at `2026-08-29T18:03:11.286Z`. The exact arguments and response are retained in the 633-byte `outputs/rosalind-open-observation.json`. The call opened only the task chooser; it did not submit 4AKE or 1AKE, align either structure, or execute a Rosalind scientific job.

## Reproduce in Codex

1. Before using the viewer, verify `inputs/4AKE.pdb` as 309,339 bytes with SHA-256 `ff798ee8791878eb58bac1c6bed32042f51b455512ac93b50bda8fa0ff0e7f78`, and `inputs/1AKE.pdb` as 357,777 bytes with SHA-256 `651e952f55f1317f50f4e82b7f0e99053397032cd8da5b2896f79d0af9f619a9`.
2. Open `inputs/4AKE.pdb` once in a clean Molecular Structure Viewer session; retain that returned viewer state for every subsequent command.
3. Add `inputs/1AKE.pdb` to the same scene and retain the returned object identifier. Align protein chain A of that mobile object to chain A of 4AKE using the viewer's TM-align method.
4. Color 4AKE teal and 1AKE magenta. Select AP5 in chain A of 1AKE, create or retain the derived object as `ap5a_bound`, and display it as amber sticks.
5. Record the alignment response, including aligned-residue count, RMSD, reference TM-score, mobile TM-score, object identifiers, and applied-state acknowledgement. Only after a successful response may the contract section in `outputs/results.json` be replaced by fresh values.
6. If the viewer stays pending, times out, or returns no applied-state acknowledgement, preserve the starter-contract values and report `structure_open_from_chat`, `structure_add_structure`, `structure_align_structures`, and `structure_query` as unverified.

The exact teaching prompt is in `prompt.md`; source and execution status are recorded in `outputs/provenance.json`.

The separate Rosalind observation records task-chooser availability only and does not verify a Rosalind alignment run.

## Retained execution prompt

Verify the retained 4AKE and 1AKE file sizes and SHA-256 values listed in `README.md`. In one clean Molecular Structure Viewer session, open 4AKE once, add 1AKE, align mobile chain A to reference chain A with TM-align, color the objects teal and magenta, and show chain-A AP5 as amber sticks under the derived-object identifier `ap5a_bound`. Report the aligned-residue count, RMSD, both directional TM-scores, returned object identifiers, and applied-state acknowledgement. Replace the starter-contract metrics only when the viewer returns a successful operation receipt; otherwise state that open, add, align, and query remain unverified. Cite `outputs/provenance.json`. Also cite `outputs/rosalind-open-observation.json` and explain that its genuine task-chooser response did not submit either structure or run a Rosalind scientific job.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
