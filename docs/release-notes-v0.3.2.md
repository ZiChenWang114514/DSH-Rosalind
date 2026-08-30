# DSH-Rosalind 0.3.2

DSH-Rosalind 0.3.2 integrates the scientific workbench into the native DeepSeek Harness shell.

## Highlights

- Adds an extensible Harness workspace sidebar with native **Sessions** and Rosalind **Science** views.
- Adds Science mode, a scientific theme and the `Rosalind Science` capability preset without replacing Harness conversations, trajectories, tool results or settings.
- Connects workspace selection, research questions, module selection and session evidence into a working research-project flow.
- Adds interactive settings for Literature, Databases, Sequence, NGS, Structure, Slide and Rosalind, including module status, tools, Skills and Showcase details.
- Makes all seven Cordis modules independently configurable inside the single DSH-Rosalind plugin while preserving historical session evidence.
- Corrects the release verifiers and capability manifest to use the complete 100-Showcase catalogue.

## Verification

- `npm run validate`: passed.
- Vitest: 51 files and 456 tests passed.
- Playwright: 53 passed; 7 live-profile cases were skipped because no `DSH_PROFILE_URL` was supplied.
- Packed bundle: 1,466 files, 55 Skills, 100 Showcase manifests and 140 registered tools.
- Explicit archive verification: passed in a clean DSH `0.1.1-rc.2` profile with representative local calls for all seven scientific areas.

The release archive is `zichenwang114514-dsh-rosalind-0.3.2.tgz`.
