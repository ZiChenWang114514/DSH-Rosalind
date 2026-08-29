# Showcase catalogue

This release contains 23 lesson-and-replay-ready projects copied from `rosalind-science-showcases` commit `f81e668c69edbfe7863cc936f2d535b61d8df76b`. Every row exposes lesson, replay, and reproduce. Reproduce runs the registered local operations, prepares an authorized public request, or reports the exact missing renderer, service, credential, input, or compute resource without changing providers. A completed replay does not imply that a fresh run completed.

| Area | Showcase ID | Project | Fresh-run path |
|---|---|---|---|
| Literature | `literature-trem2-landscape` | TREM2 microglia publication landscape | NCBI Entrez, PMC, bioRxiv/medRxiv |
| Literature | `literature-pmc-availability` | PMC open-access availability | NCBI Entrez, PMC, bioRxiv/medRxiv |
| Literature | `literature-preprint-publication-link` | Preprint to publication linkage | NCBI Entrez, PMC, bioRxiv/medRxiv |
| Databases | `databases-il6r-asthma` | IL6R and asthma evidence map | Open Targets, Ensembl, ClinVar, GWAS, GTEx and related public sources |
| Databases | `databases-variant-interpretation` | Multi-source variant interpretation | Open Targets, Ensembl, ClinVar, GWAS, GTEx and related public sources |
| Databases | `databases-egfr-landscape` | EGFR structure and pharmacology landscape | UniProt, ChEMBL, RCSB PDB, Reactome and related public sources |
| Sequence | `sequence-lambda-annotation` | Lambda genome annotation and cI translation | Deterministic local sequence adapter |
| Sequence | `sequence-ras-alignment` | Human RAS protein alignment | Deterministic local sequence adapter |
| Sequence | `sequence-fastq-qc` | Public-read FASTQ quality exploration | Deterministic local sequence adapter |
| NGS | `ngs-fastq-qc` | FASTQ QC workflow readiness | Local container or configured SSH/HPC |
| NGS | `ngs-bulk-rnaseq` | Bulk RNA-seq workflow design | Local container or configured SSH/HPC |
| NGS | `ngs-single-cell` | Single-cell RNA-seq workflow design | Local container or configured SSH/HPC |
| Structures | `structure-mdm2-p53` | MDM2-p53 interface analysis | Local structure adapter, optional RCSB retrieval |
| Structures | `structure-adenylate-kinase` | Adenylate kinase conformational comparison | Local structure adapter, optional RCSB retrieval |
| Structures | `structure-gfp-figure` | Provenance-bearing GFP figure | Local structure adapter, optional RCSB retrieval |
| Pathology & spatial | `slide-tissue-architecture` | CMU-1 whole-slide source and pyramid | Local slide checks, authorized public dataset |
| Pathology & spatial | `slide-spatial-expression` | Mouse-brain spatial expression | Local spatial checks, authorized public dataset |
| Pathology & spatial | `slide-segmentation-overlay` | Source-aligned spatial annotation overlay | Local spatial checks, authorized public dataset |
| Pathology & spatial | `slide-research-export` | Source-preserving spatial research export | Local spatial checks, authorized public dataset |
| Workbench | `rosalind-molecular-design` | PD-L1 nanobody design showcase | Local replay; optional Boltz, Biohub ESM, Modal, or Runpod |
| Workbench | `rosalind-structure-analysis` | Rosalind structure-analysis launcher | Local Workbench adapter |
| Workbench | `rosalind-genomics` | Rosalind genomics launcher | Local Workbench adapter |
| Workbench | `rosalind-scientific-compute` | Rosalind scientific-compute launcher | Local Workbench adapter |

## What a project record contains

Each `ShowcaseDefinition` identifies the scientific question, original plugin, source records, inputs, outputs, preview, reproduction adapter, providers, validation checks, and scientific claims. The fields for observations, computed results, interpretation, and limitations remain distinct. A generated conversation bundle acts as a file index; the referenced files remain the evidence.

The machine-readable source is [`showcases/catalog.json`](../showcases/catalog.json). Each case directory includes a README, prompt, manifest, inputs or retained outputs, preview material, and provenance where supplied by the source snapshot.

## Large data

Large SVS, H5AD, FASTQ, container, model-weight, and remote-compute inputs are downloaded only when a user chooses a fresh run and authorizes the source and destination. The repository retains compact fixtures and metadata needed to teach, replay, and verify the published result.
