import type { Context } from "@deepseek-ai/cordis";

import type { CapabilityRegistry } from "../capabilities.js";
import { createScienceTools, type ScienceExecutor } from "../science-tools.js";

export const SLIDE_HOST_MODULE = {
  id: "slide",
  version: "0.1.56",
  toolPrefix: "slide_",
} as const;

export function registerSlideHostModule(
  ctx: Context,
  runtime: ScienceExecutor,
  capabilities: CapabilityRegistry,
): Array<() => void> {
  return createScienceTools(runtime, capabilities, [SLIDE_HOST_MODULE.id])
    .map((tool) => ctx.tools.register(tool));
}
