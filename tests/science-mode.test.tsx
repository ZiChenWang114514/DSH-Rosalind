// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SCIENCE_ECOSYSTEMS } from "../src/client/ecosystem.js";
import { activateScienceMode, ScienceSidebar, type ScienceModeActions } from "../src/client/science-mode.js";

afterEach(cleanup);

function actions(session: { id: string; blank: boolean } | undefined): ScienceModeActions & Record<string, ReturnType<typeof vi.fn>> {
  return {
    currentSession: vi.fn(() => session),
    selectTheme: vi.fn(),
    selectSidebar: vi.fn(),
    selectConversationView: vi.fn(),
    composeBlankSession: vi.fn(async () => undefined),
  };
}

describe("Rosalind science mode", () => {
  it("applies the theme and sidebar without composing when no session is active", async () => {
    const adapter = actions(undefined);
    await expect(activateScienceMode(adapter)).resolves.toEqual({ composed: false });
    expect(adapter.selectTheme).toHaveBeenCalledOnce();
    expect(adapter.selectSidebar).toHaveBeenCalledOnce();
    expect(adapter.selectConversationView).not.toHaveBeenCalled();
    expect(adapter.composeBlankSession).not.toHaveBeenCalled();
  });

  it("activates theme, sidebar, view, and composition for a blank session", async () => {
    const adapter = actions({ id: "blank-1", blank: true });
    await expect(activateScienceMode(adapter)).resolves.toEqual({ composed: true, sessionId: "blank-1" });
    expect(adapter.selectTheme).toHaveBeenCalledOnce();
    expect(adapter.selectSidebar).toHaveBeenCalledOnce();
    expect(adapter.selectConversationView).toHaveBeenCalledWith("blank-1");
    expect(adapter.composeBlankSession).toHaveBeenCalledWith("blank-1");
  });

  it("preserves the composition of a session that already has content", async () => {
    const adapter = actions({ id: "existing-1", blank: false });
    await expect(activateScienceMode(adapter)).resolves.toEqual({ composed: false, sessionId: "existing-1" });
    expect(adapter.selectTheme).toHaveBeenCalledOnce();
    expect(adapter.selectSidebar).toHaveBeenCalledOnce();
    expect(adapter.selectConversationView).toHaveBeenCalledWith("existing-1");
    expect(adapter.composeBlankSession).not.toHaveBeenCalled();
  });

  it("shows seven concise module statuses and activates from the wide sidebar", async () => {
    const onActivate = vi.fn(async () => ({ composed: true, sessionId: "blank-1" }));
    render(<ScienceSidebar wide onActivate={onActivate} />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(SCIENCE_ECOSYSTEMS.length);
    for (const module of SCIENCE_ECOSYSTEMS) expect(screen.getByText(module.name)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "启用科学模式" }));
    await waitFor(() => expect(onActivate).toHaveBeenCalledOnce());
    expect(await screen.findByText(/已为当前空白会话选择能力组合/)).toBeTruthy();
  });

  it("keeps a named compact action when the sidebar is narrow", () => {
    render(<ScienceSidebar wide={false} onActivate={vi.fn(async () => ({ composed: false }))} />);
    expect(screen.getByRole("button", { name: "启用 Rosalind 科学模式" })).toBeTruthy();
  });
});
