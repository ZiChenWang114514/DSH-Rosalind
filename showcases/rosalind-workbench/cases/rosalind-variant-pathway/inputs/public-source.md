# Public evidence for the rs7903146 C>T path

Accessed 2026-08-30.

## Allele identity

- ClinVar Variation 7413: https://www.ncbi.nlm.nih.gov/clinvar/variation/7413/
  - Selected allele: `NC_000010.11:g.112998590C>T`
  - Transcript annotation: `NM_001367943.1(TCF7L2):c.450+33966C>T`
  - Molecular consequence shown by ClinVar: intron variant
- Ensembl variation API: https://rest.ensembl.org/variation/homo_sapiens/rs7903146
  - The retained public result identifies `rs7903146` as dbSNP-imported and includes `VCV000007413` among returned cross-references.
- Excluded record: ClinVar Variation 1692994 is the C>G allele and is not merged into this C>T path.

The allele-resolved ClinVar and Ensembl results were retained previously in `showcases/life-sciences-databases/cases/databases-variant-interpretation/outputs/results.json`; this case reuses those public observations without claiming a new remote retrieval.

## Gene and pathway records

- Human TCF7L2 Reactome entity `R-HSA-201923`: https://reactome.org/content/detail/R-HSA-201923
- Formation of the beta-catenin:TCF transactivating complex `R-HSA-201722`: https://reactome.org/content/detail/R-HSA-201722

Reactome connects the human TCF7L2 entity to curated WNT signaling events and describes TCF7L2 as a member of the TCF/LEF transcription-factor family in the beta-catenin:TCF complex pathway.

## Evidence rule

The case records an identifier path only. It does not treat pathway membership as evidence that rs7903146 changes pathway activity, causes a phenotype, or warrants a clinical classification.
