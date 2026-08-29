# Capability verification record

Date: 2026-08-30 (Asia/Shanghai)

CAPABILITY_RUN_ID: capability-fixtures-2026-08-30

RESULT: passed

## Executed fixture set

```text
npx vitest run tests/runtime.test.ts tests/science-literature-databases.test.ts tests/database-provider-matrix.test.ts tests/sequence-ngs-operation-matrix.test.ts tests/structure-operation-matrix.test.ts tests/science-slide-parity.test.ts tests/skills-source.test.ts tests/skills-workflow-matrix.test.ts tests/science-integration.test.ts tests/rosalind-operation.test.ts tests/dsh-host-registration.test.ts tests/capabilities.test.ts --reporter=dot
```

Observed result:

```text
Test Files  12 passed (12)
Tests       195 passed (195)
```

This run exercised service implementations, loaded all 55 bundled Skills, dispatched the 117-operation registry, and executed the Sequence, NGS, Structure, and Slide matrices. The host-registration test mounted Cordis and the local DSH ToolRuntime/SkillRegistry services. Its shared null-argument dispatch demonstrates registration and reachability only; it is not live-operation evidence.

## Evidence interpretation

A source directory, implementation filename, test filename, or showcase reference records location only. It does not record that code executed successfully. The generated manifest therefore records source and test locators separately from this passing execution identifier.

Operation `verified` status in the capability manifest means fixture-contract verification: a locatable source implementation plus an executed operation-specific fixture containing meaningful input and an asserted local result or exact diagnostic. It does not assert successful live execution. Each operation now records `fixtureOutcome` as `successful-local-result`, `mixed-success-and-diagnostic`, or `exact-diagnostic`; live DSH-profile and public-service evidence remain separate. A source locator, registry count, shared null-argument dispatch, or operation name in a test file supports implemented status only.

No run in this record used a real DSH profile or a real public-service request. Consequently, all live evidence fields remain `missing`. Shared pre-dispatch cancellation is retained only as host-level behavior; operation cancellation evidence is recorded only for a directly asserted cancellation operation.

Current generated status:

```text
Services    7 verified, 0 implemented, 0 missing
Skills      55 verified, 0 implemented, 0 missing
Operations 117 verified, 0 implemented, 0 missing
```

For the 117 operation fixtures, the manifest records 65 successful local-result contracts, 22 mixed success/diagnostic contracts, and 30 exact diagnostic contracts. These figures describe the fixtures, not public-service availability.

The operation breakdown is Sequence 13, NGS 22, Structure 41, Slide 40, and Rosalind 1 verified. The added fixtures assert a concrete `plan_nextflow` plan/readiness result, precise results or diagnostics for the 33 formerly classification-only Slide operations, and the retained molecular-design result for `rosalind.open`.

All 55 Skills have a project-authored `SKILL.md`, DSH SkillRegistry registration/readback, invocation metadata, a registered main tool or one of three explicit instruction-only execution modes, provider/server mapping where applicable, and a link to an executed meaningful provider or operation fixture. This does not claim that a running model autonomously selected the Skill.

Error evidence is recorded only when an applicable test contains a locatable operation-specific or service-specific assertion. Missing error evidence remains explicit even when the ordinary operation fixture passed.

## TypeScript check

`npx tsc --noEmit --pretty false` passed after the concurrent validator correction was incorporated.
