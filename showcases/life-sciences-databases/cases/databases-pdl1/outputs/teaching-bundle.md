# Codex showcase lesson: PD-L1 sequence and structure records

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `databases-pdl1` (PD-L1 sequence and structure records). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `databases-pdl1`
- Plugin: `life-sciences-databases` (Life Sciences Databases v0.1.5)
- Status: `ready`
- Domain: `public-data-integration`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `multi-tool-result`
- Covered operations: `life-sciences-databases.public-evidence`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Life Sciences Databases uniprot-skill and rcsb-pdb-skill`, `Python 3 standard library`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: Which identifiers connect PD-L1 sequence, structures, and binding evidence?
- Recorded next step: Verify the human PD-L1 topology against the retained UniProt record and map it to the inhibitor-bound RCSB structure.
- Plugin guide: `showcases/life-sciences-databases/README.md`

## Repository files to inspect

- case guide: `showcases/life-sciences-databases/cases/databases-pdl1/README.md`
- case manifest: `showcases/life-sciences-databases/cases/databases-pdl1/showcase.json`
- teaching prompt: `showcases/life-sciences-databases/cases/databases-pdl1/prompt.md`
- input: `showcases/life-sciences-databases/cases/databases-pdl1/inputs/public-source.md`
- input: `showcases/life-sciences-databases/cases/databases-pdl1/inputs/uniprot-Q9NZQ7.json`
- input: `showcases/life-sciences-databases/cases/databases-pdl1/inputs/rcsb-5J89.json`
- input: `showcases/life-sciences-databases/cases/databases-pdl1/scripts/build_case.py`
- output: `showcases/life-sciences-databases/cases/databases-pdl1/outputs/results.json`
- output: `showcases/life-sciences-databases/cases/databases-pdl1/outputs/provenance.json`
- output: `showcases/life-sciences-databases/cases/databases-pdl1/outputs/query-verification.json`
- output: `showcases/life-sciences-databases/cases/databases-pdl1/outputs/rosalind-open-observation.json`
- output: `showcases/life-sciences-databases/cases/databases-pdl1/outputs/teaching-bundle.md`
- preview: `showcases/life-sciences-databases/cases/databases-pdl1/previews/preview.svg`

## Public sources

- https://www.uniprot.org/uniprotkb/Q9NZQ7/entry
- https://www.rcsb.org/structure/5J89

## Retained case guide

# PD-L1 sequence and structure records

![PD-L1 sequence and structure records](../previews/preview.svg)

## Scientific question

Which exact public records connect the full-length human PD-L1 sequence and topology to a structure-level observation of small-molecule binding?

## Source observations

- UniProt Q9NZQ7 is the reviewed 290-residue human PD-L1 entry, named `PD1L1_HUMAN` and encoded by `CD274`.
- UniProt annotates residues 1–18 as a signal peptide, 19–238 as extracellular, 239–259 as transmembrane, and 260–290 as cytoplasmic.
- RCSB PDB 5J89 is a 2.20 Å X-ray structure titled *Structure of human Programmed cell death 1 ligand 1 (PD-L1) with low molecular mass inhibitor*.

The exact UniProt and RCSB responses are retained under `inputs/`; `outputs/provenance.json` records both API paths and retrieval time.

## Computed result

`scripts/build_case.py` extracts the topology intervals from the UniProt feature table, verifies PDB 5J89, and writes `outputs/results.json` and the preview. The sequence strip preserves full-length UniProt numbering.

## Interpretation

The UniProt record defines the canonical membrane-protein context, while 5J89 supplies direct structural evidence of a low-molecular-mass inhibitor in a PD-L1 crystal structure. The record pair does not supply an affinity value or cellular checkpoint response.

## Rosalind Workbench observation

The genuine `mcp__rosalind__rosalind_open` call at `2026-08-29T18:14:05.263Z` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The exact response, arguments, timestamps, and `scientific_job_executed: false` are retained in `outputs/rosalind-open-observation.json`.

The operation opened the task chooser only. It did not analyze PD-L1 binding or run a molecular design task.

## Reproduce

```powershell
python showcases/life-sciences-databases/cases/databases-pdl1/scripts/build_case.py
```

Inspect the retained API responses, `outputs/results.json`, `outputs/provenance.json`, `outputs/rosalind-open-observation.json`, and `previews/preview.svg`.

## Limitations

- 5J89 is one inhibitor-bound crystal structure and does not measure cellular activity.
- UniProt topology annotations describe the canonical sequence and do not represent every proteoform or glycoform.
- No affinity, clinical response, or nanobody ranking is inferred.

## Retained execution prompt

# PD-L1 sequence and structure records

Retrieve the reviewed human PD-L1 UniProt record Q9NZQ7 and RCSB PDB entry 5J89. Retain both raw public API responses and exact paths. Run `scripts/build_case.py` to extract the canonical topology intervals and the structure method, title, and resolution without inferring affinity or cellular activity.

Inspect `outputs/rosalind-open-observation.json` as the record of a genuine case-specific `mcp__rosalind__rosalind_open` call. State that the exact chooser response did not execute a scientific job and that the retained UniProt and RCSB responses provide the scientific evidence.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
