// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SCIENCE_ECOSYSTEMS } from "../src/client/ecosystem.js";
import {
  activateScienceMode,
  createScienceModeController,
  ensureRosalindSciencePreset,
  registerScienceMode,
  ROSALIND_SCIENCE_DARK_THEME_ID,
  ScienceSidebar,
  type ScienceModeActions,
} from "../src/client/science-mode.js";
import { MODULE_SETTING_IDS, type ModuleSettingsView } from "../src/shared/module-settings-contract.js";

afterEach(cleanup);

function actions(session: { id: string; blank: boolean; agentPreset?: string } | undefined): ScienceModeActions & Record<string, ReturnType<typeof vi.fn>> {
  return {
    currentSession: vi.fn(() => session),
    selectTheme: vi.fn(),
    selectSidebar: vi.fn(),
    selectConversationView: vi.fn(),
    composeBlankSession: vi.fn(async () => ({ selected: true })),
  };
}

function moduleScope(): { getSnapshot(): { status: "ready"; value: ModuleSettingsView; writable: boolean }; subscribe(): () => void } {
  const runtime = Object.fromEntries(MODULE_SETTING_IDS.map((id, index) => [id, {
    id,
    name: SCIENCE_ECOSYSTEMS.find((item) => item.id === (id === "rosalind" ? "workbench" : id))!.name,
    status: index === 1 ? "needs_setup" : index === 2 ? "disabled" : index === 3 ? "error" : "active",
    enabled: index !== 2,
    version: "test",
    toolCount: index + 1,
    skillCount: index + 2,
    showcaseCount: 0,
    providers: [],
    issues: [],
  }])) as unknown as ModuleSettingsView["runtime"];
  const snapshot = { status: "ready" as const, value: { modules: Object.fromEntries(MODULE_SETTING_IDS.map((id) => [id, true])) as ModuleSettingsView["modules"], runtime }, writable: true };
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
  };
}

describe("Rosalind science mode", () => {
  it("applies theme and sidebar without composing when no session is active", async () => {
    const adapter = actions(undefined);
    await expect(activateScienceMode(adapter)).resolves.toEqual({ enabled: true, composed: false });
    expect(adapter.selectTheme).toHaveBeenCalledOnce();
    expect(adapter.selectSidebar).toHaveBeenCalledOnce();
    expect(adapter.selectConversationView).not.toHaveBeenCalled();
  });

  it("prepares the first blank session that appears after science mode is enabled", async () => {
    let current: { id: string; blank: boolean; agentPreset?: string } | undefined;
    let notify: (() => void) | undefined;
    const currentSession = vi.fn(() => current);
    const adapter = { ...actions(undefined), currentSession };
    adapter.subscribeSessions = vi.fn((listener: () => void) => { notify = listener; return () => undefined; });
    const controller = createScienceModeController(adapter);
    await controller.toggle();
    expect(adapter.composeBlankSession).not.toHaveBeenCalled();
    current = { id: "blank-1", blank: true, agentPreset: "standard" };
    notify?.();
    await waitFor(() => expect(adapter.composeBlankSession).toHaveBeenCalledWith("blank-1"));
    expect(adapter.selectConversationView).toHaveBeenCalledWith("blank-1");
    expect(controller.getSnapshot()).toMatchObject({ enabled: true, composed: true, sessionId: "blank-1" });
  });

  it("prepares a newly selected blank session after an earlier composition finishes", async () => {
    let current = { id: "blank-a", blank: true, agentPreset: "standard" };
    let notify: (() => void) | undefined;
    let finishFirst: ((value: { selected: boolean }) => void) | undefined;
    const first = new Promise<{ selected: boolean }>((resolve) => { finishFirst = resolve; });
    const composeBlankSession = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue({ selected: true });
    const adapter = Object.assign(actions(current), {
      currentSession: vi.fn(() => current),
      composeBlankSession,
      subscribeSessions: vi.fn((listener: () => void) => { notify = listener; return () => undefined; }),
    });
    const controller = createScienceModeController(adapter);
    const enabling = controller.toggle();
    await waitFor(() => expect(composeBlankSession).toHaveBeenCalledWith("blank-a"));
    current = { id: "blank-b", blank: true, agentPreset: "standard" };
    notify?.();
    expect(composeBlankSession).toHaveBeenCalledTimes(1);
    finishFirst?.({ selected: true });
    await enabling;
    await waitFor(() => expect(composeBlankSession).toHaveBeenCalledWith("blank-b"));
    expect(controller.getSnapshot()).toMatchObject({ enabled: true, composed: true, sessionId: "blank-b" });
  });

  it("does not change the preset of an existing session and explains why", async () => {
    const adapter = Object.assign(actions({ id: "existing-1", blank: false, agentPreset: "standard" }), {
      currentConversationView: vi.fn(() => "trajectory"),
      restoreConversationView: vi.fn(),
    });
    const controller = createScienceModeController(adapter);
    await controller.toggle();
    expect(adapter.composeBlankSession).not.toHaveBeenCalled();
    expect(adapter.selectConversationView).toHaveBeenCalledWith("existing-1");
    expect(controller.getSnapshot().message).toMatch(/已有内容.*不允许更换 Agent preset/);
    await controller.toggle();
    expect(adapter.restoreConversationView).toHaveBeenCalledWith("existing-1", "trajectory");
  });

  it("restores the original theme, sidebar, preset, and conversation view for a blank session", async () => {
    const adapter = Object.assign(actions({ id: "blank-1", blank: true, agentPreset: "standard" }), {
      currentTheme: vi.fn(() => "dark"),
      currentSidebar: vi.fn(() => "sessions"),
      currentConversationView: vi.fn(() => "chat"),
      restoreTheme: vi.fn(),
      restoreSidebar: vi.fn(),
      restoreConversationView: vi.fn(),
      selectPreset: vi.fn(async () => ({ selected: true })),
    });
    const controller = createScienceModeController(adapter);
    await controller.toggle();
    await controller.toggle();
    expect(adapter.restoreTheme).toHaveBeenCalledWith("dark");
    expect(adapter.restoreSidebar).toHaveBeenCalledWith("sessions");
    expect(adapter.restoreConversationView).toHaveBeenCalledWith("blank-1", "chat");
    expect(adapter.selectPreset).toHaveBeenCalledWith("blank-1", "standard");
  });

  it("uses a dark science theme for dark users and preserves a later manual theme choice", async () => {
    let selectedTheme = "dark";
    const adapter = Object.assign(actions({ id: "blank-1", blank: true, agentPreset: "standard" }), {
      currentTheme: vi.fn(() => selectedTheme),
      selectTheme: vi.fn(() => {
        selectedTheme = ROSALIND_SCIENCE_DARK_THEME_ID;
        return ROSALIND_SCIENCE_DARK_THEME_ID;
      }),
      restoreTheme: vi.fn(),
      selectPreset: vi.fn(async () => ({ selected: true })),
    });
    const controller = createScienceModeController(adapter);
    await controller.toggle();
    expect(adapter.selectTheme).toHaveBeenCalledOnce();
    expect(selectedTheme).toBe(ROSALIND_SCIENCE_DARK_THEME_ID);
    selectedTheme = "user-picked-theme";
    await controller.toggle();
    expect(adapter.restoreTheme).not.toHaveBeenCalled();
    expect(controller.getSnapshot().message).toMatch(/保留了你在科学模式中选择的新主题/);
  });

  it("composes the same blank session again after science mode is disabled", async () => {
    const adapter = Object.assign(actions({ id: "blank-1", blank: true, agentPreset: "standard" }), {
      selectPreset: vi.fn(async () => ({ selected: true })),
    });
    const controller = createScienceModeController(adapter);
    await controller.toggle();
    await controller.toggle();
    await controller.toggle();
    expect(adapter.composeBlankSession).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({ enabled: true, composed: true, busy: false });
  });

  it("keeps the original blank-session state after the session receives content", async () => {
    let current = { id: "blank-1", blank: true, agentPreset: "standard" };
    let notify: (() => void) | undefined;
    const adapter = Object.assign(actions(current), {
      currentSession: vi.fn(() => current),
      currentConversationView: vi.fn(() => current.blank ? "chat" : "dsh-rosalind"),
      restoreConversationView: vi.fn(),
      selectPreset: vi.fn(async () => ({ selected: true })),
      subscribeSessions: vi.fn((listener: () => void) => { notify = listener; return () => undefined; }),
    });
    const controller = createScienceModeController(adapter);
    await controller.toggle();
    current = { ...current, blank: false };
    notify?.();
    await waitFor(() => expect(controller.getSnapshot().composed).toBe(false));
    await controller.toggle();
    expect(adapter.restoreConversationView).toHaveBeenCalledWith("blank-1", "chat");
    expect(controller.getSnapshot()).toMatchObject({ enabled: false, busy: false });
  });

  it("finishes disabling when individual restore actions fail", async () => {
    const adapter = Object.assign(actions({ id: "blank-1", blank: true, agentPreset: "standard" }), {
      currentTheme: vi.fn(() => "dark"),
      currentSidebar: vi.fn(() => "sessions"),
      currentConversationView: vi.fn(() => "chat"),
      selectPreset: vi.fn(async () => { throw new Error("preset failed"); }),
      restoreConversationView: vi.fn(() => { throw new Error("view failed"); }),
      restoreTheme: vi.fn(() => { throw new Error("theme failed"); }),
      restoreSidebar: vi.fn(),
    });
    const controller = createScienceModeController(adapter);
    await controller.toggle();
    await expect(controller.toggle()).resolves.toMatchObject({ enabled: false });
    expect(adapter.restoreSidebar).toHaveBeenCalledWith("sessions");
    expect(controller.getSnapshot()).toMatchObject({ enabled: false, busy: false });
  });

  it("shares one subscribed controller between wide and compact sidebars and reads live module settings", async () => {
    const controller = createScienceModeController(actions({ id: "blank-1", blank: true, agentPreset: "standard" }));
    const scope = moduleScope();
    const { rerender } = render(<ScienceSidebar wide controller={controller} moduleSettings={scope as never} />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("等待配置")).toBeTruthy();
    expect(screen.getByText("已停用")).toBeTruthy();
    expect(screen.getByText("运行异常")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "启用科学模式" }));
    await waitFor(() => expect(screen.getByText("恢复原主题与会话")).toBeTruthy());
    rerender(<ScienceSidebar wide={false} controller={controller} moduleSettings={scope as never} />);
    expect(screen.getByRole("button", { name: "停用 Rosalind 科学模式" })).toBeTruthy();
  });

  it("creates the Rosalind Science composition once from the standard preset", async () => {
    const copy = vi.fn().mockResolvedValue({ result: { ok: true, value: { agentPreset: "rosalind-science" } } });
    const connection = { api: { agentPresets: {
      list: vi.fn().mockResolvedValue({ result: { ok: true, value: { presets: [{ id: "standard" }], authorable: true } } }),
      copy,
      select: vi.fn(),
    } } };
    await ensureRosalindSciencePreset(connection);
    expect(copy).toHaveBeenCalledWith({ from: "standard", agentPreset: "rosalind-science", name: "Rosalind Science" });
  });

  it("keeps the plugin usable when an older Harness has no workspace sidebar service", () => {
    const register = vi.fn(() => vi.fn());
    const disposeTheme = vi.fn();
    const disposeDarkTheme = vi.fn();
    const unsubscribeSessions = vi.fn();
    const ctx = {
      get(name: string) {
        if (name === "workspaceSidebar") return undefined;
        if (name === "theme") return { register, setTheme: vi.fn(), getTheme: () => ({ preference: "dark" }) };
        if (name === "connection") return { api: { agentPresets: { list: vi.fn(), copy: vi.fn(), select: vi.fn() } } };
        return { list: { getSnapshot: () => ({ current: undefined, byId: {} }), subscribe: vi.fn(() => unsubscribeSessions) }, scope: () => undefined, noteAgentPreset: vi.fn() };
      },
    } as never;
    register.mockReturnValueOnce(disposeTheme).mockReturnValueOnce(disposeDarkTheme);
    const registration = registerScienceMode(ctx, moduleScope() as never);
    expect(registration.sidebarAvailable).toBe(false);
    registration.dispose();
    expect(unsubscribeSessions).toHaveBeenCalledOnce();
    expect(disposeTheme).toHaveBeenCalledOnce();
    expect(disposeDarkTheme).toHaveBeenCalledOnce();
  });
});
