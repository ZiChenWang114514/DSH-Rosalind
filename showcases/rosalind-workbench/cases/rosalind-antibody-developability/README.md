# Therapeutic antibody sequence-liability comparison

![Antibody sequence comparison](previews/preview.svg)

## Scientific question

What sequence-derived follow-up flags appear when the variable domains of the Herceptin Fab in PDB 1N8Z and the pembrolizumab Fab in PDB 5DK3 are analyzed with one transparent method?

## Source observations

- `inputs/antibody-chains.fasta` retains the complete heavy- and light-chain polymer sequences returned by RCSB for both entries.
- The analyzed variable domains are the first 120 residues of each heavy chain, the first 107 residues of the 1N8Z light chain, and the first 111 residues of the 5DK3 light chain.
- PDB entry and chain metadata are retained in `inputs/source-records.csv`.

## Computed results

The local script calculates predicted pI, net charge at pH 7.4, hydrophobic fraction, the strongest hydrophobic and charge 9-residue windows, oxidation-prone M/W counts, N-linked sequons, and six simple deamidation/isomerization motif classes.

The Herceptin Fab variable-domain pair contains nine retained motif flags; the pembrolizumab Fab pair contains three. The largest hydrophobic 9-residue window contains seven residues for Herceptin and eight for pembrolizumab. Both pairs reach a maximum absolute charge-window score of three. Per-chain values and exact positions are in `outputs/sequence-metrics.csv` and `outputs/motif-liabilities.csv`.

## Interpretation

The tables identify sequences and local windows that merit structural inspection and controlled stress testing. A lower motif count does not establish better developability because solvent exposure, local conformation, formulation, concentration, and manufacturing conditions strongly affect observed behavior.

## Rosalind Workbench observation

The genuine `mcp__rosalind__rosalind_open` call at `2026-08-29T17:56:31.322Z` returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The case-specific arguments and exact observed response are retained in `outputs/rosalind-open-observation.json`.

This operation only opens the Rosalind task chooser. It does not prove that an antibody scientific task ran; the exact public sequences and deterministic local calculations above provide the scientific evidence in this case.

## Limitations

- The simple pI model uses fixed residue pKa values.
- Motif presence does not demonstrate deamidation, isomerization, oxidation, or glycosylation.
- The calculation does not model solvent exposure, full IgG architecture, Fc effects, glycoforms, viscosity, expression, or conformational dynamics.
- No experimental developability, stability, aggregation, pharmacokinetic, efficacy, or safety measurement was performed.
- The Workbench chooser was opened, while no Rosalind scientific job was executed.

## Reproduce

```powershell
python showcases/rosalind-workbench/cases/rosalind-antibody-developability/scripts/analyze.py
```

Inspect the exact sequences before interpreting `outputs/sequence-metrics.csv`, `outputs/motif-liabilities.csv`, `outputs/result-summary.json`, `outputs/rosalind-open-observation.json`, and `previews/preview.svg`.
