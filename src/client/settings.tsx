import type { CSSProperties } from "react";
import { useCallback, useState, useSyncExternalStore } from "react";
import type { SettingsScope, SettingsScopeSnapshot } from "@deepseek-ai/dsh-client-runtime/client";

import {
  MODULE_SETTING_IDS,
  type ModuleProviderView,
  type ModuleRuntimeView,
  type ModuleSettingId,
  type ModuleSettingState,
  type ModuleSettingsView,
} from "../shared/module-settings-contract.js";
import { SettingsIcon } from "./icons.js";
import { MODULE_DETAILS } from "./module-settings-control.js";

const PAGE_STYLE: CSSProperties = {
  boxSizing: "border-box",
  display: "grid",
  gap: 16,
  width: "100%",
  maxHeight: "calc(100dvh - 9rem)",
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: "clamp(4px, 1.5vw, 16px)",
  paddingBottom: 32,
};

const GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 25rem), 1fr))",
  gap: 12,
  alignItems: "start",
};

const CARD_STYLE: CSSProperties = {
  boxSizing: "border-box",
  minWidth: 0,
  border: "1px solid color-mix(in srgb, var(--rr-muted, #7b8794) 35%, transparent)",
  borderRadius: 14,
  padding: "clamp(12px, 2vw, 18px)",
  background: "color-mix(in srgb, var(--rr-surface, #fff) 94%, var(--rr-accent, #4c7fa4))",
};

const ROW_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const META_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(7.5rem, 1fr))",
  gap: 8,
  margin: "12px 0",
};

const STATE_LABELS: Record<ModuleSettingState, string> = {
  active: "正常运行",
  needs_setup: "需要配置",
  error: "出现错误",
  disabled: "已停用",
};

const STATE_COLORS: Record<ModuleSettingState, string> = {
  active: "#2c7a55",
  needs_setup: "#9a6815",
  error: "#b33a3a",
  disabled: "#69727d",
};

function useSettingsSnapshot(scope: SettingsScope<ModuleSettingsView>): SettingsScopeSnapshot<ModuleSettingsView> {
  const subscribe = useCallback((listener: () => void) => scope.subscribe(listener), [scope]);
  const getSnapshot = useCallback(() => scope.getSnapshot(), [scope]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function providerState(provider: ModuleProviderView): string {
  if (provider.runnable) return "可用";
  if (provider.credentialRequired && !provider.credentialConfigured) return "缺少凭据";
  if (!provider.installed) return "需要配置";
  return "暂不可用";
}

function credentialState(provider: ModuleProviderView): string {
  if (!provider.credentialRequired) return "不需要凭据";
  return provider.credentialConfigured ? "凭据已配置" : "凭据未配置";
}

function RuntimeState({ runtime }: { runtime: ModuleRuntimeView }): JSX.Element {
  return (
    <span
      role="status"
      style={{ color: STATE_COLORS[runtime.status], fontWeight: 700, whiteSpace: "nowrap" }}
      aria-label={`实际运行状态：${STATE_LABELS[runtime.status]}`}
    >
      {STATE_LABELS[runtime.status]}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string | number }): JSX.Element {
  return <div style={{ minWidth: 0 }}><dt style={{ color: "var(--rr-muted, #66717e)", fontSize: 12 }}>{label}</dt><dd style={{ margin: "2px 0 0", overflowWrap: "anywhere", fontWeight: 650 }}>{value}</dd></div>;
}

function ModuleCard({
  id,
  settings,
  pending,
  writable,
  onToggle,
}: {
  id: ModuleSettingId;
  settings: ModuleSettingsView;
  pending: boolean;
  writable: boolean;
  onToggle: (id: ModuleSettingId) => void;
}): JSX.Element {
  const runtime = settings.runtime[id];
  const desired = settings.modules[id];
  const detail = MODULE_DETAILS.find((item) => item.id === id)!;
  const changing = pending || desired !== runtime.enabled;
  const detailsId = `module-settings-details-${id}`;

  return (
    <article style={CARD_STYLE} aria-labelledby={`module-settings-title-${id}`}>
      <div style={ROW_STYLE}>
        <div style={{ minWidth: 0 }}>
          <h3 id={`module-settings-title-${id}`} style={{ margin: 0, overflowWrap: "anywhere" }}>{runtime.name}</h3>
          <p style={{ margin: "5px 0 0", color: "var(--rr-muted, #66717e)" }}>期望：{desired ? "启用" : "停用"} · 实际：<RuntimeState runtime={runtime} /></p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={desired}
          aria-label={`${desired ? "停用" : "启用"}${runtime.name}`}
          disabled={!writable || pending}
          onClick={() => onToggle(id)}
          style={{
            minWidth: 82,
            minHeight: 40,
            border: 0,
            borderRadius: 999,
            padding: "8px 13px",
            cursor: !writable || pending ? "not-allowed" : "pointer",
            background: desired ? "var(--rr-accent, #316f93)" : "#737b84",
            color: "white",
            fontWeight: 700,
          }}
        >
          {pending ? "保存中" : desired ? "已启用" : "已停用"}
        </button>
      </div>

      {changing && <p aria-live="polite" style={{ margin: "10px 0 0", color: "#8a621b" }}>主机正在应用这项更改，实际状态会自动更新。</p>}

      <dl style={META_STYLE} aria-label={`${runtime.name} 模块信息`}>
        <Metric label="版本" value={runtime.version} />
        <Metric label="工具合同" value={runtime.toolCount} />
        <Metric label="Skills" value={runtime.skillCount} />
        <Metric label="Showcases" value={runtime.showcaseCount} />
      </dl>

      <details id={detailsId}>
        <summary style={{ cursor: "pointer", minHeight: 32, fontWeight: 700 }}>查看 Skills、工具、Showcases 与配置提示</summary>
        <div style={{ display: "grid", gap: 12, paddingTop: 10, overflowWrap: "anywhere" }}>
          <section aria-label={`${runtime.name} provider readiness`}>
            <h4 style={{ margin: "0 0 6px" }}>Provider 状态</h4>
            {runtime.providers.length === 0 ? <p style={{ margin: 0 }}>该模块没有报告 Provider。</p> : <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {runtime.providers.map((provider) => <li key={provider.id}><strong>{provider.label}</strong>：{providerState(provider)}；{credentialState(provider)}</li>)}
            </ul>}
          </section>
          <section><h4 style={{ margin: "0 0 6px" }}>配置提示</h4><ul style={{ margin: 0, paddingInlineStart: 20 }}>{detail.configuration.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><h4 style={{ margin: "0 0 6px" }}>工具示例</h4><p style={{ margin: 0 }}>下列名称用于说明工具合同，不表示曾经成功执行：{detail.tools.join("、")}。</p></section>
          <section><h4 style={{ margin: "0 0 6px" }}>Showcase 引用的 Skills</h4>{detail.skills.length > 0 ? <ul style={{ margin: 0, paddingInlineStart: 20 }}>{detail.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p style={{ margin: 0 }}>该模块没有声明 Skill。</p>}</section>
          <section><h4 style={{ margin: "0 0 6px" }}>已审核 Showcases（{detail.showcases.length}）</h4><ul style={{ margin: 0, paddingInlineStart: 20 }}>{detail.showcases.map((showcase) => <li key={showcase}>{showcase}</li>)}</ul></section>
          {runtime.issues.length > 0 && <section aria-label={`${runtime.name} issues`}><h4 style={{ margin: "0 0 6px", color: STATE_COLORS.error }}>当前提示</h4><ul style={{ margin: 0, paddingInlineStart: 20 }}>{runtime.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></section>}
        </div>
      </details>
    </article>
  );
}

export interface ProviderSettingsProps {
  scope: SettingsScope<ModuleSettingsView>;
}

export function ProviderSettings({ scope }: ProviderSettingsProps): JSX.Element {
  const snapshot = useSettingsSnapshot(scope);
  const [pending, setPending] = useState<ReadonlySet<ModuleSettingId>>(() => new Set());
  const [writeError, setWriteError] = useState<string | null>(null);

  async function toggle(id: ModuleSettingId): Promise<void> {
    const value = scope.getSnapshot().value;
    if (!value) return;
    setWriteError(null);
    setPending((current) => new Set(current).add(id));
    try {
      await scope.set("modules", { ...value.modules, [id]: !value.modules[id] });
    } catch (cause) {
      setWriteError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <section className="rr-settings" style={PAGE_STYLE} aria-labelledby="dsh-rosalind-module-settings-title">
      <header>
        <h2 id="dsh-rosalind-module-settings-title" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 0 }}><SettingsIcon size={22} /> DSH-Rosalind 模块设置</h2>
        <p>插件清单仍显示一个 DSH-Rosalind。这里管理插件内部的七个科学模块，并分别显示期望状态、主机实际状态和 Provider 准备情况。</p>
        <p style={{ color: "var(--rr-muted, #66717e)" }}>工具数表示已声明的工具合同数量，不代表工具曾经成功执行。</p>
      </header>

      {snapshot.status === "loading" && <p role="status" aria-live="polite">正在读取主机设置与模块状态…</p>}
      {snapshot.status === "unavailable" && <p role="alert">当前连接无法读取主机设置。模块信息暂时不可编辑。</p>}
      {!snapshot.writable && snapshot.status === "ready" && <p role="status">当前设置为只读模式。</p>}
      {writeError && <p role="alert" style={{ color: STATE_COLORS.error }}>设置保存失败：{writeError}</p>}

      {snapshot.value && <div style={GRID_STYLE} aria-label="七个科学模块">
        {MODULE_SETTING_IDS.map((id) => <ModuleCard key={id} id={id} settings={snapshot.value!} pending={pending.has(id)} writable={snapshot.writable} onToggle={(nextId) => { void toggle(nextId); }} />)}
      </div>}
    </section>
  );
}
