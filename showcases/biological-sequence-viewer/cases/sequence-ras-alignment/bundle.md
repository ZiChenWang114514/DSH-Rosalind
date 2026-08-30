# Codex showcase lesson: Human RAS protein alignment

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `sequence-ras-alignment` (Human RAS protein alignment). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `sequence-ras-alignment`
- Plugin: `biological-sequence-viewer` (Biological Sequence & Alignment Viewer v0.1.43)
- Status: `ready`
- Domain: `structure-and-sequence`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `computed-result`
- Covered operations: `sequence-viewer.sequence_open_from_chat`, `sequence-viewer.sequence_control_viewer`, `sequence-viewer.sequence_run_analysis`, `sequence-viewer.sequence_query_viewer`, `sequence-viewer.sequence_export_artifact`, `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Rosalind Workbench mcp__rosalind__rosalind_open`, `Biological Sequence & Alignment Viewer 0.1.43 diagnostic attempts recorded in outputs/viewer-operation-evidence.json`, `Historical completed Sequence Viewer calls recovered from source task archived-sequence-viewer-task`
- Summary: Compare KRAS, NRAS, and HRAS conservation, distances, and an exploratory NJ tree.
- Recorded next step: Open the case README to present the verified alignment, matrix, tree, and preview.
- Plugin guide: `showcases/biological-sequence-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/README.md`
- case manifest: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/showcase.json`
- teaching prompt: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/prompt.md`
- input: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta`
- input: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta.provenance.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/outputs/RAS-P01116-P01111-P01112-NJ.nwk`
- output: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/outputs/analysis.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/outputs/provenance.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/outputs/rosalind-open-observation.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/outputs/viewer-operation-evidence.json`
- preview: `showcases/biological-sequence-viewer/cases/sequence-ras-alignment/previews/ras-alignment.svg`

## Public sources

- https://rest.uniprot.org/uniprotkb/P01116.fasta
- https://rest.uniprot.org/uniprotkb/P01111.fasta
- https://rest.uniprot.org/uniprotkb/P01112.fasta

## Retained case guide

# Human RAS protein alignment

This ready showcase compares reviewed human KRAS, NRAS, and HRAS proteins in Biological Sequence & Alignment Viewer.

![RAS alignment analysis](previews/ras-alignment.svg)

## Scientific question

How strongly is the shared RAS GTPase core conserved, and where do the three human paralogues differ most clearly?

## Source observations

- The aligned FASTA contains three 189-residue proteins and 191 alignment columns.
- The rows are P01116 (KRAS), P01111 (NRAS), and P01112 (HRAS), all UniProt sequence version 1.
- The mounted viewer reported mean identity 0.9284467713787081 and normalized conservation 0.6453400570165564 across the full alignment.

## Computed results

- P01116 was used as the reference row.
- KRAS positions 10–17, 30–38, 60–76, and 116–119 were identical across all three sequences in the displayed alignment.
- Pairwise uncorrected p-distances were 0.131579 for KRAS–NRAS, 0.136842 for KRAS–HRAS, and 0.157895 for NRAS–HRAS.
- The neighbor-joining result is stored in `outputs/RAS-P01116-P01111-P01112-NJ.nwk`; the matrix and analysis settings are in `outputs/analysis.json`.
- Columns 170–191 contain the clearest substitutions and short gaps, consistent with greater divergence in the C-terminal targeting region.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with this case's task context at `2026-08-29T18:14:15.178Z`. It returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. The arguments, UTC and local timestamps, response, and `scientific_job_executed=false` are retained in `outputs/rosalind-open-observation.json` and cited by `outputs/provenance.json`. The call opened only the task chooser; it did not generate the alignment, coordinate mappings, distance matrix, or tree.

## Reproduce

1. Open `inputs/human-RAS-UniProt-SV1.aln-fasta` in Biological Sequence & Alignment Viewer.
2. Set P01116 as the reference row and enable protein-conservation coloring plus identity, gap, conservation, and sequence-logo tracks.
3. Inspect the four conserved KRAS intervals and the 170–191 C-terminal interval.
4. Run `distance-matrix` for all three rows.
5. Run `build-tree` with neighbor joining for the same row order.

The retained viewer-derived results belong to the recorded prior session. No new viewer action was performed for this update.

## Interpretation

The shared GTPase core is highly conserved, whereas the C-terminal region carries more paralogue-specific sequence variation. The built-in three-sequence tree is an exploratory teaching aid and does not replace a phylogenetic analysis with an explicit substitution model and support assessment.

## Viewer operation review (2026-08-30)

Historical completed calls recovered from source task `archived-sequence-viewer-task` support the capabilities listed in `showcase.json`. Exact non-sensitive arguments, response summaries, durations, source turn, and the retained scientific outputs are recorded in `outputs/viewer-operation-evidence.json`. The present retry did not receive viewer acknowledgement; it is recorded separately and does not alter the historical results.

## Retained execution prompt

# Prompt

Open the verified human KRAS, NRAS, and HRAS alignment. Set KRAS P01116 as the reference, map the P-loop, Switch I, Switch II, and NKXD regions, compare the conserved core with the C-terminal tails, and compute an exploratory distance matrix and neighbor-joining tree. Invoke `mcp__rosalind__rosalind_open` with this case's task context, cite `outputs/rosalind-open-observation.json`, and state that its ready task-chooser response did not perform any sequence or tree analysis.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
