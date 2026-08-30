// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationWorkbenchView, HeroWorkspacePicker, Workbench } from "../src/client/components.js";
import { buildResearchTaskPrompt, deriveResearchSessionRecord, setResearchProjectHostAdapter } from "../src/client/project-flow.js";
import { resetResearchProjectFlow } from "../src/client/state.js";

const workspace = { id: "workspace-a", title: "Native workspace A", path: "D:/science/a", sessionIds: [] as string[] };
let disposeHostAdapter: () => void = () => undefined;

function beginTask(): void {
  fireEvent.click(screen.getByRole("button", { name: "New research task" }));
  fireEvent.change(screen.getByLabelText("DSH workspace"), { target: { value: workspace.id } });
  fireEvent.change(screen.getByLabelText("Research question"), { target: { value: "Which variants change protein stability?" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Sequences/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Structures/ }));
  fireEvent.change(screen.getByLabelText("Data sources and local files"), { target: { value: "variants.csv\nreference.fasta" } });
  fireEvent.click(screen.getByRole("button", { name: "Review research task" }));
}

afterEach(() => {
  resetResearchProjectFlow();
  disposeHostAdapter();
  disposeHostAdapter = () => undefined;
  cleanup();
});

describe("research project flow", () => {
  it("shows actionable validation feedback and returns to a visible project overview", () => {
    render(<Workbench hero projectFlow={{ workspaces: [], workspaceReady: true, blankSessionIds: new Set() }} />);
    fireEvent.click(screen.getByRole("button", { name: "New research task" }));
    expect(screen.getByText("Add a native DSH workspace from the sidebar before creating a research task.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review research task" }));
    const validation = screen.getByText(/Choose a DSH workspace\. Enter a research question/);
    expect(validation).toHaveTextContent("Select at least one scientific module");
    fireEvent.click(screen.getByRole("button", { name: "Project overview" }));
    expect(screen.getByRole("heading", { name: "A new scientific investigation" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Describe the investigation" })).not.toBeInTheDocument();
  });

  it("selects a native workspace, confirms the task, creates a blank session, applies modules, submits, and opens Science", async () => {
    const adapter = {
      createOrReuseBlankSession: vi.fn().mockResolvedValue({ sessionId: "session-blank", reused: false }),
      applyScienceCapabilities: vi.fn().mockResolvedValue(undefined),
      submitResearchPrompt: vi.fn().mockResolvedValue(undefined),
      showScienceView: vi.fn(),
    };
    disposeHostAdapter = setResearchProjectHostAdapter(adapter);
    const workspaces = { items: [{ workspaceId: workspace.id, title: workspace.title, path: workspace.path, sessionIds: [] }], archivedSessionIds: [], state: "idle", phase: "ready", error: null, baselinesReady: true, recentWorkspaceId: workspace.id };
    const sessions = { ids: [], byId: {}, current: undefined, phase: "ready", subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined };
    render(<HeroWorkspacePicker
      open
      selectedId={workspace.id as never}
      onPick={vi.fn()}
      onClose={vi.fn()}
      useSessions={((selector: (snapshot: typeof sessions) => unknown) => selector(sessions)) as never}
      useWorkspaces={((selector: (snapshot: typeof workspaces) => unknown) => selector(workspaces)) as never}
    />);
    beginTask();
    expect(screen.getByRole("heading", { name: "Review before creating the session" })).toBeInTheDocument();
    expect(screen.getByText("Which variants change protein stability?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create research task" }));

    await waitFor(() => expect(adapter.submitResearchPrompt).toHaveBeenCalledTimes(1));
    expect(adapter.createOrReuseBlankSession).toHaveBeenCalledWith(workspace.id);
    expect(adapter.applyScienceCapabilities).toHaveBeenCalledWith("session-blank", expect.arrayContaining(["sequence", "structure"]));
    const prompt = adapter.submitResearchPrompt.mock.calls[0]?.[1] as string;
    expect(prompt).toContain("Which variants change protein stability?");
    expect(prompt).toContain("variants.csv");
    expect(adapter.showScienceView).toHaveBeenCalledWith("session-blank");
    expect(screen.getByRole("status")).toHaveTextContent("Research task submitted");
  });

  it("submits directly when the current session is already blank in the selected workspace", async () => {
    const setDraft = vi.fn();
    const submit = vi.fn();
    const onPickWorkspace = vi.fn();
    const blankWorkspace = { ...workspace, sessionIds: ["session-blank"] };
    render(<Workbench inputActions={{ setDraft, submit }} projectFlow={{
      workspaces: [blankWorkspace], workspaceReady: true, currentSessionId: "session-blank", currentSessionBlank: true,
      currentWorkspaceId: workspace.id, blankSessionIds: new Set(["session-blank"]), onPickWorkspace,
    }} />);
    beginTask();
    fireEvent.click(screen.getByRole("button", { name: "Create research task" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(onPickWorkspace).toHaveBeenCalledWith(workspace.id);
    expect(setDraft.mock.calls[0]?.[0]).toContain("session-blank");
  });

  it("keeps a populated session unchanged and reports that a blank session must finish opening", async () => {
    const setDraft = vi.fn();
    const submit = vi.fn();
    const onPickWorkspace = vi.fn();
    render(<Workbench session inputActions={{ setDraft, submit }} projectFlow={{
      workspaces: [{ ...workspace, sessionIds: ["session-existing"] }], workspaceReady: true,
      currentSessionId: "session-existing", currentSessionBlank: false, currentWorkspaceId: workspace.id,
      blankSessionIds: new Set(), onPickWorkspace,
    }} />);
    beginTask();
    fireEvent.click(screen.getByRole("button", { name: "Create research task" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("opening a blank session"));
    expect(onPickWorkspace).toHaveBeenCalledWith(workspace.id);
    expect(setDraft).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("reconstructs the project overview from the research message and later tool results", async () => {
    const prompt = buildResearchTaskPrompt({ workspaceId: workspace.id, question: "Map resistance mutations", moduleIds: ["sequence", "structure"], sources: "mutations.csv", }, "session-project", "2026-08-31T01:00:00.000Z");
    const nodes = [
      { kind: "user", seq: 1, time: 1, source: null, content: [{ type: "text", text: prompt }] },
      { kind: "tool-result", seq: 2, time: 2, callId: "tool-1", call: { name: "sequence_align", argsRaw: "{}" }, content: [{ type: "text", text: JSON.stringify({ status: "completed", summary: "Alignment completed" }) }], isError: false },
    ];
    const sessions = { ids: ["session-project"], byId: { "session-project": { id: "session-project", displayTitle: "Project", running: false, blank: false, updatedAt: 2 } }, current: "session-project", phase: "ready", subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined };
    const workspaces = { items: [{ workspaceId: workspace.id, title: workspace.title, path: workspace.path, sessionIds: ["session-project"] }], archivedSessionIds: [], state: "idle", phase: "ready", error: null, baselinesReady: true, recentWorkspaceId: workspace.id };
    render(<ConversationWorkbenchView
      inputActions={{ setDraft: vi.fn() }}
      sessionId={"session-project" as never}
      useSession={((selector: (snapshot: { nodes: typeof nodes }) => unknown) => selector({ nodes })) as never}
      useSessions={((selector: (snapshot: typeof sessions) => unknown) => selector(sessions)) as never}
      useWorkspaces={((selector: (snapshot: typeof workspaces) => unknown) => selector(workspaces)) as never}
    />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Map resistance mutations" })).toBeInTheDocument());
    expect(screen.getByText("mutations.csv")).toBeInTheDocument();
    expect(screen.getAllByText(/Alignment completed/).length).toBeGreaterThan(0);
    expect(screen.getByText("Review limitations, provenance, citations, and any unanswered part of the research question.")).toBeInTheDocument();
  });

  it("keeps session identity and unfinished work in the message-derived record", () => {
    const prompt = buildResearchTaskPrompt({ workspaceId: workspace.id, question: "Inspect a cohort", moduleIds: ["ngs"], sources: "reads/*.fastq.gz" }, "session-7", "2026-08-31T02:00:00.000Z");
    const record = deriveResearchSessionRecord([{ kind: "user", seq: 1, time: 1, source: null, content: [{ type: "text", text: prompt }] }]);
    expect(record).toMatchObject({ workspaceId: workspace.id, sessionId: "session-7", question: "Inspect a cohort", moduleIds: ["ngs"], stage: "submitted", toolResults: [] });
    expect(record?.unfinishedItems.length).toBeGreaterThan(0);
  });
});
