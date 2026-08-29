import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import type {} from "@deepseek-ai/dsh-client-ui-conversation/client";
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import type {} from "@deepseek-ai/dsh-client-ui-tool/client";

import { ConversationWorkbenchView, HeroWorkspacePicker, RosalindBrandMark, ShowcaseDetailOverlay, Workbench } from "./components.js";
import { ProviderSettings } from "./settings.js";
import { WORKBENCH_CSS } from "./styles.js";
import { ROSALIND_TOOL_NAMES, RosalindToolCard } from "./toolview.js";

export * from "../shared/types.js";
export { Workbench, ShowcaseDetailOverlay, ProviderSettings, RosalindToolCard };

export const name = "dsh-rosalind-client";
export const inject = ["slots"];

function installStyles(): () => void {
  const id = "dsh-rosalind-styles";
  const existing = document.getElementById(id);
  if (existing) return () => undefined;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = WORKBENCH_CSS;
  document.head.append(style);
  return () => style.remove();
}

export function apply(ctx: ClientContext): void {
  ctx.effect(installStyles, "dsh-rosalind: styles");
  ctx.slots.inject("conversation.hero.brand.mark", () => ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -20 }, RosalindBrandMark));
  ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register({ name: "conversation.hero.workspace", priority: -20 }, HeroWorkspacePicker));
  ctx.slots.inject("conversation.view", () => ctx.slots.register({ name: "conversation.view", id: "dsh-rosalind", order: 30, label: "Workbench" }, ConversationWorkbenchView));
  ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "dsh-rosalind", order: 45, label: "Rosalind" }, ProviderSettings));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "dsh-rosalind-detail", order: 60 }, ShowcaseDetailOverlay));
  for (const toolName of ROSALIND_TOOL_NAMES) {
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: toolName }, RosalindToolCard));
  }
}
