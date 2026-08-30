# Heme contact environment

## Scientific question

What protein contact shell and iron-centered geometry are present around HEM A:155 in deposited model 1 of RCSB 1MBN?

## Source observation

The retained public PDB snapshot records an X-ray model at 2.00 Å resolution. HEM A:155 contains 43 admitted heavy atoms. Protein contacts use chain A `ATOM` records; all selections require positive occupancy and blank or `A` alternate location.

## Computed result

Fifteen protein residues have a heavy atom within 4.0 Å of the heme. The closest is HIS A:93 NE2 to Fe at 2.191 Å. The four Fe–porphyrin nitrogen distances are 2.007, 1.967, 2.054, and 2.078 Å (mean 2.026 Å). Fe lies 0.241 Å from the explicitly defined diagonal N4 plane. OH A:154 O and HIS A:93 NE2 lie within 3.0 Å of Fe, at 2.147 and 2.191 Å.

## Interpretation

These values describe one deposited heme environment. They support inspection of coordination geometry and nearby residues, while remaining silent about energy, affinity, oxidation state, or functional performance.

## Limitations

- The 4.0 Å shell depends on the chosen cutoff.
- The N4 plane is defined by the NA/NB/NC/ND centroid and the cross product of the NA→NC and NB→ND diagonals; it is not a full porphyrin normal-mode analysis.
- Coordinate uncertainty, crystal packing, solvent dynamics, and alternative chemical states are not modeled.

## Reproduce

```powershell
python showcases/molecular-structure-viewer/cases/structure-heme-contacts/scripts/analyze.py
```

The script regenerates `outputs/heme-geometry.json` and `previews/preview.svg` from the retained PDB snapshot.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with this case's task context at `2026-08-29T18:03:11.355Z`. The exact arguments and response are retained in the 621-byte `outputs/rosalind-open-observation.json`. The call opened only the task chooser; it did not submit 1MBN, calculate the heme contact shell or iron geometry, or execute a Rosalind scientific job.
