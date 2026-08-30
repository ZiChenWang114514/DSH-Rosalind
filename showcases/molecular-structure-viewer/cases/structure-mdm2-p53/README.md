# MDM2–p53 interface analysis

This display-ready showcase packages the pinned 1YCR source, a locally recomputed 4 Å contact result, the Molecular Structure Viewer starter contract, and a transparent current-host status record.

![MDM2–p53 interface summary](previews/mdm2-p53.svg)

## Scientific question

What does a 4 Å coordinate-contact analysis reveal about the MDM2–p53 peptide interface, and how should the viewer's buried-area metric be reported?

## Source observations and computed result

- The downloaded RCSB 1YCR file matched the plugin contract: 94,041 bytes, 818 atoms, and the declared SHA-256 digest.
- Chain A contains 705 atoms and chain B contains 113 atoms.
- A direct coordinate calculation over all cross-chain atom pairs found exactly 105 contacts at or below 4.0 Å, spanning 34 residue pairs.
- Author-numbered p53 Phe19, Trp23, and Leu26 are present in chain B and are the workflow's labeled hotspots.

## Starter-contract metric

The plugin's shipped contract specifies a Shrake–Rupley calculation with a 1.4 Å probe and 240 samples. Its expected one-sided interface area is 735.864963 Å², while total SASA loss across both partners is 1471.729925 Å². These are distinct geometric quantities and are not affinity or energy estimates.

The buried-area values remain starter-contract targets because they were not recomputed in the current session. The mounted viewer did acknowledge the interface-display operations recorded below.

## Mounted-viewer operation evidence

`outputs/structure-operation-evidence.json` retains UTC timestamps, scientific arguments, revisions, and responses for the following successful operations in one recoverable 1YCR session. Nonportable session, caller, and command identifiers are intentionally omitted.

- `structure_control_viewer` enabled the sequence strip and measurements with atom-level picking.
- `structure_pymol_actions` authenticated 24 typed actions at scene revision 1.
- `structure_manage_guides` created a best-fit plane from all 113 atoms of p53 chain B at revision 2.
- `structure_derive_object` created `p53-chain-labeled-copy`, renaming chain B to P in a new mmCIF-backed object while leaving `primary` unchanged.
- `structure_pymol_action` added a chain-B sticks layer while retaining the complete cartoon, producing two live style layers at revision 4.

These are viewer-state observations. They do not extend the local 4 Å contact calculation or supply a new buried-area value. `outputs/structure-operation-provenance.json` describes the source, session, revision sequence, and reversible-state policy; `outputs/teaching-bundle.md` keeps the teaching summary tied to those records.

The related-data request returned `available: false` because active workspace roots were not bound to the viewer session. Consequently no authenticated PNG/JPEG token existed, and `structure_load_background` was not called. Neither operation is listed as a covered capability.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with this case's task context at `2026-08-29T18:03:11.265Z`. The 615-byte record `outputs/rosalind-open-observation.json` retains the exact arguments and response. The call opened only the task chooser; it did not submit 1YCR, calculate contacts or buried area, or execute a Rosalind scientific job.

## Reproduce

1. Open `inputs/1YCR.pdb` once with Molecular Structure Viewer 0.1.80.
2. Confirm chains A and B and run `contacts` with a 4.0 Å cutoff.
3. Run `buried_area` between atom-disjoint chains A and B with a 1.4 Å probe and 240 samples.
4. Keep the complete complex as cartoon and add chain-B Phe19, Trp23, and Leu26 as labeled sticks.
5. Report interface area and total SASA loss separately with method provenance.
6. Inspect `outputs/structure-operation-evidence.json` before teaching the mounted-viewer actions; do not infer a fresh buried-area calculation from those display receipts.

The separate Rosalind observation documents task-chooser availability only and must not be used as evidence that these structure operations ran in Rosalind Workbench.
