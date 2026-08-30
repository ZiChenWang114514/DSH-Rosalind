// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationWorkbenchView, Workbench } from "../src/client/components.js";
import { publishConversationNodes } from "../src/client/session-evidence.js";
import { closeShowcase, consumeConversationPrompt, resetResearchProjectFlow, stageConversationPrompt } from "../src/client/state.js";

afterEach(() => {
  closeShowcase();
  resetResearchProjectFlow();
  publishConversationNodes([]);
  cleanup();
});

function openModuleRecord(title: string, moduleName: RegExp, action = "Inspect"): void {
  const newTask = screen.queryByRole("button", { name: "New research task" });
  if (newTask) fireEvent.click(newTask);
  fireEvent.click(screen.getByRole("tab", { name: moduleName }));
  const record = screen.getByText(title).closest("article");
  expect(record).not.toBeNull();
  fireEvent.click(within(record!).getByRole("button", { name: action }));
}

describe("Research project workspace", () => {
  it("renders a project workspace with seven scientific module choices", () => {
    render(<Workbench />);
    expect(screen.getByRole("heading", { name: "Rosalind research workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A new scientific investigation" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(9);
    expect(screen.queryByText("Human RAS protein alignment")).not.toBeInTheDocument();
    expect(screen.getByText("1224 manifest-referenced files · seven scientific areas")).toBeInTheDocument();
  });

  it("shows the project workspace in a blank session without a showcase wall", () => {
    render(<Workbench hero />);
    expect(screen.getByRole("heading", { name: "Rosalind research workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Open / })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New research task" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Workbench view" })).not.toBeInTheDocument();
  });

  it("reveals showcases only inside a selected scientific module", () => {
    render(<Workbench />);
    fireEvent.click(screen.getByRole("button", { name: "New research task" }));
    expect(screen.getAllByRole("tab")).toHaveLength(7);
    expect(screen.getByText("TREM2 microglia publication landscape")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Molecular Structure Viewer/ }));
    expect(screen.queryByText("Human RAS protein alignment")).not.toBeInTheDocument();
    expect(screen.getByText("MDM2-p53 interface analysis")).toBeInTheDocument();
  });

  it("starts the selected project with a natural request and submits it", () => {
    const setDraft = vi.fn();
    const submit = vi.fn();
    render(<Workbench inputActions={{ setDraft, submit }} />);
    openModuleRecord("Human RAS protein alignment", /Biological Sequence/, "Reproduce");
    const detail = screen.getByRole("region", { name: "Human RAS protein alignment" });
    expect(within(detail).getByRole("tab", { name: "Reproduce" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(detail).getByRole("button", { name: "Prepare run" }));
    expect(setDraft).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(setDraft.mock.calls[0]?.[0]).toContain("Human RAS protein alignment");
    expect(setDraft.mock.calls[0]?.[0]).not.toContain("rosalind_showcase_import");
    expect(setDraft.mock.calls[0]?.[0]).not.toContain("adapter");
  });

  it("remembers the last selected mode for each project", () => {
    render(<Workbench />);
    openModuleRecord("Human RAS protein alignment", /Biological Sequence/);
    const detail = screen.getByRole("region", { name: "Human RAS protein alignment" });
    fireEvent.click(within(detail).getByRole("tab", { name: "Reproduce" }));
    fireEvent.click(within(detail).getByRole("button", { name: "Back to scientific modules" }));
    openModuleRecord("Human RAS protein alignment", /Biological Sequence/);
    expect(within(screen.getByRole("region", { name: "Human RAS protein alignment" })).getByRole("tab", { name: "Reproduce" })).toHaveAttribute("aria-selected", "true");
  });

  it("preserves a staged blank-session request for direct submission", () => {
    stageConversationPrompt("Help me inspect this project.", { autoSubmit: true });
    expect(consumeConversationPrompt()).toEqual({ text: "Help me inspect this project.", autoSubmit: true });
  });

  it("keeps the conversation view focused on the current project and next step", async () => {
    const node = {
      kind: "tool-result",
      callId: "rosalind-project-1",
      call: { name: "rosalind_showcase_import", argsRaw: '{"showcase_id":"sequence-ras-alignment","mode":"replay"}' },
      content: [{ type: "text", text: JSON.stringify({ showcase_id: "sequence-ras-alignment", title: "Human RAS protein alignment", mode: "replay", next_action: "Inspect the retained alignment evidence." }) }],
      isError: false,
    };
    render(<ConversationWorkbenchView inputActions={{ setDraft: vi.fn() }} useSession={(() => [node]) as never} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Human RAS protein alignment" })).toBeInTheDocument());
    expect(screen.getByText("Next step")).toBeInTheDocument();
    expect(screen.getByText("Inspect the retained alignment evidence.")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /^Open / })).not.toBeInTheDocument();
  });

  it("maps recorded project identity to a public title without exposing internal identifiers", async () => {
    const node = {
      kind: "tool-result",
      callId: "plan-only-1",
      call: { name: "rosalind_status", argsRaw: '{"run_id":"run-private"}' },
      content: [{ type: "text", text: JSON.stringify({ id: "run-private", showcaseId: "sequence-ras-alignment", state: "running" }) }],
      isError: false,
    };
    render(<ConversationWorkbenchView inputActions={{ setDraft: vi.fn() }} useSession={(() => [node]) as never} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Human RAS protein alignment" })).toBeInTheDocument());
    expect(document.body).not.toHaveTextContent("sequence-ras-alignment");
    expect(document.body).not.toHaveTextContent("rosalind_status");
  });

  it("closes project details with Escape", () => {
    render(<Workbench />);
    openModuleRecord("Provenance-bearing GFP figure", /Molecular Structure Viewer/);
    const detail = screen.getByRole("region", { name: "Provenance-bearing GFP figure" });
    fireEvent.keyDown(detail, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Provenance-bearing GFP figure" })).not.toBeInTheDocument();
  });

  it("renders project details inline without modal semantics", () => {
    render(<Workbench />);
    openModuleRecord("Provenance-bearing GFP figure", /Molecular Structure Viewer/);
    const detail = screen.getByRole("region", { name: "Provenance-bearing GFP figure" });
    expect(detail).not.toHaveAttribute("aria-modal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Back to scientific modules" })).toBeInTheDocument();
  });

  it("shows a browser-safe PNG preview for the GFP showcase", () => {
    render(<Workbench />);
    openModuleRecord("Provenance-bearing GFP figure", /Molecular Structure Viewer/);
    const detail = screen.getByRole("region", { name: "Provenance-bearing GFP figure" });
    expect(detail.querySelector("img.rr-preview")).toHaveAttribute("src", expect.stringMatching(/^data:image\/png;base64,/));
  });

  it("uses roving focus and linked panels for project detail tabs", () => {
    render(<Workbench />);
    openModuleRecord("Human RAS protein alignment", /Biological Sequence/);
    const detail = screen.getByRole("region", { name: "Human RAS protein alignment" });
    const tabs = within(detail).getAllByRole("tab");
    const selected = within(detail).getByRole("tab", { selected: true });
    const selectedIndex = tabs.indexOf(selected);
    const next = tabs[(selectedIndex + 1) % tabs.length]!;

    expect(selected).toHaveAttribute("tabindex", "0");
    expect(next).toHaveAttribute("tabindex", "-1");
    selected.focus();
    fireEvent.keyDown(selected, { key: "ArrowRight" });
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("aria-selected", "true");
    expect(within(detail).getByRole("tabpanel")).toHaveAttribute("aria-labelledby", next.id);
    expect(within(detail).getAllByRole("tabpanel", { hidden: true })).toHaveLength(3);
  });
});
