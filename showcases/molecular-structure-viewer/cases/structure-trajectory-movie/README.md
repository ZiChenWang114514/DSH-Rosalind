# Compact adenylate-kinase trajectory and movie rehearsal

## Scientific question

Can a public PSF/DCD pair be verified, reduced to an inspectable five-frame subset, and prepared for Structure Viewer playback, movie rendering, and export without overstating unexecuted viewer work?

## Public source and compatibility

Figshare 5108170 v1 provides an apo adenylate-kinase PSF and a 1.004 μs DCD under CC BY 4.0. The MDAnalysisData access module records the same file URLs and SHA-256 values retained here.

The executed local run used MDAnalysis 2.10.0 and NumPy 2.5.2. It verified both source files, then loaded 4,187 DCD frames against the 3,341-atom PSF. The system contains 214 residues and 214 protein Cα atoms. Coordinates were finite in all five sampled frames.

## Retained subset

Source frames 0, 1046, 2093, 3140, and 4186 were written to `inputs/adk-equilibrium-5frames.dcd`. Reloading the compact DCD with the retained PSF recovered five frames and 3,341 atoms with zero maximum coordinate difference at stored precision. `inputs/adk-frame0.pdb` provides a supported coordinate file for mounting the viewer before loading the PSF/DCD pair.

| Source frame | Source time (ps) | Cα RMSD to frame 0 (Å) | Protein Rg (Å) | CORE→LID centroid (Å) |
|---:|---:|---:|---:|---:|
| 0 | 0.000 | 0.000 | 17.220 | 21.525 |
| 1046 | 251040.005 | 5.628 | 19.291 | 29.202 |
| 2093 | 502320.010 | 6.072 | 19.297 | 29.254 |
| 3140 | 753600.015 | 7.271 | 19.689 | 31.140 |
| 4186 | 1004640.021 | 6.091 | 19.431 | 29.216 |

RMSD values are ordinary least-squares Kabsch fits over all 214 Cα atoms. Domain centroids use CORE residues 1-29, 60-121, and 160-214; NMP residues 30-59; and LID residues 122-159.

The increasing radius of gyration and CORE-to-LID separation in the sampled frames are consistent with more open sampled conformations relative to frame zero. Five selected frames cannot characterize the ensemble distribution or transition kinetics.

## Structure Viewer rehearsal

`outputs/viewer-operation-plan.json` defines the trajectory load, paused frame checks, once-mode movie timeline, render validation, asynchronous status handling, cancellation test, and selected exports. This task did not have a mounted Structure Viewer session. No MP4, viewer render sidecar, scene export, CSV export, or cancellation receipt is claimed.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with this case's task context at `2026-08-29T18:07:20.217Z`. The exact arguments and response are retained in the 658-byte `outputs/rosalind-open-observation.json`. The call opened only the task chooser; it did not submit the adenylate-kinase trajectory, render or export a movie, or execute a Rosalind scientific job.

## Reproduce the executed local subset

Install the pinned dependency from `scripts/requirements.txt`, download the full DCD from the Figshare URL above, and run:

```powershell
python scripts/build_subset_and_inspect.py `
  --topology inputs/adk4AKE.psf `
  --trajectory <downloaded-full-dcd> `
  --subset inputs/adk-equilibrium-5frames.dcd `
  --frame0-pdb inputs/adk-frame0.pdb `
  --json-output outputs/trajectory-inspection.json `
  --csv-output outputs/sampled-frame-metrics.csv
```

## Limitations

- The compact DCD preserves the selected coordinates and their order. Original frame numbers and times live in the CSV; playback spacing is presentational.
- The derived frame-zero PDB uses chain X and writer defaults for metadata absent from the PSF; the retained PSF remains the topology identity.
- The source trajectory is solvent-stripped and pre-aligned on the CORE domain.
- The five retained frames support inspection and rehearsal, not equilibrium statistics.
- Movie, cancellation, and export behavior require returned evidence from a mounted viewer run.
