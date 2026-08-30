import type { Context } from "@deepseek-ai/cordis";

import type { CapabilityRegistry } from "../capabilities.js";
import { createScienceTools, type ScienceExecutor } from "../science-tools.js";

export const SEQUENCE_HOST_MODULE = {
  id: "sequence",
  version: "0.1.43",
  toolPrefix: "sequence_",
} as const;

export function registerSequenceHostModule(
  ctx: Context,
  runtime: ScienceExecutor,
  capabilities: CapabilityRegistry,
): Array<() => void> {
  return createScienceTools(runtime, capabilities, [SEQUENCE_HOST_MODULE.id])
    .map((tool) => ctx.tools.register(tool));
}
