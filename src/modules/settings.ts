import type { Context } from "@deepseek-ai/cordis";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";

import type { ModuleRegistry } from "./registry.js";
import type { ModuleEnabledState } from "./types.js";

export const MODULE_SETTINGS_NAMESPACE = settingsNamespace("dsh-rosalind-modules");

export interface ModuleSettings {
  modules: ModuleEnabledState;
}

export const DEFAULT_MODULE_SETTINGS: ModuleSettings = {
  modules: {
    literature: true,
    databases: true,
    sequence: true,
    ngs: true,
    structure: true,
    slide: true,
    rosalind: true,
  },
};

export const MODULE_SETTINGS_SCHEMA = z.object({
  modules: z.object({
    literature: z.boolean().default(true),
    databases: z.boolean().default(true),
    sequence: z.boolean().default(true),
    ngs: z.boolean().default(true),
    structure: z.boolean().default(true),
    slide: z.boolean().default(true),
    rosalind: z.boolean().default(true),
  }).default(DEFAULT_MODULE_SETTINGS.modules),
});

export function installModuleSettings(ctx: Context, registry: ModuleRegistry): void {
  let source = () => DEFAULT_MODULE_SETTINGS;
  installSettingsSection(ctx, MODULE_SETTINGS_NAMESPACE, MODULE_SETTINGS_SCHEMA, DEFAULT_MODULE_SETTINGS, {
    setSource(next) {
      source = next;
    },
    onChange() {
      void registry.reconcile(source().modules);
    },
  });
}

export async function persistModuleSettings(ctx: Context, enabled: ModuleEnabledState): Promise<void> {
  const settings = ctx.get("settings");
  if (!settings || settings.get(MODULE_SETTINGS_NAMESPACE) === undefined) return;
  await settings.update(MODULE_SETTINGS_NAMESPACE, { modules: enabled });
}
