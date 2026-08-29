import { useSyncExternalStore } from "react";
import type { ShowcaseDefinition, ShowcaseMode } from "../shared/types.js";

export interface WorkbenchBridge {
  importCase?: (showcase: ShowcaseDefinition, mode: ShowcaseMode) => void;
  startSession?: (showcase: ShowcaseDefinition, mode: ShowcaseMode) => void;
}

interface WorkbenchState {
  selectedCaseId: string | null;
  detailTab: "overview" | "evidence" | "reproduce";
  mode: ShowcaseMode;
  bridge: WorkbenchBridge;
  notice: string | null;
}

const listeners = new Set<() => void>();
let state: WorkbenchState = {
  selectedCaseId: null,
  detailTab: "overview",
  mode: "lesson",
  bridge: {},
  notice: null,
};

let pendingPrompt: string | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function update(patch: Partial<WorkbenchState>): void {
  state = { ...state, ...patch };
  emit();
}

export function subscribeWorkbench(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWorkbenchState(): WorkbenchState {
  return state;
}

export function useWorkbenchState(): WorkbenchState {
  return useSyncExternalStore(subscribeWorkbench, getWorkbenchState, getWorkbenchState);
}

export function openShowcase(caseId: string): void {
  update({ selectedCaseId: caseId, detailTab: "overview", mode: "lesson", notice: null });
}

export function closeShowcase(): void {
  update({ selectedCaseId: null, notice: null });
}

export function setDetailTab(detailTab: WorkbenchState["detailTab"]): void {
  update({ detailTab });
}

export function setShowcaseMode(mode: ShowcaseMode): void {
  update({ mode });
}

export function setWorkbenchBridge(bridge: WorkbenchBridge): () => void {
  update({ bridge: { ...state.bridge, ...bridge } });
  return () => {
    const next = { ...state.bridge };
    for (const key of Object.keys(bridge) as Array<keyof WorkbenchBridge>) {
      if (next[key] === bridge[key]) delete next[key];
    }
    update({ bridge: next });
  };
}

export function showNotice(notice: string | null): void {
  update({ notice });
}

export function stageConversationPrompt(prompt: string): void {
  pendingPrompt = prompt;
}

export function consumeConversationPrompt(): string | null {
  const prompt = pendingPrompt;
  pendingPrompt = null;
  return prompt;
}
