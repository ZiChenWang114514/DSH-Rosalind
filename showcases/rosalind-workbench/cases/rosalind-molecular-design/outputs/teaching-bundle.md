# Codex showcase lesson: PD-L1 nanobody design showcase

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-molecular-design` (PD-L1 nanobody design showcase). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-molecular-design`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `protein-and-antibody-design`
- Case type: `workflow`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: `design-pdl1-nanobodies`
- Actual tools: `Boltz-2 in a completed local GPU run`, `Python and Gemmi scoring scripts retained with the public case`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: Twenty KN035-derived designs, Boltz-2 ensemble ranking, and retained best structure.
- Recorded next step: Audit the 20 initial and 25 ensemble Boltz-2 predictions, inspect the NB13_E104Q structure, and define experimental affinity and developability tests.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-molecular-design/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-molecular-design/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-molecular-design/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-molecular-design/inputs/PDL1_Q9NZQ7_18-239.fasta`
- input: `showcases/rosalind-workbench/cases/rosalind-molecular-design/inputs/public-inputs.md`
- input: `showcases/rosalind-workbench/cases/rosalind-molecular-design/prepare_boltz_inputs.py`
- input: `showcases/rosalind-workbench/cases/rosalind-molecular-design/run_boltz.sh`
- input: `showcases/rosalind-workbench/cases/rosalind-molecular-design/score_initial.py`
- input: `showcases/rosalind-workbench/cases/rosalind-molecular-design/score_ensemble.py`
- output: `showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/candidates.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/top5_ensemble_ranking.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/design_metadata.json`
- output: `showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/result-summary.json`
- output: `showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/NB13_E104Q_best_model.cif`
- output: `showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/teaching-bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-molecular-design/previews/pdl1-nanobody.svg`

## Public sources

- https://www.uniprot.org/uniprotkb/Q9NZQ7/entry
- https://www.rcsb.org/structure/5JDS

## Retained case guide

# PD-L1 nanobody design showcase

![PD-L1 nanobody design](../previews/pdl1-nanobody.svg)

## Scientific question

Which conservative KN035-derived variants merit experimental follow-up after repeated Boltz-2 complex prediction against human PD-L1 residues 18–239?

## Source observations

- Target: UniProt Q9NZQ7 extracellular domain, residues 18–239.
- Structural parent: KN035 in PDB 5JDS.
- Twenty 130-residue VHH candidates were evaluated in the historical run; all initial predictions completed.
- The five leading designs were each resampled five times, yielding 25 successful ensemble predictions. One best-model CIF is retained in this public case.

## Computed result

NB13_E104Q ranked first with ensemble score 0.91750 ± 0.00803, protein ipTM 0.92386 ± 0.01084, interface pLDDT 0.92900, and no severe-clash models. The complete candidate table, top-five ranking, result summary, and best NB13 model are included.

## Interpretation

NB13_E104Q is the leading computational candidate in this specific scoring pipeline. The ranking prioritizes experimental testing; it does not establish affinity, specificity, expression, stability, or therapeutic activity.

## Rosalind observation

`outputs/rosalind-open-observation.json` records one genuine `mcp__rosalind__rosalind_open` call with molecular-design context. It returned the exact readiness message and did not execute a scientific job. The molecular-design result came from a separately completed Boltz-2 GPU run and retained scientific artifacts.

## Public inputs

`inputs/PDL1_Q9NZQ7_18-239.fasta` contains the target sequence verified against the free UniProt FASTA. `outputs/candidates.csv` retains the tag-free KN035 parent from PDB 5JDS and all 19 variants. `inputs/public-inputs.md` records the free acquisition URLs. `prepare_boltz_inputs.py` converts these retained sequences into Boltz YAML files without using a private path or saved task.

## Complete rerun

1. Create a fresh Python environment and install the free open-source packages: `python -m pip install --upgrade "boltz[cuda]" gemmi`. On CPU-only hardware, install `boltz` without the CUDA extra; prediction will be substantially slower.
2. Record `python -m pip show boltz gemmi` and `boltz predict --help` with the new run. The exact Boltz package version used for the historical snapshot was not retained, so a fresh run may differ.
3. Generate the 20 initial inputs: `python prepare_boltz_inputs.py --output-dir rerun/initial-inputs`.
4. Run one fixed-seed sample per candidate: `bash run_boltz.sh rerun/initial-inputs rerun/initial-predictions 1 20260829`.
5. Rank the initial screen: `python score_initial.py --candidates outputs/candidates.csv --predictions rerun/initial-predictions --output-dir rerun/initial-ranking`.
6. Read the five candidate names from `rerun/initial-ranking/top5.json`, pass them as a comma-separated value to `prepare_boltz_inputs.py --select`, and write `rerun/top5-inputs`.
7. Run five samples per selected candidate: `bash run_boltz.sh rerun/top5-inputs rerun/top5-predictions 5 20260829`.
8. Score the ensemble: `python score_ensemble.py --candidates outputs/candidates.csv --predictions rerun/top5-predictions --output-dir rerun/top5-ranking`.
9. Compare the fresh ranking with `outputs/top5_ensemble_ranking.csv`; treat differences as model, dependency, MSA, hardware, or stochastic drift until investigated.
10. Inspect `outputs/rosalind-open-observation.json` independently as interface evidence.

## Retained execution prompt

# Prompt

Design 20 KN035-derived nanobody variants against human PD-L1, predict complexes with Boltz-2, resample the five leading designs, and retain auditable rankings and structures.

Use the retained public PD-L1 FASTA, candidate CSV, portable YAML generator, run command, and scoring scripts. Record the Boltz and Gemmi versions for a fresh run because the exact historical Boltz package version is unavailable. Inspect `outputs/rosalind-open-observation.json` as a launcher-readiness observation only. Do not state that its `mcp__rosalind__rosalind_open` call executed the retained Boltz-2 job.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
