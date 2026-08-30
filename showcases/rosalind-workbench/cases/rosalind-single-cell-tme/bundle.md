# Codex showcase lesson: Single-cell tumour microenvironment

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-single-cell-tme` (Single-cell tumour microenvironment). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-single-cell-tme`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `genomics-and-pathology`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind-workbench.public-evidence`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Rosalind Workbench mcp__rosalind__rosalind_open`, `CZ CELLxGENE Discover API via cellxgene-skill and local Python standard library`
- Summary: How should public single-cell tumour data be prepared for cell-state exploration?
- Recorded next step: Repeat preparation checks on the retained treatment-naive TNBC CELLxGENE metadata before proposing cell-state analysis.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/build_case.py`
- input: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/inputs/public-source.md`
- input: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/inputs/cellxgene-collection.json`
- output: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/outputs/tme-metadata-summary.json`
- output: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/outputs/cell-type-inventory.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/outputs/provenance.json`
- output: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-single-cell-tme/previews/preview.svg`

## Public sources

- https://cellxgene.cziscience.com/collections/ceef2841-5333-46ac-92ef-ccbe0c20fe55

## Retained case guide

# Triple-negative breast-cancer single-cell preparation

![Triple-negative breast-cancer single-cell preparation](previews/preview.svg)

## Scientific question

What public metadata must be verified before cell-state exploration of an untreated triple-negative breast-cancer single-cell atlas?

## Public collection

The retained CELLxGENE Discover response describes collection `ceef2841-5333-46ac-92ef-ccbe0c20fe55`, *Single-cell atlas of untreated human triple negative breast cancer*. It was retrieved through the official collection API at `2026-08-29T18:22:32.428743Z` using the repository's CELLxGENE skill.

The single dataset is human breast tissue annotated as triple-negative breast carcinoma (`MONDO:0005494`). The metadata lists 10x 3′ v2 and v3 assays, 427,823 primary cells, 32,354 features, an aggregate study-participant count of 101, mean genes per cell 2,120.624429, `raw.X`, and `X_umap`.

## Executed deterministic preparation check

`build_case.py` verifies collection and dataset identifiers, checks the aggregate participant count, preserves assay and ontology records, and writes the seven broad cell-type labels to `outputs/cell-type-inventory.csv`:

- T cell
- abnormal cell
- endothelial cell
- fibroblast
- lymphocyte of B lineage
- myeloid leukocyte
- perivascular cell

These broad labels and the UMAP inventory make a cell-state review technically approachable. They do not show cell proportions, marker expression, cluster quality, patient effects, or tumour–immune interactions.

## Data-use note

The retained input is a public-metadata extract with contact fields and all study participant pseudonyms removed. It preserves the reported cohort size as a single aggregate value. This case contains single-cell collection metadata only and has no pathology or Visium task association.

## Observed Rosalind Workbench invocation

`mcp__rosalind__rosalind_open` was genuinely invoked at `2026-08-29T18:21:04.136Z`. It returned exactly `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The 923-byte `outputs/rosalind-open-observation.json` retains the case-specific arguments, timestamps, response, and `scientific_job_executed=false`.

The launcher call did not receive cells or an H5AD. The retained CELLxGENE metadata and local script support the preparation summary.

## Limitations

- The 4.52 GB H5AD asset was not downloaded; no expression matrix or cell-level row was inspected.
- Broad CELLxGENE labels cannot substitute for study-specific cell-state annotation.
- Assay-version mixing and participant effects need explicit modelling in a full analysis.
- The aggregate count cannot support participant-aware modelling by itself; a full analysis must obtain the required grouping variables through an appropriate data-use procedure.
- No Rosalind single-cell analysis, clinical inference, or wet-lab work was executed.

## Reproduce

```powershell
python showcases/rosalind-workbench/cases/rosalind-single-cell-tme/build_case.py
python scripts/showcase_session.py bundle rosalind-single-cell-tme --output showcases/rosalind-workbench/cases/rosalind-single-cell-tme/bundle.md
```

## Retained execution prompt

# Triple-negative breast-cancer single-cell preparation

Use the retained de-identified CELLxGENE metadata extract for collection `ceef2841-5333-46ac-92ef-ccbe0c20fe55`. Verify organism, tissue, disease ontology, assay versions, cells, features, aggregate participant count, broad cell-type inventory, raw-count location, UMAP availability, and asset size. Do not infer cell proportions or tumour–immune biology without the matrix, and do not associate this case with pathology or Visium analysis. Invoke `mcp__rosalind__rosalind_open` only to open the task chooser; cite `outputs/rosalind-open-observation.json` and state that no H5AD or cells were submitted to Rosalind.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
