// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  currentEvidence,
  publishConversationNodes,
  setWorkbenchModuleAvailability,
  useRosalindProjectSummary,
  useWorkbenchDataFlow,
} from "../src/client/session-evidence.js";

function toolResult(
  callId: string,
  toolName: string,
  args: Record<string, unknown>,
  payload: Record<string, unknown>,
  isError = false,
): Record<string, unknown> {
  return {
    kind: "tool-result",
    seq: Number(callId.replace(/\D/g, "")) || 1,
    time: 1,
    callId,
    call: { name: toolName, argsRaw: JSON.stringify(args) },
    content: [{ type: "text", text: JSON.stringify(payload) }],
    isError,
  };
}

afterEach(() => {
  setWorkbenchModuleAvailability("ngs", "unknown");
  setWorkbenchModuleAvailability("rosalind", "unknown");
  publishConversationNodes([]);
});

describe("Rosalind project session evidence", () => {
  it("projects files, runs, results, citations, viewer summaries, and module availability from recorded results", () => {
    publishConversationNodes([
      toolResult("call-1", "rosalind_showcase_import", { showcase_id: "case-a" }, {
        showcaseId: "case-a", title: "Evidence project", suggestedMode: "replay",
        caseIndex: [{ role: "input", path: "inputs/example.fasta" }, { role: "output", path: "outputs/result.json" }],
        sources: ["PMID:12345"],
      }),
      toolResult("call-2", "ngs_list_ngs_runs", {}, {
        status: "completed", runs: [{ registry_run_id: "run-1", workflow_id: "wf-1", state: "completed" }],
      }),
      toolResult("call-3", "sequence_open_from_chat", {}, {
        status: "completed", viewer: "alignment", viewerSessionId: "sequence-1", result: { rows: 3 },
      }),
      toolResult("call-4", "structure_get_state", {}, {
        status: "completed", viewerSessionId: "structure-1", sceneRevision: 4,
      }),
      toolResult("call-5", "slide_get_viewer_state", {}, {
        status: "completed", viewerSessionId: "slide-1", stateRevision: 7,
      }),
    ]);

    const flow = currentEvidence().workbench;
    expect(flow.files.map((item) => item.label)).toEqual(["inputs/example.fasta", "outputs/result.json"]);
    expect(flow.activity).toContainEqual(expect.objectContaining({ label: "run-1", detail: "wf-1", status: "completed" }));
    expect(flow.sources).toContainEqual(expect.objectContaining({ label: "PMID:12345" }));
    expect(flow.viewers).toMatchObject({
      sequence: { status: "observed", sessionId: "sequence-1", detail: "alignment" },
      structure: { status: "observed", sessionId: "structure-1", detail: "revision 4" },
      slide: { status: "observed", sessionId: "slide-1", detail: "revision 7" },
    });
    expect(flow.modules).toEqual({ ngs: "available", rosalind: "available" });

    const { result } = renderHook(() => useWorkbenchDataFlow());
    expect(result.current.files).toHaveLength(2);
  });

  it("keeps historical evidence when the NGS client module is disabled and re-enabled", () => {
    publishConversationNodes([toolResult("call-1", "ngs_get_ngs_run", { registry_run_id: "run-1" }, {
      status: "completed", registry_run_id: "run-1", state: "completed", summary_path: "results/summary.md",
    })]);
    setWorkbenchModuleAvailability("ngs", "disabled");
    expect(currentEvidence().workbench.modules.ngs).toBe("disabled");
    expect(currentEvidence().workbench.files).toContainEqual(expect.objectContaining({ label: "results/summary.md" }));
    expect(currentEvidence().workbench.activity).toContainEqual(expect.objectContaining({ label: "run-1" }));

    setWorkbenchModuleAvailability("ngs", "available");
    expect(currentEvidence().workbench.modules.ngs).toBe("available");
    expect(currentEvidence().workbench.files).toHaveLength(1);
  });

  it("reconstructs a compact current-project summary from settled lifecycle results", () => {
    publishConversationNodes([
      toolResult("call-1", "rosalind_showcase_import", { showcase_id: "case-a", mode: "reproduce" }, {
        showcaseId: "case-a",
        title: "Example project",
        suggestedMode: "reproduce",
        caseIndex: [{ role: "readme" }, { role: "output" }],
      }),
      toolResult("call-2", "rosalind_plan", { showcase_id: "case-a", mode: "reproduce", provider_id: "local" }, {
        id: "run-a",
        showcaseId: "case-a",
        mode: "reproduce",
        state: "awaiting_confirmation",
        updatedAt: "2026-08-30T01:00:00.000Z",
        plan: { providerIds: ["local"] },
        artifacts: [],
      }),
      toolResult("call-3", "rosalind_approve", { run_id: "run-a", acknowledgements: [] }, {
        id: "run-a",
        showcaseId: "case-a",
        state: "queued",
        updatedAt: "2026-08-30T01:01:00.000Z",
        plan: { providerIds: ["local"] },
        artifacts: [],
      }),
      toolResult("call-4", "rosalind_run", { run_id: "run-a" }, {
        id: "run-a",
        showcaseId: "case-a",
        state: "completed",
        updatedAt: "2026-08-30T01:02:00.000Z",
        artifacts: [{ id: "result" }, { id: "validation" }],
        plan: { providerIds: ["local"] },
      }),
    ]);

    expect(currentEvidence().rosalind).toEqual({
      showcaseId: "case-a",
      title: "Example project",
      mode: "reproduce",
      runId: "run-a",
      status: "completed",
      providerId: "local",
      artifactCount: 2,
      updatedAt: "2026-08-30T01:02:00.000Z",
      nextAction: null,
    });
  });

  it("keeps incomplete payloads honest and recovers after a node refresh", () => {
    const { result } = renderHook(() => useRosalindProjectSummary());
    expect(result.current).toBeNull();

    act(() => publishConversationNodes([
      toolResult("call-1", "rosalind_status", { run_id: "run-unknown" }, {}),
      toolResult("call-2", "rosalind_cancel", { run_id: "run-failed" }, {}, true),
    ]));
    expect(result.current).toEqual({
      showcaseId: null,
      title: null,
      mode: null,
      runId: "run-unknown",
      status: null,
      providerId: null,
      artifactCount: null,
      updatedAt: null,
      nextAction: null,
    });

    act(() => publishConversationNodes([toolResult("call-3", "rosalind_showcase_import", { showcase_id: "case-b", mode: "lesson" }, {
      showcaseId: "case-b",
      title: "Recovered project",
      suggestedMode: "lesson",
    })]));
    expect(result.current).toMatchObject({ showcaseId: "case-b", title: "Recovered project", mode: "lesson" });
  });

  it("derives only actions supported by a recorded run state", () => {
    publishConversationNodes([toolResult("call-1", "rosalind_plan", { showcase_id: "case-a", mode: "replay" }, {
      id: "run-a", showcaseId: "case-a", state: "awaiting_confirmation",
    })]);
    expect(currentEvidence().rosalind?.nextAction).toBe("Review the plan and confirm its recorded requirements.");

    publishConversationNodes([toolResult("call-2", "rosalind_status", { run_id: "run-a" }, {
      id: "run-a", showcaseId: "case-a", state: "running",
    })]);
    expect(currentEvidence().rosalind?.nextAction).toBe("Review the latest activity and generated artifacts.");
  });

  it("clears run-specific values when the same project starts a different run", () => {
    publishConversationNodes([
      toolResult("call-1", "rosalind_plan", { showcase_id: "case-a", mode: "reproduce", provider_id: "local" }, {
        id: "run-a",
        showcaseId: "case-a",
        title: "Example project",
        mode: "reproduce",
        state: "running",
        plan: { providerIds: ["local"] },
      }),
      toolResult("call-2", "rosalind_status", { run_id: "run-b" }, {
        id: "run-b",
        showcaseId: "case-a",
        state: "queued",
      }),
    ]);

    expect(currentEvidence().rosalind).toEqual({
      showcaseId: "case-a",
      title: "Example project",
      mode: null,
      runId: "run-b",
      status: "queued",
      providerId: null,
      artifactCount: null,
      updatedAt: null,
      nextAction: "Start the approved run.",
    });
  });
});
