import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import type {} from "@deepseek-ai/dsh-client-ui-conversation/client";
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import type {} from "@deepseek-ai/dsh-client-ui-tool/client";

import { ShowcaseDetailOverlay, Workbench } from "./components.js";
import { ProviderSettings } from "./settings.js";
import { SCIENCE_VIEWER_CSS } from "./science-viewers.css.js";
import { WORKBENCH_CSS } from "./styles.js";
import { SCIENCE_VIEWER_TOOL_NAMES, RosalindToolCard, ScienceToolCard } from "./toolview.js";
import { createNgsWorkbenchClientModule, createRosalindWorkbenchClientModule, NGS_WORKBENCH_TOOL_NAMES } from "./workflow-modules.js";
export { ScienceEcosystemPanel, SCIENCE_ECOSYSTEMS } from "./ecosystem.js";

export * from "../shared/types.js";
export { Workbench, ShowcaseDetailOverlay, ProviderSettings, RosalindToolCard, ScienceToolCard };
export {
  createNgsWorkbenchClientModule,
  createRosalindWorkbenchClientModule,
  NGS_WORKBENCH_TOOL_NAMES,
  ngsWorkbenchClientModule,
  rosalindWorkbenchClientModule,
} from "./workflow-modules.js";

export const name = "dsh-rosalind-client";
export const inject = ["slots"];

function installStyles(): () => void {
  const id = "dsh-rosalind-styles";
  const existing = document.getElementById(id);
  if (existing) return () => undefined;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `${WORKBENCH_CSS}\n${SCIENCE_VIEWER_CSS}`;
  document.head.append(style);
  return () => style.remove();
}

export function apply(ctx: ClientContext): void {
  ctx.effect(installStyles, "dsh-rosalind: styles");
  const ngsTools = new Set(NGS_WORKBENCH_TOOL_NAMES);
  for (const toolName of SCIENCE_VIEWER_TOOL_NAMES.filter((name) => !ngsTools.has(name))) {
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: toolName }, ScienceToolCard));
  }
  ctx.plugin(createNgsWorkbenchClientModule());
  ctx.plugin(createRosalindWorkbenchClientModule());
}
