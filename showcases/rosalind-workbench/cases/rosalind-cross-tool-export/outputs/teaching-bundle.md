# Codex showcase lesson: Cross-tool research export

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `rosalind-cross-tool-export` (Cross-tool research export). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `rosalind-cross-tool-export`
- Plugin: `rosalind-workbench` (Rosalind Workbench v0.2.2-research-preview)
- Status: `ready`
- Domain: `scientific-computing`
- Case type: `export`
- Difficulty: `advanced`
- Evidence level: `multi-tool-result`
- Covered operations: `rosalind.rosalind_open`
- Rosalind tasks: none recorded
- Actual tools: `Python 3.14 standard library`, `retained evidence from the GB1, PD-L1 assay, Boltz-2, and workflow-definition cases`, `Rosalind Workbench mcp__rosalind__rosalind_open`
- Summary: Which files preserve source, parameters, outputs, previews, and limitations across scientific viewers?
- Recorded next step: Validate the RO-Crate 1.1 metadata and fixed-timestamp ZIP against all 16 retained cross-case evidence artifacts.
- Plugin guide: `showcases/rosalind-workbench/README.md`

## Repository files to inspect

- case guide: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/README.md`
- case manifest: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/showcase.json`
- teaching prompt: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/prompt.md`
- input: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/build_case.py`
- input: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/inputs/ro-crate-specification.md`
- output: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/outputs/ro-crate/README.md`
- output: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/outputs/ro-crate/artifact-inventory.csv`
- output: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/outputs/ro-crate/ro-crate-metadata.json`
- output: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/outputs/ro-crate/validation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/outputs/rosalind-evidence-ro-crate.zip`
- output: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/outputs/rosalind-open-observation.json`
- output: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/outputs/teaching-bundle.md`
- preview: `showcases/rosalind-workbench/cases/rosalind-cross-tool-export/previews/preview.svg`

## Public sources

- https://www.researchobject.org/ro-crate/1.1/
- https://github.com/ResearchObject/ro-crate

## Retained case guide

# Cross-case Rosalind evidence export

![RO-Crate evidence map](../previews/preview.svg)

## Scientific question

Can selected evidence from four different Rosalind teaching cases be packaged for inspection and transfer while keeping public observations, computed results, experimental plans, workflow plans, and provenance distinguishable?

## Exported research object

`build_case.py` creates a self-contained RO-Crate directory and deterministic ZIP. The package includes selected evidence from:

- the 500-variant GB1 categorical embedding;
- the PD-L1 assay and plate plan;
- the retained Boltz-2 ensemble evidence;
- the direct FASTQ QC result and two unexecuted workflow definitions.

`outputs/ro-crate/artifact-inventory.csv` records the source case, source path, evidence class, and byte count for every copied artifact. `ro-crate-metadata.json` describes the same files as JSON-LD entities. `validation.json` checks file presence, content-size declarations, and preservation of plan labels.

## Verified result

The archive is written with sorted member paths and a fixed timestamp. Repeating the builder against unchanged source artifacts produces the same member order and contents. The package contains no missing planned engine output and no invented wet-lab result.

## Rosalind Workbench observation

A genuine `mcp__rosalind__rosalind_open` call with the cross-tool export context returned `Rosalind Workbench is ready. Choose a research task in the app.` with `ready=true`. `outputs/rosalind-open-observation.json` records its exact arguments and timestamps.

The launcher call did not copy files, build the RO-Crate, create the ZIP, or validate its members. Those results came from the local deterministic builder and remain documented in the inventory, metadata, validation report, and archive.

## Interpretation

The package makes heterogeneous evidence easier to inspect and transfer. Its classifications help a reader distinguish source observations, local calculations, model predictions, and proposed experiments.

## Limitations

- Packaging does not strengthen the biological evidence in any source case.
- External source URLs can change after the recorded access date.
- The selected artifact set is compact; large Boltz structure coordinates and the full ProteinGym archive are referenced through provenance rather than copied.
- RO-Crate structural validation does not establish that a scientific method or interpretation is correct.

## Reproduce

1. Verify the four source case directories and their retained artifacts.
2. Run `python build_case.py`.
3. Inspect `outputs/ro-crate/validation.json` and `artifact-inventory.csv`.
4. Extract `outputs/rosalind-evidence-ro-crate.zip` into an empty directory and compare the member list with the RO-Crate directory.
5. Inspect `outputs/rosalind-open-observation.json` separately from the export products.

## Retained execution prompt

# Cross-case research export

Create a deterministic RO-Crate 1.1 package from the verified files in the GB1 computation, PD-L1 assay plan, Boltz repeat, and workflow-definition cases. Copy only existing artifacts, assign an evidence class to each file, validate file presence and declared size, and preserve plans and predictions as such. Inspect `outputs/rosalind-open-observation.json` as the genuine chooser-readiness record; it did not build or validate the export.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.
