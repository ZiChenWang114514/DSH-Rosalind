# KRAS G12C public evidence map

Retrieve the reviewed UniProt P01116 record, search ClinVar for `KRAS G12C`, search ChEMBL for `sotorasib`, and retrieve RCSB PDB 6OIM. Retain the raw public API responses and exact query parameters. Run `scripts/build_case.py` to verify the reference residue, select the exact G12C and sotorasib rows, and build the case-specific summary.

Inspect `outputs/rosalind-open-observation.json` as the record of a genuine case-specific `mcp__rosalind__rosalind_open` call. State that its exact chooser response did not execute a scientific job and that the retained database responses provide the scientific evidence.
