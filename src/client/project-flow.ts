import type { ConversationSnapshot } from "@deepseek-ai/dsh-client-runtime/client";

import { SHOWCASE_CATEGORIES } from "../shared/categories.js";

export interface ResearchTaskDraft {
  workspaceId: string;
  question: string;
  moduleIds: string[];
  sources: string;
}

export interface ResearchToolResult {
  callId: string;
  toolName: string;
  status: string;
  summary: string | null;
  time: number;
}

export interface ResearchSessionRecord {
  workspaceId: string;
  sessionId: string;
  question: string;
  moduleIds: string[];
  sources: string;
  createdAt: string;
  stage: "submitted" | "analysis" | "review" | "needs-attention";
  toolResults: ResearchToolResult[];
  unfinishedItems: string[];
}

export interface BlankSessionResult {
  sessionId: string;
  reused: boolean;
}

/**
 * Temporary host-facing adapter until DSH exposes a workspaceSidebar project
 * action. The host implementation must delegate to workspaces.connectWorkspace,
 * keep non-blank sessions unchanged, switch only blank sessions to the
 * Rosalind Science capability composition, submit through the session input
 * facade, and select the Science conversation view.
 */
export interface ResearchProjectHostAdapter {
  createOrReuseBlankSession(workspaceId: string): Promise<BlankSessionResult>;
  applyScienceCapabilities(sessionId: string, moduleIds: readonly string[]): Promise<void>;
  submitResearchPrompt(sessionId: string, prompt: string): Promise<void>;
  showScienceView(sessionId: string): void;
}

let hostAdapter: ResearchProjectHostAdapter | null = null;

export function setResearchProjectHostAdapter(adapter: ResearchProjectHostAdapter): () => void {
  hostAdapter = adapter;
  return () => {
    if (hostAdapter === adapter) hostAdapter = null;
  };
}

export function getResearchProjectHostAdapter(): ResearchProjectHostAdapter | null {
  return hostAdapter;
}

export const SCIENCE_MODULE_OPTIONS = SHOWCASE_CATEGORIES.map((category) => ({
  id: category.id,
  label: category.label,
  description: category.description,
}));

function normaliseLines(value: string): string {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join("\n");
}

function moduleLabel(id: string): string {
  return SCIENCE_MODULE_OPTIONS.find((module) => module.id === id)?.label ?? id;
}

export function validateResearchTaskDraft(draft: ResearchTaskDraft): string[] {
  const errors: string[] = [];
  if (!draft.workspaceId.trim()) errors.push("Choose a DSH workspace.");
  if (!draft.question.trim()) errors.push("Enter a research question.");
  if (draft.moduleIds.length === 0) errors.push("Select at least one scientific module.");
  if (!draft.sources.trim()) errors.push("Describe the data source or local files.");
  return errors;
}

export function buildResearchTaskPrompt(draft: ResearchTaskDraft, sessionId: string, createdAt: string): string {
  const record = {
    workspaceId: draft.workspaceId,
    sessionId,
    question: draft.question.trim(),
    moduleIds: [...draft.moduleIds],
    sources: normaliseLines(draft.sources),
    createdAt,
    stage: "submitted",
    unfinishedItems: [
      "Confirm that the listed sources and files are accessible.",
      "Run the selected scientific analyses with appropriate review before external or costly work.",
      "Assess the returned evidence, limitations, provenance, and remaining questions.",
    ],
  };
  return [
    "Rosalind research task",
    "",
    "Research question:",
    record.question,
    "",
    "Scientific modules:",
    ...record.moduleIds.map((id) => `- ${id}: ${moduleLabel(id)}`),
    "",
    "Data sources and local files:",
    record.sources,
    "",
    "Research record:",
    `- Workspace: ${record.workspaceId}`,
    `- Session: ${record.sessionId}`,
    `- Created: ${record.createdAt}`,
    `- Current stage: ${record.stage}`,
    "",
    "Unfinished items:",
    ...record.unfinishedItems.map((item) => `- ${item}`),
    "",
    "Please examine the available evidence, state any missing inputs, plan the selected analyses, and keep results, limitations, and provenance together in this conversation.",
  ].join("\n");
}

function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.map((block) => {
    if (!block || typeof block !== "object") return "";
    const text = (block as Record<string, unknown>).text;
    return typeof text === "string" ? text : "";
  }).filter(Boolean).join("\n");
}

function recordFromText(text: string): Omit<ResearchSessionRecord, "stage" | "toolResults" | "unfinishedItems"> & { unfinishedItems: string[] } | null {
  const taskStart = text.lastIndexOf("Rosalind research task\n");
  if (taskStart < 0) return null;
  const task = text.slice(taskStart);
  const section = (start: string, end: string): string | null => {
    const from = task.indexOf(start);
    if (from < 0) return null;
    const valueStart = from + start.length;
    const to = task.indexOf(end, valueStart);
    return to < 0 ? null : task.slice(valueStart, to).trim();
  };
  const question = section("Research question:\n", "\n\nScientific modules:");
  const modules = section("Scientific modules:\n", "\n\nData sources and local files:");
  const sources = section("Data sources and local files:\n", "\n\nResearch record:");
  const record = section("Research record:\n", "\n\nUnfinished items:");
  const unfinished = section("Unfinished items:\n", "\n\nPlease examine");
  if (!question || !modules || !sources || !record || unfinished === null) return null;
  const field = (name: string): string | null => {
    const match = record.match(new RegExp(`^[-] ${name}: (.+)$`, "m"));
    return match?.[1]?.trim() || null;
  };
  const workspaceId = field("Workspace");
  const sessionId = field("Session");
  const createdAt = field("Created");
  const moduleIds = modules.split("\n").map((line) => /^- ([^:]+):/.exec(line)?.[1]?.trim()).filter((value): value is string => Boolean(value));
  if (!workspaceId || !sessionId || !createdAt || moduleIds.length === 0) return null;
  return {
    workspaceId,
    sessionId,
    question,
    moduleIds,
    sources,
    createdAt,
    unfinishedItems: unfinished.split("\n").map((line) => line.replace(/^- /, "").trim()).filter(Boolean),
  };
}

function resultPayload(node: Record<string, unknown>): Record<string, unknown> | null {
  const content = Array.isArray(node.content) ? node.content : [];
  for (const block of content) {
    const text = block && typeof block === "object" ? (block as Record<string, unknown>).text : undefined;
    if (typeof text !== "string" || !text.trim().startsWith("{")) continue;
    try {
      const value = JSON.parse(text) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return null;
}

function toolResult(node: unknown): ResearchToolResult | null {
  if (!node || typeof node !== "object") return null;
  const value = node as Record<string, unknown>;
  if (value.kind !== "tool-result") return null;
  const call = value.call && typeof value.call === "object" ? value.call as Record<string, unknown> : null;
  const toolName = typeof call?.name === "string" ? call.name : null;
  if (!toolName) return null;
  const payload = resultPayload(value);
  const error = payload?.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : null;
  const status = value.isError === true
    ? "failed"
    : typeof payload?.status === "string"
      ? payload.status
      : typeof payload?.state === "string"
        ? payload.state
        : payload?.ok === false
          ? "failed"
          : "completed";
  const summaryValues = [payload?.summary, payload?.title, payload?.result, error?.message];
  const summary = summaryValues.find((item): item is string => typeof item === "string" && item.trim().length > 0) ?? null;
  return {
    callId: String(value.callId ?? `${toolName}:${String(value.time ?? 0)}`),
    toolName,
    status,
    summary,
    time: typeof value.time === "number" ? value.time : 0,
  };
}

export function deriveResearchSessionRecord(nodes: ConversationSnapshot["nodes"] | readonly unknown[]): ResearchSessionRecord | null {
  let base: ReturnType<typeof recordFromText> = null;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const value = node as Record<string, unknown>;
    if (value.kind !== "user" && value.kind !== "steering") continue;
    base = recordFromText(textFromContent(value.content)) ?? base;
  }
  if (!base) return null;
  const toolResults = nodes.map(toolResult).filter((result): result is ResearchToolResult => result !== null).slice(-12);
  const hasFailure = toolResults.some((result) => result.status === "failed" || result.status === "error");
  const hasActive = toolResults.some((result) => ["queued", "running", "pending", "awaiting_confirmation"].includes(result.status));
  const stage: ResearchSessionRecord["stage"] = hasFailure ? "needs-attention" : hasActive ? "analysis" : toolResults.length > 0 ? "review" : "submitted";
  const unfinishedItems = hasFailure
    ? ["Review the failed tool result and decide whether inputs or the analysis plan need revision."]
    : stage === "analysis"
      ? ["Wait for active analyses to finish, then review the returned evidence and limitations."]
      : stage === "review"
        ? ["Review limitations, provenance, citations, and any unanswered part of the research question."]
        : base.unfinishedItems;
  return { ...base, stage, toolResults, unfinishedItems };
}
