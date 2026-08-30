import type { Context } from "@deepseek-ai/cordis";

import type { CapabilityRegistry } from "../capabilities.js";
import { createScienceTools, type ScienceExecutor } from "../science-tools.js";

export const STRUCTURE_HOST_MODULE = {
  id: "structure",
  version: "0.1.80",
  toolPrefix: "structure_",
} as const;

export function registerStructureHostModule(
  ctx: Context,
  runtime: ScienceExecutor,
  capabilities: CapabilityRegistry,
): Array<() => void> {
  return createScienceTools(runtime, capabilities, [STRUCTURE_HOST_MODULE.id])
    .map((tool) => ctx.tools.register(tool));
}
