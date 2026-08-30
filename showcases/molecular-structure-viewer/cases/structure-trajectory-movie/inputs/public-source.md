# Public adenylate-kinase trajectory

The retained topology and five-frame DCD subset derive from Figshare dataset 5108170 v1:

- Title: *Molecular dynamics trajectory for benchmarking MDAnalysis*
- Authors: Sean Seyler and Oliver Beckstein
- DOI: https://doi.org/10.6084/m9.figshare.5108170.v1
- License: CC BY 4.0
- Dataset API: https://api.figshare.com/v2/articles/5108170
- Topology file: https://ndownloader.figshare.com/files/8672230
- Full trajectory file: https://ndownloader.figshare.com/files/8672074

The source describes a 1.004 μs apo adenylate-kinase simulation with CHARMM27, explicit-solvent NPT conditions at 300 K and 1 bar, solvent stripped from the deposited trajectory, coordinates saved every 240 ps, and frames fitted on the CORE domain.

The original topology and full DCD were downloaded and checked against the SHA-256 values published in the MDAnalysisData accessor. The full 168,200,440-byte DCD was processed temporarily. This case retains its 789,917-byte PSF, a five-frame DCD subset, a frame-zero PDB for mounting a supported coordinate file, and exact source-frame mappings in `outputs/sampled-frame-metrics.csv`.
