import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";

import { SLIDE_TOOLS } from "../science-viewers.js";
import { ScienceToolCard } from "../toolview.js";

export const SLIDE_CLIENT_MODULE = {
  id: "slide",
  version: "0.1.56",
  toolNames: SLIDE_TOOLS,
} as const;

export function registerSlideClientModule(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposers = SLIDE_CLIENT_MODULE.toolNames.map((toolName) => ctx.slots.register(
      { name: "tool.call.toolview", key: toolName },
      ScienceToolCard,
    ));
    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }, "dsh-rosalind: slide client module");
}
