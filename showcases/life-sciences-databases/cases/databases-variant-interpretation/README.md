# Multi-source variant interpretation

This ready showcase resolves the C>T allele of rs7903146 across clinical, annotation, and cohort databases while preserving a failed gnomAD check as method provenance.

![rs7903146 evidence summary](previews/variant-rs7903146.svg)

## Scientific question

Can Codex reconcile one rsID across multiple databases without merging different alternate alleles or overstating the compact records?

## Source observations

- ClinVar returned two records for rs7903146. Variation 7413 is the selected TCF7L2 C>T allele; Variation 1692994 is a distinct C>G allele.
- Ensembl identifies the variant as rs7903146 and returned cross-references that include VCV000007413.
- UKB-TOPMed resolved the selected allele to GRCh38 `10:112998590-C-T`, reported a cohort allele frequency of 0.29, and exposed 1,419 association rows.
- The gnomAD r4 GraphQL request returned a service error, so no gnomAD frequency is reported.

## Reproduce

1. Run the prompt in `prompt.md` with Life Sciences Databases 0.1.5.
2. Search ClinVar for rs7903146 and select the C>T record explicitly.
3. Query Ensembl variation metadata for the rsID and compare returned cross-references.
4. Query UKB-TOPMed using the explicit GRCh38 C>T allele, not only the rsID resolver.
5. Attempt the matching gnomAD r4 query and retain the service outcome separately.

## Interpretation

The useful result is the identity-preserving join: the selected C>T allele connects ClinVar Variation 7413, Ensembl cross-references, and a cohort PheWAS record. These compact responses do not justify a new clinical classification, and the initial PheWAS page is not a ranked disease summary.
