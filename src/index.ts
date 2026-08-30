import type { Context } from "@deepseek-ai/cordis";
import "@deepseek-ai/dsh-skill";

import { createRosalindModuleComposition } from "./modules/definitions.js";
import { ModuleRegistry } from "./modules/registry.js";
import { installModuleSettings, persistModuleSettings } from "./modules/settings.js";

export * from "./shared/types.js";
export * from "./shared/categories.js";
export { ShowcaseCatalog } from "./host/catalog.js";
export { ProviderRegistry } from "./host/providers.js";
export { RosalindRuntime } from "./host/runtime.js";
export { createRosalindTools } from "./host/tools.js";
export { createScienceSkills, SCIENCE_SKILL_SPECS } from "./host/skills.js";
export type {
  ModuleDefinition as SourceModuleDefinition,
  ShowcaseOwnership,
  SourceProviderAdapter,
} from "./modules/module-definition.js";
export {
  createLiteratureModule,
  createLiteratureRequestTool,
  createLiteratureSkills,
  LiteratureProviderAdapter,
  LITERATURE_PROVIDER_IDS,
  LITERATURE_REQUEST_PARAMETERS,
  LITERATURE_SHOWCASES,
  LITERATURE_SKILL_SPECS,
} from "./modules/life-sciences-literature.js";
export {
  createDatabaseModule,
  createDatabaseRequestTool,
  createDatabaseSkills,
  DatabaseProviderAdapter,
  DATABASE_PROVIDER_IDS,
  DATABASE_PROVIDERS,
  DATABASE_REQUEST_PARAMETERS,
  DATABASE_SHOWCASES,
  DATABASE_SKILL_SPECS,
} from "./modules/life-sciences-databases.js";
export { CapabilityRegistry } from "./host/capabilities.js";
export { createScienceTools } from "./host/science-tools.js";
export { ScienceRuntime } from "./host/science/runtime.js";
export {
  WorkflowModuleCoordinator,
  createNgsWorkbenchModule,
  createRosalindWorkbenchModule,
  ngsWorkbenchModule,
  rosalindWorkbenchModule,
} from "./host/workflow-modules.js";
export type {
  NgsWorkbenchModuleOptions,
  RosalindWorkbenchModuleOptions,
  WorkflowModuleHandle,
  WorkflowModuleStatus,
} from "./host/workflow-modules.js";
export { registerSequenceHostModule, SEQUENCE_HOST_MODULE } from "./host/modules/sequence.js";
export { registerSlideHostModule, SLIDE_HOST_MODULE } from "./host/modules/slide.js";
export { registerStructureHostModule, STRUCTURE_HOST_MODULE } from "./host/modules/structure.js";
export { validateShowcase } from "./host/validators.js";
export { createRosalindModuleComposition } from "./modules/definitions.js";
export { ModuleRegistry } from "./modules/registry.js";
export { DEFAULT_MODULE_SETTINGS, MODULE_SETTINGS_NAMESPACE, MODULE_SETTINGS_SCHEMA } from "./modules/settings.js";
export { MODULE_IDS } from "./modules/types.js";
export type { ModuleDefinition, ModuleEnabledState, ModuleId, ModuleState, ModuleStatus } from "./modules/types.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    rosalindModules: ModuleRegistry;
  }
}

export const name = "dsh-rosalind";
export const inject = ["tools", "skills"];

const WRITE_APPROVAL_REASONS: Readonly<Record<string, string>> = {
  sequence_export_artifact: "Approval is required to write the requested Sequence Viewer artifact.",
  structure_render_image: "Approval is required before writing a Molecular Structure Viewer image and its rendering record.",
  structure_render_movie: "Approval is required before writing a Molecular Structure Viewer movie and its rendering record.",
  structure_export: "Approval is required to write the requested Molecular Structure Viewer export.",
  slide_export_dicom_object: "Approval is required before attempting a DICOM export.",
  slide_prepare_dicom_upload: "Approval is required before preparing a DICOM upload.",
  slide_submit_dicom_upload: "Approval is required before submitting a DICOM upload.",
};

const SLIDE_WRITE_ACTIONS = new Set(["save_project", "resume_project_save", "export_view"]);

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const composition = createRosalindModuleComposition();
  const modules = new ModuleRegistry(ctx, composition.definitions, {
    persist: (enabled) => persistModuleSettings(ctx, enabled),
    disposeShared: () => composition.dispose(),
  });
  composition.bindModules(modules);
  ctx.provide("rosalindModules", modules);
  const approvalListener = ctx.on("tools/pre-execute", async (exec, next) => {
      const decision = await next();
      if (decision.kind !== "allow") return decision;
      const args = exec.arguments && typeof exec.arguments === "object" && !Array.isArray(exec.arguments)
        ? exec.arguments as Record<string, unknown>
        : {};
      if ((exec.name === "literature_request" || exec.name === "database_request") && args.allowNetwork === true) {
        return { kind: "ask" as const, reason: `Approval is required to send this ${exec.name === "literature_request" ? "literature" : "database"} request to the selected public service.` };
      }
      const writeReason = WRITE_APPROVAL_REASONS[exec.name];
      if (writeReason) {
        return { kind: "ask" as const, reason: writeReason };
      }
      if (exec.name === "slide_control_viewer" && typeof args.action === "string" && SLIDE_WRITE_ACTIONS.has(args.action)) {
        return { kind: "ask" as const, reason: `Approval is required to perform the Slide Viewer ${args.action} file operation.` };
      }
      return decision;
  });
  await modules.start();
  installModuleSettings(ctx, modules);
  return async () => {
    approvalListener();
    await modules.destroy();
  };
}
