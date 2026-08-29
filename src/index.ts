import type { Context } from "@deepseek-ai/cordis";

import { RosalindRuntime } from "./host/runtime.js";
import { createRosalindTools } from "./host/tools.js";

export * from "./shared/types.js";
export * from "./shared/categories.js";
export { ShowcaseCatalog } from "./host/catalog.js";
export { ProviderRegistry } from "./host/providers.js";
export { RosalindRuntime } from "./host/runtime.js";
export { createRosalindTools } from "./host/tools.js";
export { validateShowcase } from "./host/validators.js";

export const name = "dsh-rosalind";
export const inject = ["tools"];

export function apply(ctx: Context): void {
  const runtime = new RosalindRuntime();
  ctx.effect(() => {
    const disposers = createRosalindTools(runtime).map((tool) => ctx.tools.register(tool));
    return () => {
      runtime.dispose();
      for (const dispose of disposers.reverse()) dispose();
    };
  }, "dsh-rosalind: tools");
}
