# Showcase catalogue

This release contains 100 lesson-and-replay-ready projects from the reviewed showcase snapshot at commit `f8c2ea83ac3b3b9258b160b80039dc3db37d76c4`. Every project exposes lesson, replay, and reproduce records. Reproduce runs a registered local operation, prepares an authorized public request, or reports the missing renderer, service, credential, input, or compute resource. A completed replay does not imply that a fresh run completed.

| Area | Projects | Representative scope |
|---|---:|---|
| Literature | 6 | Publication discovery, access, evidence landscapes and assay literature |
| Databases | 7 | Target, variant, pharmacology, structure, pathway and expression records |
| Sequence | 12 | Annotation, alignment, quality analysis, editing, sessions and export |
| NGS | 15 | Runtime inspection, workflow readiness, saved definitions and run lifecycle records |
| Structures | 15 | Contacts, selections, pockets, alignment, density, assembly and trajectories |
| Pathology & spatial | 15 | DICOM, OME, regions, scientific layers, measurements and research packages |
| Workbench | 30 | Molecular design, scientific computing, experimental plans and cross-tool studies |

The machine-readable catalogue below is the complete ID index; every entry points to its case directory and preview where available.

## What a project record contains

Each `ShowcaseDefinition` identifies the scientific question, original plugin, source records, inputs, outputs, preview, reproduction adapter, providers, validation checks, and scientific claims. The fields for observations, computed results, interpretation, and limitations remain distinct. A generated conversation bundle acts as a file index; the referenced files remain the evidence.

The machine-readable source is [`showcases/catalog.json`](../showcases/catalog.json). Each case directory includes a README, prompt, manifest, inputs or retained outputs, preview material, and provenance where supplied by the source snapshot.

## Large data

Large SVS, H5AD, FASTQ, container, model-weight, and remote-compute inputs are downloaded only when a user chooses a fresh run and authorizes the source and destination. The repository retains compact fixtures and metadata needed to teach, replay, and verify the published result.
