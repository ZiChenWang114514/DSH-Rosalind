# Public sequence inputs

- Human PD-L1: UniProt Q9NZQ7, residues 18–239, https://rest.uniprot.org/uniprotkb/Q9NZQ7.fasta
- KN035 parent complex: RCSB PDB 5JDS, https://www.rcsb.org/fasta/entry/5JDS/display
- Retained target sequence: `PDL1_Q9NZQ7_18-239.fasta`
- Retained KN035 parent and 19 designed variants: `../outputs/candidates.csv`

The target sequence was verified on 2026-08-30 by downloading the UniProt FASTA and selecting one-based residues 18–239. The tag-free 130-residue KN035 sequence is the nanobody portion of the public 5JDS FASTA record. Both downloads are free and require no account. `prepare_boltz_inputs.py` validates the retained lengths and writes one Boltz YAML file per candidate.
