<div align="center">
  <img src="assets/readme-hero.svg" alt="DSH-Rosalind — a reproducible science workbench for DeepSeek Harness" width="100%" />

  <p>
    <a href="https://github.com/ZiChenWang114514/DSH-Rosalind/actions/workflows/validate.yml"><img alt="Validate" src="https://github.com/ZiChenWang114514/DSH-Rosalind/actions/workflows/validate.yml/badge.svg" /></a>
    <a href="https://github.com/ZiChenWang114514/DSH-Rosalind/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/ZiChenWang114514/DSH-Rosalind?display_name=tag" /></a>
    <a href="LICENSE"><img alt="Code licence: Apache-2.0" src="https://img.shields.io/badge/code-Apache--2.0-6b8f83" /></a>
    <a href="LICENSE-DOCS"><img alt="Documentation licence: CC BY 4.0" src="https://img.shields.io/badge/docs-CC%20BY%204.0-b17b55" /></a>
  </p>

  <p><strong>Twenty-three reproducible life-science projects, designed for DSH Web.</strong></p>
  <p><a href="README.zh-CN.md">简体中文</a> · <a href="docs/showcases.md">Showcase catalogue</a> · <a href="docs/architecture.md">Architecture</a> · <a href="docs/verification.md">Verification</a></p>
</div>

## What it is

DSH-Rosalind is a native extension for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It turns a fixture-checked scientific showcase collection into a searchable workbench inside DSH Web. Every project supports three complementary paths:

- **Lesson** explains the scientific question, retained evidence, computed results, interpretation, limitations, and citations.
- **Replay** opens the versioned artifacts and previews that were already checked for this release.
- **Reproduce** prepares a new execution plan, reports provider readiness, and runs only the steps that are available and approved.

The release contains **23 lesson-and-replay-ready projects in seven scientific areas** and the **150 files referenced by their manifests**. A fresh reproduction can complete locally, call a public service after authorization, or report the exact missing runtime or credential. The snapshot is pinned to `rosalind-science-showcases` commit [`f81e668c69edbfe7863cc936f2d535b61d8df76b`](https://github.com/ZiChenWang114514/rosalind-science-showcases/tree/f81e668c69edbfe7863cc936f2d535b61d8df76b).

## Inside DSH Web

These images were captured from the packaged extension after installation into a clean DSH `0.1.1-rc.2` Web profile.

| Catalogue · light | PD-L1 details · dark |
|---|---|
| ![DSH-Rosalind catalogue in the light DSH theme](docs/screenshots/dsh-light-catalogue-1280x720.png) | ![PD-L1 nanobody evidence in the dark DSH theme](docs/screenshots/dsh-dark-pdl1-detail-1280x720.png) |

The catalogue also adapts to a collapsed DSH sidebar and a 720-pixel-wide desktop viewport without horizontal scrolling.

<p align="center"><img src="docs/screenshots/dsh-light-narrow-720x900.png" alt="DSH-Rosalind in a narrow DSH Web window" width="420" /></p>

## Ten-minute start

### Requirements

- Node.js 20 or newer
- DeepSeek Harness `0.1.1-rc.2`
- A DSH Web profile with at least one workspace

Install DSH if it is not already present:

```powershell
npm install --global @deepseek-ai/dsh@0.1.1-rc.2 pnpm
dsh --version
```

Download `zichenwang114514-dsh-rosalind-0.2.0.tgz` from the [v0.2.0 release](https://github.com/ZiChenWang114514/DSH-Rosalind/releases/tag/v0.2.0), then add the bundle to DSH Web:

```powershell
dsh plugin --profile web add C:\Downloads\zichenwang114514-dsh-rosalind-0.2.0.tgz
dsh web --no-open
```

Open the address printed by DSH. The blank-session screen now contains the DSH-Rosalind catalogue. Search or filter the projects, open one, choose **Lesson**, **Replay**, or **Reproduce**, and select **Add to conversation**. The preserved teaching prompt is placed in the DSH composer for review before sending.

To install a local source build:

```powershell
git clone https://github.com/ZiChenWang114514/DSH-Rosalind.git
cd DSH-Rosalind
npm ci
npm run pack:bundle
dsh plugin --profile web add .\zichenwang114514-dsh-rosalind-0.2.0.tgz
```

## The catalogue

| Area | Projects | Examples |
|---|---:|---|
| Literature | 3 | TREM2 landscape, PMC availability, preprint-to-publication linkage |
| Databases | 3 | IL6R–asthma evidence, rs7903146 interpretation, EGFR knowledge map |
| Sequence | 3 | Lambda annotation, human RAS alignment, FASTQ quality |
| NGS | 3 | FASTQ readiness, bulk RNA-seq, single-cell RNA-seq |
| Molecular structure | 3 | MDM2–p53 contacts, adenylate kinase alignment, GFP figure |
| Pathology & spatial | 4 | Whole-slide pyramid, spatial expression, GeoJSON overlay, research export |
| Workbench | 4 | PD-L1 nanobody design and three guided scientific launchers |

See the [complete catalogue](docs/showcases.md) for all IDs, data sources, retained results, and fresh-run requirements.

## Native DSH experience

The extension uses the public DSH `0.1.1-rc.2` contracts rather than page selectors:

- the original DSH-Rosalind mark on the blank-session hero;
- a two-column searchable project catalogue;
- a session-level **Workbench** view;
- scientific provider settings;
- dedicated cards for every `rosalind_*` tool call;
- a detail overlay for evidence, artifacts, run preparation, and import.

The host registers thirteen model-callable tools for catalogue access, provider checks, import, planning, confirmation, execution, status, cancellation, artifact handling, export, and scientific review. Network and long-running work receive cancellation signals. Paid services, GPU work, SSH/HPC execution, and external writes require a specific confirmation, and a failed provider is never replaced automatically.

## Scientific provenance

Recorded artifacts remain separate from live service responses. The workbench stores and presents:

1. source observations;
2. computed results;
3. scientific interpretation;
4. limitations and citation checks.

Release validation derives the headline values from the retained files, including the 191-column RAS alignment, the 500-read FASTQ subset, 105 MDM2–p53 atom contacts, the 684-row spatial export, and the twenty PD-L1 nanobody candidates. Details and commands are in [verification.md](docs/verification.md).

Large SVS, FASTQ, H5AD, container images, and model weights are not committed. A fresh run reports the source, estimated size, destination, credentials, compute requirements, and expected cost before it requests approval.

## Providers

The historical projects work without credentials. Fresh execution can use local algorithms, public APIs, containers, SSH/HPC, or optional compute providers. Provider configuration and diagnostic messages are described in [providers.md](docs/providers.md).

DSH-Rosalind is compatible with both DeepSeek V4 Flash and DeepSeek V4 Pro at runtime. The model selected in DSH decides how the lesson is discussed; it does not change the retained scientific artifacts.

## Development

```powershell
npm ci
npm run validate:showcases
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run pack:bundle
```

The CI matrix covers Windows and Ubuntu, the complete catalogue, scientific acceptance records, host state transitions, browser components, DSH installation, keyboard access, themes, responsive layouts, packaging, and documentation links. See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a new adapter or project.

## Licence and notices

Source code is licensed under [Apache-2.0](LICENSE). Project-authored documentation and visual material use [CC BY 4.0](LICENSE-DOCS). Scientific data, external services, and retained public files keep their original licences and citation requirements; consult [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and each case's provenance files.

The DSH-Rosalind mark and interface artwork are original. No OpenAI or Rosalind product artwork is distributed in this repository.
