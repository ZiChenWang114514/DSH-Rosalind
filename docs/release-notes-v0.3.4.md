# DSH-Rosalind 0.3.4

DSH-Rosalind 0.3.4 preserves the scientific workbench delivered in 0.3.3 and repairs its GitHub Actions validation workflow.

## Improvements

- Initializes the clean DSH profile from each runner's runtime environment, allowing GitHub Actions to create the Linux and Windows bundle jobs successfully.
- Runs validation with Node 24 and an explicit pnpm 10.15.1 installation, matching current dependency requirements and the verified DSH runtime.
- Retains the DeepSeek Harness Science sidebar, reversible Science mode, seven Cordis science modules, session evidence, project workflow, source adapters, viewers and runtime improvements from 0.3.3.

## Verification

- Local `npm run validate`: passed, including 52 Vitest files and 493 tests.
- Playwright: 57 passed; 7 live-profile cases were skipped because `DSH_PROFILE_URL` was not supplied.
- Independent scientific verification: 10 focused files and 68 tests passed.
- Independent interface verification: 43 product tests and 36 Harness tests passed; four live-profile browser checks passed.
- The GitHub Actions workflow now creates its Linux and Windows jobs normally and validates the exact 0.3.4 release commit.
