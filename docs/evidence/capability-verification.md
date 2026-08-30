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
npx vitest run tests/runtime.test.ts tests/science-literature-databases.test.ts tests/database-provider-matrix.test.ts tests/sequence-ngs-operation-matrix.test.ts tests/structure-operation-matrix.test.ts tests/science-slide-parity.test.ts tests/skills-source.test.ts tests/skills-workflow-matrix.test.ts tests/science-integration.test.ts tests/rosalind-operation.test.ts tests/dsh-host-registration.test.ts --reporter=dot
```

Observed result:

```text
Test Files  11 passed (11)
Tests       203 passed (203)
```

This run exercised service implementations, loaded all 55 bundled Skills, dispatched the 117-operation registry, and executed the Sequence, NGS, Structure, and Slide matrices. The host-registration test mounted Cordis and the local DSH ToolRuntime/SkillRegistry services, listed every registered Skill, read each definition back, and asserted its model/user invocation metadata. This is the recorded Skill registration evidence. Its shared null-argument dispatch demonstrates registration and reachability only; it is not live-operation evidence. `tests/capabilities.test.ts` remains a source-level manifest check and is deliberately excluded from this execution record.

## Evidence interpretation

A source directory, implementation filename, test filename, or showcase reference records location only. It does not record that code executed successfully. The generated manifest therefore records source and test locators separately from this passing execution identifier.

Operation `verified` status in the capability manifest requires a locatable source implementation plus an executed operation-specific fixture containing meaningful input and an asserted successful local scientific result. Exact unavailable diagnostics and combined mixed fixtures remain `implemented`. Each operation records `fixtureOutcome` as `successful-local-result`, `mixed-success-and-diagnostic`, or `exact-diagnostic`; live DSH-profile and public-service evidence remain separate. A source locator, registry count, shared null-argument dispatch, operation name, or exact failure diagnostic supports implemented status only.

No run in this record used a real DSH profile or a real public-service request. Consequently, all live evidence fields remain `missing`. Shared pre-dispatch cancellation is retained only as host-level behavior; operation cancellation evidence is recorded only for a directly asserted cancellation operation.

Current generated status:

```text
Services    0 verified, 7 implemented, 0 missing
Skills      0 verified, 55 implemented, 0 missing
Operations 65 verified, 52 implemented, 0 missing
```

For the 117 operation fixtures, the manifest records 65 successful local-result contracts, 22 mixed success/diagnostic contracts, and 30 exact diagnostic contracts. These figures describe the fixtures, not public-service availability.

The 65 verified operation fixtures assert successful local scientific results. The remaining 52 operations retain implementation and diagnostic evidence while awaiting operation-specific successful output or live DSH execution. The retained fixtures include concrete NGS plan/readiness records, precise diagnostics for unavailable Slide and Structure actions, and the molecular-design result for `rosalind.open`.

All 55 Skills have a project-authored `SKILL.md`, DSH SkillRegistry registration/readback, invocation metadata, a registered main tool or one of three explicit instruction-only execution modes, provider/server mapping where applicable, and a link to an executed meaningful provider or operation fixture. This does not claim that a running model autonomously selected the Skill.

Error evidence is recorded only when an applicable test contains a locatable operation-specific or service-specific assertion. Missing error evidence remains explicit even when the ordinary operation fixture passed.

## TypeScript check

`npx tsc --noEmit --pretty false` passed after the concurrent validator correction was incorporated.
