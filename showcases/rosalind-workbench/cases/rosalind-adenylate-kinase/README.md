# Adenylate kinase conformational comparison

![Adenylate kinase conformational comparison](previews/preview.svg)

## Scientific question

How do the public 4AKE open structure and AP5-bound 1AKE structure differ in a transparent chain-A coordinate comparison?

## Public coordinate sources

The case retains pinned RCSB PDB files for 4AKE and 1AKE. Their sizes and SHA-256 values match the repository's independently verified adenylate-kinase example. 4AKE contains 3,459 ATOM/HETATM records; 1AKE contains 3,816. Each chain A contributes 214 Cα atoms, and 1AKE contains 57 primary-conformer AP5 atoms in chain A.

No official Rosalind task describes an adenylate-kinase conformational comparison, so this case has no associated Rosalind task ID. Its recorded Workbench operation is limited to opening the task chooser.

## Executed deterministic analysis

`build_case.py` performs an ordinary least-squares Kabsch fit over all 214 matched chain-A Cα atoms. The resulting RMSD is 7.130700 Å and the maximum Cα residual is 18.336170 Å. This calculation differs from TM-align and is identified as a local coordinate result.

Using CORE residues 1–29, 60–121, and 160–214; NMP residues 30–59; and LID residues 122–159:

| Structure state | CORE–NMP centroid distance | CORE–LID centroid distance |
|---|---:|---:|
| 4AKE open | 22.287398 Å | 30.806052 Å |
| 1AKE AP5-bound after global fit | 18.185715 Å | 20.978079 Å |

The shorter domain-centroid distances in 1AKE describe closure in these coordinates. They are not binding, kinetic, or energetic measurements.

## Observed Rosalind Workbench invocation

`mcp__rosalind__rosalind_open` was genuinely invoked at `2026-08-29T18:20:51.563Z`. The exact response was `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The 914-byte `outputs/rosalind-open-observation.json` retains the case-specific arguments, timestamps, response, and `scientific_job_executed=false`.

The launcher call did not receive either PDB file. The retained coordinate files and local NumPy calculation support the structural results.

## Limitations

- The all-correspondence Kabsch RMSD is sensitive to large domain motion and is distinct from a fold-aware TM-align score.
- Domain definitions are explicit teaching definitions and should be reviewed for another biological question.
- No Rosalind structure analysis, molecular simulation, binding experiment, or wet-lab procedure was executed.

## Reproduce

```powershell
python showcases/rosalind-workbench/cases/rosalind-adenylate-kinase/build_case.py
python scripts/showcase_session.py bundle rosalind-adenylate-kinase --output showcases/rosalind-workbench/cases/rosalind-adenylate-kinase/bundle.md
```

The script verifies both source digests, 214 matched Cα atoms, AP5 presence, output JSON, and the tabular domain distances.
