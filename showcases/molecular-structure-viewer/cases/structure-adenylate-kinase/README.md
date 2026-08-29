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

## Reproduce in Codex

1. Open `inputs/4AKE.pdb` in Molecular Structure Viewer.
2. Add `inputs/1AKE.pdb` to the same scene.
3. Align protein chain A from 1AKE to chain A from 4AKE.
4. Color 4AKE teal and 1AKE magenta; display AP5 as amber sticks.
5. Export the alignment result and replace the contract section in `outputs/results.json` with the observed values.

The reusable prompt is in `prompt.md`; source and execution status are recorded in `outputs/provenance.json`.
