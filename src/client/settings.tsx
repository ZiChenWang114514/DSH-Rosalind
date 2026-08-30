import { useCallback, useId, useState, useSyncExternalStore } from "react";
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

const STATE_LABELS: Record<ModuleSettingState, string> = {
  active: "运行正常",
  needs_setup: "等待配置",
  error: "运行异常",
  disabled: "已停用",
};

function useSettingsSnapshot(scope: SettingsScope<ModuleSettingsView>): SettingsScopeSnapshot<ModuleSettingsView> {
  const subscribe = useCallback((listener: () => void) => scope.subscribe(listener), [scope]);
  const getSnapshot = useCallback(() => scope.getSnapshot(), [scope]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function providerState(provider: ModuleProviderView): string {
  if (provider.runnable) return "可运行";
  if (provider.credentialRequired && !provider.credentialConfigured) return "缺少凭据";
  if (!provider.installed) return "尚未就绪";
  return "暂不可用";
}

function credentialState(provider: ModuleProviderView): string {
  if (!provider.credentialRequired) return "无需凭据";
  return provider.credentialConfigured ? "凭据已配置" : "凭据未配置";
}

function RuntimeState({ runtime }: { runtime: ModuleRuntimeView }): JSX.Element {
  return <span className="rr-settings__state" data-state={runtime.status} role="status" aria-label={`当前运行状态：${STATE_LABELS[runtime.status]}`}>{STATE_LABELS[runtime.status]}</span>;
}

function Metric({ label, value }: { label: string; value: string | number }): JSX.Element {
  return <div className="rr-settings__metric"><dt>{label}</dt><dd>{value}</dd></div>;
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
  const titleId = useId();
  const detailsId = useId();
  const runtime = settings.runtime[id];
  const desired = settings.modules[id];
  const detail = MODULE_DETAILS.find((item) => item.id === id)!;
  const changing = pending || desired !== runtime.enabled;

  return (
    <article className="rr-settings__card" aria-labelledby={titleId}>
      <div className="rr-settings__row">
        <div className="rr-settings__identity">
          <h3 id={titleId}>{runtime.name}</h3>
          <p>已选择：{desired ? "启用" : "停用"} · 当前：<RuntimeState runtime={runtime} /></p>
        </div>
        <button
          type="button"
          className="rr-settings__switch"
          data-enabled={desired}
          role="switch"
          aria-checked={desired}
          aria-label={`${desired ? "停用" : "启用"} ${runtime.name}`}
          disabled={!writable || pending}
          onClick={() => onToggle(id)}
        >
          {pending ? "保存中…" : desired ? "已启用" : "已停用"}
        </button>
      </div>

      {changing && <p className="rr-settings__pending" aria-live="polite">正在应用此项设置，当前运行状态会自动更新。</p>}

      <dl className="rr-settings__metrics" aria-label={`${runtime.name} 模块信息`}>
        <Metric label="版本" value={runtime.version} />
        <Metric label="工具" value={runtime.toolCount} />
        <Metric label="技能" value={runtime.skillCount} />
        <Metric label="案例" value={runtime.showcaseCount} />
      </dl>

      <details className="rr-settings__details" id={detailsId}>
        <summary>查看技能、工具、案例与配置说明</summary>
        <div className="rr-settings__details-content">
          <section aria-label={`${runtime.name} 服务准备情况`}>
            <h4>服务状态</h4>
            {runtime.providers.length === 0 ? <p>该模块暂未报告服务信息。</p> : <ul>
              {runtime.providers.map((provider) => <li key={provider.id}><strong>{provider.label}</strong>：{providerState(provider)}；{credentialState(provider)}</li>)}
            </ul>}
          </section>
          <section><h4>配置说明</h4><ul>{detail.configuration.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><h4>工具示例</h4><p>以下名称仅说明该模块提供的工具，不代表它们已经成功运行：{detail.tools.join("、")}。</p></section>
          <section><h4>案例使用的技能</h4>{detail.skills.length > 0 ? <ul>{detail.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p>该模块没有声明技能。</p>}</section>
          <section><h4>已审核案例（{detail.showcases.length}）</h4><ul>{detail.showcases.map((showcase) => <li key={showcase}>{showcase}</li>)}</ul></section>
          {runtime.issues.length > 0 && <section className="rr-settings__issues" aria-label={`${runtime.name} 当前提示`}><h4>当前提示</h4><ul>{runtime.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></section>}
        </div>
      </details>
    </article>
  );
}

export interface ProviderSettingsProps {
  scope: SettingsScope<ModuleSettingsView>;
}

export function ProviderSettings({ scope }: ProviderSettingsProps): JSX.Element {
  const headingId = useId();
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
    <section className="rr-settings" aria-labelledby={headingId}>
      <header className="rr-settings__header">
        <h2 id={headingId}><SettingsIcon size={22} /> DSH-Rosalind 模块设置</h2>
        <p>DSH 将它显示为一个 DSH-Rosalind 插件；这里可以管理其中七个科学模块，并查看选择状态、当前运行状态和服务准备情况。</p>
        <p className="rr-settings__note">工具数量表示已登记的工具数量，不代表工具已经成功运行。</p>
      </header>

      {snapshot.status === "loading" && <p className="rr-settings__notice" role="status" aria-live="polite">正在读取设置与模块状态…</p>}
      {snapshot.status === "unavailable" && <p className="rr-settings__notice rr-settings__notice--error" role="alert">当前连接无法读取设置，模块暂时不可编辑。</p>}
      {!snapshot.writable && snapshot.status === "ready" && <p className="rr-settings__notice" role="status">当前设置为只读状态。</p>}
      {writeError && <p className="rr-settings__notice rr-settings__notice--error" role="alert">保存设置失败：{writeError}</p>}

      {snapshot.value && <div className="rr-settings__grid" aria-label="七个科学模块">
        {MODULE_SETTING_IDS.map((id) => <ModuleCard key={id} id={id} settings={snapshot.value!} pending={pending.has(id)} writable={snapshot.writable} onToggle={(nextId) => { void toggle(nextId); }} />)}
      </div>}
    </section>
  );
}
