---
name: design-ngs-analysis
description: Design a defensible NGS analysis before workflow selection or execution.
---

# Design NGS Analysis

## When to use

Use this Skill when a biological question needs an analysis plan before choosing or running a workflow. Fixed reference: `ngs-analysis-workbench-0.2.16/skills/design-ngs-analysis/SKILL.md`. The DSH mapping preserves the fixed-version workflow and uses DSH-Rosalind's registered tools.

## Tool call sequence

1. Establish objective, assay, biological experimental unit, groups, covariates, contrast, endpoint, reference, and present data state.
2. If identities or relationships are unclear, use Understand NGS Data before selecting a method.
3. Produce an `analysis_plan` covering validity criteria, methods, evidence required, limitations, and supported versus unsupported claims. This Skill is read-only: it does not call a run, registration, install, or download tool.

## Success and viewer state

A completed plan states a scientifically identifiable comparison and shows which result could support each claim. It is an analysis-design artifact, not a workflow result or readiness confirmation.

## Failure, authorization, and cancellation

When replication, confounding, reference, or endpoint details are unresolved, state them as unknown rather than selecting a pipeline. There is no cancellable job or authorization request in this reasoning-only Skill.

## Provenance

Retain input material identities, assay and reference assumptions, design rationale, data exclusions, validity criteria, and the plan revision that later workflow work uses.
