# Whole-structure nonbonded overlap diagnostic

## Scientific question

Do any admitted heavy-atom pairs in deposited model 1 of RCSB 1CRN exceed a 0.4 Å van der Waals overlap under an explicit local method?

## Source observation

The retained public PDB snapshot records an X-ray model at 1.50 Å resolution. The analysis admits 327 C, N, O, S, and P atoms with positive occupancy and blank or `A` alternate location.

## Computed result

After excluding atom pairs separated by one, two, or three inferred covalent bonds, 51,964 nonbonded pairs were tested. No pair exceeded 0.4 Å overlap using radii C 1.70, N 1.55, O 1.52, S 1.80, and P 1.80 Å.

## Interpretation

The zero count applies only to this deposited coordinate set and the recorded heavy-atom method. A reported overlap would mark coordinates for inspection; it would not automatically identify an erroneous residue. Likewise, this result is not an all-atom validation score.

## Limitations

- Hydrogen atoms are absent and are not added or optimized, so this is not a MolProbity clashscore.
- Bonds are inferred from within-residue covalent radii, peptide C–N distances, and CYS SG–SG distances.
- Crystallographic symmetry mates, coordinate uncertainty, and dynamics are not included.

## Reproduce

```powershell
python showcases/molecular-structure-viewer/cases/structure-clash-screen/scripts/analyze.py
```

The script regenerates `outputs/clash-screen.json` and the SVG preview from the retained coordinate snapshot.

## Rosalind Workbench observation

`outputs/rosalind-open-observation.json` records a case-specific `mcp__rosalind__rosalind_open` call and the exact ready message returned by the launcher. The call only opened the research-task chooser; it did not select a task or execute a Rosalind scientific job.
