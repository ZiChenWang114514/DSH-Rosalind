# Public acquisition and scope

The compound identities and structure strings in `compounds.csv` were retrieved on 2026-08-30 through the PubChem PUG REST property endpoint.

- Captopril, CID 44093: https://pubchem.ncbi.nlm.nih.gov/compound/44093
- Enalapril, CID 5388962: https://pubchem.ncbi.nlm.nih.gov/compound/5388962
- Lisinopril, CID 5362119: https://pubchem.ncbi.nlm.nih.gov/compound/5362119

The pKa and pH-conditioned lipophilicity annotations were transcribed from the cited PubChem compound pages. Their upstream references are named in `compounds.csv`. PubChem XLogP and RDKit MolLogP are model-derived neutral-structure descriptors. No Rosalind service, clinical ADME study, or laboratory measurement was run for this case.
