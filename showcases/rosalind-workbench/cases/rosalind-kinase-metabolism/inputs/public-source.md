# Public acquisition and evidence types

PubChem PUG REST property records were retrieved on 2026-08-30 for imatinib (CID 5291), gefitinib (CID 123631), and erlotinib (CID 176870). Exact record links and structures are retained in `compounds.csv`.

Official U.S. label statements were reviewed on DailyMed and transcribed into `metabolism-evidence.csv` with their source URLs. The local RDKit script computes descriptors and applies the named SMARTS queries in `structural-alerts.csv`. These queries are mechanistic prompts for manual review, without statistical calibration as metabolism predictors.

No Rosalind service, microsome assay, hepatocyte assay, metabolite-identification experiment, or clinical pharmacokinetic analysis was run.
