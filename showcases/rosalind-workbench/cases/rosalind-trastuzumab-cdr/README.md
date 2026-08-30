# Trastuzumab CDR refinement

![Trastuzumab CDR interface map](previews/preview.svg)

## Scientific question

Which trastuzumab CDR positions directly contact HER2 in public PDB 1N8Z, and which distant positions can be reserved for conservative exploration?

## Public source and computation

`build_case.py` downloads public PDB 1N8Z and analyzes explicit operational CDR ranges on light chain A and heavy chain B against HER2 chain C. It records each CDR residue's nearest HER2 distance, direct HER2 contacts within 4.5 Å, and mean crystallographic B factor.

## Computed result

- 56 residues are included across six operational CDR ranges.
- 17 CDR residues lie within 4.5 Å of HER2 in this crystal structure.
- Direct-contact positions include light-chain Asp28, Asn30, Thr31, Ala32, Ser50, Phe53, His91, Tyr92, Thr93, Thr94 and heavy-chain Tyr33, Arg50, Tyr52, Tyr57, Thr58, Arg59, Trp99.
- `outputs/conservative-exploration-set.csv` lists 12 conservative substitutions at positions at least 8 Å from HER2. They are hypotheses for later testing, not established improvements.

## Interpretation

The direct-contact set should receive the strongest preservation preference when the HER2 epitope hypothesis is maintained. Distant CDR positions offer a more cautious starting set for sequence exploration, followed by structural modeling, developability screening, and binding experiments.

## Rosalind observation

`outputs/rosalind-open-observation.json` records one genuine `mcp__rosalind__rosalind_open` call with trastuzumab CDR context. It confirmed launcher readiness and records `scientific_job_executed: false`. The contact analysis came from the local retained script and public 1N8Z coordinates.

## Limitations

- The CDR ranges are an explicit operational definition, not a universal numbering convention.
- One 2.52 Å crystal structure cannot describe all solution conformations or mutation-induced rearrangements.
- Distance from HER2 does not prove that a substitution preserves folding, affinity, specificity, or developability.
- No candidate was modeled or tested experimentally.

## Reproduce

1. Run `python build_case.py` from this case directory.
2. Confirm 56 analyzed CDR residues and 17 residues within 4.5 Å of HER2.
3. Inspect `outputs/cdr-contact-metrics.csv`, `outputs/conservative-exploration-set.csv`, and `outputs/interface-summary.json`.
4. Read `outputs/rosalind-open-observation.json` separately as launcher evidence.
