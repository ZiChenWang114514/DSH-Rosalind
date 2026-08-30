import { useMemo, useState, type KeyboardEvent } from "react";
import type {
  SessionId,
  SessionListState,
  WorkspaceId,
  WorkspaceListState,
} from "@deepseek-ai/dsh-client-runtime/client";

import { SHOWCASES } from "../generated/catalog.js";
import { categoryById } from "../shared/categories.js";
import { ArrowIcon, CategoryIcon, SearchIcon } from "./icons.js";
import { SCIENCE_ECOSYSTEMS, type SciencePluginSpec } from "./ecosystem.js";
import { stageConversationPrompt } from "./state.js";

type SelectorHook<T> = <S>(selector: (state: T) => S) => S;

export interface ScienceSidebarBrowserProps {
  wide: boolean;
  expandSidebar: () => void;
  useSessions: SelectorHook<SessionListState>;
  useWorkspaces: SelectorHook<WorkspaceListState>;
  openSession: (sessionId: SessionId) => void;
  startSession: (workspaceId?: WorkspaceId) => void;
}

type SidebarTab = "sessions" | "science";

function moduleShowcaseCount(moduleId: string): number {
  return SHOWCASES.filter((showcase) => showcase.categoryId === moduleId && showcase.status === "ready").length;
}

function ModuleGlyph({ module }: { module: SciencePluginSpec }): JSX.Element {
  const category = categoryById.get(module.id);
  return <span className="drr-sidebar-module__glyph" style={{ "--module-color": module.color } as React.CSSProperties}>
    {category ? <CategoryIcon icon={category.icon} size={17} /> : <span aria-hidden="true">R</span>}
  </span>;
}

function modulePrompt(module: SciencePluginSpec): string {
  return `Start a new ${module.name} research task. Ask me for the scientific question, selected local or public inputs, expected outputs, and verification criteria before proposing any run.`;
}

function ScienceModules({ startSession }: Pick<ScienceSidebarBrowserProps, "startSession">): JSX.Element {
  const [activeId, setActiveId] = useState(SCIENCE_ECOSYSTEMS[0]!.id);
  const active = SCIENCE_ECOSYSTEMS.find((module) => module.id === activeId) ?? SCIENCE_ECOSYSTEMS[0]!;

  function startResearch(prompt: string): void {
    stageConversationPrompt(prompt);
    startSession();
  }

  return <div className="drr-sidebar-science">
    <div className="drr-sidebar-science__intro">
      <strong>Scientific modules</strong>
      <span>Declared in this bundle; runtime readiness is checked when a task is prepared.</span>
    </div>
    <ul className="drr-sidebar-module-list" aria-label="Scientific modules">
      {SCIENCE_ECOSYSTEMS.map((module) => <li key={module.id}><button
        type="button"
        className={`drr-sidebar-module${module.id === active.id ? " is-active" : ""}`}
        onClick={() => setActiveId(module.id)}
        aria-current={module.id === active.id ? "true" : undefined}
      >
        <ModuleGlyph module={module} />
        <span className="drr-sidebar-module__copy"><strong>{module.name}</strong><small>v{module.version} · Declared</small></span>
        <ArrowIcon size={13} />
      </button></li>)}
    </ul>
    <section className="drr-sidebar-module-detail" aria-label={`${active.name} details`}>
      <div className="drr-sidebar-module-detail__head"><ModuleGlyph module={active} /><div><strong>{active.name}</strong><span><i /> Declared in bundle</span></div></div>
      <p>{active.description}</p>
      <dl>
        <div><dt>Tools</dt><dd>{active.operationCount}</dd></div>
        <div><dt>Skills</dt><dd>{active.skillCount}</dd></div>
        <div><dt>Showcases</dt><dd>{moduleShowcaseCount(active.id)}</dd></div>
      </dl>
      <div className="drr-sidebar-module-detail__meta"><span>Settings</span><strong>DSH Settings → Rosalind</strong></div>
      <div className="drr-sidebar-module-detail__questions">
        <span>Questions</span>
        {active.examples.slice(0, 2).map((example) => <button key={example.label} type="button" onClick={() => startResearch(example.prompt)}>{example.label}<ArrowIcon size={12} /></button>)}
      </div>
      <button type="button" className="drr-sidebar-module-detail__new" onClick={() => startResearch(modulePrompt(active))}>New research task</button>
    </section>
  </div>;
}

function SessionBrowser({ useSessions, useWorkspaces, openSession, startSession }: ScienceSidebarBrowserProps): JSX.Element {
  const sessions = useSessions((state) => state);
  const workspaces = useWorkspaces((state) => state);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(workspaces.items.map((workspace) => workspace.workspaceId)));
  const normalized = query.trim().toLowerCase();
  const archived = new Set(workspaces.archivedSessionIds);
  const groups = useMemo(() => {
    const accounted = new Set<string>();
    const result = workspaces.items.map((workspace) => {
      const rows = workspace.sessionIds
        .map((id) => sessions.byId[id])
        .filter((session) => session && !session.blank && !archived.has(session.id))
        .filter((session) => !normalized || session!.displayTitle.toLowerCase().includes(normalized));
      workspace.sessionIds.forEach((id) => accounted.add(id));
      return { id: workspace.workspaceId, title: workspace.title, workspaceId: workspace.workspaceId, rows };
    });
    const rows = sessions.ids
      .filter((id) => !accounted.has(id))
      .map((id) => sessions.byId[id])
      .filter((session) => session && !session.blank && !archived.has(session.id))
      .filter((session) => !normalized || session!.displayTitle.toLowerCase().includes(normalized));
    if (rows.length) result.push({ id: "ungrouped" as WorkspaceId, title: "Ungrouped", workspaceId: undefined as unknown as WorkspaceId, rows });
    return result;
  }, [archived, normalized, sessions, workspaces.items]);

  function toggle(id: string): void {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return <div className="drr-sidebar-sessions">
    <label className="drr-sidebar-search"><SearchIcon size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions" aria-label="Search sessions" /></label>
    <div className="drr-sidebar-session-list" aria-label="Workspace sessions">
      {groups.map((group) => <section key={group.id} className="drr-sidebar-workspace">
        <div className="drr-sidebar-workspace__row">
          <button type="button" onClick={() => toggle(group.id)} aria-expanded={expanded.has(group.id)}><span aria-hidden="true">{expanded.has(group.id) ? "⌄" : "›"}</span>{group.title}</button>
          {group.workspaceId && <button type="button" aria-label={`New session in ${group.title}`} onClick={() => startSession(group.workspaceId)}>+</button>}
        </div>
        {expanded.has(group.id) && <div className="drr-sidebar-session-rows">{group.rows.map((session) => session && <button key={session.id} type="button" className={session.id === sessions.current ? "is-current" : ""} onClick={() => openSession(session.id)}>
          <i className={session.pendingInteraction ? "is-waiting" : session.running ? "is-running" : session.completed ? "is-complete" : ""} />
          <span>{session.displayTitle}</span>
        </button>)}</div>}
      </section>)}
      {groups.every((group) => group.rows.length === 0) && <p className="drr-sidebar-empty">{normalized ? "No matching sessions" : "No sessions yet"}</p>}
    </div>
  </div>;
}

export function ScienceSidebarBrowser(props: ScienceSidebarBrowserProps): JSX.Element {
  const [tab, setTab] = useState<SidebarTab>("sessions");

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === "sessions" ? "science" : "sessions";
    setTab(next);
    document.getElementById(`drr-sidebar-tab-${next}`)?.focus();
  }

  if (!props.wide) {
    return <div className="drr-sidebar-rail" aria-label="Sidebar browser modes">
      <button type="button" aria-label="Sessions" onClick={() => { setTab("sessions"); props.expandSidebar(); }}>◫</button>
      <button type="button" aria-label="Science" onClick={() => { setTab("science"); props.expandSidebar(); }}>⌬</button>
    </div>;
  }

  return <section className="drr-sidebar-browser">
    <div className="drr-sidebar-tabs" role="tablist" aria-label="Sidebar browser">
      {(["sessions", "science"] as const).map((id) => <button id={`drr-sidebar-tab-${id}`} key={id} type="button" role="tab" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={onTabKeyDown}>{id === "sessions" ? "Sessions" : "Science"}</button>)}
    </div>
    <div role="tabpanel" aria-labelledby={`drr-sidebar-tab-${tab}`} className="drr-sidebar-panel">
      {tab === "sessions" ? <SessionBrowser {...props} /> : <ScienceModules startSession={props.startSession} />}
    </div>
  </section>;
}
