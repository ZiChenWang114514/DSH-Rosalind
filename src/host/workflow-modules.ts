import type { Context, Plugin } from "@deepseek-ai/cordis";

import { CapabilityRegistry } from "./capabilities.js";
import { RosalindRuntime } from "./runtime.js";
import { createScienceTools } from "./science-tools.js";
import { NgsService } from "./science/ngs.js";
import { ScienceRuntime } from "./science/runtime.js";
import { createScienceSkills } from "./skills.js";
import { createRosalindTools } from "./tools.js";

const NGS_SERVICES = new Set(["ngs"]);
const ROSALIND_SERVICES = new Set(["rosalind"]);

export interface WorkflowModuleStatus {
  id: "ngs-analysis-workbench" | "rosalind-workbench";
  enabled: boolean;
  toolCount: number;
  skillCount: number;
  diagnostic: string | null;
}

export interface WorkflowModuleHandle {
  status(): WorkflowModuleStatus;
}

export interface NgsWorkbenchModuleOptions {
  science?: ScienceRuntime;
  capabilities?: CapabilityRegistry;
  createService?: () => NgsService;
}

export interface RosalindWorkbenchModuleOptions {
  science?: ScienceRuntime;
  runtime?: RosalindRuntime;
  capabilities?: CapabilityRegistry;
}

/**
 * Cordis plugin for the NGS workflow lifecycle. Its disposer owns every local
 * process started by this module and removes only the NGS tools and Skills.
 */
export function createNgsWorkbenchModule(options: NgsWorkbenchModuleOptions = {}): Plugin.Object {
  return {
    name: "dsh-rosalind-ngs-workbench",
    inject: ["tools", "skills"],
    apply(ctx: Context): void {
      const capabilities = options.capabilities ?? new CapabilityRegistry();
      const science = options.science ?? new ScienceRuntime({ ngs: null });
      const service = options.createService?.() ?? new NgsService();
      const tools = createScienceTools(science, capabilities, NGS_SERVICES);
      const skills = createScienceSkills(capabilities.packageRoot, NGS_SERVICES);
      science.attachNgs(service);
      let enabled = true;
      const handle: WorkflowModuleHandle = {
        status: () => ({
          id: "ngs-analysis-workbench",
          enabled,
          toolCount: enabled ? tools.length : 0,
          skillCount: enabled ? skills.length : 0,
          diagnostic: enabled ? null : "The NGS Analysis Workbench Cordis module is disabled.",
        }),
      };
      ctx.effect(() => {
        const approval = ctx.on("tools/pre-execute", async (exec, next) => {
          const decision = await next();
          if (decision.kind !== "allow" || exec.name !== "ngs_execute_plan") return decision;
          return { kind: "ask" as const, reason: "Approval is required to run the exact reviewed NGS plan on the selected compute target." };
        });
        const disposers = [
          approval,
          ctx.provide("dshRosalindNgsWorkbench", handle),
          ...tools.map((tool) => ctx.tools.register(tool)),
          ...skills.map((skill) => ctx.skills.register(skill)),
        ];
        return async () => {
          enabled = false;
          science.detachNgs(service);
          await service.dispose();
          for (const dispose of disposers.reverse()) dispose();
          if (!options.science) await science.dispose();
        };
      }, "dsh-rosalind: NGS Analysis Workbench module");
    },
  };
}

/**
 * Cordis plugin for cross-service projects and their retained Rosalind
 * lifecycle. NGS is reached through the supplied dynamic ScienceRuntime, so
 * this module remains queryable while the NGS plugin is disabled.
 */
export function createRosalindWorkbenchModule(options: RosalindWorkbenchModuleOptions = {}): Plugin.Object {
  return {
    name: "dsh-rosalind-workbench",
    inject: ["tools", "skills"],
    apply(ctx: Context): void {
      const capabilities = options.capabilities ?? new CapabilityRegistry();
      const science = options.science ?? new ScienceRuntime({ ngs: null });
      const runtime = options.runtime ?? new RosalindRuntime({ science });
      const tools = [
        ...createRosalindTools(runtime),
        ...createScienceTools(science, capabilities, ROSALIND_SERVICES),
      ];
      let enabled = true;
      const handle: WorkflowModuleHandle = {
        status: () => ({ id: "rosalind-workbench", enabled, toolCount: enabled ? tools.length : 0, skillCount: 0, diagnostic: enabled ? null : "The Rosalind Workbench Cordis module is disabled." }),
      };
      ctx.effect(() => {
        const approval = ctx.on("tools/pre-execute", async (exec, next) => {
          const decision = await next();
          if (decision.kind !== "allow") return decision;
          const args = exec.arguments && typeof exec.arguments === "object" && !Array.isArray(exec.arguments)
            ? exec.arguments as Record<string, unknown>
            : {};
          if (exec.name === "rosalind_approve") {
            return { kind: "ask" as const, reason: "Approval is required to authorize the exact DSH-Rosalind plan and its recorded external actions." };
          }
          if (exec.name === "rosalind_export" && args.approved === true) {
            return { kind: "ask" as const, reason: "Approval is required to write the requested DSH-Rosalind export to the active workspace." };
          }
          return decision;
        });
        const disposers = [
          approval,
          ctx.provide("dshRosalindWorkbench", handle),
          ...tools.map((tool) => ctx.tools.register(tool)),
        ];
        return async () => {
          enabled = false;
          if (!options.runtime) runtime.dispose();
          for (const dispose of disposers.reverse()) dispose();
          if (!options.science) await science.dispose();
        };
      }, "dsh-rosalind: Rosalind Workbench module");
    },
  };
}

export class WorkflowModuleCoordinator {
  readonly capabilities: CapabilityRegistry;
  readonly science: ScienceRuntime;
  readonly rosalind: RosalindRuntime;

  constructor(capabilities = new CapabilityRegistry()) {
    this.capabilities = capabilities;
    this.science = new ScienceRuntime({ ngs: null });
    this.rosalind = new RosalindRuntime({ science: this.science });
  }

  ngsModule(): Plugin.Object {
    return createNgsWorkbenchModule({ science: this.science, capabilities: this.capabilities });
  }

  rosalindModule(): Plugin.Object {
    return createRosalindWorkbenchModule({ science: this.science, runtime: this.rosalind, capabilities: this.capabilities });
  }
}

export const ngsWorkbenchModule = createNgsWorkbenchModule();
export const rosalindWorkbenchModule = createRosalindWorkbenchModule();
