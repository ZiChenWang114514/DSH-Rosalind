import type { ProviderKind } from "./types.js";

export const MODULE_SETTINGS_NAMESPACE_VALUE = "dsh-rosalind-modules";

export const MODULE_SETTING_IDS = [
  "literature",
  "databases",
  "sequence",
  "ngs",
  "structure",
  "slide",
  "rosalind",
] as const;

export type ModuleSettingId = (typeof MODULE_SETTING_IDS)[number];
export type ModuleSettingState = "active" | "disabled" | "needs_setup" | "error";
export type ModuleSettingSelection = Record<ModuleSettingId, boolean>;

/** Secret-free provider facts sent to the browser settings page. */
export interface ModuleProviderView {
  id: string;
  label: string;
  kind: ProviderKind;
  installed: boolean;
  credentialRequired: boolean;
  credentialConfigured: boolean;
  runnable: boolean;
  diagnostics: string[];
}

/** Current Host observation for one independently managed module. */
export interface ModuleRuntimeView {
  id: ModuleSettingId;
  name: string;
  status: ModuleSettingState;
  enabled: boolean;
  version: string;
  toolCount: number;
  skillCount: number;
  showcaseCount: number;
  providers: ModuleProviderView[];
  issues: string[];
}

export interface ModuleSettingsView {
  modules: ModuleSettingSelection;
  runtime: Record<ModuleSettingId, ModuleRuntimeView>;
}
