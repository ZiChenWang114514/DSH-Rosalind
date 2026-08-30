---
name: ngs-analysis-workbench
description: Route NGS requests to data understanding, design, execution, or results interpretation.
---

# NGS Analysis Workbench

## When to use

Use this Skill when an NGS request may involve data understanding, design, execution, or interpretation and needs the appropriate workflow. Fixed reference: `ngs-analysis-workbench-0.2.16/skills/ngs-analysis-workbench/SKILL.md`. The DSH mapping preserves the fixed-version workflow and uses DSH-Rosalind's registered tools.

## Tool call sequence

1. Route data identity and usability questions to Understand NGS Data.
2. Route a decision or contrast to Design NGS Analysis.
3. Route a user-approved operational request to Run NGS Analysis.
4. Route completed, partial, failed, or historical output to Understand NGS Results. Preserve the question, material, plan identity, run identity, and observed status across handoffs.

## Success and viewer state

A successful route names the next focused Skill and the information that must travel with it. It does not create a workflow, install software, execute a pipeline, or claim a result.

## Failure, authorization, and cancellation

For an underspecified request, explain the information needed next. There is no cancellation or authorization action while routing; do not initiate external work implicitly.

## Provenance

Record the starting material, question, plan or run identities when present, and why the selected handoff fits the observed lifecycle.
