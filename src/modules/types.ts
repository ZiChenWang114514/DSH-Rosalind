import type { Plugin } from "@deepseek-ai/cordis";

import type { ProviderStatus } from "../shared/types.js";

export const MODULE_IDS = [
  "literature",
  "databases",
  "sequence",
  "ngs",
  "structure",
  "slide",
  "rosalind",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];
export type ModuleState = "active" | "disabled" | "needs_setup" | "error";

export const MODULE_PLUGIN_IDS: Record<ModuleId, string> = {
  literature: "life-sciences-literature",
  databases: "life-sciences-databases",
  sequence: "biological-sequence-viewer",
  ngs: "ngs-analysis-workbench",
  structure: "molecular-structure-viewer",
  slide: "slide-viewer",
  rosalind: "rosalind-workbench",
};

export function moduleIdForPlugin(pluginId: string): ModuleId | undefined {
  return MODULE_IDS.find((id) => MODULE_PLUGIN_IDS[id] === pluginId);
}

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  version: string;
  pluginId: string;
  plugin: Plugin<void>;
  toolCount: number;
  skillCount: number;
  showcaseCount: number;
  checkProviders: () => ProviderStatus[];
}

export interface ModuleStatus {
  id: ModuleId;
  name: string;
  status: ModuleState;
  enabled: boolean;
  version: string;
  toolCount: number;
  skillCount: number;
  showcaseCount: number;
  providers: ProviderStatus[];
  issues: string[];
}

export type ModuleEnabledState = Record<ModuleId, boolean>;
