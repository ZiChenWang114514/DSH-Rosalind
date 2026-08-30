# Residue selection and distance

## Scientific question

What is the closest deposited heavy-atom distance between lysozyme residues GLU A:35 and ASP A:52 in RCSB 1LYZ?

## Source observation

The retained public PDB snapshot records an X-ray model at 2.00 Å resolution. The two selections use model 1, `ATOM` records, author chain A, and author residue numbers 35 and 52. The selection admits non-hydrogen atoms with positive occupancy and blank or `A` alternate location.

## Computed result

GLU A:35 contributes 9 heavy atoms and ASP A:52 contributes 8, giving 72 pairwise distances. The minimum is **5.951 Å**, between GLU OE1 (atom serial 276) and ASP OD2 (atom serial 405). The full typed result is retained in `outputs/residue-distance.json`.

## Interpretation

This case teaches exact author-numbered selections and a closest-heavy-atom measurement. The value is a separation in one deposited coordinate model; it does not establish a bond, attraction, or interaction energy.

## Limitations

- The calculation does not model coordinate uncertainty or molecular motion.
- The deposited model lacks hydrogen atoms, so only heavy atoms are compared.
- A different model, structure revision, residue pair, or alternate-location policy can produce a different value.

## Reproduce

From the repository root, run:

```powershell
python showcases/molecular-structure-viewer/cases/structure-residue-selection/scripts/analyze.py
```

The script reads the retained PDB snapshot and regenerates the JSON result and SVG preview without network access.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with this case's task context at `2026-08-29T18:03:11.334Z`. The 626-byte `outputs/rosalind-open-observation.json` retains the exact arguments and response. The call opened only the task chooser; it did not submit 1LYZ, create the residue selections, measure their distance, or execute a Rosalind scientific job.
