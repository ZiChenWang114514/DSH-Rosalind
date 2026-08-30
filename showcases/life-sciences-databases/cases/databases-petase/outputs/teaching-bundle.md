# Codex showcase lesson: PETase sequence–structure map

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `databases-petase` (PETase sequence–structure map). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `databases-petase`
- Plugin: `life-sciences-databases` (Life Sciences Databases v0.1.5)
- Status: `ready`
- Domain: `public-data-integration`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `multi-tool-result`
- Covered operations: `life-sciences-databases.public-evidence`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Life Sciences Databases uniprot-skill and rcsb-pdb-skill`, `Python 3 standard library`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: How can PETase sequence, structure, and catalytic annotations be connected?
- Recorded next step: Check the IsPETase catalytic residues against the retained UniProt sequence and RCSB 5XJH structure annotations.
- Plugin guide: `showcases/life-sciences-databases/README.md`

## Repository files to inspect

- case guide: `showcases/life-sciences-databases/cases/databases-petase/README.md`
- case manifest: `showcases/life-sciences-databases/cases/databases-petase/showcase.json`
- teaching prompt: `showcases/life-sciences-databases/cases/databases-petase/prompt.md`
- input: `showcases/life-sciences-databases/cases/databases-petase/inputs/public-source.md`
- input: `showcases/life-sciences-databases/cases/databases-petase/inputs/uniprot-A0A0K8P6T7.json`
- input: `showcases/life-sciences-databases/cases/databases-petase/inputs/rcsb-5XJH.json`
- input: `showcases/life-sciences-databases/cases/databases-petase/scripts/build_case.py`
- output: `showcases/life-sciences-databases/cases/databases-petase/outputs/results.json`
- output: `showcases/life-sciences-databases/cases/databases-petase/outputs/provenance.json`
- output: `showcases/life-sciences-databases/cases/databases-petase/outputs/query-verification.json`
- output: `showcases/life-sciences-databases/cases/databases-petase/outputs/rosalind-open-observation.json`
- output: `showcases/life-sciences-databases/cases/databases-petase/outputs/teaching-bundle.md`
- preview: `showcases/life-sciences-databases/cases/databases-petase/previews/preview.svg`

## Public sources

- https://www.uniprot.org/uniprotkb/A0A0K8P6T7/entry
- https://www.rcsb.org/structure/5XJH
- https://www.rhea-db.org/rhea/49528

## Retained case guide

# PETase sequence–structure map

![PETase sequence–structure map](../previews/preview.svg)

## Scientific question

How do exact public sequence, catalytic-reaction, and crystal-structure records describe IsPETase?

## Source observations

- UniProt A0A0K8P6T7 is the reviewed 290-residue poly(ethylene terephthalate) hydrolase from *Piscinibacter sakaiensis*.
- The record annotates a 1–27 signal peptide, a 28–290 mature chain, and active-site residues S160, D206, and H237 in full-length numbering.
- The PET hydrolysis annotation carries EC 3.1.1.101 and RHEA:49528.
- RCSB PDB 5XJH is the 1.54 Å X-ray structure titled *Crystal structure of PETase from Ideonella sakaiensis*.

The exact UniProt and RCSB responses are retained under `inputs/`; `outputs/provenance.json` records both API paths and retrieval time.

## Computed result

`scripts/build_case.py` reads the UniProt sequence, reconstructs each active-site label from residue identity and position, selects the PET reaction, checks RHEA:49528 and PDB 5XJH, and writes `outputs/results.json` plus the preview.

## Interpretation

The sequence annotations and structure record support a compact catalytic map centered on S160–D206–H237. This is an annotation and structure linkage, not a kinetic or mutation-effect calculation.

## Rosalind Workbench observation

The genuine `mcp__rosalind__rosalind_open` call at `2026-08-29T18:14:05.283Z` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The exact response, case-specific arguments, timestamps, and `scientific_job_executed: false` are retained in `outputs/rosalind-open-observation.json`.

The operation opened the task chooser only. It did not run a PETase structure or activity calculation.

## Reproduce

```powershell
python showcases/life-sciences-databases/cases/databases-petase/scripts/build_case.py
```

Inspect the retained API responses, `outputs/results.json`, `outputs/provenance.json`, `outputs/rosalind-open-observation.json`, and `previews/preview.svg`.

## Limitations

- The case does not calculate catalytic rates, stability, or mutation effects.
- Residue positions use full-length UniProt numbering, including the signal peptide.
- The preview is a project graphic, not an interactive structure-viewer capture.

## Retained execution prompt

# PETase sequence–structure map

Retrieve UniProt A0A0K8P6T7 and RCSB PDB 5XJH, retaining the raw public responses and exact API paths. Run `scripts/build_case.py` to derive the full-length active-site labels, select the PET hydrolysis reaction and RHEA accession, and join them to the structure record without estimating kinetics or mutation effects.

Inspect `outputs/rosalind-open-observation.json` as the record of a genuine case-specific `mcp__rosalind__rosalind_open` call. State that the exact chooser response did not execute a scientific job and that the retained UniProt and RCSB responses provide the scientific evidence.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
