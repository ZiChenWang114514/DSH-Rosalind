import type { Context } from "@deepseek-ai/cordis";
import "@deepseek-ai/dsh-skill";

import { RosalindRuntime } from "./host/runtime.js";
import { createRosalindTools } from "./host/tools.js";
import { createScienceSkills } from "./host/skills.js";
import { CapabilityRegistry } from "./host/capabilities.js";
import { createScienceGatewayTools } from "./host/science-gateway-tools.js";
import { createScienceTools } from "./host/science-tools.js";
import { ScienceRuntime } from "./host/science/runtime.js";

export * from "./shared/types.js";
export * from "./shared/categories.js";
export { ShowcaseCatalog } from "./host/catalog.js";
export { ProviderRegistry } from "./host/providers.js";
export { RosalindRuntime } from "./host/runtime.js";
export { createRosalindTools } from "./host/tools.js";
export { createScienceSkills, SCIENCE_SKILL_SPECS } from "./host/skills.js";
export { CapabilityRegistry } from "./host/capabilities.js";
export { createScienceTools } from "./host/science-tools.js";
export { ScienceRuntime } from "./host/science/runtime.js";
export { validateShowcase } from "./host/validators.js";

export const name = "dsh-rosalind";
export const inject = ["tools", "skills"];

const WRITE_APPROVAL_REASONS: Readonly<Record<string, string>> = {
  rosalind_approve: "Approval is required to authorize the exact DSH-Rosalind plan and its recorded external actions.",
  rosalind_export: "Approval is required to write the requested DSH-Rosalind export to the active workspace.",
  sequence_export_artifact: "Approval is required to write the requested Sequence Viewer artifact.",
  structure_render_image: "Approval is required before writing a Molecular Structure Viewer image and its rendering record.",
  structure_render_movie: "Approval is required before writing a Molecular Structure Viewer movie and its rendering record.",
  structure_export: "Approval is required to write the requested Molecular Structure Viewer export.",
  slide_export_dicom_object: "Approval is required before attempting a DICOM export.",
  slide_prepare_dicom_upload: "Approval is required before preparing a DICOM upload.",
  slide_submit_dicom_upload: "Approval is required before submitting a DICOM upload.",
};

const SLIDE_WRITE_ACTIONS = new Set(["save_project", "resume_project_save", "export_view"]);

export function apply(ctx: Context): void {
  const capabilities = new CapabilityRegistry();
  const science = new ScienceRuntime();
  const runtime = new RosalindRuntime({ science });
  ctx.effect(() => {
    const approvalListener = ctx.on("tools/pre-execute", async (exec, next) => {
      const decision = await next();
      if (decision.kind !== "allow") return decision;
      const args = exec.arguments && typeof exec.arguments === "object" && !Array.isArray(exec.arguments)
        ? exec.arguments as Record<string, unknown>
        : {};
      if (exec.name === "ngs_execute_plan") {
        return { kind: "ask" as const, reason: "Approval is required to run the exact reviewed NGS plan on the selected compute target." };
      }
      if ((exec.name === "literature_request" || exec.name === "database_request") && args.allowNetwork === true) {
        return { kind: "ask" as const, reason: `Approval is required to send this ${exec.name === "literature_request" ? "literature" : "database"} request to the selected public service.` };
      }
      const writeReason = WRITE_APPROVAL_REASONS[exec.name];
      if (writeReason && (exec.name !== "rosalind_export" || args.approved === true)) {
        return { kind: "ask" as const, reason: writeReason };
      }
      if (exec.name === "slide_control_viewer" && typeof args.action === "string" && SLIDE_WRITE_ACTIONS.has(args.action)) {
        return { kind: "ask" as const, reason: `Approval is required to perform the Slide Viewer ${args.action} file operation.` };
      }
      return decision;
    });
    const disposers = [
      approvalListener,
      ...createRosalindTools(runtime).map((tool) => ctx.tools.register(tool)),
      ...createScienceTools(science, capabilities).map((tool) => ctx.tools.register(tool)),
      ...createScienceGatewayTools(science, capabilities.packageRoot).map((tool) => ctx.tools.register(tool)),
      ...createScienceSkills(capabilities.packageRoot).map((skill) => ctx.skills.register(skill)),
    ];
    return async () => {
      runtime.dispose();
      await science.dispose();
      for (const dispose of disposers.reverse()) dispose();
    };
  }, "dsh-rosalind: tools");
}
