import type { Context } from "@deepseek-ai/cordis";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";

import {
  MODULE_SETTING_IDS,
  MODULE_SETTINGS_NAMESPACE_VALUE,
  type ModuleRuntimeView,
  type ModuleSettingsView,
} from "../shared/module-settings-contract.js";
import type { ModuleRegistry } from "./registry.js";
import type { ModuleEnabledState, ModuleStatus } from "./types.js";

export const MODULE_SETTINGS_NAMESPACE = settingsNamespace(MODULE_SETTINGS_NAMESPACE_VALUE);

export type ModuleSettings = ModuleSettingsView;

const DEFAULT_MODULE_SELECTION: ModuleEnabledState = {
  literature: true,
  databases: true,
  sequence: true,
  ngs: true,
  structure: true,
  slide: true,
  rosalind: true,
};

function projectStatus(status: ModuleStatus): ModuleRuntimeView {
  return {
    id: status.id,
    name: status.name,
    status: status.status,
    enabled: status.enabled,
    version: status.version,
    toolCount: status.toolCount,
    skillCount: status.skillCount,
    showcaseCount: status.showcaseCount,
    providers: status.providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      installed: provider.installed,
      credentialRequired: provider.credentialRequired,
      credentialConfigured: provider.credentialConfigured,
      runnable: provider.runnable,
      diagnostics: provider.diagnostics,
    })),
    issues: status.issues,
  };
}

function runtimeRecord(registry: ModuleRegistry): ModuleSettings["runtime"] {
  return Object.fromEntries(registry.list().map((status) => [status.id, projectStatus(status)])) as ModuleSettings["runtime"];
}

function emptyRuntime(): ModuleSettings["runtime"] {
  return Object.fromEntries(MODULE_SETTING_IDS.map((id) => [id, {
    id,
    name: id,
    status: "disabled",
    enabled: false,
    version: "unknown",
    toolCount: 0,
    skillCount: 0,
    showcaseCount: 0,
    providers: [],
    issues: [],
  }])) as unknown as ModuleSettings["runtime"];
}

export const DEFAULT_MODULE_SETTINGS: ModuleSettings = {
  modules: {
    ...DEFAULT_MODULE_SELECTION,
  },
  runtime: emptyRuntime(),
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
  }).default(DEFAULT_MODULE_SELECTION),
  runtime: z.object(Object.fromEntries(MODULE_SETTING_IDS.map((id) => [id, z.object({
    id: z.const(id),
    name: z.string(),
    status: z.union([z.const("active"), z.const("disabled"), z.const("needs_setup"), z.const("error")]),
    enabled: z.boolean(),
    version: z.string(),
    toolCount: z.number(),
    skillCount: z.number(),
    showcaseCount: z.number(),
    providers: z.array(z.object({
      id: z.string(),
      label: z.string(),
      kind: z.union([z.const("local"), z.const("public-api"), z.const("container"), z.const("ssh"), z.const("gpu"), z.const("paid-api")]),
      installed: z.boolean(),
      credentialRequired: z.boolean(),
      credentialConfigured: z.boolean(),
      runnable: z.boolean(),
      diagnostics: z.array(z.string()),
    })),
    issues: z.array(z.string()),
  })])) as Record<(typeof MODULE_SETTING_IDS)[number], z<any>>).default(DEFAULT_MODULE_SETTINGS.runtime),
});

export function installModuleSettings(ctx: Context, registry: ModuleRegistry): void {
  const entry: ModuleSettings = { modules: { ...DEFAULT_MODULE_SELECTION }, runtime: runtimeRecord(registry) };
  let source = () => entry;
  let publishing = false;
  let rerun = false;
  let stopped = false;
  ctx.effect(() => () => { stopped = true; }, "dsh-rosalind: module settings status projection");

  const applyAndPublish = async (): Promise<void> => {
    if (stopped) return;
    if (publishing) {
      rerun = true;
      return;
    }
    publishing = true;
    try {
      await registry.reconcile(source().modules);
      if (stopped) return;
      const settings = ctx.get("settings");
      if (!settings) return;
      const current = settings.get(MODULE_SETTINGS_NAMESPACE) as ModuleSettings | undefined;
      const runtime = runtimeRecord(registry);
      if (JSON.stringify(current?.runtime) !== JSON.stringify(runtime)) {
        await settings.update(MODULE_SETTINGS_NAMESPACE, { runtime });
      }
    } finally {
      publishing = false;
      if (rerun && !stopped) {
        rerun = false;
        void applyAndPublish().catch(() => {});
      }
    }
  };

  installSettingsSection(ctx, MODULE_SETTINGS_NAMESPACE, MODULE_SETTINGS_SCHEMA, entry, {
    setSource(next) {
      source = next;
    },
    onChange() {
      void applyAndPublish().catch(() => {});
    },
  });
}

export async function persistModuleSettings(ctx: Context, enabled: ModuleEnabledState): Promise<void> {
  const settings = ctx.get("settings");
  if (!settings || settings.get(MODULE_SETTINGS_NAMESPACE) === undefined) return;
  await settings.update(MODULE_SETTINGS_NAMESPACE, { modules: enabled });
}
