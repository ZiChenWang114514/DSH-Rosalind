---
name: understand-ngs-data
description: Inspect NGS inputs and evidence before choosing a workflow.
---

# Understand NGS Data

## When to use

Use this Skill when the user asks what NGS material exists, how samples relate, whether inputs are usable, or which analyses the material could support. Fixed reference: `ngs-analysis-workbench-0.2.16/skills/understand-ngs-data/SKILL.md`. The DSH mapping preserves the fixed-version workflow and uses DSH-Rosalind's registered tools.

## Tool call sequence

1. Inventory reads, BCL material, alignments, VCFs, count matrices, single-cell objects, metadata, references, plans, runs, and existing results.
2. Use parsers, manifests, and recorded run metadata rather than filename guesses.
3. Create a `starting_point_assessment` with identities, relationships, provenance, supportable tasks, missing information, and one justified handoff. Do not choose a workflow, transform inputs, install software, or create a plan.

## Success and viewer state

The assessment distinguishes observations from inferences and identifies the material that a later scientific decision can use. It does not show readiness, execution, or results.

## Failure, authorization, and cancellation

Conflicting, missing, or unusable material is reported directly. This inspection-oriented Skill has no execution job, cancellation action, or approval request.

## Provenance

Keep each artifact's identity, role, assay, source, reference/annotation context, sample relationships, durable run identities, and constraints.
