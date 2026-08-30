# Codex showcase lesson: Kinase inhibitor metabolism-risk review

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-kinase-metabolism` (Kinase inhibitor metabolism-risk review). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-kinase-metabolism`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `adme-and-developability`
- Case type: `analysis`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind.rosalind_open`, `rosalind-workbench.public-evidence`
- Rosalind tasks: none recorded
- Actual tools: `Rosalind Workbench mcp__rosalind__rosalind_open`, `PubChem PUG REST`, `DailyMed public labels`, `Python 3.14`, `RDKit 2026.03.5`
- Summary: Which structural alerts and public metabolism records should be reviewed for kinase inhibitors?
- Recorded next step: Reconcile PubChem structures, DailyMed metabolism statements, and local SMARTS alerts for each retained kinase inhibitor.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/inputs/public-source.md`
- input: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/inputs/compounds.csv`
- input: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/inputs/metabolism-evidence.csv`
- input: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/scripts/analyze.py`
- output: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/outputs/descriptors.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/outputs/structural-alerts.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/outputs/metabolism-review.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/outputs/result-summary.json`
- output: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/outputs/teaching-bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/previews/preview.svg`

## Public sources

- https://pubchem.ncbi.nlm.nih.gov/compound/5291
- https://pubchem.ncbi.nlm.nih.gov/compound/123631
- https://pubchem.ncbi.nlm.nih.gov/compound/176870
- https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7b7cc194-29e4-4484-a364-a1ac7d7d6cf5
- https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=1a3c0ce7-06a1-4e04-9106-14ddb2a866a5&version=4
- https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4cff04f5-3693-4d87-a9f8-a2b195e3d26e

## Retained case guide

# Kinase inhibitor metabolism-evidence review

![Kinase inhibitor metabolism review](../previews/preview.svg)

## Scientific question

How can exact public structures and official label statements be combined with transparent structural prompts for imatinib, gefitinib, and erlotinib?

## Source observations

- PubChem records identify imatinib as CID 5291, gefitinib as CID 123631, and erlotinib as CID 176870.
- The retained DailyMed label states that CYP3A4 is the major enzyme responsible for imatinib metabolism.
- The gefitinib label describes extensive hepatic metabolism, predominantly by CYP3A4.
- The erlotinib label describes primary CYP3A4 metabolism, with lesser CYP1A2 and CYP1A1 contributions in vitro.

Exact statements and source URLs are retained in `inputs/metabolism-evidence.csv`.

## Computed results

RDKit 2026.03.5 recomputes molecular descriptors and applies five explicit SMARTS queries. Imatinib matches tertiary-amine and benzylic-carbon prompts; gefitinib matches tertiary-amine and aryl-alkyl-ether prompts; erlotinib matches aryl-alkyl-ether and terminal-alkyne prompts. Full zero and nonzero match counts appear in `outputs/structural-alerts.csv`.

## Interpretation

DailyMed statements provide the enzyme-related evidence. The SMARTS hits nominate structural regions for closer examination and comparison with metabolite-identification studies. They do not predict enzyme specificity, intrinsic clearance, metabolite abundance, or clinical interaction magnitude.

## Rosalind Workbench observation

The genuine `mcp__rosalind__rosalind_open` call at `2026-08-29T17:56:31.367Z` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The case-specific arguments and exact observed response are retained in `outputs/rosalind-open-observation.json`.

This operation only opens the Rosalind task chooser. It does not prove that a metabolism scientific task ran; the public records, official label statements, and deterministic local calculations above provide the scientific evidence in this case.

## Limitations

- The SMARTS set is small, uncalibrated, and can miss relevant chemistry or produce false positives.
- No metabolite prediction, microsomal stability, hepatocyte clearance, transporter, or clinical exposure model was run.
- PubChem and RDKit lipophilicity values are computed molecular descriptors.
- Official labels can be revised after the retrieval date.
- The Workbench chooser was opened, while no Rosalind scientific job was executed.

## Reproduce

```powershell
python showcases/rosalind-workbench/cases/rosalind-kinase-metabolism/scripts/analyze.py
```

Review `outputs/descriptors.csv`, `outputs/structural-alerts.csv`, `outputs/metabolism-review.csv`, `outputs/result-summary.json`, `outputs/rosalind-open-observation.json`, and `previews/preview.svg`.

## Retained execution prompt

# Kinase inhibitor metabolism-evidence review

Compare imatinib, gefitinib, and erlotinib using exact PubChem structures, official DailyMed metabolism statements, RDKit descriptors, and explicitly defined structural-motif queries.

Present DailyMed statements as observed evidence and SMARTS hits as local review prompts. Do not equate a structural motif with a metabolic pathway, clearance measurement, metabolite identity, or clinical drug interaction.

Inspect `outputs/rosalind-open-observation.json` as the case-specific record of a genuine Rosalind Workbench `mcp__rosalind__rosalind_open` invocation. State that it opened only the task chooser and did not execute a scientific job; use the official statements and local output tables as scientific evidence.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
