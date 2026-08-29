# Architecture

DSH-Rosalind is one installable DSH bundle with a Node host and a browser client. It targets DeepSeek Harness `0.1.1-rc.2` and uses public Cordis and DSH interfaces.

```text
DSH Web
  hero catalogue · conversation Workbench · settings · tool views · detail overlay
        │
        ▼
DSH-Rosalind client module
  search · filters · evidence views · prompt import · run presentation
        │
        ▼
DSH tool runtime
  catalogue · provider status · plan · approval · run · cancel · files · review
        │
        ▼
Scientific adapters
  literature · databases · sequence · NGS · structures · slides/spatial · design
```

## Package and lifecycle

`cordis.patch.yml` inserts the host plugin. The host exports `name`, `inject`, and `apply`, constructs one `RosalindRuntime`, registers thirteen tools through `ctx.tools.register(defineTool(...))`, and disposes running work when Cordis unloads the plugin. Network and long tasks receive the DSH cancellation signal.

The client is built as a single classic DSH browser module:

```text
window.__ModuleLoader__.load({
  id: "@zichenwang114514/dsh-rosalind",
  factory(require) { ... }
})
```

Its external modules come from the DSH Web loader. The package declares the five DSH client packages required by its slots: runtime, conversation, settings, layout, and tool UI.

## UI integration

The client occupies named slots and does not inspect product DOM elements:

| DSH slot | DSH-Rosalind use |
|---|---|
| `conversation.hero.brand.mark` | Original project mark |
| `conversation.hero.workspace` | Blank-session project catalogue |
| `conversation.view` | Session-level Workbench |
| `settings.section` | Scientific provider diagnostics |
| `tool.call.toolview` | Dedicated display for each `rosalind_*` tool |
| `shell.overlay` | Project details, evidence, use mode, and import action |

The project detail state is a small external store. A blank-session selection keeps the requested teaching prompt until a DSH workspace is chosen. In an active conversation, the prompt is placed in the composer and remains editable before submission.

## Host model

`ShowcaseCatalog` reads the generated catalogue from the pinned release snapshot. `ProviderRegistry` determines whether a declared service is installed, authorized, credentialed, and runnable. `RosalindRuntime` owns plan and run records by DSH session, validates allowed state transitions, and returns copies so callers cannot mutate internal state.

The thirteen public tools are:

```text
rosalind_catalog_list     rosalind_showcase_get     rosalind_provider_status
rosalind_showcase_import  rosalind_plan             rosalind_approve
rosalind_run              rosalind_status           rosalind_cancel
rosalind_artifact_list    rosalind_artifact_open    rosalind_export
rosalind_review
```

Every tool has typed parameters, an open-object output schema, native rendering, call presentation, and result presentation. Artifact paths are resolved beneath the package or selected workspace, including checks against existing symbolic-link ancestors.

## Scientific record

Lesson uses the retained case record. Replay verifies the referenced files and recorded scientific checks. Reproduce selects only a provider declared by the case, reports its readiness, and performs the available adapter. Paid API, GPU, SSH/HPC, and external export operations require their own confirmation. An unavailable provider produces a diagnostic result and remains selected for the run record.
