# Codex showcase lesson: IL6R and asthma evidence map

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `databases-il6r-asthma` (IL6R and asthma evidence map). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `databases-il6r-asthma`
- Plugin: `life-sciences-databases` (Life Sciences Databases v0.1.5)
- Status: `ready`
- Domain: `public-data-integration`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Life Sciences Databases public API evidence and local JSON aggregation`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: Combine public genetics, expression, and target evidence for IL6R and asthma.
- Recorded next step: Open the case README to present the three-source IL6R evidence map.
- Plugin guide: `showcases/life-sciences-databases/README.md`

## Repository files to inspect

- case guide: `showcases/life-sciences-databases/cases/databases-il6r-asthma/README.md`
- case manifest: `showcases/life-sciences-databases/cases/databases-il6r-asthma/showcase.json`
- teaching prompt: `showcases/life-sciences-databases/cases/databases-il6r-asthma/prompt.md`
- output: `showcases/life-sciences-databases/cases/databases-il6r-asthma/outputs/results.json`
- output: `showcases/life-sciences-databases/cases/databases-il6r-asthma/outputs/sources.json`
- output: `showcases/life-sciences-databases/cases/databases-il6r-asthma/outputs/provenance.json`
- output: `showcases/life-sciences-databases/cases/databases-il6r-asthma/outputs/query-verification.json`
- output: `showcases/life-sciences-databases/cases/databases-il6r-asthma/outputs/rosalind-open-observation.json`
- output: `showcases/life-sciences-databases/cases/databases-il6r-asthma/outputs/teaching-bundle.md`
- preview: `showcases/life-sciences-databases/cases/databases-il6r-asthma/previews/il6r-asthma.svg`

## Public sources

- https://platform.opentargets.org/target/ENSG00000160712
- https://www.ebi.ac.uk/gwas/
- https://gtexportal.org/home/gene/ENSG00000160712

## Retained case guide

# IL6R and asthma evidence map

This ready showcase connects target–disease evidence, cataloged genetic associations, and tissue eQTL observations for IL6R.

![IL6R and asthma evidence map](../previews/il6r-asthma.svg)

## Scientific question

What complementary evidence do Open Targets, the GWAS Catalog, and GTEx provide for an IL6R–asthma research hypothesis?

## Source observations

- Open Targets returned an asthma row for IL6R with datasource scores of 0.8824 for GWAS credible sets and 0.6642 for Europe PMC.
- A GWAS Catalog query with `mapped_gene=IL6R` returned ten association records in the requested slice.
- GTEx v10 returned 15 single-tissue eQTL rows for rs2228145; seven mapped to IL6R across esophagus muscularis, blood, three arteries, and two colon tissues.
- All seven returned IL6R normalized effect sizes were negative, ranging from −0.3009 to −0.0905.

## Reproduce

1. Run the prompt in `prompt.md` with Life Sciences Databases 0.1.5.
2. Query the Open Targets associated-disease matrix for `ENSG00000160712` and filter for asthma.
3. Request ten GWAS Catalog associations with `mapped_gene=IL6R`.
4. Resolve rs2228145 to GRCh38 and request GTEx single-tissue eQTL associations.
5. Preserve the three result types separately before writing the synthesis.

## Interpretation

The three sources answer different questions: Open Targets summarizes target–disease evidence context, the GWAS Catalog exposes mapped association records, and GTEx shows tissue-specific expression associations for a selected IL6R variant. Their agreement makes the hypothesis richer, but it does not by itself prove causality or predict whether increasing or decreasing IL6R activity would benefit asthma.

## Rosalind Workbench observation

The genuine `mcp__rosalind__rosalind_open` call at `2026-08-29T18:14:05.178Z` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. Its case-specific arguments and both timestamps are retained in `outputs/rosalind-open-observation.json`.

This operation opened the task chooser only. It did not run a genetics, target-evidence, or eQTL analysis; `outputs/results.json`, `outputs/sources.json`, and `outputs/provenance.json` carry the scientific evidence and query history.

## Limitations

- Open Targets datasource scores are evidence summaries, not effect sizes.
- The retained GWAS slice did not expose trait labels and is not described as asthma-specific.
- The evidence map does not establish causality or therapeutic direction.

## Retained execution prompt

Use Life Sciences Databases to build a compact IL6R–asthma evidence map from Open Targets, the GWAS Catalog, and GTEx. Keep disease-target evidence, catalog associations, and tissue eQTL observations separate, and explain what the combined evidence does and does not establish. Inspect `outputs/provenance.json` for the exact identifiers and queries. Cite `outputs/rosalind-open-observation.json` as the record of a genuine `mcp__rosalind__rosalind_open` call, and state that its chooser response did not execute a scientific job.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
