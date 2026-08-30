# Codex showcase lesson: Oral candidate property comparison

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-oral-candidates` (Oral candidate property comparison). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-oral-candidates`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `adme-and-developability`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind.rosalind_open`, `rosalind-workbench.public-evidence`
- Rosalind tasks: none recorded
- Actual tools: `Rosalind Workbench mcp__rosalind__rosalind_open`, `PubChem PUG REST`, `Python 3.14`, `RDKit 2026.03.5`
- Summary: How can five public molecular-property records support a transparent oral-candidate comparison?
- Recorded next step: Recompute descriptors and threshold counts for the five CID-exact oral reference drugs in the retained comparison.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/inputs/public-source.md`
- input: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/inputs/compounds.csv`
- input: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/scripts/analyze.py`
- output: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/outputs/property-comparison.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/outputs/result-summary.json`
- output: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/outputs/teaching-bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-oral-candidates/previews/preview.svg`

## Public sources

- https://pubchem.ncbi.nlm.nih.gov/compound/5291
- https://pubchem.ncbi.nlm.nih.gov/compound/123631
- https://pubchem.ncbi.nlm.nih.gov/compound/176870
- https://pubchem.ncbi.nlm.nih.gov/compound/71496458
- https://pubchem.ncbi.nlm.nih.gov/compound/5329102

## Retained case guide

# Five oral-drug property profiles

![Five oral-drug descriptor table](../previews/preview.svg)

## Scientific question

What can a reproducible molecule-only descriptor table reveal about five orally administered kinase-inhibitor reference drugs, and what remains unresolved?

## Source observations

`inputs/compounds.csv` retains exact PubChem records for imatinib (CID 5291), gefitinib (CID 123631), erlotinib (CID 176870), osimertinib (CID 71496458), and sunitinib (CID 5329102), including structures, formulas, molecular weights, XLogP, TPSA, hydrogen-bond counts, and rotatable bonds.

## Computed results

RDKit 2026.03.5 recomputes molecular weight, MolLogP, TPSA, hydrogen-bond counts, rotatable bonds, aromatic rings, fraction sp3, and QED. It also counts exceedances of four Lipinski thresholds and two Veber-style thresholds. All five molecules have zero exceedances under the exact definitions retained in `outputs/result-summary.json`.

The set still spans RDKit molecular weights from 393.44 to 499.62, MolLogP from 3.33 to 4.59, TPSA from 68.74 to 87.55 Å², and QED from 0.311 to 0.626.

## Interpretation

Simple thresholds describe molecular-property regions and can support early comparison. The five reference drugs illustrate that satisfying these thresholds does not supply a clinical ranking or explain oral exposure by itself.

## Rosalind Workbench observation

The genuine `mcp__rosalind__rosalind_open` call at `2026-08-29T17:56:31.387Z` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The case-specific arguments and exact observed response are retained in `outputs/rosalind-open-observation.json`.

This operation only opens the Rosalind task chooser. It does not prove that an oral-property scientific task ran; the exact public records and deterministic local calculations above provide the scientific evidence in this case.

## Limitations

- No salt form, solid state, formulation, dissolution, permeability, transporter, metabolism, dose, or exposure data are modeled.
- QED and the listed descriptors are computed molecule-level quantities.
- Threshold exceedances do not rank efficacy, safety, developability, or probability of oral success.
- These are reference drugs, not prospectively selected development candidates.
- The Workbench chooser was opened, while no Rosalind scientific job was executed.

## Reproduce

```powershell
python showcases/rosalind-workbench/cases/rosalind-oral-candidates/scripts/analyze.py
```

Inspect `outputs/property-comparison.csv`, `outputs/result-summary.json`, `outputs/rosalind-open-observation.json`, and `previews/preview.svg`.

## Retained execution prompt

# Five oral-drug property profiles

Use exact PubChem records for imatinib, gefitinib, erlotinib, osimertinib, and sunitinib. Recompute a compact descriptor table with RDKit and apply transparent Lipinski and Veber-style thresholds.

Describe the output as a molecule-only comparison of five orally administered reference drugs. Do not infer oral bioavailability, dose, exposure, efficacy, safety, or clinical ranking from these descriptors.

Inspect `outputs/rosalind-open-observation.json` as the case-specific record of a genuine Rosalind Workbench `mcp__rosalind__rosalind_open` invocation. State that it opened only the task chooser and did not execute a scientific job; use the local descriptor table as scientific evidence.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
