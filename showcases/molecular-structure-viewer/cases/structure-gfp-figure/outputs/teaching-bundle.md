# Codex showcase lesson: Provenance-bearing GFP figure

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `structure-gfp-figure` (Provenance-bearing GFP figure). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `structure-gfp-figure`
- Plugin: `molecular-structure-viewer` (Molecular Structure Viewer v0.1.80)
- Status: `ready`
- Domain: `structure-and-sequence`
- Case type: `render`
- Difficulty: `intermediate`
- Evidence level: `computed-result`
- Covered operations: `structure-viewer.structure_render_image`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Molecular Structure Viewer PNG and render provenance sidecar`, `RCSB PDB 1EMA coordinate snapshot and Python 3 standard library`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: Style the 1EMA chromophore and render a publication-ready image.
- Recorded next step: Open the case README to present the inspected PNG, contact analysis, and render provenance.
- Plugin guide: `showcases/molecular-structure-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/README.md`
- case manifest: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/showcase.json`
- teaching prompt: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/prompt.md`
- input: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/inputs/public-source.md`
- input: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/inputs/1EMA.pdb`
- input: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/scripts/verify_figure.py`
- output: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/previews/gfp.png`
- output: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/previews/gfp.png.render.json`
- output: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/outputs/rosalind-open-observation.json`
- output: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/outputs/background-operation-blocker.json`
- output: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/outputs/source-provenance.json`
- output: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/outputs/chromophore-contacts.json`
- output: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/outputs/structure-operation-evidence.json`
- output: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/outputs/teaching-bundle.md`
- preview: `showcases/molecular-structure-viewer/cases/structure-gfp-figure/previews/gfp.png`

## Public sources

- https://www.rcsb.org/structure/1EMA
- https://files.rcsb.org/download/1EMA.pdb
- RCSB PDB 1EMA, supplied to the viewer by the plugin's bundled example

## Retained case guide

# GFP chromophore structure showcase

This ready showcase uses Molecular Structure Viewer and the public RCSB entry 1EMA to present the GFP beta barrel and its CRO chromophore. The official entry is [RCSB PDB 1EMA](https://www.rcsb.org/structure/1EMA), and the exact [RCSB coordinate download](https://files.rcsb.org/download/1EMA.pdb) used by the retained render is preserved as `inputs/1EMA.pdb`.

![GFP beta barrel and CRO chromophore](../previews/gfp.png)

## Scientific question

Where is the mature GFP chromophore located within the protein fold, and which nearby residues lie within a 4 Å heavy-atom distance in the displayed crystal coordinates?

## Source observations

- 1EMA is an X-ray structure reported at 1.9 Å resolution.
- The displayed model contains one protein chain, 225 polymer residues, 1,866 atoms, and one CRO component.
- CRO is identified by author chain A and residue 66.
- The retained PDB is 190,188 bytes with SHA-256 `f1b9fdc2b871cc41f21f645a21b4948ce12d79b29197256330b108c9b503b088`, exactly matching the source digest recorded by the render sidecar.

## Viewer analysis

- A deterministic case-local calculation reproduces 18 polymer residues within 4.0 Å using the closest heavy-atom Euclidean distance in the retained coordinates.
- Examples below 3.1 Å include Thr203 (2.666 Å), Arg96 (2.730 Å), Val61 (2.778 Å), Thr62 (2.795 Å), Glu222 (2.813 Å), His148 (2.850 Å), and Gln94 (3.028 Å).
- The 1600×1200 PNG uses a dark background, studio lighting, a protein cartoon, element-colored ligand sticks, and no displayed hydrogens.
- The PNG does not contain a visible CRO text label. The retained render sidecar also records no scientific annotations, so label creation is not claimed as a completed operation.

## Artifacts

- `previews/gfp.png` — inspected PNG preview.
- `previews/gfp.png.render.json` — render settings and provenance.
- `inputs/1EMA.pdb` and `scripts/verify_figure.py` — exact public coordinate input and deterministic verifier.
- `outputs/chromophore-contacts.json` — reproducible 4.0 Å contact shell with atom identities and covalent-contact cautions.
- `outputs/structure-operation-evidence.json` — successful image-render evidence derived from the viewer-written PNG and sidecar, plus the explicitly unverified operations.
- `outputs/rosalind-open-observation.json` — 619-byte record of the genuine case-specific Rosalind task-chooser call.
- `outputs/background-operation-blocker.json` — the fresh project-backed authorization evidence and the resulting decision not to call `structure_load_background` without an authenticated image token.
- `inputs/public-source.md` and `outputs/source-provenance.json` — official 1EMA URLs, current RCSB observations, retained coordinate identity, and equality with the render source digest.
- `outputs/teaching-bundle.md` — evidence-aware lesson index with source observations, viewer results, interpretation, and limitations.

Internal viewer, resource, and render UUIDs have been removed from public receipts because they have no scientific meaning and cannot be reused outside the original app session. Scientific parameters, timestamps, dimensions, hashes, revisions, and response messages remain available.

## Background-image operation status

A fresh attempt opened the retained public 4AKE file from the project. The server session was created and reported source-relative publication support, but the molecular view remained `presentation-issued` with `renderState: pending`; the first authoritative state read timed out. A later state check reported that the session was no longer active. `structure_browse_related_data` then returned `available: false` because trusted file metadata was not bound to that session. It returned no directory listing and no PNG/JPEG token. The installed viewer accepts a background only through such a token from the same browse call, so `structure_load_background` was not invoked. Both operations remain absent from the capability list.

## Reproduce the retained scientific result

Run:

```powershell
python scripts/verify_figure.py
```

The script verifies the PDB, PNG, and sidecar identities, rebuilds the 18-residue CRO contact shell, and writes the image-render evidence record. It does not claim a fresh viewer open, contact analysis, scene application, or render validation call.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked at `2026-08-29T18:03:11.311Z`; the retained record includes the exact arguments and response. The call opened only the task chooser. It did not submit 1EMA, calculate the CRO contact shell, render the PNG, or execute a Rosalind scientific job.

## Interpretation

The chromophore lies in the protected interior of the GFP beta barrel. The contact list describes coordinate proximity; it does not measure bond energy or binding affinity. The very short 1.332 Å records reflect CRO's covalent incorporation into the GFP polypeptide and should not be discussed as ordinary noncovalent ligand contacts.

The task-chooser response is interface evidence only and does not add a Rosalind-generated scientific result to this case.

## Retained execution prompt

# Prompt

Inspect the retained 1EMA GFP figure and reproduce its 4.0 Å CRO contact shell from `inputs/1EMA.pdb` with `scripts/verify_figure.py`. Use `outputs/structure-operation-evidence.json` to identify the completed image render and the operations for which no direct successful receipt exists. Describe the visible protein cartoon, CRO sticks, dark background, and 1600×1200 output, but do not claim a visible CRO text label. Cite `inputs/public-source.md` and `outputs/source-provenance.json` for the official RCSB source and its byte identity with the render source digest. For workspace-image backgrounds, inspect `outputs/background-operation-blocker.json`: the viewer remained unready, the related-data request returned `available: false`, no authenticated image token was returned, and `structure_load_background` was not invoked. Invoke `mcp__rosalind__rosalind_open` with this case's task context, cite `outputs/rosalind-open-observation.json`, and state that the task-chooser response does not show that a Rosalind scientific job ran.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
