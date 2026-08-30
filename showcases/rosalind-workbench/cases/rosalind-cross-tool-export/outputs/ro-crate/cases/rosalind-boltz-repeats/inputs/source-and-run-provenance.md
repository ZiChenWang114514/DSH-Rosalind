# Public inputs and prior execution provenance

- Human PD-L1 extracellular domain: UniProt Q9NZQ7, residues 18–239, https://www.uniprot.org/uniprotkb/Q9NZQ7/entry
- KN035–PD-L1 structural reference: PDB 5JDS, https://www.rcsb.org/structure/5JDS
- Boltz source and documentation: https://github.com/jwohlwend/boltz
- Retained target sequence: `PDL1_Q9NZQ7_18-239.fasta`
- Portable YAML generator: `../prepare_boltz_inputs.py`

The parent VHH and 19 interface variants are retained in `candidates.csv`. A completed local GPU run supplied the historical result snapshot. During case preparation, 25 confidence JSON files, 25 paired CIF files, and the final ensemble summaries were inspected. The public case retains all 25 confidence payloads and the complete per-model metric table. It also contains public sequences, a portable input generator, a portable five-sample command, and scoring code for a fresh free local rerun. The historical CIF coordinates were not copied into this repository snapshot.
