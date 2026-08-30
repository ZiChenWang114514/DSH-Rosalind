# Protein–DNA hydrogen-bond geometry

## Scientific question

Which protein–DNA atom pairs in deposited model 1 of RCSB 1LMB satisfy a transparent heavy-atom donor/acceptor geometry screen?

## Source observation

The retained public PDB snapshot records an X-ray model at 1.80 Å resolution. Author chains 1 and 2 contain DNA; author chains 3 and 4 contain protein. Only cross-interface pairs with positive occupancy and blank or `A` alternate location are evaluated.

## Computed result

The screen retains 36 candidates with donor–acceptor distance from 2.2 through 3.5 Å and an antecedent–donor–acceptor angle of at least 90°. The shortest candidate is LYS 4:3 NZ to DG 1:11 O6 at 2.574 Å and 148.6°. The JSON output records every donor, acceptor, antecedent, atom serial, distance, and angle.

## Interpretation

Each row is a plausible hydrogen-bond geometry in the deposited coordinates. The list can guide visual inspection of the interface, while it cannot supply bond strength, energetic contribution, or a hydrogen-resolved assignment.

## Limitations

- The structure has no explicit hydrogens. Donor direction is approximated with a named covalent heavy-atom antecedent; when two are available, the larger angle is retained.
- Protonation, tautomer states, water-mediated bridges, coordinate uncertainty, and dynamics are not evaluated.
- The 90° rule is an explicit educational heuristic and differs from a donor–H–acceptor angle measured with resolved hydrogens.

## Reproduce

```powershell
python showcases/molecular-structure-viewer/cases/structure-dna-hydrogen-bonds/scripts/analyze.py
```

The script regenerates `outputs/protein-dna-hydrogen-bonds.json` and the SVG preview from the retained coordinate snapshot.

## Rosalind Workbench observation

`outputs/rosalind-open-observation.json` records a case-specific `mcp__rosalind__rosalind_open` call and the exact ready message returned by the launcher. The call only opened the research-task chooser; it did not select a task or execute a Rosalind scientific job.
