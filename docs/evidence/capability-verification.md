# Capability verification record

Date: 2026-08-30 (Asia/Shanghai)

CAPABILITY_RUN_ID: capability-fixtures-2026-08-30

RESULT: passed

The authoritative execution record is the machine-readable
`capabilities/evidence/capability-fixtures-2026-08-30.json`. It records the
package identity and SHA-256 identities of every source file, Skill document,
fixed input, contract, and fixture file used by the run. Hashes are sampled
before and after the tests; the record is written only when both samples agree.
The generator invalidates `executed` evidence whenever any recorded content
changes.

## Executed fixture set

```text
npm run verify:capability-fixtures
```

Observed result:

```text
Test Files  24 passed (24)
Tests       303 passed (303)
```

This run exercised service implementations, loaded all 55 bundled Skills, dispatched the 121-operation registry, and executed the Sequence, NGS, Structure, and Slide matrices. The host-registration test mounted Cordis and the local DSH ToolRuntime/SkillRegistry services, listed every registered Skill, read each definition back, and asserted its model/user invocation metadata. This is the recorded Skill registration evidence. Its shared null-argument dispatch demonstrates registration and reachability only; it is not live-operation evidence. `tests/capabilities.test.ts` remains a source-level manifest check and is deliberately excluded from this execution record.

## Evidence interpretation

A source directory, implementation filename, test filename, or showcase reference records location only. It does not record that code executed successfully. The generated manifest therefore records source and test locators separately from this passing execution identifier.

Operation `verified` status in the capability manifest requires a locatable source implementation plus an executed operation-specific fixture containing meaningful input and an asserted successful local scientific result. Exact unavailable diagnostics and combined mixed fixtures remain `implemented`. Each operation records `fixtureOutcome` as `successful-local-result`, `mixed-success-and-diagnostic`, or `exact-diagnostic`; live DSH-profile and public-service evidence remain separate. A source locator, registry count, shared null-argument dispatch, operation name, or exact failure diagnostic supports implemented status only.

The record includes an isolated temporary DSH profile created from a current-worktree source-smoke archive. It confirms installation, registration, Skill readback, and representative local execution; it is not a validated release archive. No public-service request was sent. Shared pre-dispatch cancellation is retained only as host-level behavior; operation cancellation evidence is recorded only for a directly asserted cancellation operation.

Current generated status:

```text
Services    7 verified, 0 implemented, 0 missing
Skills      55 verified, 0 implemented, 0 missing
Operations 118 verified, 3 implemented, 0 missing
```

For the 121 operation fixtures, the manifest records 120 successful local-result contracts and one exact diagnostic contract. These figures describe the fixtures, not public-service availability.

The 118 verified operations assert successful local scientific results with operation-specific evidence. Three NGS operations retain `implemented` status because their current successful fixture is shared and does not yet identify each operation separately. The exact diagnostic fixture remains implemented. This status is kept distinct from public-provider readiness.

All 55 Skills have a project-authored `SKILL.md`, DSH SkillRegistry registration/readback, invocation metadata, a registered main tool or one of three explicit instruction-only execution modes, provider/server mapping where applicable, and a link to an executed meaningful provider or operation fixture. This does not claim that a running model autonomously selected the Skill.

Error evidence is recorded only when an applicable test contains a locatable operation-specific or service-specific assertion. Missing error evidence remains explicit even when the ordinary operation fixture passed.

## TypeScript check

`npx tsc --noEmit --pretty false` passed after the concurrent validator correction was incorporated.
