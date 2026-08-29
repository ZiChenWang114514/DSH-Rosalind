# DSH-Rosalind v0.1.0

DSH-Rosalind v0.1.0 brings a reproducible scientific workbench to DeepSeek Harness 0.1.1-rc.2. The release includes 23 ready teaching projects across literature, biomedical databases, sequences, NGS, molecular structures, pathology and spatial biology, and scientific workbench launchers.

## What is included

- A native DSH Web catalogue with search, scientific-area filters, provider status, and responsive light and dark themes.
- Lesson, replay, and reproduce modes for all 23 projects.
- Thirteen model-callable tools for catalogue discovery, conversation import, planning, approval, execution, status, cancellation, artifact access, export, and scientific review.
- 148 compact, parseable showcase files pinned to source snapshot `f81e668c69edbfe7863cc936f2d535b61d8df76b`.
- Exact validation for the Lambda annotation, human RAS alignment, FASTQ quality control, MDM2-p53 contacts, GFP chromophore environment, whole-slide image metadata, spatial expression export, and PD-L1 nanobody ranking examples.
- Explicit diagnostics for optional public APIs, SSH/HPC, Boltz, Biohub ESM, Modal, and Runpod providers.

## Install

Install DeepSeek Harness and add the attached package to the Web profile:

```bash
npm install --global @deepseek-ai/dsh@0.1.1-rc.2
dsh plugin --profile web add file:./zichenwang114514-dsh-rosalind-0.1.0.tgz
dsh web --no-open
```

Open the URL printed by DSH, choose a project, inspect its evidence, select a use mode, and add the prepared teaching prompt to the conversation.

## Verification

The release is checked on Windows and Ubuntu with Node.js 20. Automated verification covers catalogue and scientific-file validation, TypeScript, 19 unit and component tests, 12 browser interaction and layout tests at four viewport sizes, documentation links, production builds, bundle size, clean-profile installation, and a live DSH Web request.

External services and GPU jobs remain optional. DSH-Rosalind shows the selected provider, required credentials, resources, and confirmation details before execution.
