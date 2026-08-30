import { useSyncExternalStore } from "react";

/**
 * Session evidence bridge.
 *
 * DSH tool slots are pure render functions and the browser client has no
 * client-to-host tool RPC, so the upstream viewer apps cannot query the host
 * directly. The conversation snapshot is the only durable source of real
 * tool results in the browser. This module stores the settled DSH tool
 * results relevant to the upstream NGS and Slide applications, published
 * from the session-scoped conversation view, and answers the applications'
 * backend calls strictly from that recorded evidence. When the session has
 * no evidence, the applications receive honest empty responses.
 */

export interface SessionToolEvidence {
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
  payload: Record<string, unknown>;
  time: number;
}

export interface SlideViewerCommand {
  commandId: string;
  action: string;
  args: Record<string, unknown>;
  stateRevision: number | null;
}

export interface StructureViewerCommand {
  commandId: string;
  action: string;
  args: Record<string, unknown>;
  sceneRevision: number | null;
}

/**
 * The latest Rosalind project information that can be reconstructed from
 * settled tool-result nodes in the current conversation window.
 *
 * A nullable field means that the conversation contains no value for that
 * field. In particular, the projection never turns a tool name into a run
 * state or assumes a provider when the payload does not identify one.
 */
export interface RosalindProjectSummary {
  showcaseId: string | null;
  title: string | null;
  mode: string | null;
  runId: string | null;
  status: string | null;
  providerId: string | null;
  artifactCount: number | null;
  updatedAt: string | null;
  nextAction: string | null;
}

interface EvidenceState {
  ngs: {
    workflows: SessionToolEvidence | null;
    targets: SessionToolEvidence | null;
    runs: SessionToolEvidence | null;
    lineages: SessionToolEvidence | null;
    runDetails: Map<string, SessionToolEvidence>;
    observations: Map<string, SessionToolEvidence>;
  };
  structure: {
    source: SessionToolEvidence | null;
    commands: StructureViewerCommand[];
  };
  slideCommands: SlideViewerCommand[];
  rosalind: RosalindProjectSummary | null;
}

let state: EvidenceState = emptyState();

function emptyState(): EvidenceState {
  return {
    ngs: { workflows: null, targets: null, runs: null, lineages: null, runDetails: new Map(), observations: new Map() },
    structure: { source: null, commands: [] },
    slideCommands: [],
    rosalind: null,
  };
}

const listeners = new Set<() => void>();
let version = 0;

function publish(next: EvidenceState): void {
  state = next;
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshotVersion(): number {
  return version;
}

export function useSessionEvidenceVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshotVersion, getSnapshotVersion);
}

export function useSessionEvidence(): EvidenceState {
  useSessionEvidenceVersion();
  return state;
}

export function currentEvidence(): EvidenceState {
  return state;
}

/** Returns the current-project projection reconstructed from conversation evidence. */
export function useRosalindProjectSummary(): RosalindProjectSummary | null {
  useSessionEvidenceVersion();
  return state.rosalind;
}

function textPayload(node: unknown): { toolName: string; args: Record<string, unknown>; payload: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  if (record.kind !== "tool-result" || record.isError === true) return null;
  const call = record.call as Record<string, unknown> | null | undefined;
  const toolName = typeof call?.name === "string" ? call.name : null;
  if (!toolName) return null;
  let args: Record<string, unknown> = {};
  if (typeof call?.argsRaw === "string") {
    try {
      const parsed = JSON.parse(call.argsRaw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
    } catch {
      args = {};
    }
  }
  const content = Array.isArray(record.content) ? record.content : [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const text = (block as Record<string, unknown>).text;
    if (typeof text !== "string" || !text.trim().startsWith("{")) continue;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { toolName, args, payload: parsed as Record<string, unknown> };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function completed(payload: Record<string, unknown>): boolean {
  return payload.status === "completed" || (payload.ok === true && payload.status === undefined);
}

function stripEnvelope(payload: Record<string, unknown>): Record<string, unknown> {
  const { serviceId: _serviceId, operation: _operation, status: _status, ...body } = payload;
  return body;
}

const ROSALIND_TOOLS = new Set([
  "rosalind_showcase_import",
  "rosalind_plan",
  "rosalind_approve",
  "rosalind_run",
  "rosalind_status",
  "rosalind_cancel",
]);

function recordValue(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function stringValue(record: Record<string, unknown>, ...keys: string[]): string | null {
  const value = recordValue(record, ...keys);
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(record: Record<string, unknown>, ...keys: string[]): number | null {
  const value = recordValue(record, ...keys);
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function nestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function artifactCount(payload: Record<string, unknown>): number | null {
  const direct = numberValue(payload, "artifactCount", "artifact_count");
  if (direct !== null) return direct;
  for (const key of ["artifacts", "caseIndex", "case_index"]) {
    if (Array.isArray(payload[key])) return payload[key].length;
  }
  return null;
}

function providerId(payload: Record<string, unknown>, args: Record<string, unknown>): string | null {
  const plan = nestedRecord(payload, "plan");
  const providerIds = plan?.providerIds ?? plan?.provider_ids ?? payload.providerIds ?? payload.provider_ids;
  const fromPlan = Array.isArray(providerIds) && typeof providerIds[0] === "string" ? providerIds[0] : null;
  const steps = plan && Array.isArray(plan.steps) ? plan.steps : [];
  const firstStep = steps[0] && typeof steps[0] === "object" ? steps[0] as Record<string, unknown> : null;
  return stringValue(payload, "providerId", "provider_id")
    ?? (fromPlan && fromPlan.trim() ? fromPlan : null)
    ?? stringValue(firstStep ?? {}, "providerId", "provider_id")
    ?? stringValue(args, "provider_id", "providerId");
}

function nextActionFor(status: string | null): string | null {
  if (status === "draft" || status === "awaiting_confirmation") return "Review the plan and confirm its recorded requirements.";
  if (status === "queued") return "Start the approved run.";
  if (status === "running") return "Review the latest activity and generated artifacts.";
  return null;
}

function statusValue(toolName: string, payload: Record<string, unknown>): string | null {
  if (toolName === "rosalind_showcase_import") return null;
  const state = stringValue(payload, "state");
  if (state !== null) return state;
  const status = stringValue(payload, "status");
  return status;
}

function rosalindSummaryFromEvidence(
  toolName: string,
  args: Record<string, unknown>,
  payload: Record<string, unknown>,
  previous: RosalindProjectSummary | null,
): RosalindProjectSummary {
  const plan = nestedRecord(payload, "plan");
  const showcase = nestedRecord(payload, "showcase");
  const showcaseId = stringValue(payload, "showcaseId", "showcase_id")
    ?? stringValue(plan ?? {}, "showcaseId", "showcase_id")
    ?? stringValue(args, "showcase_id", "showcaseId");
  const importMode = stringValue(payload, "suggestedMode", "suggested_mode");
  const mode = stringValue(payload, "mode") ?? importMode ?? stringValue(args, "mode");
  const runId = stringValue(payload, "runId", "run_id", "id") ?? stringValue(args, "run_id", "runId");
  const status = statusValue(toolName, payload);
  const explicitNextAction = stringValue(payload, "nextAction", "next_action");
  const count = artifactCount(payload);
  const title = stringValue(payload, "title", "showcaseTitle", "showcase_title") ?? stringValue(showcase ?? {}, "title");
  const updatedAt = stringValue(payload, "updatedAt", "updated_at");
  const hasIdentity = showcaseId !== null || runId !== null || toolName === "rosalind_showcase_import";

  // A later result for the same project/run enriches earlier evidence. If a
  // result is incomplete, retaining an already recorded value is safer than
  // manufacturing a replacement from the tool name.
  if (!hasIdentity) {
    return previous ?? emptyRosalindSummary();
  }
  const projectChanged = showcaseId !== null && previous !== null && previous.showcaseId !== null && showcaseId !== previous.showcaseId;
  const runChanged = runId !== null && previous !== null && previous.runId !== null && runId !== previous.runId;
  const startsNewProjectContext = toolName === "rosalind_showcase_import";
  const base = projectChanged || startsNewProjectContext
    ? emptyRosalindSummary()
    : runChanged
      ? (showcaseId === null
        ? emptyRosalindSummary()
        : { ...(previous ?? emptyRosalindSummary()), mode: null, runId: null, status: null, providerId: null, artifactCount: null, updatedAt: null, nextAction: null })
      : previous ?? emptyRosalindSummary();
  const resolvedStatus = status ?? base.status;
  return {
    showcaseId: showcaseId ?? base.showcaseId,
    title: title ?? base.title,
    mode: mode ?? (plan ? stringValue(plan, "mode") : null) ?? base.mode,
    runId: runId ?? base.runId,
    status: resolvedStatus,
    providerId: providerId(payload, args) ?? base.providerId,
    artifactCount: count ?? base.artifactCount,
    updatedAt: updatedAt ?? base.updatedAt,
    nextAction: explicitNextAction ?? (status !== null ? nextActionFor(status) : base.nextAction),
  };
}

function emptyRosalindSummary(): RosalindProjectSummary {
  return { showcaseId: null, title: null, mode: null, runId: null, status: null, providerId: null, artifactCount: null, updatedAt: null, nextAction: null };
}

function fingerprint(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  if (record.kind !== "tool-result") return null;
  const call = record.call as Record<string, unknown> | null | undefined;
  return typeof call?.name === "string" ? String(record.callId ?? "") : null;
}

/**
 * Rebuild the evidence store from a conversation snapshot's node list.
 * Publication is skipped when the relevant tool-result set is unchanged.
 */
export function publishConversationNodes(nodes: readonly unknown[]): void {
  const marks: string[] = [];
  const ngs = { workflows: null, targets: null, runs: null, lineages: null, runDetails: new Map<string, SessionToolEvidence>(), observations: new Map<string, SessionToolEvidence>() } as EvidenceState["ngs"];
  const slideCommands: SlideViewerCommand[] = [];
  const structure: EvidenceState["structure"] = { source: null, commands: [] };
  let rosalind: RosalindProjectSummary | null = null;
  const seenNgs = new Set<string>();
  for (const node of nodes) {
    const mark = fingerprint(node);
    if (mark != null) marks.push(mark);
    const parsed = textPayload(node);
    if (!parsed) continue;
    const { toolName, args, payload } = parsed;
    const time = typeof (node as Record<string, unknown>).time === "number" ? (node as Record<string, unknown>).time as number : 0;
    const evidence: SessionToolEvidence = { callId: String((node as Record<string, unknown>).callId ?? ""), toolName, args, payload, time };
    if (ROSALIND_TOOLS.has(toolName)) {
      rosalind = rosalindSummaryFromEvidence(toolName, args, payload, rosalind);
    } else if (toolName.startsWith("ngs_")) {
      const operation = typeof payload.operation === "string" ? payload.operation : toolName.replace(/^ngs_/, "");
      if (!completed(payload) || seenNgs.has(operation)) continue;
      seenNgs.add(operation);
      if (operation === "list_workflows") ngs.workflows = evidence;
      else if (operation === "list_compute_targets") ngs.targets = evidence;
      else if (operation === "list_ngs_runs") ngs.runs = evidence;
      else if (operation === "list_ngs_run_lineages") ngs.lineages = evidence;
      else if (operation === "get_ngs_run") {
        const id = typeof payload.registry_run_id === "string" ? payload.registry_run_id : typeof args.registry_run_id === "string" ? args.registry_run_id : null;
        if (id) ngs.runDetails.set(id, evidence);
      } else if (operation === "observe_ngs_run") {
        const id = typeof payload.registry_run_id === "string" ? payload.registry_run_id : typeof args.registry_run_id === "string" ? args.registry_run_id : null;
        if (id) ngs.observations.set(id, evidence);
      }
    } else if ((toolName === "structure_open_from_chat" || toolName === "structure_get_state") && completed(payload)) {
      if (Array.isArray(payload.atoms) && payload.atoms.length > 0) structure.source = evidence;
    } else if (toolName === "structure_control_viewer" && completed(payload)) {
      const action = typeof args.action === "string" ? args.action : typeof payload.action === "string" ? payload.action : null;
      if (action) {
        structure.commands.push({
          commandId: evidence.callId || `structure-command-${structure.commands.length + 1}`,
          action,
          args,
          sceneRevision: typeof payload.sceneRevision === "number" ? payload.sceneRevision : typeof payload.appliedRevision === "number" ? payload.appliedRevision : null,
        });
      }
    } else if (toolName === "slide_control_viewer" && completed(payload)) {
      const action = typeof args.action === "string" ? args.action : typeof payload.action === "string" ? payload.action : null;
      if (action) {
        slideCommands.push({
          commandId: evidence.callId || `slide-command-${slideCommands.length + 1}`,
          action,
          args,
          stateRevision: typeof payload.stateRevision === "number" ? payload.stateRevision : null,
        });
      }
    }
  }
  const next: EvidenceState = { ngs, structure, slideCommands, rosalind };
  const signature = JSON.stringify([
    marks,
    next.ngs.workflows?.callId ?? null,
    next.ngs.targets?.callId ?? null,
    next.ngs.runs?.callId ?? null,
    next.ngs.lineages?.callId ?? null,
    [...next.ngs.runDetails.keys()],
    [...next.ngs.observations.keys()],
    next.structure.source?.callId ?? null,
    next.structure.commands.map((command) => [command.commandId, command.action, command.args]),
    next.slideCommands.map((command) => [command.action, command.args]),
    next.rosalind,
  ]);
  if (signature === lastSignature) return;
  lastSignature = signature;
  publish(next);
}

let lastSignature: string | null = null;

/** Seeds evidence from a host-provided global (used by the release preview). */
export function seedEvidenceFromGlobal(): void {
  const seed = (globalThis as Record<string, unknown>).__DSH_ROSALIND_SESSION_EVIDENCE__ as {
    ngs?: { workflows?: unknown; targets?: unknown; runs?: unknown; lineages?: unknown; runDetails?: Array<Record<string, unknown>>; observations?: Array<Record<string, unknown>> };
  } | undefined;
  if (!seed?.ngs) return;
  const asRecord = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null);
  const item = (value: unknown): SessionToolEvidence | null => {
    const record = asRecord(value);
    return record ? { callId: String(record.callId ?? "seed"), toolName: String(record.toolName ?? "seed"), args: {}, payload: record, time: 0 } : null;
  };
  const ngs = emptyState().ngs;
  ngs.workflows = item(seed.ngs.workflows);
  ngs.targets = item(seed.ngs.targets);
  ngs.runs = item(seed.ngs.runs);
  ngs.lineages = item(seed.ngs.lineages);
  for (const detail of seed.ngs.runDetails ?? []) {
    const record = asRecord(detail);
    const id = typeof record?.registry_run_id === "string" ? record.registry_run_id : null;
    const evidence = item(detail);
    if (id && evidence) ngs.runDetails.set(id, evidence);
  }
  for (const observation of seed.ngs.observations ?? []) {
    const record = asRecord(observation);
    const id = typeof record?.registry_run_id === "string" ? record.registry_run_id : null;
    const evidence = item(observation);
    if (id && evidence) ngs.observations.set(id, evidence);
  }
  publish({ ngs, structure: { source: null, commands: [] }, slideCommands: [], rosalind: null });
}
