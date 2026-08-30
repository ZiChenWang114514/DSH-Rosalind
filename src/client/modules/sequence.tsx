import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";

import { SEQUENCE_TOOLS } from "../science-viewers.js";
import { ScienceToolCard } from "../toolview.js";

export const SEQUENCE_CLIENT_MODULE = {
  id: "sequence",
  version: "0.1.43",
  toolNames: SEQUENCE_TOOLS,
} as const;

export function registerSequenceClientModule(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposers = SEQUENCE_CLIENT_MODULE.toolNames.map((toolName) => ctx.slots.register(
      { name: "tool.call.toolview", key: toolName },
      ScienceToolCard,
    ));
    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }, "dsh-rosalind: sequence client module");
}
