# Codex showcase lesson: Reversible sequence copy edit

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `sequence-edit-copy` (Reversible sequence copy edit). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `sequence-edit-copy`
- Plugin: `biological-sequence-viewer` (Biological Sequence & Alignment Viewer v0.1.43)
- Status: `ready`
- Domain: `structure-and-sequence`
- Case type: `analysis`
- Difficulty: `intermediate`
- Evidence level: `computed-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Python 3 standard library`, `Rosalind Workbench mcp__rosalind__rosalind_open`, `Biological Sequence & Alignment Viewer 0.1.43 diagnostic attempts recorded in outputs/viewer-operation-evidence.json`
- Summary: How can a copied sequence be edited while retaining source provenance?
- Recorded next step: Repeat the P01116 Gly12-to-Cys edit on a copy and verify that the original sequence and source provenance remain unchanged.
- Plugin guide: `showcases/biological-sequence-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/README.md`
- case manifest: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/showcase.json`
- teaching prompt: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/prompt.md`
- input: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/inputs/public-source.md`
- input: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/inputs/P01116-KRAS-SV1.fasta`
- output: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/outputs/before-after.csv`
- output: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/outputs/P01116-G12C-copy.fasta`
- output: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/outputs/edit-checks.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/outputs/provenance.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/outputs/rosalind-open-observation.json`
- output: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/outputs/viewer-operation-evidence.json`
- preview: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/previews/preview.svg`
- provenance reference: `showcases/biological-sequence-viewer/cases/sequence-edit-copy/build_case.py`

## Public sources

- https://rest.uniprot.org/uniprotkb/P01116.fasta

## Retained case guide

# Verified KRAS G12C protein copy edit

![KRAS G12C safe copy edit](previews/preview.svg)

## Scientific question

Can residue 12 of reviewed human KRAS be changed from glycine to cysteine in a derived protein-sequence copy while proving that the source remains unchanged?

## Source observations

- The source is UniProtKB P01116, sequence version 1, extracted without gaps from the verified RAS alignment.
- The source has 189 residues and residue 12 is glycine.
- Its sequence SHA-256 is `1d5a9ab11f64cb886d8ffa08a153c412b2d190fcf70e5690cd4b4c7efcdee53a`.

## Copy transformation and checks

`build_case.py` writes a standalone source FASTA, creates a new `P01116_G12C_COPY` record, and replaces only residue 12. The checks verify:

- length 189 before and after;
- exactly one difference, G12C;
- source-file SHA-256 unchanged during the transformation;
- distinct source and derived FASTA files;
- source and copy sequence digests retained in JSON.

The one-row change record is available as `outputs/before-after.csv`; full checks are in `outputs/edit-checks.json`.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with a case-specific task context at `2026-08-29T17:56:31.828Z`. The exact response, arguments, UTC/local times, and `scientific_job_executed: false` are retained in `outputs/rosalind-open-observation.json`. The call opened only the task chooser; it did not submit P01116 or create or export the G12C copy.

## Viewer rehearsal

The retained copy was generated with local Python. No successful Viewer copy edit or export was found, so neither operation is listed as a capability.

## Reproduce

```powershell
python showcases/biological-sequence-viewer/cases/sequence-edit-copy/build_case.py
```

## Limitations

This is a protein-sequence teaching copy. It does not specify a nucleotide codon, cloning strategy, expression construct, biochemical effect, structural effect, or clinical interpretation.

## Viewer operation review (2026-08-30)

No Sequence Viewer operation is recorded as successful. Server sessions were created for the relevant local public files, but subsequent queries or controls were not acknowledged. `outputs/viewer-operation-evidence.json` separates failed calls from actions that were not attempted after the prerequisite confirmation failed. It omits session identifiers, private paths, and internal resource URIs.

## Retained execution prompt

# Prompt

Create a derived copy of reviewed UniProtKB P01116 sequence version 1 and replace protein residue 12 from glycine to cysteine. Invoke `mcp__rosalind__rosalind_open` with this case's task context, cite `outputs/rosalind-open-observation.json`, and state that the chooser response does not prove a scientific job ran. Preserve the source FASTA, verify length and exact difference count before export, retain before/after sequence digests, and avoid functional or clinical claims.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
