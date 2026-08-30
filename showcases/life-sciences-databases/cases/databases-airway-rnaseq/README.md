# Airway RNA-seq dataset discovery

![Airway RNA-seq study design](previews/preview.svg)

## Scientific question

Which public study record supports planning a small airway smooth-muscle dexamethasone RNA-seq analysis, and what must be verified before a donor-aware model can be justified?

## Source observations

- BioStudies/ArrayExpress accession E-GEOD-52778 is titled *Human Airway Smooth Muscle Transcriptome Changes in Response to Asthma Medications* and is annotated as human coding-RNA sequencing.
- The study record reports 16 samples and 16 sequencing assays.
- Four treatment groups are present: untreated, albuterol, dexamethasone, and albuterol plus dexamethasone, with four samples in each group.
- Four airway smooth-muscle cell lines are listed: N052611, N061011, N080611, and N61311, each contributing four samples.
- The retained study record lists the 5,045-byte IDF and 18,168-byte SDRF metadata files.

The exact accession response is retained as `inputs/biostudies-E-GEOD-52778.json`; `outputs/provenance.json` records the API path and retrieval time.

## Computed result

`scripts/build_case.py` traverses the BioStudies sample and assay sections, counts treatment groups and cell lines, verifies the balanced 4-by-4 layout, and writes `outputs/results.json` plus the preview.

## Interpretation

The retained study-level metadata show four treatment groups and four airway smooth-muscle cell-line labels. This supports a treatment-group comparison plan, but it does not establish a paired or donor-aware design. The sample-to-donor mapping must first be extracted and checked from the SDRF. The combined-treatment group remains distinct because it tests an additional intervention.

## Rosalind Workbench observation

The genuine `mcp__rosalind__rosalind_open` call at `2026-08-29T18:14:05.307Z` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. Exact arguments, timestamps, response, and `scientific_job_executed: false` are retained in `outputs/rosalind-open-observation.json`.

The operation opened the task chooser only. It did not download reads, normalize counts, or run differential expression.

## Reproduce

```powershell
python showcases/life-sciences-databases/cases/databases-airway-rnaseq/scripts/build_case.py
```

Inspect the retained BioStudies response, `outputs/results.json`, `outputs/provenance.json`, `outputs/rosalind-open-observation.json`, and `previews/preview.svg`.

## Limitations

- Reads were not downloaded and no expression analysis was performed.
- Donor covariates and sample pairing should be checked in the SDRF before model fitting.
- The albuterol-plus-dexamethasone samples must remain separate from dexamethasone alone.
