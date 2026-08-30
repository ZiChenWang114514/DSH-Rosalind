import type { ClientContext, SettingsScope, SettingsScopeSnapshot } from "@deepseek-ai/dsh-client-runtime/client";
import { useCallback, useState, useSyncExternalStore } from "react";

import { SCIENCE_ECOSYSTEMS } from "./ecosystem.js";
import { MODULE_SETTING_IDS, type ModuleSettingId, type ModuleSettingsView, type ModuleSettingState } from "../shared/module-settings-contract.js";

export const SCIENCE_SIDEBAR_VIEW_ID = "science";
export const SCIENCE_CONVERSATION_VIEW_ID = "dsh-rosalind";
export const ROSALIND_SCIENCE_THEME_ID = "rosalind-science";
export const ROSALIND_SCIENCE_DARK_THEME_ID = "rosalind-science-dark";
export const ROSALIND_SCIENCE_AGENT_PRESET = "rosalind-science";

export interface ScienceModeSession {
  id: string;
  blank: boolean;
  agentPreset?: string;
}

export interface ScienceModeActions {
  currentSession(): ScienceModeSession | undefined;
  selectTheme(): string | undefined;
  selectSidebar(): void;
  selectConversationView(sessionId: string): void;
  composeBlankSession(sessionId: string): Promise<ScienceCompositionResult>;
  selectPreset?(sessionId: string, agentPreset: string): Promise<ScienceCompositionResult>;
  subscribeSessions?(listener: () => void): () => void;
  currentTheme?(): string;
  currentSidebar?(): string | undefined;
  restoreTheme?(id: string): void;
  restoreSidebar?(id: string): void;
  currentConversationView?(sessionId: string): string | undefined;
  restoreConversationView?(sessionId: string, view: string): void;
}

export interface ScienceCompositionResult {
  selected: boolean;
  message?: string;
}

export interface ScienceModeResult {
  enabled: boolean;
  composed: boolean;
  sessionId?: string;
  message?: string;
}

export interface ScienceModeSnapshot extends ScienceModeResult {
  busy: boolean;
}

export async function activateScienceMode(actions: ScienceModeActions): Promise<ScienceModeResult> {
  actions.selectTheme();
  actions.selectSidebar();
  const session = actions.currentSession();
  if (!session) return { enabled: true, composed: false };
  actions.selectConversationView(session.id);
  if (!session.blank) return { enabled: true, composed: false, sessionId: session.id };
  const composition = await actions.composeBlankSession(session.id);
  return {
    enabled: true,
    composed: composition.selected,
    sessionId: session.id,
    ...(composition.message ? { message: composition.message } : {}),
  };
}

export interface ScienceModeController {
  getSnapshot(): ScienceModeSnapshot;
  subscribe(listener: () => void): () => void;
  toggle(): Promise<ScienceModeResult>;
  dispose(): void;
}

interface PreparedSession {
  preset?: string;
  view?: string;
}

function result(snapshot: ScienceModeSnapshot): ScienceModeResult {
  return {
    enabled: snapshot.enabled,
    composed: snapshot.composed,
    ...(snapshot.sessionId ? { sessionId: snapshot.sessionId } : {}),
    ...(snapshot.message ? { message: snapshot.message } : {}),
  };
}

/** Owns the one shared science-mode state used by wide and compact sidebars. */
export function createScienceModeController(actions: ScienceModeActions): ScienceModeController {
  let enabled = false;
  let priorTheme: string | undefined;
  let scienceTheme: string | undefined;
  let priorSidebar: string | undefined;
  const prepared = new Map<string, PreparedSession>();
  const listeners = new Set<() => void>();
  let sessionUnsubscribe: (() => void) | undefined;
  let pendingSessionId: string | undefined;
  let snapshot: ScienceModeSnapshot = { enabled: false, composed: false, busy: false };

  function publish(next: ScienceModeSnapshot): void {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  async function prepareCurrentSession(): Promise<void> {
    if (!enabled || pendingSessionId !== undefined) return;
    const session = actions.currentSession();
    if (!session) {
      publish({ enabled: true, composed: false, busy: false, message: "科学模式已启用。新建或选中空白会话后会自动选择 Rosalind Science 组合。" });
      return;
    }
    const previousView = actions.currentConversationView?.(session.id);
    actions.selectConversationView(session.id);
    if (!session.blank) {
      if (!prepared.has(session.id)) prepared.set(session.id, { ...(previousView ? { view: previousView } : {}) });
      publish({ enabled: true, composed: false, busy: false, sessionId: session.id, message: "当前会话已有内容，DSH 不允许更换 Agent preset；科学主题和科学视图已启用，原组合保持不变。" });
      return;
    }
    if (prepared.has(session.id)) {
      publish({ enabled: true, composed: true, busy: false, sessionId: session.id, message: "Rosalind Science 组合已在当前空白会话中启用。" });
      return;
    }
    pendingSessionId = session.id;
    publish({ enabled: true, composed: false, busy: true, sessionId: session.id, message: "正在选择 Rosalind Science 组合…" });
    try {
      const composition = await actions.composeBlankSession(session.id);
      if (!enabled) return;
      if (composition.selected) prepared.set(session.id, { ...(session.agentPreset ? { preset: session.agentPreset } : {}), ...(previousView ? { view: previousView } : {}) });
      publish({
        enabled: true,
        composed: composition.selected,
        busy: false,
        sessionId: session.id,
        ...(composition.message ? { message: composition.message } : { message: "Rosalind Science 组合已在当前空白会话中启用。" }),
      });
    } catch (cause) {
      if (enabled) publish({ enabled: true, composed: false, busy: false, sessionId: session.id, message: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      pendingSessionId = undefined;
      if (enabled && actions.currentSession()?.id !== session.id) void prepareCurrentSession();
    }
  }

  async function disable(): Promise<ScienceModeResult> {
    publish({ ...snapshot, busy: true });
    const current = actions.currentSession();
    const preparedSession = current ? prepared.get(current.id) : undefined;
    const notes: string[] = [];
    if (current?.blank && preparedSession?.preset && actions.selectPreset) {
      try {
        const restored = await actions.selectPreset(current.id, preparedSession.preset);
        if (!restored.selected) notes.push(restored.message ?? "原 Agent preset 未恢复。");
      } catch (cause) {
        notes.push(`原 Agent preset 未恢复：${cause instanceof Error ? cause.message : String(cause)}`);
      }
    } else if (preparedSession?.preset) {
      notes.push("当前会话已有内容，DSH 不允许恢复原 Agent preset。");
    }
    if (current && preparedSession?.view && actions.restoreConversationView) {
      try { actions.restoreConversationView(current.id, preparedSession.view); }
      catch (cause) { notes.push(`原会话视图未恢复：${cause instanceof Error ? cause.message : String(cause)}`); }
    } else if (current && preparedSession && !actions.restoreConversationView) notes.push("当前 Harness 未提供会话视图读取接口，保留科学视图。");
    const currentTheme = actions.currentTheme?.();
    if (priorTheme && (currentTheme === undefined || currentTheme === scienceTheme || currentTheme === priorTheme)) {
      try { actions.restoreTheme?.(priorTheme); }
      catch (cause) { notes.push(`原主题未恢复：${cause instanceof Error ? cause.message : String(cause)}`); }
    } else if (priorTheme && currentTheme !== scienceTheme) {
      notes.push("保留了你在科学模式中选择的新主题。");
    }
    if (priorSidebar) {
      try { actions.restoreSidebar?.(priorSidebar); }
      catch (cause) { notes.push(`原侧栏未恢复：${cause instanceof Error ? cause.message : String(cause)}`); }
    }
    prepared.clear();
    enabled = false;
    scienceTheme = undefined;
    publish({ enabled: false, composed: false, busy: false, ...(current ? { sessionId: current.id } : {}), message: notes.length > 0 ? `科学模式已关闭；${notes.join(" ")}` : "已恢复启用科学模式前的主题、侧栏与会话状态。" });
    return result(snapshot);
  }

  sessionUnsubscribe = actions.subscribeSessions?.(() => { void prepareCurrentSession(); });

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async toggle(): Promise<ScienceModeResult> {
      if (enabled) return disable();
      priorTheme = actions.currentTheme?.();
      priorSidebar = actions.currentSidebar?.();
      enabled = true;
      scienceTheme = actions.selectTheme() ?? ROSALIND_SCIENCE_THEME_ID;
      actions.selectSidebar();
      publish({ enabled: true, composed: false, busy: true });
      await prepareCurrentSession();
      return result(snapshot);
    },
    dispose() { sessionUnsubscribe?.(); },
  };
}

export function ScienceModeIcon({ size = 18 }: { size?: number }): JSX.Element {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M8 3h8M10 3v5.2l-4.8 8.1A3 3 0 0 0 7.8 21h8.4a3 3 0 0 0 2.6-4.7L14 8.2V3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M7.5 15h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

export interface ScienceSidebarProps {
  wide: boolean;
  controller: ScienceModeController;
  moduleSettings: SettingsScope<ModuleSettingsView>;
}

const STATE_LABELS: Record<ModuleSettingState, string> = {
  active: "运行正常",
  disabled: "已停用",
  needs_setup: "等待配置",
  error: "运行异常",
};

function moduleColor(id: ModuleSettingId): string {
  return SCIENCE_ECOSYSTEMS.find((item) => item.id === (id === "rosalind" ? "workbench" : id))?.color ?? "#69727d";
}

function useModuleSettings(scope: SettingsScope<ModuleSettingsView>): SettingsScopeSnapshot<ModuleSettingsView> {
  const subscribe = useCallback((listener: () => void) => scope.subscribe(listener), [scope]);
  const getSnapshot = useCallback(() => scope.getSnapshot(), [scope]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useScienceMode(controller: ScienceModeController): ScienceModeSnapshot {
  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller]);
  const getSnapshot = useCallback(() => controller.getSnapshot(), [controller]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function ScienceSidebar({ wide, controller, moduleSettings }: ScienceSidebarProps): JSX.Element {
  const [message, setMessage] = useState<string>();
  const mode = useScienceMode(controller);
  const settings = useModuleSettings(moduleSettings);

  async function toggle(): Promise<void> {
    setMessage(undefined);
    try {
      await controller.toggle();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const statusMessage = message ?? mode.message;
  const rows = MODULE_SETTING_IDS.map((id) => ({ id, runtime: settings.value?.runtime[id] }));

  if (!wide) {
    return <div className="rr-science-sidebar rr-science-sidebar--compact">
      <button type="button" className="rr-science-sidebar__activate rr-science-sidebar__activate--compact" aria-label={mode.enabled ? "停用 Rosalind 科学模式" : "启用 Rosalind 科学模式"} title={mode.enabled ? "停用 Rosalind 科学模式" : "启用 Rosalind 科学模式"} disabled={mode.busy} onClick={() => { void toggle(); }}><ScienceModeIcon /></button>
      <span className="rr-visually-hidden" role="status" aria-live="polite">{statusMessage}</span>
    </div>;
  }

  return <section className="rr-science-sidebar" aria-label="Rosalind 科学模块">
    <header className="rr-science-sidebar__head"><p>Rosalind Science</p><h2>科学工作区</h2><span>七个 Cordis 模块已接入；实际运行状态在任务执行时确认。</span></header>
    <ul className="rr-science-sidebar__modules">
      {rows.map(({ id, runtime }) => <li key={id}>
        <span className="rr-science-sidebar__mark" style={{ background: moduleColor(id) }} aria-hidden="true" />
        <span><strong>{runtime?.name ?? id}</strong><small>{runtime ? `${runtime.skillCount} skills · ${runtime.toolCount} tools` : "读取模块信息…"}</small></span>
        <em>{runtime ? STATE_LABELS[runtime.status] : settings.status === "unavailable" ? "不可用" : "读取中"}</em>
      </li>)}
    </ul>
    <button type="button" className="rr-science-sidebar__activate" disabled={mode.busy} onClick={() => { void toggle(); }}><ScienceModeIcon size={16} />{mode.busy ? "正在切换…" : mode.enabled ? "恢复原主题与会话" : "启用科学模式"}</button>
    <p className="rr-science-sidebar__message" role="status" aria-live="polite">{statusMessage}</p>
  </section>;
}

interface WorkspaceSidebarService {
  register(entry: { id: string; label: string; icon: JSX.Element; order: number; render(props: { wide: boolean }): JSX.Element }): () => void;
  select(id: string): void;
  getSnapshot?(): { activeId: string };
}

interface ThemeService {
  register(definition: { id: string; colorScheme: "light" | "dark"; tokens: Record<string, string> }): () => void;
  setTheme(id: string): void;
  getTheme(): { preference: string };
}

interface ConversationService {
  selectView(id: string): void;
  getView?(): string | undefined;
}

interface ClientSessionsService {
  list: {
    getSnapshot(): { current?: string; byId: Record<string, { id: string; blank: boolean; agentPreset?: string }> };
    subscribe(listener: () => void): () => void;
  };
  scope(sessionId: string): { get(name: string): unknown } | undefined;
  noteAgentPreset(sessionId: string, agentPreset: string): void;
}

interface ConnectionService {
  api: {
    agentPresets: {
      list(request: Record<string, never>): Promise<{ result: { ok: true; value: { presets: Array<{ id: string }>; authorable: boolean } } | { ok: false; error: { message: string } } }>;
      copy(request: { from: string; agentPreset: string; name: string }): Promise<{ result: { ok: true; value: { agentPreset: string } } | { ok: false; error: { message: string } } }>;
      select(request: { sessionId: string; agentPreset: string }): Promise<{ result: { ok: true; value: { agentPreset: string } } | { ok: false; error: { message: string } } }>;
    };
  };
}

/** Create the locally managed Rosalind composition once, then reuse it. */
export async function ensureRosalindSciencePreset(connection: ConnectionService): Promise<void> {
  const roster = await connection.api.agentPresets.list({});
  if (!roster.result.ok) throw new Error(roster.result.error.message);
  if (roster.result.value.presets.some((preset) => preset.id === ROSALIND_SCIENCE_AGENT_PRESET)) return;
  if (!roster.result.value.authorable) {
    throw new Error("当前 DSH 不允许创建 Rosalind Science 组合，请先在 Agent presets 设置中启用本地组合。");
  }
  const copied = await connection.api.agentPresets.copy({
    from: "standard",
    agentPreset: ROSALIND_SCIENCE_AGENT_PRESET,
    name: "Rosalind Science",
  });
  if (!copied.result.ok) throw new Error(copied.result.error.message);
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

export const ROSALIND_SCIENCE_DARK_THEME = Object.freeze({
  id: ROSALIND_SCIENCE_DARK_THEME_ID,
  colorScheme: "dark" as const,
  tokens: {
    "--dsw-alias-bg-base": "#171c1a",
    "--dsw-alias-bg-layer-1": "#202724",
    "--dsw-alias-bg-layer-2": "#29312e",
    "--dsw-alias-border-l2": "rgba(222, 235, 228, 0.12)",
    "--dsw-alias-brand-primary": "#8eb5a7",
    "--dsw-alias-brand-text": "#b9d8cd",
    "--dsw-alias-button-primary-fill": "#587f71",
    "--dsw-alias-button-primary-hover": "#6d9a89",
    "--dsw-alias-interactive-bg-active": "rgba(142, 181, 167, 0.18)",
    "--dsw-alias-interactive-bg-hover": "rgba(142, 181, 167, 0.1)",
    "--dsw-alias-label-primary": "#edf1ef",
    "--dsw-alias-label-secondary": "#bbc4c0",
    "--rr-bg": "#171c1a",
    "--rr-panel": "rgba(31, 38, 35, .88)",
    "--rr-panel-solid": "#202724",
    "--rr-panel-muted": "#29312e",
    "--rr-ink": "#edf1ef",
    "--rr-muted": "#bbc4c0",
    "--rr-faint": "#9aa6a0",
    "--rr-line": "rgba(222, 235, 228, .12)",
    "--rr-accent": "#8eb5a7",
    "--rr-accent-ink": "#b9d8cd",
    "--rr-accent-soft": "#2a423a",
  },
});

function scienceThemeFor(preference: string | undefined): string {
  return preference?.toLowerCase().includes("dark") ? ROSALIND_SCIENCE_DARK_THEME_ID : ROSALIND_SCIENCE_THEME_ID;
}

export interface ScienceModeRegistration {
  sidebarAvailable: boolean;
  dispose(): void;
}

function optionalService<T>(ctx: ClientContext, name: string): T | undefined {
  try {
    return ctx.get(name) as T | undefined;
  } catch {
    return undefined;
  }
}

export function registerScienceMode(ctx: ClientContext, moduleSettings: SettingsScope<ModuleSettingsView>): ScienceModeRegistration {
  const workspaceSidebar = optionalService<WorkspaceSidebarService>(ctx, "workspaceSidebar");
  const theme = ctx.get("theme") as ThemeService;
  const connection = ctx.get("connection") as ConnectionService;
  const sessions = ctx.get("sessions") as unknown as ClientSessionsService;
  const actions: ScienceModeActions = {
    currentSession() {
      const state = sessions.list.getSnapshot();
      const session = state.current === undefined ? undefined : state.byId[state.current];
      return session === undefined ? undefined : { id: session.id, blank: session.blank, ...(session.agentPreset ? { agentPreset: session.agentPreset } : {}) };
    },
    selectTheme: () => {
      const id = scienceThemeFor(theme.getTheme().preference);
      theme.setTheme(id);
      return id;
    },
    selectSidebar: () => { workspaceSidebar?.select(SCIENCE_SIDEBAR_VIEW_ID); },
    selectConversationView(sessionId) {
      const conversation = sessions.scope(sessionId)?.get("conversation") as ConversationService | undefined;
      if (!conversation) throw new Error("当前会话尚未准备好科学视图，请稍后重试。");
      conversation.selectView(SCIENCE_CONVERSATION_VIEW_ID);
    },
    async composeBlankSession(sessionId) {
      await ensureRosalindSciencePreset(connection);
      const response = await connection.api.agentPresets.select({ sessionId, agentPreset: ROSALIND_SCIENCE_AGENT_PRESET });
      if (!response.result.ok) {
        return { selected: false, message: `Rosalind Science 组合未能启用：${response.result.error.message}` };
      }
      sessions.noteAgentPreset(sessionId, response.result.value.agentPreset);
      return { selected: true };
    },
    async selectPreset(sessionId, agentPreset) {
      const response = await connection.api.agentPresets.select({ sessionId, agentPreset });
      if (!response.result.ok) return { selected: false, message: response.result.error.message };
      sessions.noteAgentPreset(sessionId, response.result.value.agentPreset);
      return { selected: true };
    },
    ...(typeof sessions.list.subscribe === "function" ? { subscribeSessions: (listener: () => void) => sessions.list.subscribe(listener) } : {}),
    currentTheme: () => theme.getTheme().preference,
    currentSidebar: () => workspaceSidebar?.getSnapshot?.().activeId,
    restoreTheme: (id) => { theme.setTheme(id); },
    restoreSidebar: (id) => { workspaceSidebar?.select(id); },
    currentConversationView: (sessionId) => (sessions.scope(sessionId)?.get("conversation") as ConversationService | undefined)?.getView?.(),
    restoreConversationView: (sessionId, view) => { (sessions.scope(sessionId)?.get("conversation") as ConversationService | undefined)?.selectView(view); },
  };
  const controller = createScienceModeController(actions);
  const disposeTheme = theme.register(ROSALIND_SCIENCE_THEME);
  const disposeDarkTheme = theme.register(ROSALIND_SCIENCE_DARK_THEME);
  const disposeSidebar = workspaceSidebar?.register({
    id: SCIENCE_SIDEBAR_VIEW_ID,
    label: "科学",
    icon: <ScienceModeIcon />,
    order: 20,
    render: ({ wide }) => <ScienceSidebar wide={wide} controller={controller} moduleSettings={moduleSettings} />,
  });
  return {
    sidebarAvailable: workspaceSidebar !== undefined,
    dispose() {
      controller.dispose();
      disposeSidebar?.();
      disposeDarkTheme();
      disposeTheme();
    },
  };
}
