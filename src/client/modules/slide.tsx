import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";

import { SLIDE_TOOLS } from "../science-viewers.js";
import { ScienceToolCard } from "../toolview.js";

export const SLIDE_CLIENT_MODULE = {
  id: "slide",
  version: "0.1.56",
  toolNames: SLIDE_TOOLS,
} as const;

export function registerSlideClientModule(ctx: ClientContext): void {
  for (const toolName of SLIDE_CLIENT_MODULE.toolNames) {
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register(
      { name: "tool.call.toolview", key: toolName },
      ScienceToolCard,
    ));
  }
}
