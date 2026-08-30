// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SettingsScope, SettingsScopeSnapshot } from "@deepseek-ai/dsh-client-runtime/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProviderSettings } from "../src/client/settings.js";
import {
  MODULE_SETTING_IDS,
  type ModuleRuntimeView,
  type ModuleSettingId,
  type ModuleSettingsView,
} from "../src/shared/module-settings-contract.js";

function runtime(id: ModuleSettingId, overrides: Partial<ModuleRuntimeView> = {}): ModuleRuntimeView {
  const names: Record<ModuleSettingId, string> = {
    literature: "Life Sciences Literature",
    databases: "Life Sciences Databases",
    sequence: "Biological Sequence Viewer",
    ngs: "NGS Analysis Workbench",
    structure: "Molecular Structure Viewer",
    slide: "Slide Viewer",
    rosalind: "Rosalind Workbench",
  };
  return {
    id,
    name: names[id],
    status: "active",
    enabled: true,
    version: "1.2.3",
    toolCount: 3,
    skillCount: 2,
    showcaseCount: 4,
    providers: [{
      id: `${id}-provider`,
      label: `${names[id]} Provider`,
      kind: "local",
      installed: true,
      credentialRequired: false,
      credentialConfigured: true,
      runnable: true,
      diagnostics: ["Provider prerequisites are available."],
    }],
    issues: [],
    ...overrides,
  };
}

function settings(): ModuleSettingsView {
  return {
    modules: Object.fromEntries(MODULE_SETTING_IDS.map((id) => [id, id !== "slide"])) as ModuleSettingsView["modules"],
    runtime: Object.fromEntries(MODULE_SETTING_IDS.map((id) => [id, runtime(id, id === "slide" ? { status: "disabled", enabled: false } : {})])) as ModuleSettingsView["runtime"],
  };
}

class FakeSettingsScope implements SettingsScope<ModuleSettingsView> {
  private listeners = new Set<() => void>();
  private snapshot: SettingsScopeSnapshot<ModuleSettingsView>;
  readonly writes: Array<{ field: string; value: unknown }> = [];
  failNextWrite: Error | null = null;

  constructor(value: ModuleSettingsView | null = settings(), status: SettingsScopeSnapshot<ModuleSettingsView>["status"] = "ready") {
    const resolved = value ?? undefined;
    this.snapshot = { status, value: resolved, base: resolved, user: undefined, revision: 1, writable: status === "ready", mode: "host" };
  }

  getSnapshot(): SettingsScopeSnapshot<ModuleSettingsView> {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async set(field: string, value: unknown): Promise<void> {
    this.writes.push({ field, value });
    if (this.failNextWrite) {
      const error = this.failNextWrite;
      this.failNextWrite = null;
      throw error;
    }
    if (field !== "modules" || !this.snapshot.value) return;
    const modules = value as ModuleSettingsView["modules"];
    const runtimeView = Object.fromEntries(MODULE_SETTING_IDS.map((id) => [id, {
      ...this.snapshot.value!.runtime[id],
      enabled: modules[id],
      status: modules[id] ? this.snapshot.value!.runtime[id].status : "disabled",
    }])) as ModuleSettingsView["runtime"];
    this.snapshot = { ...this.snapshot, value: { ...this.snapshot.value, modules, runtime: runtimeView }, revision: (this.snapshot.revision ?? 0) + 1 };
    for (const listener of this.listeners) listener();
  }

  async unset(): Promise<void> {}
}

afterEach(cleanup);

describe("ProviderSettings", () => {
  it("shows one plugin with seven independently described module states", () => {
    const value = settings();
    value.runtime.literature = runtime("literature", { status: "needs_setup" });
    value.runtime.sequence = runtime("sequence", { status: "error", issues: ["Module startup failed: fixture"] });
    value.runtime.slide = runtime("slide", { status: "disabled", enabled: false });
    render(<ProviderSettings scope={new FakeSettingsScope(value)} />);

    expect(screen.getByRole("heading", { name: /DSH-Rosalind 模块设置/ })).toBeInTheDocument();
    expect(screen.getByText(/DSH 将它显示为一个 DSH-Rosalind 插件/)).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(7);
    expect(screen.getByText("等待配置")).toBeInTheDocument();
    expect(screen.getByText("运行异常")).toBeInTheDocument();
    expect(screen.getAllByText("已停用").length).toBeGreaterThan(0);
    expect(screen.getByText(/不代表工具已经成功运行/)).toBeInTheDocument();
  });

  it("writes the complete desired module selection and follows the live snapshot", async () => {
    const scope = new FakeSettingsScope();
    render(<ProviderSettings scope={scope} />);
    const toggle = screen.getByRole("switch", { name: "停用 Biological Sequence Viewer" });
    fireEvent.click(toggle);

    await waitFor(() => expect(scope.writes).toHaveLength(1));
    expect(scope.writes[0]).toMatchObject({ field: "modules", value: { sequence: false, ngs: true, rosalind: true } });
    expect(screen.getByRole("switch", { name: "启用 Biological Sequence Viewer" })).toHaveAttribute("aria-checked", "false");
    expect(within(screen.getByRole("article", { name: "Biological Sequence Viewer" })).getAllByText("已停用").length).toBeGreaterThan(0);
  });

  it("expands concrete tools, Skills, Showcases, configuration and provider readiness", () => {
    const value = settings();
    value.runtime.literature = runtime("literature", {
      status: "needs_setup",
      providers: [{
        id: "ncbi-entrez",
        label: "NCBI Entrez",
        kind: "public-api",
        installed: false,
        credentialRequired: true,
        credentialConfigured: false,
        runnable: false,
        diagnostics: ["Credential is not configured."],
      }],
    });
    render(<ProviderSettings scope={new FakeSettingsScope(value)} />);
    const card = screen.getByRole("article", { name: "Life Sciences Literature" });
    fireEvent.click(within(card).getByText("查看技能、工具、案例与配置说明"));

    expect(within(card).getByText(/literature_request/)).toBeInTheDocument();
    expect(within(card).getByText("rosalind-literature-ncbi-entrez")).toBeInTheDocument();
    expect(within(card).getByText(/DSH_ROSALIND_ENABLE_LIVE_NETWORK/)).toBeInTheDocument();
    expect(within(card).getByLabelText("Life Sciences Literature 服务准备情况")).toHaveTextContent("NCBI Entrez：缺少凭据；凭据未配置");
    expect(within(card).getByRole("heading", { name: /已审核案例/ })).toBeInTheDocument();
  });

  it("reports rejected writes without changing the selected state", async () => {
    const scope = new FakeSettingsScope();
    scope.failNextWrite = new Error("host refused fixture write");
    render(<ProviderSettings scope={scope} />);
    fireEvent.click(screen.getByRole("switch", { name: "停用 NGS Analysis Workbench" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("保存设置失败：host refused fixture write");
    expect(screen.getByRole("switch", { name: "停用 NGS Analysis Workbench" })).toHaveAttribute("aria-checked", "true");
  });

  it("uses native keyboard controls and a scrollable responsive layout", () => {
    render(<ProviderSettings scope={new FakeSettingsScope()} />);
    const page = screen.getByRole("region", { name: "DSH-Rosalind 模块设置" });
    const grid = screen.getByLabelText("七个科学模块");
    expect(page).toHaveClass("rr-settings");
    expect(grid).toHaveClass("rr-settings__grid");
    expect(screen.getAllByRole("switch").every((control) => control.tagName === "BUTTON")).toBe(true);
    expect(screen.getAllByText("查看技能、工具、案例与配置说明").every((summary) => summary.tagName === "SUMMARY")).toBe(true);
  });

  it("handles loading and unavailable settings without editable controls", () => {
    const { rerender } = render(<ProviderSettings scope={new FakeSettingsScope(null, "loading")} />);
    expect(screen.getByText("正在读取设置与模块状态…")).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    rerender(<ProviderSettings scope={new FakeSettingsScope(null, "unavailable")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("当前连接无法读取设置");
  });

  it("uses namespaced CSS classes instead of inline layout styles", () => {
    render(<ProviderSettings scope={new FakeSettingsScope()} />);
    expect(screen.getAllByRole("article").every((card) => card.getAttribute("style") === null)).toBe(true);
    expect(screen.getByRole("article", { name: "Life Sciences Literature" })).toHaveClass("rr-settings__card");
  });
});
