import type { ShowcaseDefinition, ShowcaseMode } from "../shared/types.js";

export function buildConversationPrompt(showcase: ShowcaseDefinition, mode: ShowcaseMode): string {
  const modeInstruction: Record<ShowcaseMode, string> = {
    lesson: "Guide me through the scientific question, the recorded observations and results, their interpretation, limitations, and sources.",
    replay: "Inspect the retained evidence and outputs with me, and distinguish what the project records from what still needs verification.",
    reproduce: "Help me prepare a fresh run. Start by reviewing the required inputs and readiness, then ask before any network, paid, GPU, SSH/HPC, or external-write work.",
  };

  return [
    `I want to work with the research project \"${showcase.title}\".`,
    modeInstruction[mode],
  ].join("\n\n");
}
