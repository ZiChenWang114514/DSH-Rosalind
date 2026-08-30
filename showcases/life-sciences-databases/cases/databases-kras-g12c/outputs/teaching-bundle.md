# Codex showcase lesson: KRAS G12C public evidence map

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `databases-kras-g12c` (KRAS G12C public evidence map). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `databases-kras-g12c`
- Plugin: `life-sciences-databases` (Life Sciences Databases v0.1.5)
- Status: `ready`
- Domain: `public-data-integration`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `multi-tool-result`
- Covered operations: `life-sciences-databases.public-evidence`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Life Sciences Databases uniprot-skill, clinvar-variation-skill, chembl-skill, and rcsb-pdb-skill`, `Python 3 standard library`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: How do structure, variant, target, and compound databases describe KRAS G12C?
- Recorded next step: Reconcile the retained UniProt, ClinVar, ChEMBL, and RCSB records by allele, protein, compound, and structure identifiers.
- Plugin guide: `showcases/life-sciences-databases/README.md`

## Repository files to inspect

- case guide: `showcases/life-sciences-databases/cases/databases-kras-g12c/README.md`
- case manifest: `showcases/life-sciences-databases/cases/databases-kras-g12c/showcase.json`
- teaching prompt: `showcases/life-sciences-databases/cases/databases-kras-g12c/prompt.md`
- input: `showcases/life-sciences-databases/cases/databases-kras-g12c/inputs/public-source.md`
- input: `showcases/life-sciences-databases/cases/databases-kras-g12c/inputs/uniprot-P01116.json`
- input: `showcases/life-sciences-databases/cases/databases-kras-g12c/inputs/clinvar-KRAS-G12C-search.json`
- input: `showcases/life-sciences-databases/cases/databases-kras-g12c/inputs/chembl-sotorasib-search.json`
- input: `showcases/life-sciences-databases/cases/databases-kras-g12c/inputs/rcsb-6OIM.json`
- input: `showcases/life-sciences-databases/cases/databases-kras-g12c/scripts/build_case.py`
- output: `showcases/life-sciences-databases/cases/databases-kras-g12c/outputs/results.json`
- output: `showcases/life-sciences-databases/cases/databases-kras-g12c/outputs/provenance.json`
- output: `showcases/life-sciences-databases/cases/databases-kras-g12c/outputs/query-verification.json`
- output: `showcases/life-sciences-databases/cases/databases-kras-g12c/outputs/rosalind-open-observation.json`
- output: `showcases/life-sciences-databases/cases/databases-kras-g12c/outputs/teaching-bundle.md`
- preview: `showcases/life-sciences-databases/cases/databases-kras-g12c/previews/preview.svg`

## Public sources

- https://www.uniprot.org/uniprotkb/P01116/entry
- https://www.ncbi.nlm.nih.gov/clinvar/variation/12578/
- https://www.ebi.ac.uk/chembl/explore/compound/CHEMBL4535757
- https://www.rcsb.org/structure/6OIM

## Retained case guide

# KRAS G12C public evidence map

![KRAS G12C evidence map](../previews/preview.svg)

## Scientific question

How do exact public protein, variant, compound, and structure records describe the KRAS G12C research theme?

## Source observations

- UniProt P01116 is the reviewed 189-residue human KRAS entry; its canonical sequence has glycine at position 12.
- A ClinVar search for `KRAS G12C` returned twelve matches. The retained ten-record slice includes Variation 12578, `NM_004985.5(KRAS):c.34G>T (p.Gly12Cys)`.
- A ChEMBL molecule search for `sotorasib` returned CHEMBL4535757 as SOTORASIB, with maximum phase 4 and first approval year 2021.
- RCSB PDB 6OIM is the 1.65 Å X-ray structure titled *Crystal Structure of human KRAS G12C covalently bound to AMG 510*.

The exact API responses are retained under `inputs/`; `outputs/provenance.json` records every accession, path, search term, limit, and retrieval time.

## Computed result

`scripts/build_case.py` checks that residue 12 of P01116 is glycine, selects the exact p.Gly12Cys ClinVar row and SOTORASIB ChEMBL row, verifies PDB 6OIM, and writes `outputs/results.json` plus the preview.

## Interpretation

P01116, ClinVar Variation 12578, CHEMBL4535757, and PDB 6OIM connect the protein, allele, named compound, and covalent-complex structure. Their agreement supports an identifier-preserving research map, not a treatment recommendation.

## Rosalind Workbench observation

The genuine `mcp__rosalind__rosalind_open` call at `2026-08-29T18:14:05.242Z` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The case-specific arguments, timestamps, exact response, and `scientific_job_executed: false` are retained in `outputs/rosalind-open-observation.json`.

The operation opened the task chooser only. It did not query KRAS records, calculate a structure, or compare drugs.

## Reproduce

```powershell
python showcases/life-sciences-databases/cases/databases-kras-g12c/scripts/build_case.py
```

Inspect the four retained API responses, `outputs/results.json`, `outputs/provenance.json`, `outputs/rosalind-open-observation.json`, and `previews/preview.svg`.

## Limitations

- The ClinVar response retains ten of twelve search matches.
- ChEMBL phase and approval fields do not compare efficacy or safety.
- One crystal structure does not describe every conformational or cellular state of KRAS G12C.

## Retained execution prompt

# KRAS G12C public evidence map

Retrieve the reviewed UniProt P01116 record, search ClinVar for `KRAS G12C`, search ChEMBL for `sotorasib`, and retrieve RCSB PDB 6OIM. Retain the raw public API responses and exact query parameters. Run `scripts/build_case.py` to verify the reference residue, select the exact G12C and sotorasib rows, and build the case-specific summary.

Inspect `outputs/rosalind-open-observation.json` as the record of a genuine case-specific `mcp__rosalind__rosalind_open` call. State that its exact chooser response did not execute a scientific job and that the retained database responses provide the scientific evidence.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
