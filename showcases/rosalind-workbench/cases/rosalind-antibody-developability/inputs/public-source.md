# Public sequence acquisition

RCSB FASTA downloads were retrieved on 2026-08-30.

- PDB 1N8Z, Herceptin Fab heavy and light chains: https://www.rcsb.org/structure/1N8Z
- PDB 5DK3, pembrolizumab Fab heavy and light chains: https://www.rcsb.org/structure/5DK3

`antibody-chains.fasta` retains each complete antibody chain exactly as returned by RCSB. `source-records.csv` records the N-terminal variable-domain lengths used for a like-for-like comparison. The local script only reads these files; no antibody sequence was sent to an external prediction service.
