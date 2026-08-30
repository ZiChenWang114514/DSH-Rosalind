import type { Context, Plugin } from "@deepseek-ai/cordis";
import type { SkillRegistration } from "@deepseek-ai/dsh-skill";
import type { ToolDefinition } from "@deepseek-ai/dsh-tools";

import { CapabilityRegistry } from "../host/capabilities.js";
import { ProviderRegistry } from "../host/providers.js";
import { RosalindRuntime } from "../host/runtime.js";
import { createScienceGatewayTools } from "../host/science-gateway-tools.js";
import { createScienceTools } from "../host/science-tools.js";
import { ScienceRuntime } from "../host/science/runtime.js";
import { createScienceSkills } from "../host/skills.js";
import { createRosalindTools } from "../host/tools.js";
import { WorkflowModuleCoordinator } from "../host/workflow-modules.js";
import { MODULE_IDS, type ModuleDefinition, type ModuleId } from "./types.js";

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

function modulePlugin(id: ModuleId, tools: readonly ToolDefinition[], skills: readonly SkillRegistration[]): Plugin<void> {
  return {
    name: `dsh-rosalind:${id}`,
    inject: ["tools", "skills"],
    apply(ctx: Context) {
      const disposers = [
        ...tools.map((tool) => ctx.tools.register(tool)),
        ...skills.map((skill) => ctx.skills.register(skill)),
      ];
      return () => {
        for (const dispose of disposers.reverse()) dispose();
      };
    },
  };
}

export interface RosalindModuleComposition {
  definitions: ModuleDefinition[];
  runtime: RosalindRuntime;
  science: ScienceRuntime;
  dispose(): Promise<void>;
}

export function createRosalindModuleComposition(): RosalindModuleComposition {
  const capabilities = new CapabilityRegistry();
  const providers = new ProviderRegistry();
  const workflow = new WorkflowModuleCoordinator(capabilities);
  const { science, rosalind: runtime } = workflow;
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
    const plugin = id === "ngs"
      ? workflow.ngsModule()
      : id === "rosalind"
        ? workflow.rosalindModule()
        : modulePlugin(id, tools, skills);
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
    async dispose() {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
      await science.dispose();
    },
  };
}
