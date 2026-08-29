# Providers and compute

Lesson and replay use files included in the release and do not require credentials. Reproduce first calls provider status and creates a plan that lists the selected service, inputs, resources, network use, estimated cost, and required confirmations.

## Local providers

| Provider ID | Purpose | Requirement |
|---|---|---|
| `local-replay` | Retained project and PD-L1 result checks | Included with the bundle |
| `local-sequence` | Lambda, RAS, and FASTQ deterministic checks | Included with the bundle |
| `local-structure` | Structure fixtures and contact checks | Included with the bundle |
| `local-slide` | Slide and spatial fixture checks | Included with the bundle |
| `local-workbench` | Guided launcher checks | Included with the bundle |
| `local-container` | NGS workflows | `docker` available on `PATH` |

## Public scientific sources

The current adapter registry knows NCBI Entrez, PMC, bioRxiv/medRxiv, Open Targets, GWAS Catalog, GTEx, ClinVar, Ensembl, UniProt, ChEMBL, RCSB PDB, Reactome, and an authorized public-dataset source. Live access is disabled by default. Set the following variable in the environment that starts DSH when you intend to use current network responses:

```powershell
$env:DSH_ROSALIND_ENABLE_LIVE_NETWORK = "1"
dsh web --no-open
```

Historical result counts remain tied to the published snapshot. A live query is dated and reported separately.

## Remote and optional compute

| Provider ID | Requirement | Confirmation |
|---|---|---|
| `ssh-hpc` | `ssh` on `PATH`; `DSH_ROSALIND_SSH_HOST` | Remote target and command |
| `boltz` | `boltz` on `PATH`; suitable compute | GPU work and estimate |
| `biohub-esm` | `BIOHUB_ESM_API_KEY` | Paid API and estimate |
| `modal` | `modal` on `PATH`; `MODAL_TOKEN_ID` | Paid compute and estimate |
| `runpod` | `RUNPOD_API_KEY` | Paid compute and estimate |

Example for an SSH target:

```powershell
$env:DSH_ROSALIND_SSH_HOST = "user@cluster.example.org"
dsh web --no-open
```

Credentials remain in the process environment or the user-selected secret system. They are never copied into the project catalogue, prompts, exports, or logs. If a provider cannot run, DSH-Rosalind explains the missing command, authorization, credential, or target. It does not start another service automatically.

## Large inputs

Before a large download or remote run, the planned action should state the public source, expected size when known, destination, provider, and resulting files. Public PR tests use compact fixtures. Tests that can create charges are manual release checks and do not run for pull requests.
