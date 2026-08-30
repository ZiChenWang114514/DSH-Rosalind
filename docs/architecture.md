# Architecture

DSH-Rosalind is one installable DSH bundle with a Node host and a browser client. It targets DeepSeek Harness `0.1.1-rc.2` and uses public Cordis and DSH interfaces.

```text
DSH Web
  native Sessions browser · Science conversation view · settings · tool views
        │
        ▼
DSH-Rosalind client bundle
  Rosalind Workbench module · NGS Analysis Workbench module · other science viewers
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

`cordis.patch.yml` inserts the host bundle. Its core creates a shared science coordinator and a `ModuleRegistry` that manages seven independently disposable Cordis Fibers. NGS and Rosalind use dedicated workflow plugins; Sequence, Structure, and Slide also expose service-specific host registration functions for focused mounting and contract tests.

- `dsh-rosalind-ngs-workbench` registers the 25 NGS operations and five NGS Skills. It owns workflow discovery and versioning, reviewed plans, durable run attempts, observations and logs, cancellation, workflow restoration, and local process cleanup.
- `dsh-rosalind-workbench` registers the thirteen project tools and the two fixed Rosalind service operations. It owns cross-service projects, confirmation, run coordination, status, cancellation, retained session evidence, and research-project summaries.

Removing the NGS plugin unregisters its tools and Skills and stops any process it owns. The shared coordinator then reports `NGS_MODULE_DISABLED` for a new direct NGS request, while `rosalind_status` can still read project history already held by the Rosalind runtime. Mounting a fresh NGS plugin restores new calls and reads the same durable per-session registry. Network and long tasks continue to receive the DSH cancellation signal.

The browser output remains one classic DSH module file for package compatibility, while its runtime registration is divided into matching NGS and Rosalind Cordis client plugins:

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
| `sidebar.workspaces` | Unchanged; the native DSH WorkspaceBrowser remains the sole occupant |
| `conversation.hero.brand.mark` | Original project mark |
| `conversation.hero.workspace` | Blank-session research project workspace |
| `conversation.view` | Session-level `Science` view with seven modules |
| `settings.section` | Scientific provider diagnostics |
| `tool.call.toolview` | Dedicated display for each `rosalind_*` tool |

The project detail state is a small external store. A blank-session selection keeps the requested teaching prompt until a DSH workspace is chosen. In an active conversation, the prompt is placed in the composer and remains editable before submission. The session Workbench derives its project, data and files, tasks and runs, recent results, sources and citations, and Sequence, Structure, and Slide Viewer summaries only from settled conversation tool results. Missing evidence stays visibly empty. Client-module lifecycle status is shown separately, so disabling NGS does not erase earlier result records.

The DSH sidebar shell and `ui-workspace` continue to own the brand row, New Session action, grouped or flat Workspace and Session rows, add, rename, reorder, search, fork, archive, Settings, theme, width, and collapsed rail. Rosalind deliberately does not register into `sidebar.workspaces`. In fixed DSH `0.1.1-rc.2`, the WorkspaceBrowser implementation is package-internal and the single browser region has no public child region for an adjacent tab. The closest public composition keeps that browser intact and registers `Science` through `conversation.view`, where seven keyboard-accessible module tabs provide module status, questions, reviewed records, and new-task actions.

The blank-session home is a research project workspace. Reviewed showcases are absent from the home view and appear only within a selected module, where they can be inspected or used to prepare a reproduction request. Details render inside the Workbench document, with no application-wide modal registration. A selected request remains editable before submission.

## Viewer modules

Sequence, Structure, and Slide have paired host and client registrations. Each host registration filters the capability registry to its service id; each client registration maps exactly the same tool names to the scientific result view. Tests require the three name sets to remain equal and disjoint. This keeps viewer registration independent while the shared `ScienceRuntime` remains the sole lifecycle and execution service.

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
