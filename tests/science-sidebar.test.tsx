// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScienceSidebarBrowser, type ScienceSidebarBrowserProps } from "../src/client/sidebar.js";

afterEach(cleanup);

const sessionState = {
  ids: ["session-1"],
  byId: {
    "session-1": { id: "session-1", displayTitle: "RAS alignment review", running: true, blank: false, updatedAt: 1 },
  },
  current: "session-1",
  phase: "ready",
  subagentsByParent: {},
  jobsBySession: {},
  currentAddress: undefined,
};

const workspaceState = {
  items: [{ workspaceId: "workspace-1", title: "Protein studies", path: "D:/science", createdAt: "2026-08-30T00:00:00Z", sessionIds: ["session-1"] }],
  archivedSessionIds: [],
  state: "idle",
  phase: "ready",
  error: null,
  baselinesReady: true,
  recentWorkspaceId: "workspace-1",
};

function props(overrides: Partial<ScienceSidebarBrowserProps> = {}): ScienceSidebarBrowserProps {
  return {
    wide: true,
    expandSidebar: vi.fn(),
    useSessions: (selector: (state: typeof sessionState) => unknown) => selector(sessionState),
    useWorkspaces: (selector: (state: typeof workspaceState) => unknown) => selector(workspaceState),
    openSession: vi.fn(),
    startSession: vi.fn(),
    ...overrides,
  } as unknown as ScienceSidebarBrowserProps;
}

describe("ScienceSidebarBrowser", () => {
  it("keeps workspace sessions as the initial browser and uses DSH actions", () => {
    const input = props();
    render(<ScienceSidebarBrowser {...input} />);
    expect(screen.getByRole("tab", { name: "Sessions" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Protein studies")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "RAS alignment review" }));
    expect(input.openSession).toHaveBeenCalledWith("session-1");
    fireEvent.click(screen.getByRole("button", { name: "New session in Protein studies" }));
    expect(input.startSession).toHaveBeenCalledWith("workspace-1");
  });

  it("shows seven modules with version, contract counts, settings, and questions", () => {
    const input = props();
    render(<ScienceSidebarBrowser {...input} />);
    fireEvent.click(screen.getByRole("tab", { name: "Science" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getAllByText("v0.1.5 · Declared")).toHaveLength(2);
    expect(screen.getByLabelText("Life Sciences Literature details")).toHaveTextContent("Tools0Skills3Showcases3");
    expect(screen.getByText("DSH Settings → Rosalind")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New research task" }));
    expect(input.startSession).toHaveBeenCalledTimes(1);
  });

  it("supports roving tab focus and expands from the compact rail", () => {
    const input = props();
    const { rerender } = render(<ScienceSidebarBrowser {...input} />);
    const sessions = screen.getByRole("tab", { name: "Sessions" });
    sessions.focus();
    fireEvent.keyDown(sessions, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Science" })).toHaveFocus();
    rerender(<ScienceSidebarBrowser {...props({ wide: false, expandSidebar: input.expandSidebar })} />);
    fireEvent.click(screen.getByRole("button", { name: "Science" }));
    expect(input.expandSidebar).toHaveBeenCalledTimes(1);
  });
});
