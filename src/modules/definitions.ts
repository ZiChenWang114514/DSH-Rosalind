import type { Context, Plugin } from "@deepseek-ai/cordis";
import type { SkillRegistration } from "@deepseek-ai/dsh-skill";
import type { ToolDefinition } from "@deepseek-ai/dsh-tools";

import { CapabilityRegistry } from "../host/capabilities.js";
import { ProviderRegistry } from "../host/providers.js";
import { RosalindRuntime } from "../host/runtime.js";
import { createScienceGatewayTools } from "../host/science-gateway-tools.js";
import { createScienceTools } from "../host/science-tools.js";
import { NgsService } from "../host/science/ngs.js";
import { ScienceRuntime } from "../host/science/runtime.js";
import { createScienceSkills } from "../host/skills.js";
import { createRosalindTools } from "../host/tools.js";
import { MODULE_IDS, type ModuleDefinition, type ModuleId } from "./types.js";
import type { ModuleRegistry } from "./registry.js";

const MODULE_META: Record<ModuleId, {
  name: string;
  pluginId: string;
  providerIds: readonly string[];
}> = {
  literature: {
    name: "Life Sciences Literature",
    pluginId: "life-sciences-literature",
    providerIds: ["ncbi-entrez", "ncbi-pmc", "biorxiv"],
  },
  databases: {
    name: "Life Sciences Databases",
    pluginId: "life-sciences-databases",
    providerIds: ["opentargets", "gwas-catalog", "gtex-eqtl", "clinvar-variation", "ensembl", "gnomad-graphql", "uniprot", "chembl", "rcsb-pdb", "reactome"],
  },
  sequence: {
    name: "Biological Sequence Viewer",
    pluginId: "biological-sequence-viewer",
    providerIds: ["local-sequence"],
  },
  ngs: {
    name: "NGS Analysis Workbench",
    pluginId: "ngs-analysis-workbench",
    providerIds: ["local-ngs"],
  },
  structure: {
    name: "Molecular Structure Viewer",
    pluginId: "molecular-structure-viewer",
    providerIds: ["local-structure"],
  },
  slide: {
    name: "Slide Viewer",
    pluginId: "slide-viewer",
    providerIds: ["local-slide"],
  },
  rosalind: {
    name: "Rosalind Workbench",
    pluginId: "rosalind-workbench",
    providerIds: ["local-workbench"],
  },
};

interface ModuleLifecycle {
  activate?(): void;
  deactivate?(): void | Promise<void>;
}

function approvalListener(ctx: Context, id: ModuleId): (() => void) | undefined {
  if (id === "ngs") {
    return ctx.on("tools/pre-execute", async (exec, next) => {
      const decision = await next();
      if (decision.kind !== "allow" || exec.name !== "ngs_execute_plan") return decision;
      return { kind: "ask" as const, reason: "Approval is required to run the exact reviewed NGS plan on the selected compute target." };
    });
  }
  if (id === "rosalind") {
    return ctx.on("tools/pre-execute", async (exec, next) => {
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
  }
  return undefined;
}

function modulePlugin(
  id: ModuleId,
  tools: readonly ToolDefinition[],
  skills: readonly SkillRegistration[],
  lifecycle: ModuleLifecycle = {},
): Plugin<void> {
  return {
    name: `dsh-rosalind:${id}`,
    inject: ["tools", "skills"],
    apply(ctx: Context) {
      lifecycle.activate?.();
      const approval = approvalListener(ctx, id);
      const disposers = [
        ...(approval ? [approval] : []),
        ...tools.map((tool) => ctx.tools.register(tool)),
        ...skills.map((skill) => ctx.skills.register(skill)),
      ];
      return async () => {
        for (const dispose of disposers.reverse()) dispose();
        await lifecycle.deactivate?.();
      };
    },
  };
}

export interface RosalindModuleComposition {
  definitions: ModuleDefinition[];
  runtime: RosalindRuntime;
  science: ScienceRuntime;
  bindModules(registry: ModuleRegistry): void;
  dispose(): Promise<void>;
}

export function createRosalindModuleComposition(): RosalindModuleComposition {
  const capabilities = new CapabilityRegistry();
  const providers = new ProviderRegistry();
  const science = new ScienceRuntime({ ngs: null });
  const runtime = new RosalindRuntime({ science, providers });
  const ngs = new NgsService();
  const definitions = MODULE_IDS.map((id): ModuleDefinition => {
    const meta = MODULE_META[id];
    const scienceTools = createScienceTools(science, capabilities, id);
    const gatewayTools = id === "literature" || id === "databases" || id === "slide"
      ? createScienceGatewayTools(science, capabilities.packageRoot, id)
      : [];
    const tools = id === "rosalind"
      ? [...scienceTools, ...createRosalindTools(runtime)]
      : [...scienceTools, ...gatewayTools];
    const skills = id === "rosalind" ? [] : createScienceSkills(capabilities.packageRoot, id);
    const showcases = runtime.catalog.entries.filter((entry) => entry.pluginId === meta.pluginId);
    const version = showcases[0]?.pluginVersion;
    if (!version) throw new Error(`No showcase metadata supplies a version for ${meta.pluginId}`);
    const plugin = modulePlugin(id, tools, skills, id === "ngs" ? {
      activate() {
        ngs.activate();
        science.attachNgs(ngs);
      },
      async deactivate() {
        science.detachNgs(ngs);
        await ngs.suspend();
      },
    } : {});
    return {
      id,
      name: meta.name,
      version,
      pluginId: meta.pluginId,
      plugin,
      toolCount: tools.length,
      skillCount: skills.length,
      showcaseCount: showcases.length,
      checkProviders: () => providers.list(meta.providerIds),
    };
  });
  let disposed = false;
  return {
    definitions,
    runtime,
    science,
    bindModules(registry) {
      const enabled = (id: ModuleId) => registry.isActive(id);
      runtime.setModuleEnabled(enabled);
      science.setModuleEnabled(enabled);
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
      await ngs.dispose();
      await science.dispose();
    },
  };
}
