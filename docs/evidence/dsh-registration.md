# DSH host registration evidence

Date: 2026-08-30 (Asia/Shanghai)

## What was exercised

The verification creates a real `@deepseek-ai/cordis` `Context`, installs the actual `SystemPrompt`, `ToolRuntime`, and `SkillRegistry` services, and mounts the DSH-Rosalind bundle with `ctx.plugin(bundle)`. It does not call `ScienceRuntime` directly as a substitute for host registration.

The tested package versions are:

- `@deepseek-ai/cordis` 4.0.1
- `@deepseek-ai/dsh-tools` 0.1.1-rc.2
- `@deepseek-ai/dsh-skill` 0.1.1-rc.2

The registration check reads the model-facing schemas from `ctx.tools.schemas()`, resolves definitions through `ctx.tools.get()`, discovers Skills through `ctx.skills.list()`, loads each Skill through `ctx.skills.get()`, and dispatches calls through `ctx.tools.execute()`.

## Results

The live registries contained:

| Contribution | Registered |
| --- | ---: |
| Fixed scientific operations | 117 |
| Literature/database gateway tools | 2 |
| DSH-Rosalind showcase tools | 13 |
| Total tools | 136 |
| Skills | 55 |

Every one of the 136 tool definitions exposes an object parameter schema, an object output schema, an output renderer, a call presenter, and a result presenter. The current bundle contains 117 fixed science operations, 6 Skill adapter tools, and 13 Rosalind tools.

Every registered name was then sent through `ToolRuntime.execute()` with `null` arguments. The 117 fixed-operation adapters normalized the input and returned structured scientific results. The remaining 15 definitions rejected it with `INVALID_ARGS`. No dispatch returned `UNKNOWN_TOOL`.

Representative schema-valid calls produced the following observed results:

| Tool | Host result | Scientific result |
| --- | --- | --- |
| `rosalind_catalog_list` | success | 23 showcases |
| `rosalind_open` | success | `completed` |
| `ngs_list_workflows` | success | `completed` |
| `sequence_query_viewer` with an absent session | success | `failed`, `SEQUENCE_OPERATION_FAILED` |
| `structure_get_state` with an absent session | structured diagnostic | `SESSION_ID_REQUIRED` |
| `slide_get_viewer_state` with an absent session | structured diagnostic | `SESSION_ID_REQUIRED` or `SESSION_NOT_FOUND` |
| `literature_request` with network disabled | success | `failed`, `NETWORK_NOT_AUTHORIZED` |
| `database_request` with network disabled | success | `failed`, `NETWORK_NOT_AUTHORIZED` |

A pre-aborted `ngs_list_workflows` call returned the ToolRuntime error `ABORTED_BEFORE_DISPATCH` with the message `tool call aborted before dispatch`.

Bundle lifecycle was also observed through the services. Before disposal, the context reported 136 tools and 55 Skills. After disposing only the bundle fiber, it reported zero tools and zero Skills.

## Commands and outputs

```text
> npm exec vitest -- run tests/dsh-host-registration.test.ts --reporter=verbose

Test Files  1 passed (1)
Tests       3 passed (3)
Duration    2.84s
```

```text
> npm run typecheck

> @zichenwang114514/dsh-rosalind@0.1.0 typecheck
> tsc --noEmit
```

```text
> node scripts/verify-dsh-registration.mjs

ok: true
registration: 136 tools = 117 fixed operations + 6 Skill adapters + 13 Rosalind tools
skills: 55
rendered outputs: 136
call/result presenter functions: 136 / 136
call/result views from empty arguments: 119 / 119
null-argument dispatch: 117 structured results, 15 INVALID_ARGS
cancellation: ABORTED_BEFORE_DISPATCH
lifecycle before disposal: 136 tools, 55 Skills
lifecycle after disposal: 0 tools, 0 Skills
live requests enabled: false
DeepSeek API called: false
```

The verifier prints the complete JSON record, including each representative call summary.

## What this does and does not demonstrate

This demonstrates actual same-process DSH service registration, discovery, rendering, presentation, dispatch, cancellation before dispatch, and Cordis-owned removal for the installed package versions. It also demonstrates that all 136 registered names reach ToolRuntime and that representative calls from every scientific service family return their current structured result or precise diagnostic. It is not live scientific-service evidence.

It does not demonstrate a model-selected call from a running DeepSeek agent, any DeepSeek API request, public literature/database network success, paid provider execution, GPU/HPC execution, or cooperative cancellation after long-running work has begun. Those require external services or deliberately long work and were excluded from this offline registration check. No global DSH configuration was read or changed.
