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
