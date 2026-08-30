import { useEffect, useRef, useState } from "react";
import type { ConversationSnapshot, SessionId, SessionListState, WorkspaceId, WorkspaceListState } from "@deepseek-ai/dsh-client-runtime/client";
import type { EmptyWorkspaceOwnerProps, HeroBrandMarkOwnerProps } from "@deepseek-ai/dsh-client-ui-conversation/client";

import { PREVIEW_DATA_URLS, SHOWCASE_BY_ID, SHOWCASES, SHOWCASE_FILE_COUNT, SHOWCASE_SOURCE_COMMIT } from "../generated/catalog.js";
import { SHOWCASE_CATEGORIES, categoryById } from "../shared/categories.js";
import type { ShowcaseDefinition, ShowcaseMode } from "../shared/types.js";
import { CategoryIcon, CheckIcon, CloseIcon, FileIcon, PlayIcon, RosalindMark } from "./icons.js";
import { ScienceEcosystemPanel } from "./ecosystem.js";
import { buildConversationPrompt } from "./prompt.js";
import {
  buildResearchTaskPrompt,
  deriveResearchSessionRecord,
  getResearchProjectHostAdapter,
  SCIENCE_MODULE_OPTIONS,
  validateResearchTaskDraft,
} from "./project-flow.js";
import type { ResearchProjectHostAdapter, ResearchSessionRecord, ResearchTaskDraft } from "./project-flow.js";
import {
  closeShowcase,
  consumeConversationPrompt,
  openShowcase,
  setDetailTab,
  setWorkbenchBridge,
  setResearchSubmissionState,
  showProjectOverview,
  showNotice,
  stageConversationPrompt,
  startNewResearchTask,
  updateResearchDraft,
  useWorkbenchState,
} from "./state.js";
import { publishConversationNodes, useRosalindProjectSummary, useWorkbenchDataFlow } from "./session-evidence.js";
import type { RosalindProjectSummary, WorkbenchDataFlowSummary, WorkbenchRecordSummary } from "./session-evidence.js";

type InputActions = { setDraft: (text: string) => void; submit?: () => void };

interface ResearchWorkspaceOption {
  id: string;
  title: string;
  path: string;
  sessionIds: readonly string[];
}

interface ProjectFlowEnvironment {
  workspaces: readonly ResearchWorkspaceOption[];
  workspaceReady: boolean;
  currentSessionId?: string | undefined;
  currentSessionBlank?: boolean | undefined;
  currentWorkspaceId?: string | undefined;
  blankSessionIds: ReadonlySet<string>;
  onPickWorkspace?: ((workspaceId: string) => void) | undefined;
  hostAdapter?: ResearchProjectHostAdapter | null | undefined;
}

function styleFor(showcase: ShowcaseDefinition): React.CSSProperties {
  const color = categoryById.get(showcase.categoryId)?.color ?? "#537d70";
  return { "--category-color": color } as React.CSSProperties;
}

function categoryFor(showcase: ShowcaseDefinition) {
  return categoryById.get(showcase.categoryId) ?? SHOWCASE_CATEGORIES[0]!;
}

function previewFor(showcase: ShowcaseDefinition): string | undefined {
  if (!showcase.preview?.path) return undefined;
  return PREVIEW_DATA_URLS[showcase.preview.path] ?? (showcase.preview.mediaType === "image/png" ? undefined : showcase.preview.resourceUri);
}

export interface WorkbenchProps {
  session?: boolean;
  hero?: boolean;
  inputActions?: InputActions;
  projectSummary?: RosalindProjectSummary | null;
  dataFlow?: WorkbenchDataFlowSummary;
  researchRecord?: ResearchSessionRecord | null;
  projectFlow?: ProjectFlowEnvironment;
}

function DataFlowSection({ title, items, empty }: { title: string; items: readonly WorkbenchRecordSummary[]; empty: string }): JSX.Element {
  return <section className="rr-session-flow__section"><h3>{title}</h3>{items.length > 0
    ? <ul>{items.map((item) => <li key={item.id}><strong>{item.label}</strong>{(item.detail || item.status) && <span>{[item.detail, item.status].filter(Boolean).join(" · ")}</span>}</li>)}</ul>
    : <p>{empty}</p>}</section>;
}

function ResearchRecordOverview({ record }: { record: ResearchSessionRecord }): JSX.Element {
  const modules = record.moduleIds.map((id) => SCIENCE_MODULE_OPTIONS.find((item) => item.id === id)?.label ?? id);
  return <div className="rr-session-flow" aria-label="Research record">
    <div className="rr-session-flow__grid">
      <DataFlowSection title="Research question" items={[{ id: "question", label: record.question, detail: null, status: record.stage }]} empty="No research question has been recorded." />
      <DataFlowSection title="Scientific modules" items={modules.map((label) => ({ id: label, label, detail: null, status: null }))} empty="No scientific module has been recorded." />
      <DataFlowSection title="Data sources and local files" items={record.sources.split("\n").filter(Boolean).map((source) => ({ id: source, label: source, detail: null, status: null }))} empty="No data source has been recorded." />
      <DataFlowSection title="Recent tool results" items={record.toolResults.slice(-5).reverse().map((result) => ({ id: result.callId, label: result.toolName, detail: result.summary, status: result.status }))} empty="No tool result has been recorded for this task." />
      <DataFlowSection title="Unfinished items" items={record.unfinishedItems.map((item) => ({ id: item, label: item, detail: null, status: null }))} empty="No unfinished item has been recorded." />
    </div>
  </div>;
}

function SessionProjectPanel({ summary, dataFlow, researchRecord }: { summary: RosalindProjectSummary | null | undefined; dataFlow: WorkbenchDataFlowSummary | undefined; researchRecord?: ResearchSessionRecord | null | undefined }): JSX.Element {
  if (researchRecord) {
    return <section className="rr-session-project" aria-labelledby="rr-session-project-title">
      <span className="rr-kicker"><span className="rr-kicker-dot" /> Current project</span>
      <h2 id="rr-session-project-title">{researchRecord.question}</h2>
      <p className="rr-session-project__facts">Stage: {researchRecord.stage} · Created {new Date(researchRecord.createdAt).toLocaleString()}</p>
      <ResearchRecordOverview record={researchRecord} />
      {dataFlow && <SessionDataFlow dataFlow={dataFlow} />}
    </section>;
  }
  if (!summary) {
    return <section className="rr-session-project" aria-labelledby="rr-session-project-title"><span className="rr-kicker"><span className="rr-kicker-dot" /> Current project</span><h2 id="rr-session-project-title">Choose a project to begin</h2><p>Start from the new-session project search, then this view will keep the relevant research status and next action close to the conversation.</p>{dataFlow && <SessionDataFlow dataFlow={dataFlow} />}</section>;
  }
  const facts = [
    summary.mode ? `Mode: ${summary.mode}` : null,
    summary.status ? `Status: ${summary.status}` : null,
    summary.runId ? `Run: ${summary.runId}` : null,
    summary.providerId ? `Provider: ${summary.providerId}` : null,
    summary.artifactCount !== null ? `${summary.artifactCount} artifacts` : null,
  ].filter((fact): fact is string => fact !== null);
  const displayTitle = summary.title
    ?? (summary.showcaseId ? SHOWCASE_BY_ID.get(summary.showcaseId)?.title : undefined)
    ?? "Research project";
  return <section className="rr-session-project" aria-labelledby="rr-session-project-title">
    <span className="rr-kicker"><span className="rr-kicker-dot" /> Current project</span>
    <div className="rr-session-project__body"><div><h2 id="rr-session-project-title">{displayTitle}</h2>{facts.length > 0 && <p className="rr-session-project__facts">{facts.join(" · ")}</p>}</div><p className="rr-session-project__next"><strong>Next step</strong>{summary.nextAction ?? "Continue the current research task in the conversation."}</p></div>
    {dataFlow && <SessionDataFlow dataFlow={dataFlow} />}
  </section>;
}

function SessionDataFlow({ dataFlow }: { dataFlow: WorkbenchDataFlowSummary }): JSX.Element {
  const activity = dataFlow.activity.map((item) => ({
    ...item,
    detail: item.detail ? SHOWCASE_BY_ID.get(item.detail)?.title ?? item.detail : null,
  }));
  const viewerItems: WorkbenchRecordSummary[] = (Object.entries(dataFlow.viewers) as Array<[string, WorkbenchDataFlowSummary["viewers"]["sequence"]]>).map(([name, viewer]) => ({
    id: name,
    label: `${name[0]!.toUpperCase()}${name.slice(1)} Viewer`,
    detail: viewer.detail ?? viewer.sessionId,
    status: viewer.status,
  }));
  return <div className="rr-session-flow" aria-label="Current Workbench data flow">
    <div className="rr-session-flow__modules"><span>Rosalind module: {dataFlow.modules.rosalind}</span><span>NGS module: {dataFlow.modules.ngs}</span></div>
    <div className="rr-session-flow__grid">
      <DataFlowSection title="Data and files" items={dataFlow.files} empty="No file evidence has been recorded in this conversation." />
      <DataFlowSection title="Tasks and runs" items={activity} empty="No plan or run evidence has been recorded." />
      <DataFlowSection title="Recent results" items={dataFlow.recentResults} empty="No completed result has been recorded." />
      <DataFlowSection title="Sources and citations" items={dataFlow.sources} empty="No source or citation has been recorded." />
      <DataFlowSection title="Scientific viewers" items={viewerItems} empty="No viewer evidence has been recorded." />
    </div>
  </div>;
}

function ResearchTaskForm({ inputActions, projectFlow }: { inputActions: InputActions | undefined; projectFlow: ProjectFlowEnvironment | undefined }): JSX.Element {
  const { researchDraft, submissionState, notice } = useWorkbenchState();
  const [reviewing, setReviewing] = useState(false);
  const workspaces = projectFlow?.workspaces ?? [];
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === researchDraft.workspaceId);
  const draft: ResearchTaskDraft = researchDraft;
  const errors = validateResearchTaskDraft(draft);

  function toggleModule(moduleId: string): void {
    const moduleIds = researchDraft.moduleIds.includes(moduleId)
      ? researchDraft.moduleIds.filter((id) => id !== moduleId)
      : [...researchDraft.moduleIds, moduleId];
    updateResearchDraft({ moduleIds });
  }

  async function createTask(): Promise<void> {
    const validationErrors = validateResearchTaskDraft(draft);
    if (validationErrors.length > 0) {
      setResearchSubmissionState("failed", validationErrors.join(" "));
      setReviewing(false);
      return;
    }
    setResearchSubmissionState("submitting", "Creating the research session…");
    try {
      const adapter = projectFlow?.hostAdapter ?? getResearchProjectHostAdapter();
      let sessionId: string | undefined;
      if (adapter) {
        const connected = await adapter.createOrReuseBlankSession(draft.workspaceId);
        sessionId = connected.sessionId;
        await adapter.applyScienceCapabilities(sessionId, draft.moduleIds);
        const prompt = buildResearchTaskPrompt(draft, sessionId, new Date().toISOString());
        await adapter.submitResearchPrompt(sessionId, prompt);
        adapter.showScienceView(sessionId);
      } else {
        const currentIsTargetBlank = projectFlow?.currentSessionBlank === true && projectFlow.currentWorkspaceId === draft.workspaceId;
        const knownBlank = selectedWorkspace?.sessionIds.find((id) => projectFlow?.blankSessionIds.has(id));
        sessionId = currentIsTargetBlank ? projectFlow?.currentSessionId : knownBlank;
        projectFlow?.onPickWorkspace?.(draft.workspaceId);
        if (!sessionId || !inputActions) {
          throw new Error("DSH is opening a blank session for this workspace. Continue from its Science view when the session is ready.");
        }
        const prompt = buildResearchTaskPrompt(draft, sessionId, new Date().toISOString());
        inputActions.setDraft(prompt);
        inputActions.submit?.();
      }
      setResearchSubmissionState("submitted", "Research task submitted. Opening the Science view.");
    } catch (error) {
      setResearchSubmissionState("failed", error instanceof Error ? error.message : "The research task could not be created.");
    }
  }

  if (reviewing) {
    const moduleLabels = draft.moduleIds.map((id) => SCIENCE_MODULE_OPTIONS.find((module) => module.id === id)?.label ?? id);
    return <section className="rr-project__primary" aria-labelledby="rr-project-review-title">
      <span className="rr-project__label">Confirm research task</span>
      <h2 id="rr-project-review-title">Review before creating the session</h2>
      <dl>
        <dt>Workspace</dt><dd>{selectedWorkspace?.title ?? draft.workspaceId}</dd>
        <dt>Question</dt><dd>{draft.question}</dd>
        <dt>Scientific modules</dt><dd>{moduleLabels.join(", ")}</dd>
        <dt>Data sources and local files</dt><dd>{draft.sources}</dd>
      </dl>
      {notice && <p className="rr-notice" role={submissionState === "failed" ? "alert" : "status"}>{notice}</p>}
      <div className="rr-actions">
        <button type="button" className="rr-button" disabled={submissionState === "submitting"} onClick={() => setReviewing(false)}>Back to edit</button>
        <button type="button" className="rr-button rr-button--primary" disabled={submissionState === "submitting"} onClick={() => void createTask()}>{submissionState === "submitting" ? "Creating…" : "Create research task"}</button>
      </div>
    </section>;
  }

  return <form className="rr-project__primary" aria-labelledby="rr-project-new-title" onSubmit={(event) => {
    event.preventDefault();
    if (errors.length > 0) setResearchSubmissionState("failed", errors.join(" "));
    else setReviewing(true);
  }}>
    <span className="rr-project__label">New research task</span>
    <h2 id="rr-project-new-title">Describe the investigation</h2>
    <label htmlFor="rr-project-workspace"><strong>DSH workspace</strong></label>
    <select id="rr-project-workspace" value={researchDraft.workspaceId} onChange={(event) => updateResearchDraft({ workspaceId: event.currentTarget.value })}>
      <option value="">Choose a workspace</option>
      {workspaces.map((workspace) => <option value={workspace.id} key={workspace.id}>{workspace.title}</option>)}
    </select>
    {projectFlow?.workspaceReady && workspaces.length === 0 && <p role="alert">Add a native DSH workspace from the sidebar before creating a research task.</p>}
    <label htmlFor="rr-project-question"><strong>Research question</strong></label>
    <textarea id="rr-project-question" rows={4} value={researchDraft.question} onChange={(event) => updateResearchDraft({ question: event.currentTarget.value })} placeholder="What scientific question should this session answer?" />
    <fieldset>
      <legend><strong>Scientific modules</strong></legend>
      {SCIENCE_MODULE_OPTIONS.map((module) => <label key={module.id}><input type="checkbox" checked={researchDraft.moduleIds.includes(module.id)} onChange={() => toggleModule(module.id)} /> <span><strong>{module.label}</strong> — {module.description}</span></label>)}
    </fieldset>
    <label htmlFor="rr-project-sources"><strong>Data sources and local files</strong></label>
    <textarea id="rr-project-sources" rows={4} value={researchDraft.sources} onChange={(event) => updateResearchDraft({ sources: event.currentTarget.value })} placeholder="List public records, URLs, accession identifiers, or paths already available in the selected workspace." />
    {notice && <p className="rr-notice" role={submissionState === "failed" ? "alert" : "status"}>{notice}</p>}
    <div className="rr-actions"><button type="submit" className="rr-button rr-button--primary">Review research task</button></div>
  </form>;
}

export function Workbench({ session = false, hero = false, inputActions, projectSummary, dataFlow, researchRecord, projectFlow }: WorkbenchProps): JSX.Element {
  const { selectedCaseId, projectView } = useWorkbenchState();
  useEffect(() => {
    if (!inputActions) return undefined;
    const staged = consumeConversationPrompt();
    if (staged) {
      inputActions.setDraft(staged.text);
      if (staged.autoSubmit) inputActions.submit?.();
    }
    return setWorkbenchBridge({
      importCase(showcase, mode) {
        inputActions.setDraft(buildConversationPrompt(showcase, mode));
        inputActions.submit?.();
        showNotice("The scientific request was added to the conversation.");
      },
    });
  }, [inputActions]);

  function prepareExample(prompt: string): void {
    if (inputActions) inputActions.setDraft(prompt);
    else stageConversationPrompt(prompt);
    showNotice("The research question is prepared for a DSH conversation.");
  }

  function openModuleShowcase(showcase: ShowcaseDefinition, mode: ShowcaseMode): void {
    openShowcase(showcase.id);
    if (mode === "reproduce") setDetailTab("reproduce");
  }

  if (session) {
    return <section className="rr-root rr-root--session rr-science-view" aria-label="DSH-Rosalind Science workspace">
      <header className="rr-science-view__head"><div><span className="rr-kicker"><span className="rr-kicker-dot" /> Science</span><h1>Rosalind Science</h1><p>Review the current project or begin a research task in a blank session.</p></div><div className="rr-actions"><button type="button" className="rr-button" aria-pressed={projectView === "overview"} onClick={showProjectOverview}>Project overview</button><button type="button" className="rr-button rr-button--primary" aria-pressed={projectView === "new-task"} onClick={() => startNewResearchTask(projectFlow?.currentWorkspaceId ?? "")}>New research task</button></div></header>
      {selectedCaseId ? <ShowcaseDetailPanel /> : <>
        {projectView === "new-task"
          ? <ResearchTaskForm inputActions={inputActions} projectFlow={projectFlow} />
          : <SessionProjectPanel summary={projectSummary} dataFlow={dataFlow} researchRecord={researchRecord} />}
        <section className="rr-project__modules" aria-labelledby="rr-session-modules-title">
          <div className="rr-project__section-head"><div><span className="rr-project__label">Scientific modules</span><h2 id="rr-session-modules-title">Methods and reviewed records</h2></div><p>Choose a module to prepare a task or inspect its retained scientific records.</p></div>
          <ScienceEcosystemPanel onExample={(example) => prepareExample(example.prompt)} onShowcase={openModuleShowcase} />
        </section>
      </>}
    </section>;
  }

  if (selectedCaseId) {
    return <section className={`rr-root rr-project${hero ? " rr-root--hero" : ""}`} aria-label="DSH-Rosalind research project workspace"><ShowcaseDetailPanel /></section>;
  }

  return <section className={`rr-root rr-project${hero ? " rr-root--hero" : ""}`} aria-label="DSH-Rosalind research project workspace">
    <header className="rr-project__mast">
      <div className="rr-project__identity"><span className="rr-launch-mark"><RosalindMark size={30} /></span><div><span className="rr-kicker"><span className="rr-kicker-dot" /> Scientific project workspace</span><h1>Rosalind research workspace</h1><p>Frame a question, inspect sources, follow analysis, and keep results with their scientific record.</p></div></div>
      <div className="rr-actions"><button type="button" className="rr-button" aria-pressed={projectView === "overview"} onClick={showProjectOverview}>Project overview</button><button type="button" className="rr-button rr-button--primary" aria-pressed={projectView === "new-task"} onClick={() => startNewResearchTask(projectFlow?.currentWorkspaceId ?? "")}>New research task</button></div>
    </header>
    {projectView === "new-task" ? <ResearchTaskForm inputActions={inputActions} projectFlow={projectFlow} /> : <div className="rr-project__grid">
      <section className="rr-project__primary" aria-labelledby="rr-project-current">
        <span className="rr-project__label">Current project</span><h2 id="rr-project-current">A new scientific investigation</h2><p>Begin with a testable question and choose the specialist module that matches the evidence and data you already have.</p>
        <ol className="rr-project__steps"><li><span>01</span><div><strong>Question</strong><small>Define the claim and required evidence.</small></div></li><li><span>02</span><div><strong>Sources</strong><small>Select local files or public records.</small></div></li><li><span>03</span><div><strong>Analysis</strong><small>Review methods before execution.</small></div></li><li><span>04</span><div><strong>Research record</strong><small>Keep outputs, limitations, and provenance together.</small></div></li></ol>
      </section>
      <aside className="rr-project__summary" aria-label="Workspace summary">
        <div><span>Scientific modules</span><strong>7</strong><small>specialist workspaces</small></div>
        <div><span>Reviewed records</span><strong>{SHOWCASES.length}</strong><small>available inside module details</small></div>
        <div><span>Runtime status</span><strong>Checked per task</strong><small>registration does not imply readiness</small></div>
      </aside>
    </div>}
    <section className="rr-project__modules" aria-labelledby="rr-project-modules-title">
      <div className="rr-project__section-head"><div><span className="rr-project__label">Research environment</span><h2 id="rr-project-modules-title">Scientific methods and reviewed records</h2></div><p>Reviewed examples remain available inside the task workflow and can prepare a reproduction request.</p></div>
      {projectView === "new-task" ? <ScienceEcosystemPanel
        onExample={(example) => prepareExample(example.prompt)}
        onShowcase={openModuleShowcase}
      /> : <div className="rr-project__module-strip">{SHOWCASE_CATEGORIES.map((category) => <button key={category.id} type="button" onClick={() => { startNewResearchTask(projectFlow?.currentWorkspaceId ?? ""); updateResearchDraft({ moduleIds: [category.id] }); }}><CategoryIcon icon={category.icon} size={19} /><span><strong>{category.label}</strong><small>{category.description}</small></span></button>)}</div>}
    </section>
    <footer className="rr-source-note"><span>{SHOWCASE_FILE_COUNT} manifest-referenced files · seven scientific areas</span><span>Snapshot <code>{SHOWCASE_SOURCE_COMMIT.slice(0, 8)}</code></span></footer>
  </section>;
}

function InfoBlock({ title, items, wide = false }: { title: string; items: readonly string[]; wide?: boolean }): JSX.Element {
  return (
    <section className={`rr-info-block${wide ? " rr-info-block--wide" : ""}`}>
      <h3 className="rr-info-title">{title}</h3>
      <ul className="rr-list">{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
    </section>
  );
}

function Overview({ showcase }: { showcase: ShowcaseDefinition }): JSX.Element {
  return (
    <div className="rr-section-grid">
      <section className="rr-info-block rr-info-block--wide"><h3 className="rr-info-title">Scientific question</h3><p className="rr-question">{showcase.question}</p></section>
      <InfoBlock title="Source observations" items={showcase.observations} />
      <InfoBlock title="Computed results" items={showcase.computedResults} />
      <InfoBlock title="Interpretation" items={showcase.interpretation} />
      <InfoBlock title="Limitations" items={showcase.limitations} />
    </div>
  );
}

function Evidence({ showcase }: { showcase: ShowcaseDefinition }): JSX.Element {
  const artifacts = showcase.artifacts.filter((artifact) => artifact.path || artifact.resourceUri);
  return (
    <div className="rr-section-grid">
      <section className="rr-info-block rr-info-block--wide">
        <h3 className="rr-info-title">Indexed artifacts</h3>
        <div className="rr-artifacts">{artifacts.map((artifact) => <div className="rr-artifact" key={artifact.id}><FileIcon size={15} /><span className="rr-artifact-name">{artifact.path ?? artifact.resourceUri}</span><span className="rr-artifact-role">{artifact.role}</span></div>)}</div>
      </section>
      <InfoBlock title="Recorded sources" items={showcase.sources} wide />
      <InfoBlock title="Scientific claims" items={showcase.claims.map((claim) => `${claim.kind}: ${claim.statement}`)} wide />
    </div>
  );
}

function Reproduce({ showcase }: { showcase: ShowcaseDefinition }): JSX.Element {
  return (
    <div className="rr-recipe">
      <div className="rr-recipe-head"><span className="rr-chip">{showcase.recipe.strategy}</span><span className="rr-chip">{showcase.recipe.adapter}</span>{showcase.recipe.providerIds.map((id) => <span className="rr-chip" key={id}>{id}</span>)}</div>
      <InfoBlock title="Required inputs" items={showcase.recipe.requiredInputs} wide />
      <InfoBlock title="Expected outputs" items={showcase.recipe.expectedOutputs} wide />
      <InfoBlock title="Validation checks" items={showcase.recipe.checks} wide />
      <p className="rr-detail-summary">A fresh run begins with provider status and an execution plan. Network, paid, GPU, SSH/HPC, and external-write steps wait for explicit confirmation.</p>
    </div>
  );
}

const MODE_COPY: Record<ShowcaseMode, { action: string }> = {
  lesson: { action: "Start lesson" },
  replay: { action: "Inspect evidence" },
  reproduce: { action: "Prepare run" },
};

export function ShowcaseDetailPanel(): JSX.Element | null {
  const { selectedCaseId, detailTab, mode, bridge, notice } = useWorkbenchState();
  const showcase = selectedCaseId ? SHOWCASE_BY_ID.get(selectedCaseId) : undefined;
  const panelRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!showcase) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => previous?.focus();
  }, [showcase]);

  if (!showcase) return null;
  const category = categoryFor(showcase);
  const preview = previewFor(showcase);
  const detailTabs = ["overview", "evidence", "reproduce"] as const;
  const selectTab = (index: number) => {
    const nextIndex = (index + detailTabs.length) % detailTabs.length;
    setDetailTab(detailTabs[nextIndex]!);
    tabRefs.current[nextIndex]?.focus();
  };
  const importCase = () => {
    if (bridge.importCase) bridge.importCase(showcase, mode);
    else if (bridge.startSession) bridge.startSession(showcase, mode);
    else showNotice("Open a DSH workspace, then add this project to the conversation.");
  };
  return (
    <section
      ref={panelRef}
      className="rr-detail-panel"
      role="region"
      aria-labelledby="rr-detail-title"
      tabIndex={-1}
      style={styleFor(showcase)}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeShowcase(); } }}
    >
        <header className="rr-detail-head">
          {preview ? <img alt="" className="rr-preview" decoding="async" loading="lazy" src={preview} /> : <div className="rr-preview-fallback"><CategoryIcon icon={category.icon} size={36} /></div>}
          <div><span className="rr-detail-category"><CategoryIcon icon={category.icon} size={15} />{category.label}</span><h2 id="rr-detail-title" className="rr-detail-title">{showcase.title}</h2><p className="rr-detail-summary">{showcase.summary}</p></div>
          <button type="button" className="rr-close" aria-label="Back to scientific modules" onClick={closeShowcase}><CloseIcon size={18} /></button>
        </header>
        <div className="rr-tabs" role="tablist" aria-label="Project details">
          {detailTabs.map((tab, index) => <button
            aria-controls={`rr-detail-panel-${tab}`}
            aria-selected={detailTab === tab}
            className="rr-tab"
            id={`rr-detail-tab-${tab}`}
            key={tab}
            onClick={() => setDetailTab(tab)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") { event.preventDefault(); selectTab(index + 1); }
              else if (event.key === "ArrowLeft") { event.preventDefault(); selectTab(index - 1); }
              else if (event.key === "Home") { event.preventDefault(); selectTab(0); }
              else if (event.key === "End") { event.preventDefault(); selectTab(detailTabs.length - 1); }
            }}
            ref={(element) => { tabRefs.current[index] = element; }}
            role="tab"
            tabIndex={detailTab === tab ? 0 : -1}
            type="button"
          >{tab[0]!.toUpperCase() + tab.slice(1)}</button>)}
        </div>
        <main className="rr-detail-body">
          <div aria-labelledby="rr-detail-tab-overview" hidden={detailTab !== "overview"} id="rr-detail-panel-overview" role="tabpanel" tabIndex={detailTab === "overview" ? 0 : -1}>{detailTab === "overview" ? <Overview showcase={showcase} /> : null}</div>
          <div aria-labelledby="rr-detail-tab-evidence" hidden={detailTab !== "evidence"} id="rr-detail-panel-evidence" role="tabpanel" tabIndex={detailTab === "evidence" ? 0 : -1}>{detailTab === "evidence" ? <Evidence showcase={showcase} /> : null}</div>
          <div aria-labelledby="rr-detail-tab-reproduce" hidden={detailTab !== "reproduce"} id="rr-detail-panel-reproduce" role="tabpanel" tabIndex={detailTab === "reproduce" ? 0 : -1}>{detailTab === "reproduce" ? <Reproduce showcase={showcase} /> : null}</div>
        </main>
        <footer className="rr-detail-foot">
          {notice && <span className="rr-notice" role="status">{notice}</span>}
          <div className="rr-actions"><button type="button" className="rr-button rr-button--primary" onClick={importCase}><PlayIcon size={15} />{MODE_COPY[mode].action}</button></div>
        </footer>
    </section>
  );
}

/** @deprecated Project details now render inside Workbench. */
export const ShowcaseDetailOverlay = ShowcaseDetailPanel;

export function RosalindBrandMark({ size = 48, className }: HeroBrandMarkOwnerProps): JSX.Element {
  return <span className={`rr-brand-mark${className ? ` ${className}` : ""}`}><RosalindMark size={size} /></span>;
}

type SelectorHook<State> = <Value>(selector: (snapshot: State) => Value) => Value;
const EMPTY_WORKSPACE_STATE: WorkspaceListState = { items: [], archivedSessionIds: [], state: "idle", phase: "pending", baselinesReady: false, recentWorkspaceId: undefined, error: null };
const EMPTY_SESSION_STATE: SessionListState = { ids: [], byId: {}, current: undefined, phase: "pending", subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined };
const fallbackWorkspaces: SelectorHook<WorkspaceListState> = (selector) => selector(EMPTY_WORKSPACE_STATE);
const fallbackSessions: SelectorHook<SessionListState> = (selector) => selector(EMPTY_SESSION_STATE);

type HeroWorkspacePickerProps = EmptyWorkspaceOwnerProps & {
  useWorkspaces?: SelectorHook<WorkspaceListState>;
  useSessions?: SelectorHook<SessionListState>;
};

export function HeroWorkspacePicker(props: HeroWorkspacePickerProps): JSX.Element {
  const useWorkspaces = props.useWorkspaces ?? fallbackWorkspaces;
  const useSessions = props.useSessions ?? fallbackSessions;
  const workspaces = useWorkspaces((snapshot) => snapshot);
  const sessions = useSessions((snapshot) => snapshot);
  const currentSessionId = sessions.current;
  const currentWorkspace = currentSessionId ? workspaces.items.find((workspace) => workspace.sessionIds.includes(currentSessionId)) : undefined;
  const projectFlow: ProjectFlowEnvironment = {
    workspaces: workspaces.items.map((workspace) => ({ id: workspace.workspaceId, title: workspace.title, path: workspace.path, sessionIds: workspace.sessionIds })),
    workspaceReady: workspaces.phase === "ready",
    currentSessionId,
    currentSessionBlank: currentSessionId ? sessions.byId[currentSessionId]?.blank : undefined,
    currentWorkspaceId: currentWorkspace?.workspaceId ?? props.selectedId,
    blankSessionIds: new Set(sessions.ids.filter((id) => sessions.byId[id]?.blank === true)),
    onPickWorkspace: (workspaceId) => props.onPick(workspaceId as WorkspaceId),
    hostAdapter: getResearchProjectHostAdapter(),
  };
  useEffect(() => setWorkbenchBridge({
    async startSession(showcase, mode) {
      const prompt = buildConversationPrompt(showcase, mode);
      const adapter = getResearchProjectHostAdapter();
      if (props.selectedId && adapter) {
        try {
          const connected = await adapter.createOrReuseBlankSession(props.selectedId);
          await adapter.applyScienceCapabilities(connected.sessionId, [showcase.categoryId]);
          await adapter.submitResearchPrompt(connected.sessionId, prompt);
          adapter.showScienceView(connected.sessionId);
          showNotice("The reviewed project was added to a blank research session.");
        } catch (error) {
          showNotice(error instanceof Error ? error.message : "The reviewed project could not be added.");
        }
      } else {
        stageConversationPrompt(prompt, { autoSubmit: true });
        if (props.selectedId) props.onPick(props.selectedId);
        else showNotice("Choose a DSH workspace first; the selected project will remain open.");
      }
    },
  }), [props.onPick, props.selectedId]);
  return <Workbench hero projectFlow={projectFlow} />;
}

type ConversationNodes = ConversationSnapshot["nodes"];

const EMPTY_NODES: ConversationNodes = [];

export function ConversationWorkbenchView(props: {
  inputActions: InputActions;
  sessionId?: SessionId;
  useSession?: (selector: (snapshot: ConversationSnapshot) => ConversationNodes) => ConversationNodes;
  useSessions?: SelectorHook<SessionListState>;
  useWorkspaces?: SelectorHook<WorkspaceListState>;
}): JSX.Element {
  const nodes = props.useSession ? props.useSession((snapshot) => snapshot.nodes) : EMPTY_NODES;
  const useSessions = props.useSessions ?? fallbackSessions;
  const useWorkspaces = props.useWorkspaces ?? fallbackWorkspaces;
  const sessions = useSessions((snapshot) => snapshot);
  const workspaces = useWorkspaces((snapshot) => snapshot);
  const sessionId = props.sessionId ?? sessions.current;
  const currentWorkspace = sessionId ? workspaces.items.find((workspace) => workspace.sessionIds.includes(sessionId)) : undefined;
  const researchRecord = deriveResearchSessionRecord(nodes);
  const projectSummary = useRosalindProjectSummary();
  const dataFlow = useWorkbenchDataFlow();
  useEffect(() => {
    publishConversationNodes(nodes);
  }, [nodes]);
  const projectFlow: ProjectFlowEnvironment = {
    workspaces: workspaces.items.map((workspace) => ({ id: workspace.workspaceId, title: workspace.title, path: workspace.path, sessionIds: workspace.sessionIds })),
    workspaceReady: workspaces.phase === "ready",
    currentSessionId: sessionId,
    currentSessionBlank: sessionId ? sessions.byId[sessionId]?.blank : undefined,
    currentWorkspaceId: currentWorkspace?.workspaceId,
    blankSessionIds: new Set(sessions.ids.filter((id) => sessions.byId[id]?.blank === true)),
    hostAdapter: getResearchProjectHostAdapter(),
  };
  return <Workbench session inputActions={props.inputActions} projectSummary={projectSummary} dataFlow={dataFlow} researchRecord={researchRecord} projectFlow={projectFlow} />;
}

export function checkReadyIcon(): JSX.Element {
  return <CheckIcon size={14} />;
}
