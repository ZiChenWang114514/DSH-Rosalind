import type { ShowcaseDefinition } from "../shared/types.js";
import { MODULE_IDS, moduleIdForPlugin, type ModuleId } from "./types.js";

/**
 * Rosalind Workbench cases compose retained evidence from the science modules.
 * The catalogue records the Workbench launcher separately, so these scientific
 * dependencies remain explicit and reviewable here.
 */
export const ROSALIND_SHOWCASE_MODULE_DEPENDENCIES: Readonly<Record<string, readonly ModuleId[]>> = {
  "rosalind-molecular-design": ["sequence", "structure"],
  "rosalind-structure-analysis": ["structure"],
  "rosalind-genomics": ["sequence", "ngs"],
  "rosalind-scientific-compute": ["sequence", "ngs"],
  "rosalind-trastuzumab-cdr": ["sequence", "structure"],
  "rosalind-egfr-vhh": ["sequence", "structure"],
  "rosalind-il6r-vhh": ["sequence", "structure"],
  "rosalind-antibody-breadth": ["sequence", "structure"],
  "rosalind-imatinib-abl1": ["databases", "structure"],
  "rosalind-jak2-selectivity": ["databases", "structure"],
  "rosalind-kras-g12c-ligand": ["databases", "structure"],
  "rosalind-egfr-t790m": ["databases", "structure"],
  "rosalind-mdm2-p53-inhibitor": ["databases", "structure"],
  "rosalind-ace-logd-pka": ["databases"],
  "rosalind-antibody-developability": ["databases", "sequence"],
  "rosalind-vhh-aggregation": ["sequence"],
  "rosalind-kinase-metabolism": ["databases"],
  "rosalind-oral-candidates": ["databases"],
  "rosalind-petase-mutations": ["sequence", "structure"],
  "rosalind-gfp-pocket": ["sequence", "structure"],
  "rosalind-ras-isoforms": ["sequence"],
  "rosalind-adenylate-kinase": ["structure"],
  "rosalind-breast-visium": ["ngs", "slide"],
  "rosalind-fastq-qc": ["sequence", "ngs"],
  "rosalind-single-cell-tme": ["ngs"],
  "rosalind-variant-pathway": ["databases", "ngs"],
  "rosalind-pdl1-assay-plan": ["literature", "databases"],
  "rosalind-boltz-repeats": ["ngs", "structure"],
  "rosalind-nextflow-snakemake": ["ngs"],
  "rosalind-cross-tool-export": ["sequence", "structure", "slide"],
};

function declaredModule(value: string): ModuleId | undefined {
  const plugin = moduleIdForPlugin(value);
  if (plugin) return plugin;
  const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return MODULE_IDS.find((id) => tokens.includes(id));
}

export function modulesRequiredByShowcase(showcase: ShowcaseDefinition): ModuleId[] {
  const required = new Set<ModuleId>(["rosalind"]);
  const owner = moduleIdForPlugin(showcase.pluginId);
  if (owner) required.add(owner);
  for (const id of ROSALIND_SHOWCASE_MODULE_DEPENDENCIES[showcase.id] ?? []) required.add(id);
  for (const server of showcase.requiredMcpServers) {
    const id = declaredModule(server);
    if (id) required.add(id);
  }
  for (const operation of showcase.requiredOperations) {
    const id = declaredModule(operation);
    if (id) required.add(id);
  }
  return MODULE_IDS.filter((id) => required.has(id));
}
