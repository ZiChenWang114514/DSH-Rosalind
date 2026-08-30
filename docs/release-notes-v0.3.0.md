# DSH-Rosalind v0.3.0

DSH-Rosalind v0.3.0 redesigns the path from a scientific question to a usable lesson, retained result, or reviewed execution plan. It keeps the 23-case evidence snapshot and the DSH 0.1.1-rc.2 runtime contracts while reducing navigation and keeping active project state visible.

## Interaction changes

- The blank-session experience opens directly on a compact scientific task launcher and searchable project catalogue.
- Project details offer three explicit actions: **Start lesson**, **Inspect evidence**, and **Prepare run**.
- User-facing requests contain the scientific intent only. Tool names, parameter names, showcase IDs, and adapter details remain internal.
- An explicit project action can submit directly to the active DSH conversation.
- The session Workbench emphasizes the active project, current status, recent artifacts, and next useful action.
- Scientific capabilities are documented with provider settings instead of competing with projects in the daily work area.

## Scientific state

- Settled `rosalind_*` results are reconstructed from the conversation snapshot into a compact current-project summary.
- Refreshing a session can recover the latest showcase, mode, run identity, status, provider, artifacts, and next action from recorded tool results.
- Provider registration and declared capability counts are presented separately from live readiness.
- Structure coordinates and authorized slide tiles use project-owned Canvas views without packaging third-party application source.

## Compatibility and retained evidence

- DeepSeek Harness compatibility remains fixed at `0.1.1-rc.2`.
- The 23-case catalogue remains pinned to `rosalind-science-showcases` commit `f81e668c69edbfe7863cc936f2d535b61d8df76b`.
- Recorded results remain distinct from new local or external executions.
- The 55 distributed science Skills are project-authored DSH-Rosalind instructions; fixed plugin versions remain compatibility references with separate content hashes.
- Paid services, GPU work, SSH/HPC, large downloads, and external writes still require a reviewed plan and explicit confirmation.

## Verification

Run the complete release validation before distributing the archive:

```powershell
npm run validate
npm run test:e2e
npm run pack:bundle
```

Public release acceptance additionally requires the clean-profile DSH installation check described in [verification.md](verification.md).
