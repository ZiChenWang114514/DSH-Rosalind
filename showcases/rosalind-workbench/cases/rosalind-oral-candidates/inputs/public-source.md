# Public acquisition and comparison scope

PubChem PUG REST property records were retrieved on 2026-08-30. `compounds.csv` retains exact CIDs, structures, formulas, and selected PubChem-computed properties for five orally administered kinase-inhibitor reference drugs.

- Imatinib, CID 5291: https://pubchem.ncbi.nlm.nih.gov/compound/5291
- Gefitinib, CID 123631: https://pubchem.ncbi.nlm.nih.gov/compound/123631
- Erlotinib, CID 176870: https://pubchem.ncbi.nlm.nih.gov/compound/176870
- Osimertinib, CID 71496458: https://pubchem.ncbi.nlm.nih.gov/compound/71496458
- Sunitinib, CID 5329102: https://pubchem.ncbi.nlm.nih.gov/compound/5329102

The local script computes RDKit descriptors and counts threshold exceedances. It does not use formulation, dose, salt form, dissolution, permeability, transporter, metabolism, or human exposure data.
