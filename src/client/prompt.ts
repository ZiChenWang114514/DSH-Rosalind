import type { ShowcaseDefinition, ShowcaseMode } from "../shared/types.js";

export function buildConversationPrompt(showcase: ShowcaseDefinition, mode: ShowcaseMode): string {
  const modeInstruction: Record<ShowcaseMode, string> = {
    lesson: "Teach this case from its retained evidence. Explain the scientific question, observations, computed results, interpretation, limitations, and sources.",
    replay: "Open the retained outputs and previews for this case. Verify claims against the indexed artifacts before summarizing them.",
    reproduce: "Prepare a fresh execution plan for this case. Check provider readiness first and request my confirmation before any network, paid, GPU, SSH/HPC, or external-write step.",
  };

  return [
    `Import the DSH-Rosalind showcase \"${showcase.title}\" (${showcase.id}) in ${mode} mode.`,
    modeInstruction[mode],
    `Call rosalind_showcase_import with showcase_id=\"${showcase.id}\" and mode=\"${mode}\" to load its conversation bundle.`,
    `Use adapter \"${showcase.recipe.adapter}\" and keep source observations, computed results, scientific interpretation, and limitations in separate sections.`,
  ].join("\n\n");
}
