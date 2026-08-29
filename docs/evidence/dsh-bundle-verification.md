# DSH bundle verification record

This record describes the local build, registration, packed-bundle, and fresh-profile checks performed on 2026-08-30 from the current worktree.

## Environment

- Cordis: `4.0.1`
- DSH Tools: `0.1.1-rc.2`
- DSH Skill: `0.1.1-rc.2`
- live public network requests: disabled
- DeepSeek API calls: none
- packed bundle: generated with `npm pack --ignore-scripts` in a unique system temporary directory and an independent temporary npm cache
- profile package manager: an isolated temporary installation of `pnpm 10.15.1`; no global package-manager installation was changed

## Checks executed in this revision

1. `npm run build` completed successfully and regenerated the 23 showcase manifests plus the host and client bundles.
2. `node scripts/verify-dsh-registration.mjs` registered 136 tools and 55 Skills:
   - 117 fixed operations from the capability manifest;
   - 6 Skill adapter tools, including all four Slide compatibility tools;
   - 13 Rosalind orchestration tools.
3. All 136 registered tools resolved through ToolRuntime, rendered structured output, exposed call/result presenters, and accepted a null-argument dispatch without an unstructured exception. Disposal removed all 136 tools and all 55 Skills.
4. Each Slide compatibility tool was dispatched with a missing test session and returned a structured scientific diagnostic: `slide_control_viewer`, `slide_run_analysis_from_chat`, `slide_run_pathology`, and `slide_query_scientific_layer`.
5. The PMC `article-dataset` contract and the `gtex-eqtl`, `clinvar-variation`, `ukb-topmed-phewas`, and `gnomad-graphql` provider contracts were dispatched with representative identifiers and parameters. Every request reached the explicit offline authorization check and returned `NETWORK_NOT_AUTHORIZED`; no public request was sent.
6. A temporary npm archive was inspected by `node scripts/check-packed-bundle.mjs`. It contained 333 files (approximately 2.3 MB packed and 14.3 MB unpacked). The check verified 55 packaged `SKILL.md` files, 23 showcase manifests, three reproducible NGS workflow packages, the capability manifest's 117 fixed operations, all 6 Skill adapter names, all 13 Rosalind tool names, the four Slide compatibility names, the PMC contract in the built host file, and the new provider IDs in both host and client files. Development-only `src`, `tests`, `node_modules`, and fixed-version reference-plugin source directories were absent.

The first `npm pack` attempt encountered an `EEXIST` error in the shared global npm cache and did not create an archive. The successful check used a newly created temporary cache; the existing shared cache was left unchanged.

## Fresh-profile verification

The current archive was installed into a newly created DSH home and Web profile:

1. `dsh plugin --profile web add <archive>` completed with DSH `0.1.1-rc.2` and pnpm `10.15.1`.
2. The generated profile manifest listed `@zichenwang114514/dsh-rosalind` as both a dependency and the third bundle after `@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-web-app`.
3. `dsh --profile web --dump-config` contained the `dsh-rosalind` patch row.
4. The Web profile started on an isolated local port, returned HTTP 200, and logged its browser URL without an extension-initialization error.
5. `tests/e2e/dsh-profile.spec.ts` passed in all four configured projects: 1280x800, 1440x900, 2048x1320, and 720x900.
6. The first four-project run produced three passes and one false negative at 1280x800 while the DSH testing notice had already disappeared and the Workbench was visible. The test now treats the Workbench heading as the completion signal while continuing to accept the notice if it is still present. The repeated four-project run passed at 1280x800, 1440x900, 2048x1320, and 720x900.

No commit, push, publication, live public request, or DeepSeek API call was performed.
