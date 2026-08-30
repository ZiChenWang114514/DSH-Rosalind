import { useSyncExternalStore } from "react";
import type { ShowcaseDefinition, ShowcaseMode } from "../shared/types.js";

export interface WorkbenchBridge {
  importCase?: (showcase: ShowcaseDefinition, mode: ShowcaseMode) => void;
  startSession?: (showcase: ShowcaseDefinition, mode: ShowcaseMode) => void;
}

interface WorkbenchState {
  selectedCaseId: string | null;
  detailTab: DetailTab;
  mode: ShowcaseMode;
  bridge: WorkbenchBridge;
  notice: string | null;
}

export type DetailTab = "overview" | "evidence" | "reproduce";

const MODE_FOR_TAB: Record<DetailTab, ShowcaseMode> = {
  overview: "lesson",
  evidence: "replay",
  reproduce: "reproduce",
};

const TAB_FOR_MODE: Record<ShowcaseMode, DetailTab> = {
  lesson: "overview",
  replay: "evidence",
  reproduce: "reproduce",
};

const listeners = new Set<() => void>();
let state: WorkbenchState = {
  selectedCaseId: null,
  detailTab: "overview",
  mode: "lesson",
  bridge: {},
  notice: null,
};

const selectedModes = new Map<string, ShowcaseMode>();
let pendingPrompt: { text: string; autoSubmit: boolean } | null = null;

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
  const mode = selectedModes.get(caseId) ?? "lesson";
  update({ selectedCaseId: caseId, detailTab: TAB_FOR_MODE[mode], mode, notice: null });
}

export function closeShowcase(): void {
  update({ selectedCaseId: null, notice: null });
}

export function setDetailTab(detailTab: DetailTab): void {
  const mode = MODE_FOR_TAB[detailTab];
  if (state.selectedCaseId) selectedModes.set(state.selectedCaseId, mode);
  update({ detailTab, mode });
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

export function stageConversationPrompt(prompt: string, options: { autoSubmit?: boolean } = {}): void {
  pendingPrompt = { text: prompt, autoSubmit: options.autoSubmit ?? false };
}

export function consumeConversationPrompt(): { text: string; autoSubmit: boolean } | null {
  const prompt = pendingPrompt;
  pendingPrompt = null;
  return prompt;
}
