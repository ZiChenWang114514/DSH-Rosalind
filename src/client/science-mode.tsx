import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import { useState } from "react";

import { SCIENCE_ECOSYSTEMS } from "./ecosystem.js";

export const SCIENCE_SIDEBAR_VIEW_ID = "science";
export const SCIENCE_CONVERSATION_VIEW_ID = "dsh-rosalind";
export const ROSALIND_SCIENCE_THEME_ID = "rosalind-science";
export const ROSALIND_SCIENCE_AGENT_PRESET = "standard";

export interface ScienceModeSession {
  id: string;
  blank: boolean;
}

export interface ScienceModeActions {
  currentSession(): ScienceModeSession | undefined;
  selectTheme(): void;
  selectSidebar(): void;
  selectConversationView(sessionId: string): void;
  composeBlankSession(sessionId: string): Promise<void>;
}

export interface ScienceModeResult {
  composed: boolean;
  sessionId?: string;
}

export async function activateScienceMode(actions: ScienceModeActions): Promise<ScienceModeResult> {
  actions.selectTheme();
  actions.selectSidebar();
  const session = actions.currentSession();
  if (!session) return { composed: false };
  actions.selectConversationView(session.id);
  if (!session.blank) return { composed: false, sessionId: session.id };
  await actions.composeBlankSession(session.id);
  return { composed: true, sessionId: session.id };
}

export function ScienceModeIcon({ size = 18 }: { size?: number }): JSX.Element {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M8 3h8M10 3v5.2l-4.8 8.1A3 3 0 0 0 7.8 21h8.4a3 3 0 0 0 2.6-4.7L14 8.2V3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M7.5 15h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

export interface ScienceSidebarProps {
  wide: boolean;
  onActivate(): Promise<ScienceModeResult>;
}

export function ScienceSidebar({ wide, onActivate }: ScienceSidebarProps): JSX.Element {
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function activate(): Promise<void> {
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await onActivate();
      setMessage(result.composed
        ? "科学模式已启用，并已为当前空白会话选择能力组合。"
        : result.sessionId
          ? "科学主题与视图已启用；已有内容的会话保持原能力组合。"
          : "科学主题与侧栏已启用。新建会话后可使用科学工作区。");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!wide) {
    return <div className="rr-science-sidebar rr-science-sidebar--compact">
      <button type="button" className="rr-science-sidebar__activate rr-science-sidebar__activate--compact" aria-label="启用 Rosalind 科学模式" title="启用 Rosalind 科学模式" disabled={busy} onClick={() => { void activate(); }}><ScienceModeIcon /></button>
      <span className="rr-visually-hidden" role="status" aria-live="polite">{message}</span>
    </div>;
  }

  return <section className="rr-science-sidebar" aria-label="Rosalind 科学模块">
    <header className="rr-science-sidebar__head"><p>Rosalind Science</p><h2>科学工作区</h2><span>七个 Cordis 模块已接入；实际运行状态在任务执行时确认。</span></header>
    <ul className="rr-science-sidebar__modules">
      {SCIENCE_ECOSYSTEMS.map((module) => <li key={module.id}>
        <span className="rr-science-sidebar__mark" style={{ background: module.color }} aria-hidden="true" />
        <span><strong>{module.name}</strong><small>{module.skillCount} skills · {module.operationCount} tools</small></span>
        <em>已配置</em>
      </li>)}
    </ul>
    <button type="button" className="rr-science-sidebar__activate" disabled={busy} onClick={() => { void activate(); }}><ScienceModeIcon size={16} />{busy ? "正在启用…" : "启用科学模式"}</button>
    <p className="rr-science-sidebar__message" role="status" aria-live="polite">{message}</p>
  </section>;
}

interface WorkspaceSidebarService {
  register(entry: { id: string; label: string; icon: JSX.Element; order: number; render(props: { wide: boolean }): JSX.Element }): () => void;
  select(id: string): void;
}

interface ThemeService {
  register(definition: { id: string; colorScheme: "light" | "dark"; tokens: Record<string, string> }): () => void;
  setTheme(id: string): void;
}

interface ConversationService {
  selectView(id: string): void;
}

interface ClientSessionsService {
  list: {
    getSnapshot(): { current?: string; byId: Record<string, { id: string; blank: boolean }> };
  };
  scope(sessionId: string): { get(name: string): unknown } | undefined;
  noteAgentPreset(sessionId: string, agentPreset: string): void;
}

interface ConnectionService {
  api: {
    agentPresets: {
      select(request: { sessionId: string; agentPreset: string }): Promise<{ result: { ok: true; value: { agentPreset: string } } | { ok: false; error: { message: string } } }>;
    };
  };
}

export const ROSALIND_SCIENCE_THEME = Object.freeze({
  id: ROSALIND_SCIENCE_THEME_ID,
  colorScheme: "light" as const,
  tokens: {
    "--dsw-alias-bg-base": "#f5f3ee",
    "--dsw-alias-bg-layer-1": "#fffefa",
    "--dsw-alias-bg-layer-2": "#efede7",
    "--dsw-alias-border-l2": "rgba(46, 60, 54, 0.12)",
    "--dsw-alias-brand-primary": "#537d70",
    "--dsw-alias-brand-text": "#2d584b",
    "--dsw-alias-button-primary-fill": "#537d70",
    "--dsw-alias-button-primary-hover": "#42685d",
    "--dsw-alias-interactive-bg-active": "rgba(83, 125, 112, 0.14)",
    "--dsw-alias-interactive-bg-hover": "rgba(83, 125, 112, 0.08)",
    "--dsw-alias-label-primary": "#242b29",
    "--dsw-alias-label-secondary": "#68716d",
  },
});

export function registerScienceMode(ctx: ClientContext): () => void {
  const workspaceSidebar = ctx.get("workspaceSidebar") as WorkspaceSidebarService;
  const theme = ctx.get("theme") as ThemeService;
  const connection = ctx.get("connection") as ConnectionService;
  const sessions = ctx.get("sessions") as unknown as ClientSessionsService;
  const actions: ScienceModeActions = {
    currentSession() {
      const state = sessions.list.getSnapshot();
      const session = state.current === undefined ? undefined : state.byId[state.current];
      return session === undefined ? undefined : { id: session.id, blank: session.blank };
    },
    selectTheme: () => { theme.setTheme(ROSALIND_SCIENCE_THEME_ID); },
    selectSidebar: () => { workspaceSidebar.select(SCIENCE_SIDEBAR_VIEW_ID); },
    selectConversationView(sessionId) {
      const conversation = sessions.scope(sessionId)?.get("conversation") as ConversationService | undefined;
      if (!conversation) throw new Error("当前会话尚未准备好科学视图，请稍后重试。");
      conversation.selectView(SCIENCE_CONVERSATION_VIEW_ID);
    },
    async composeBlankSession(sessionId) {
      const response = await connection.api.agentPresets.select({ sessionId, agentPreset: ROSALIND_SCIENCE_AGENT_PRESET });
      if (!response.result.ok) throw new Error(response.result.error.message);
      sessions.noteAgentPreset(sessionId, response.result.value.agentPreset);
    },
  };
  const disposeTheme = theme.register(ROSALIND_SCIENCE_THEME);
  const disposeSidebar = workspaceSidebar.register({
    id: SCIENCE_SIDEBAR_VIEW_ID,
    label: "科学",
    icon: <ScienceModeIcon />,
    order: 20,
    render: ({ wide }) => <ScienceSidebar wide={wide} onActivate={() => activateScienceMode(actions)} />,
  });
  return () => {
    disposeSidebar();
    disposeTheme();
  };
}
