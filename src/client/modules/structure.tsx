import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";

import { STRUCTURE_TOOLS } from "../science-viewers.js";
import { ScienceToolCard } from "../toolview.js";

export const STRUCTURE_CLIENT_MODULE = {
  id: "structure",
  version: "0.1.80",
  toolNames: STRUCTURE_TOOLS,
} as const;

export function registerStructureClientModule(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposers = STRUCTURE_CLIENT_MODULE.toolNames.map((toolName) => ctx.slots.register(
      { name: "tool.call.toolview", key: toolName },
      ScienceToolCard,
    ));
    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }, "dsh-rosalind: structure client module");
}
