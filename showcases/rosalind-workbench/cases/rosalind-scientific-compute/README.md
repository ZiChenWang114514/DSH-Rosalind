# GB1 four-site variant embeddings

![GB1 embedding summary](previews/preview.svg)

## Scientific question

What does a transparent categorical embedding retain from a bounded public sample of the four-site GB1 binding landscape, and how quickly can it be generated locally?

## Public input and computation

The retained input contains the first 500 data rows of ProteinGym v1.3 assay `SPG1_STRSG_Wu_2016`. ProteinGym distributes the assay in its public substitution benchmark archive. `inputs/source-provenance.json` records the archive URL, member name, retrieval date, and row-selection rule.

For each variant, `build_case.py` extracts full-protein positions 265, 266, 267, and 280. Each residue is represented by one of 20 amino-acid states, producing an 80-dimensional one-hot vector. This is a small, deterministic teaching representation. No ESM checkpoint or sequence viewer was run.

## Verified result

- 500 retained variants, each with a 448-residue full-protein sequence
- 80 embedding dimensions covering four assayed positions
- a case-specific DMS-score summary and mutation-depth distribution in `outputs/embedding-summary.json`
- per-run Python, platform, wall time, and exit status in `outputs/run-metrics.json`

The DMS scores are source observations from ProteinGym. The one-hot vectors, mutation depths, and descriptive statistics are local computations.

`outputs/rosalind-open-observation.json` records a genuine `mcp__rosalind__rosalind_open` call made with scientific-computing context. It confirmed that the launcher was ready and records that no Rosalind scientific job executed. The GB1 encoding remains a separate local Python result.

## Interpretation

The representation preserves the categorical identity of every assayed residue and is directly inspectable. It is suitable for teaching data preparation or as input to a simple downstream model. It does not encode evolutionary context, structural context, or language-model features.

## Limitations

- The first 500 archive rows are a deterministic sample, not a balanced or random sample of the full landscape.
- The measured phenotype is the assay's GB1 binding score; it should not be generalized to other proteins or experimental settings.
- Timing depends on hardware, storage, and the Python runtime.
- No ESM inference was performed.

## Reproduce

1. Download the ProteinGym v1.3 substitution archive from the URL in `inputs/source-provenance.json`.
2. Run `python build_case.py --archive <path-to-DMS_ProteinGym_substitutions.zip>`.
3. Confirm that the input and embedding CSV files each contain 500 data rows.
4. Compare `outputs/embedding-summary.json` and inspect the generated preview.
5. Inspect `outputs/rosalind-open-observation.json` separately as launcher-readiness evidence.
