import { useEffect, useRef, useState } from "react";
import type { ConversationSnapshot } from "@deepseek-ai/dsh-client-runtime/client";
import type { EmptyWorkspaceOwnerProps, HeroBrandMarkOwnerProps } from "@deepseek-ai/dsh-client-ui-conversation/client";

import { PREVIEW_DATA_URLS, SHOWCASE_BY_ID, SHOWCASES, SHOWCASE_FILE_COUNT, SHOWCASE_SOURCE_COMMIT } from "../generated/catalog.js";
import { SHOWCASE_CATEGORIES, categoryById } from "../shared/categories.js";
import type { ShowcaseDefinition, ShowcaseMode } from "../shared/types.js";
import { CategoryIcon, CheckIcon, CloseIcon, FileIcon, PlayIcon, RosalindMark } from "./icons.js";
import { ScienceEcosystemPanel } from "./ecosystem.js";
import { buildConversationPrompt } from "./prompt.js";
import {
  closeShowcase,
  consumeConversationPrompt,
  getWorkbenchState,
  openShowcase,
  setDetailTab,
  setWorkbenchBridge,
  showNotice,
  stageConversationPrompt,
  useWorkbenchState,
} from "./state.js";
import { publishConversationNodes, useRosalindProjectSummary, useWorkbenchDataFlow } from "./session-evidence.js";
import type { RosalindProjectSummary, WorkbenchDataFlowSummary, WorkbenchRecordSummary } from "./session-evidence.js";

type InputActions = { setDraft: (text: string) => void; submit?: () => void };

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
}

function DataFlowSection({ title, items, empty }: { title: string; items: readonly WorkbenchRecordSummary[]; empty: string }): JSX.Element {
  return <section className="rr-session-flow__section"><h3>{title}</h3>{items.length > 0
    ? <ul>{items.map((item) => <li key={item.id}><strong>{item.label}</strong>{(item.detail || item.status) && <span>{[item.detail, item.status].filter(Boolean).join(" · ")}</span>}</li>)}</ul>
    : <p>{empty}</p>}</section>;
}

function SessionProjectPanel({ summary, dataFlow }: { summary: RosalindProjectSummary | null | undefined; dataFlow: WorkbenchDataFlowSummary | undefined }): JSX.Element {
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

export function Workbench({ session = false, hero = false, inputActions, projectSummary, dataFlow }: WorkbenchProps): JSX.Element {
  const [showModules, setShowModules] = useState(false);
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

  if (session) {
    return <section className="rr-root rr-root--session" aria-label="DSH-Rosalind current project"><SessionProjectPanel summary={projectSummary} dataFlow={dataFlow} /></section>;
  }

  function prepareExample(prompt: string): void {
    if (inputActions) inputActions.setDraft(prompt);
    else stageConversationPrompt(prompt);
    showNotice("The research question is prepared for a DSH conversation.");
  }

  return <section className={`rr-root rr-project${hero ? " rr-root--hero" : ""}`} aria-label="DSH-Rosalind research project workspace">
    <header className="rr-project__mast">
      <div className="rr-project__identity"><span className="rr-launch-mark"><RosalindMark size={30} /></span><div><span className="rr-kicker"><span className="rr-kicker-dot" /> Scientific project workspace</span><h1>Rosalind research workspace</h1><p>Frame a question, inspect sources, follow analysis, and keep results with their scientific record.</p></div></div>
      <button type="button" className="rr-button rr-button--primary" aria-expanded={showModules} onClick={() => setShowModules((value) => !value)}>{showModules ? "Project overview" : "New research task"}</button>
    </header>
    <div className="rr-project__grid">
      <section className="rr-project__primary" aria-labelledby="rr-project-current">
        <span className="rr-project__label">Current project</span><h2 id="rr-project-current">A new scientific investigation</h2><p>Begin with a testable question and choose the specialist module that matches the evidence and data you already have.</p>
        <ol className="rr-project__steps"><li><span>01</span><div><strong>Question</strong><small>Define the claim and required evidence.</small></div></li><li><span>02</span><div><strong>Sources</strong><small>Select local files or public records.</small></div></li><li><span>03</span><div><strong>Analysis</strong><small>Review methods before execution.</small></div></li><li><span>04</span><div><strong>Research record</strong><small>Keep outputs, limitations, and provenance together.</small></div></li></ol>
      </section>
      <aside className="rr-project__summary" aria-label="Workspace summary">
        <div><span>Scientific modules</span><strong>7</strong><small>specialist workspaces</small></div>
        <div><span>Reviewed records</span><strong>{SHOWCASES.length}</strong><small>available inside module details</small></div>
        <div><span>Runtime status</span><strong>Checked per task</strong><small>registration does not imply readiness</small></div>
      </aside>
    </div>
    <section className="rr-project__modules" aria-labelledby="rr-project-modules-title">
      <div className="rr-project__section-head"><div><span className="rr-project__label">Research environment</span><h2 id="rr-project-modules-title">Choose a scientific module</h2></div><p>Showcases appear only after a module is selected, alongside new-task and reproduction actions.</p></div>
      {showModules ? <ScienceEcosystemPanel
        onExample={(example) => prepareExample(example.prompt)}
        onShowcase={(showcase, mode) => { openShowcase(showcase.id); if (mode === "reproduce") setDetailTab("reproduce"); }}
      /> : <div className="rr-project__module-strip">{SHOWCASE_CATEGORIES.map((category) => <button key={category.id} type="button" onClick={() => setShowModules(true)}><CategoryIcon icon={category.icon} size={19} /><span><strong>{category.label}</strong><small>{category.description}</small></span></button>)}</div>}
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

export function ShowcaseDetailOverlay(): JSX.Element | null {
  const { selectedCaseId, detailTab, mode, bridge, notice } = useWorkbenchState();
  const showcase = selectedCaseId ? SHOWCASE_BY_ID.get(selectedCaseId) : undefined;
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!showcase) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeShowcase();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
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
    <div className="rr-overlay rr-overlay-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeShowcase(); }}>
      <div ref={panelRef} className="rr-overlay-panel" role="dialog" aria-modal="true" aria-labelledby="rr-detail-title" tabIndex={-1} style={styleFor(showcase)}>
        <header className="rr-detail-head">
          {preview ? <img className="rr-preview" src={preview} alt="" /> : <div className="rr-preview-fallback"><CategoryIcon icon={category.icon} size={36} /></div>}
          <div><span className="rr-detail-category"><CategoryIcon icon={category.icon} size={15} />{category.label}</span><h2 id="rr-detail-title" className="rr-detail-title">{showcase.title}</h2><p className="rr-detail-summary">{showcase.summary}</p></div>
          <button type="button" className="rr-close" aria-label="Close project details" onClick={closeShowcase}><CloseIcon size={18} /></button>
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
      </div>
    </div>
  );
}

export function RosalindBrandMark({ size = 48, className }: HeroBrandMarkOwnerProps): JSX.Element {
  return <span className={`rr-brand-mark${className ? ` ${className}` : ""}`}><RosalindMark size={size} /></span>;
}

export function HeroWorkspacePicker(props: EmptyWorkspaceOwnerProps): JSX.Element {
  useEffect(() => setWorkbenchBridge({
    startSession(showcase, mode) {
      const prompt = buildConversationPrompt(showcase, mode);
      stageConversationPrompt(prompt, { autoSubmit: true });
      if (props.selectedId) props.onPick(props.selectedId);
      else showNotice("Choose a DSH workspace first; the selected project will remain open.");
    },
  }), [props.onPick, props.selectedId]);
  return <Workbench hero />;
}

type ConversationNodes = ConversationSnapshot["nodes"];

const EMPTY_NODES: ConversationNodes = [];

export function ConversationWorkbenchView(props: { inputActions: InputActions; useSession?: (selector: (snapshot: ConversationSnapshot) => ConversationNodes) => ConversationNodes }): JSX.Element {
  const nodes = props.useSession ? props.useSession((snapshot) => snapshot.nodes) : EMPTY_NODES;
  const projectSummary = useRosalindProjectSummary();
  const dataFlow = useWorkbenchDataFlow();
  useEffect(() => {
    publishConversationNodes(nodes);
  }, [nodes]);
  return <Workbench session inputActions={props.inputActions} projectSummary={projectSummary} dataFlow={dataFlow} />;
}

export function checkReadyIcon(): JSX.Element {
  return <CheckIcon size={14} />;
}
