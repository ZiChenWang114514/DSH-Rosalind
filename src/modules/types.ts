import type { Plugin } from "@deepseek-ai/cordis";

import type { ProviderStatus } from "../shared/types.js";
import { MODULE_SETTING_IDS, type ModuleSettingId, type ModuleSettingSelection, type ModuleSettingState } from "../shared/module-settings-contract.js";

export const MODULE_IDS = MODULE_SETTING_IDS;

export type ModuleId = ModuleSettingId;
export type ModuleState = ModuleSettingState;

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

export type ModuleEnabledState = ModuleSettingSelection;
