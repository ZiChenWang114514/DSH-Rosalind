import type { Plugin } from "@deepseek-ai/cordis";
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";

import { ConversationWorkbenchView, HeroWorkspacePicker, RosalindBrandMark, ShowcaseDetailOverlay } from "./components.js";
import { setWorkbenchModuleAvailability } from "./session-evidence.js";
import { ProviderSettings } from "./settings.js";
import { ROSALIND_TOOL_NAMES, SCIENCE_VIEWER_TOOL_NAMES, RosalindToolCard, ScienceToolCard } from "./toolview.js";

export const NGS_WORKBENCH_TOOL_NAMES = Object.freeze(SCIENCE_VIEWER_TOOL_NAMES.filter((name) => name.startsWith("ngs_")));

export function createNgsWorkbenchClientModule(): Plugin.Object {
  return {
    name: "dsh-rosalind-ngs-workbench-client",
    inject: ["slots"],
    apply(ctx: ClientContext): void {
      ctx.effect(() => {
        setWorkbenchModuleAvailability("ngs", "available");
        const disposers = NGS_WORKBENCH_TOOL_NAMES.map((toolName) => ctx.slots.register({ name: "tool.call.toolview", key: toolName }, ScienceToolCard));
        return () => {
          for (const dispose of disposers.reverse()) dispose();
          setWorkbenchModuleAvailability("ngs", "disabled");
        };
      }, "dsh-rosalind: NGS Analysis Workbench client module");
    },
  };
}

export function createRosalindWorkbenchClientModule(): Plugin.Object {
  return {
    name: "dsh-rosalind-workbench-client",
    inject: ["slots"],
    apply(ctx: ClientContext): void {
      ctx.effect(() => {
        setWorkbenchModuleAvailability("rosalind", "available");
        const disposers = [
          ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -20 }, RosalindBrandMark),
          ctx.slots.register({ name: "conversation.hero.workspace", priority: -20 }, HeroWorkspacePicker),
          ctx.slots.register({ name: "conversation.view", id: "dsh-rosalind", order: 30, label: "Workbench" }, ConversationWorkbenchView),
          ctx.slots.register({ name: "settings.section", id: "dsh-rosalind", order: 45, label: "Rosalind" }, ProviderSettings),
          ctx.slots.register({ name: "shell.overlay", id: "dsh-rosalind-detail", order: 60 }, ShowcaseDetailOverlay),
          ...ROSALIND_TOOL_NAMES.map((toolName) => ctx.slots.register({ name: "tool.call.toolview", key: toolName }, RosalindToolCard)),
        ];
        return () => {
          for (const dispose of disposers.reverse()) dispose();
          setWorkbenchModuleAvailability("rosalind", "disabled");
        };
      }, "dsh-rosalind: Rosalind Workbench client module");
    },
  };
}

export const ngsWorkbenchClientModule = createNgsWorkbenchClientModule();
export const rosalindWorkbenchClientModule = createRosalindWorkbenchClientModule();
