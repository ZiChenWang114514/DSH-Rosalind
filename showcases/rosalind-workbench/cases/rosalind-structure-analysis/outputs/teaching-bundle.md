# Codex showcase lesson: KRAS G12C prediction and confidence review

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-structure-analysis` (KRAS G12C prediction and confidence review). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-structure-analysis`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `structure-and-sequence`
- Case type: `analysis`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: `predict-kras-g12c`
- Actual tools: `Python 3.14 standard library`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: Which regions of a free KRAS G12C prediction require cautious structural interpretation?
- Recorded next step: Repeat the residue-level quality analysis on the public PDB 6OIM KRAS G12C coordinates and flag low-confidence regions.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/build_case.py`
- input: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/inputs/public-source.md`
- input: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/inputs/source-provenance.json`
- input: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/inputs/6OIM.pdb`
- output: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/outputs/residue-quality-metrics.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/outputs/structure-summary.json`
- output: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/outputs/teaching-bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-structure-analysis/previews/preview.svg`

## Public sources

- https://www.rcsb.org/structure/6OIM
- https://files.rcsb.org/download/6OIM.pdb

## Retained case guide

# KRAS G12C experimental-reference review

![KRAS G12C structure-quality summary](../previews/preview.svg)

## Scientific question

Which regions of a KRAS G12C model deserve added caution when compared with the 1.65 Å experimental structure in PDB 6OIM?

## Public source and computation

`build_case.py` downloads public PDB 6OIM, retains the deposited coordinates, and computes per-residue mean crystallographic B factors and nearest distances to Cys12 and the covalent ligand MOV. `inputs/source-provenance.json` records the exact source and selection.

## Computed result

- Chain A contains 167 observed residue records, including a numbered residue 0; residues 105–107 and 170–189 are absent within the reviewed 1–189 span.
- Cys12 is 1.805 Å from the nearest MOV atom in the deposited coordinates.
- Mean B factors are 26.486 Å² for switch I (30–38) and 29.300 Å² for switch II (60–76), compared with 19.788 Å² for the P-loop (10–17).
- The complete per-residue table is retained in `outputs/residue-quality-metrics.csv`.

## Interpretation

Absent coordinates and relatively elevated B factors identify regions that deserve extra attention when a prediction is interpreted. Crystallographic B factors are experimental-model properties and must not be relabeled as predicted confidence scores.

## Rosalind observation

`outputs/rosalind-open-observation.json` records one genuine `mcp__rosalind__rosalind_open` call with structure-analysis context. The response confirmed launcher readiness; `scientific_job_executed` is false. The numerical structure analysis came from local Python applied to public 6OIM coordinates.

## Limitations

- 6OIM is a ligand-bound crystallographic state, so its conformational and B-factor patterns are not universal KRAS G12C properties.
- PDB residue numbering and absent density must be interpreted with the deposited sequence and experimental conditions.
- The analysis does not generate or validate a structure prediction and has no clinical interpretation.

## Reproduce

1. Run `python build_case.py` from this case directory.
2. Confirm that the retained PDB has 167 chain-A residue records and resolution 1.65 Å.
3. Compare `outputs/structure-summary.json` and `outputs/residue-quality-metrics.csv` with the preview.
4. Inspect `outputs/rosalind-open-observation.json` separately; it is interface evidence only.

## Retained execution prompt

# KRAS G12C experimental-reference review

Use public PDB 6OIM to calculate residue-level B factors, coordinate coverage, and distances to Cys12 and ligand MOV. Explain which regions deserve added caution when a KRAS G12C prediction is interpreted, while keeping crystallographic B factors distinct from prediction confidence.

Read `outputs/rosalind-open-observation.json` as evidence that `mcp__rosalind__rosalind_open` returned a ready launcher. Do not claim that the call ran this structure analysis.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
