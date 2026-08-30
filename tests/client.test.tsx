// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationWorkbenchView, ShowcaseDetailOverlay, Workbench } from "../src/client/components.js";
import { publishConversationNodes } from "../src/client/session-evidence.js";
import { closeShowcase, consumeConversationPrompt, stageConversationPrompt } from "../src/client/state.js";

afterEach(() => {
  closeShowcase();
  publishConversationNodes([]);
  cleanup();
});

describe("Workbench catalogue", () => {
  it("renders all 23 projects and all seven category choices", () => {
    render(<Workbench />);
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(23);
    const category = screen.getByRole("combobox", { name: "Filter by scientific area" });
    expect(within(category).getAllByRole("option")).toHaveLength(8);
    expect(screen.getByText("151 manifest-referenced files · seven scientific areas")).toBeInTheDocument();
  });

  it("shows a compact project search and task launch area in a blank session", () => {
    render(<Workbench hero />);
    expect(screen.getByRole("heading", { name: "Start a scientific task" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(23);
    expect(screen.getByPlaceholderText("Search a scientific question or method")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Workbench view" })).not.toBeInTheDocument();
  });

  it("searches scientific content and filters by category", () => {
    render(<Workbench />);
    fireEvent.change(screen.getByPlaceholderText("Search a scientific question or method"), { target: { value: "nanobody" } });
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Open.*PD-L1/i })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search a scientific question or method"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by scientific area" }), { target: { value: "structure" } });
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(3);
  });

  it("starts the selected project with a natural request and submits it", () => {
    const setDraft = vi.fn();
    const submit = vi.fn();
    render(<><Workbench inputActions={{ setDraft, submit }} /><ShowcaseDetailOverlay /></>);
    fireEvent.click(screen.getByRole("button", { name: "Open Human RAS protein alignment" }));
    const dialog = screen.getByRole("dialog", { name: "Human RAS protein alignment" });
    expect(within(dialog).getByText("Scientific question")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Reproduce" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Prepare run" }));
    expect(setDraft).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(setDraft.mock.calls[0]?.[0]).toContain("Human RAS protein alignment");
    expect(setDraft.mock.calls[0]?.[0]).not.toContain("rosalind_showcase_import");
    expect(setDraft.mock.calls[0]?.[0]).not.toContain("adapter");
  });

  it("remembers the last selected mode for each project", () => {
    render(<><Workbench /><ShowcaseDetailOverlay /></>);
    fireEvent.click(screen.getByRole("button", { name: "Open Human RAS protein alignment" }));
    const dialog = screen.getByRole("dialog", { name: "Human RAS protein alignment" });
    fireEvent.click(within(dialog).getByRole("tab", { name: "Reproduce" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close project details" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Human RAS protein alignment" }));
    expect(within(screen.getByRole("dialog")).getByRole("tab", { name: "Reproduce" })).toHaveAttribute("aria-selected", "true");
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
    render(<><Workbench /><ShowcaseDetailOverlay /></>);
    fireEvent.click(screen.getByRole("button", { name: "Open Provenance-bearing GFP figure" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps modal focus inside the project details", () => {
    render(<><Workbench /><ShowcaseDetailOverlay /></>);
    fireEvent.click(screen.getByRole("button", { name: "Open Provenance-bearing GFP figure" }));
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Close project details" });
    const action = within(dialog).getByRole("button", { name: "Start lesson" });

    action.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(action).toHaveFocus();
  });

  it("uses roving focus and linked panels for project detail tabs", () => {
    render(<><Workbench /><ShowcaseDetailOverlay /></>);
    fireEvent.click(screen.getByRole("button", { name: "Open Human RAS protein alignment" }));
    const dialog = screen.getByRole("dialog");
    const tabs = within(dialog).getAllByRole("tab");
    const selected = within(dialog).getByRole("tab", { selected: true });
    const selectedIndex = tabs.indexOf(selected);
    const next = tabs[(selectedIndex + 1) % tabs.length]!;

    expect(selected).toHaveAttribute("tabindex", "0");
    expect(next).toHaveAttribute("tabindex", "-1");
    selected.focus();
    fireEvent.keyDown(selected, { key: "ArrowRight" });
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByRole("tabpanel")).toHaveAttribute("aria-labelledby", next.id);
  });
});
