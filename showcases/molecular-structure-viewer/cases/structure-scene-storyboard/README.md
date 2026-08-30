# Reproducible adenylate-kinase storyboard

## Scientific question

Can open and AP5-bound adenylate kinase be represented as named molecular scenes whose object visibility, transforms, styling, and camera state can be restored exactly?

## Retained public inputs

The case includes pinned RCSB 4AKE and 1AKE PDB files. Chain A contributes 214 matched Cα atoms in each structure. The 1AKE file contains AP5, including 64 chain-A atom records and 57 primary-conformer atom records.

## Executed local evidence

`scripts/build_storyboard_evidence.py` parsed the coordinates and generated `outputs/storyboard-model.json` plus `outputs/reversibility-comparison.json`.

- An ordinary least-squares Kabsch fit over all 214 matched chain-A Cα atoms gives 7.130700 Å RMSD. This value belongs to the local script; it is distinct from a Structure Viewer TM-align result.
- The CORE-to-NMP centroid distance is 22.287398 Å in 4AKE and 18.185715 Å in fitted 1AKE.
- The CORE-to-LID centroid distance is 30.806052 Å in 4AKE and 20.978079 Å in fitted 1AKE.
- The local model contains open, AP5-bound, 70 Å side-by-side, and fitted-overlay scenes.
- Applying the side-by-side and fitted-overlay states and then restoring the complete open state reproduced all compared JSON fields exactly.

These domain-centroid distances summarize coordinate geometry. They do not provide rates, energetics, or a catalytic mechanism.

## Scene design

| Scene | Objects shown | Transform | Scientific purpose |
|---|---|---|---|
| `01-open-state` | 4AKE | identity | Establish the apo open conformation |
| `02-ap5-bound-state` | 1AKE and AP5 | identity | Show the ligand-bound conformation |
| `03-side-by-side` | both | 1AKE translated +70 Å on x | Compare silhouettes without implying molecular displacement |
| `04-local-kabsch-overlay` | both | retained 4×4 fit matrix | Inspect residual domain motion after a documented local fit |

## Mounted-viewer object history

`outputs/structure-operation-evidence.json` preserves UTC timestamps, scientific arguments, revisions, and responses from a mounted 4AKE/1AKE session; nonportable session and resource identifiers are intentionally omitted. The viewer loaded 1AKE as `ap5a-bound-copy`, translated it by 4 Å along x, then successfully performed undo, redo, and a final undo. The matrices returned by the viewer show the sequence identity → +4 Å → identity → +4 Å → identity. The final transform therefore matches the pre-test state.

The same session hid only `ap5a-bound-copy` and then restored its visibility. Both coordinate models remained loaded, and the retained PDB files were unchanged. `outputs/structure-operation-provenance.json` records the public sources and session interval; `outputs/teaching-bundle.md` separates the viewer observations from the local Kabsch computation and biological interpretation.

`outputs/viewer-operation-plan.json` still describes scene save, restore, deletion, and object removal. Those remaining operations were not executed in the mounted session and are not newly claimed here.

## Related-data authorization attempt

`outputs/related-data-authorization-blocker.json` records a fresh open of the retained public 4AKE input through its project path. The server session was created, but the view remained `presentation-issued` and render-pending; an authoritative state read timed out, and the session later became inactive. The related-data request returned `available: false` because trusted file metadata was not bound. No directory listing or image token was returned, so neither `structure_browse_related_data` nor `structure_load_background` is claimed.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with this case's task context at `2026-08-29T18:07:20.195Z`. The exact arguments and response are retained in the 631-byte `outputs/rosalind-open-observation.json`. The call opened only the task chooser; it did not submit 4AKE or 1AKE, create or restore molecular scenes, or execute a Rosalind scientific job.

## Reproduce the local evidence

```powershell
python scripts/build_storyboard_evidence.py `
  --open inputs/4AKE.pdb `
  --closed inputs/1AKE.pdb `
  --scene-output outputs/storyboard-model.json `
  --comparison-output outputs/reversibility-comparison.json
```

The script requires NumPy and writes deterministic JSON with LF line endings.

## Limitations

- The fitted overlay uses a local all-correspondence Kabsch calculation; native Structure Viewer alignment metrics remain unmeasured here.
- The 70 Å translation is presentation geometry.
- Exact restoration is proven for the retained JSON model, and the mounted viewer independently verified transform undo/redo. Named-scene persistence still awaits execution.
- The fresh related-data attempt did not yield an authenticated directory listing or image token; background state was not changed.
- Two deposited conformations cannot establish a transition path, equilibrium population, or catalytic rate.
