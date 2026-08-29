# DSH-Rosalind v0.2.0

DSH-Rosalind v0.2.0 expands the original showcase catalogue into a DSH 0.1.1-rc.2 science extension with seven registered service ecosystems, 55 model-callable Skills, 117 fixed scientific operations, and thirteen Rosalind orchestration tools.

## Included

- Seven service ecosystems for literature, biomedical databases, sequences, NGS, molecular structures, pathology and spatial data, and the unified Rosalind workbench.
- Twenty-three lesson-and-replay-ready showcases pinned to source snapshot `f81e668c69edbfe7863cc936f2d535b61d8df76b`.
- 150 manifest-referenced scientific files with schema, parsing, and fixed assertion checks.
- Searchable DSH Web catalogue, project details, provider settings, run planning, approval, status, artifact, export, and review views.
- Responsive light and dark layouts tested at 1280x800, 1440x900, 2048x1320, and 720x900, including keyboard use and 200 percent zoom.
- Project-authored Skill documents and visual assets suitable for the public bundle. Fixed-version upstream materials without confirmed redistribution terms are excluded from the release archive.

## Verification

- 266 host, scientific, Skill, replay, schema, approval, process-lifecycle, and registration tests.
- 40 standalone browser interaction and visual tests.
- Four clean DSH profile browser tests across the configured viewport matrix.
- Fresh-profile installation with DSH `0.1.1-rc.2` and pnpm `10.15.1`.
- Packed-bundle content inspection and host registration checks for 136 total tools.

Deterministic fixture verification is recorded separately from live public-service execution. Paid providers, authenticated render services, GPU/HPC execution, and public-network calls remain opt-in and report their current readiness before use.

## Install

```powershell
npm install --global @deepseek-ai/dsh@0.1.1-rc.2 pnpm@10.15.1
dsh plugin --profile web add file:.\zichenwang114514-dsh-rosalind-0.2.0.tgz
dsh web --no-open
```

See [verification.md](verification.md), [providers.md](providers.md), and the repository's `THIRD_PARTY_NOTICES.md` for details.
