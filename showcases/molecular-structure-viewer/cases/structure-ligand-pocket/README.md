# Bound-ligand contact shell

## Scientific question

Which protein residues in deposited model 1 of RCSB 1IEP have a heavy atom within 4.0 Å of bound STI A:201?

## Source observation

The retained public PDB snapshot records an X-ray model at 2.10 Å resolution and contains two independent protein–STI copies. This case selects the 37 heavy atoms of STI A:201 and protein chain A, with positive occupancy and blank or `A` alternate location. STI B:202 and protein chain B are excluded.

## Computed result

Twenty-one protein residues form the 4.0 Å contact shell, comprising 115 protein–ligand atom pairs. The shortest residue-level pair is ILE A:360 O to STI N51 at 2.668 Å. THR A:315, MET A:318, ASP A:381, and GLU A:286 follow at 2.883, 2.899, 2.901, and 2.996 Å. The JSON output retains all 21 residues, closest pairs, atom serials, and per-residue pair counts.

## Interpretation

The result is a geometric neighborhood around one deposited ligand copy. It can support pocket inspection and reproducible selections, while it does not measure affinity, potency, selectivity, optimization value, or clinical effect.

## Limitations

- Contact membership changes with cutoff, alternate-location policy, model, or crystallographic copy.
- Hydrogen atoms, protonation, solvent mediation, dynamics, and interaction energies are not evaluated.
- A deposited bound pose alone does not establish cellular or clinical activity.

## Reproduce

```powershell
python showcases/molecular-structure-viewer/cases/structure-ligand-pocket/scripts/analyze.py
```

The script regenerates `outputs/ligand-contact-shell.json` and the SVG preview from the retained coordinate snapshot.

## Rosalind Workbench observation

`outputs/rosalind-open-observation.json` records a case-specific `mcp__rosalind__rosalind_open` call and the exact ready message returned by the launcher. The call only opened the research-task chooser; it did not select a task or execute a Rosalind scientific job.
