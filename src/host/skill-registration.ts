import { readFileSync } from "node:fs";
import { dirname } from "node:path";

import type { SkillRegistration } from "@deepseek-ai/dsh-skill";

import { findPackageRoot, resolveInside } from "./catalog.js";

export interface SkillSpec {
  serviceId: "literature" | "databases" | "sequence" | "ngs" | "structure" | "slide";
  sourceName: string;
  title: string;
  description: string;
  /** A fixed primary tool only when the source Skill itself names one. */
  tool?: string;
  executionMode?: "primary-tool" | "reasoning-only" | "routing" | "inspection-guided";
}

function runtimeName(spec: SkillSpec): string {
  const base = spec.sourceName.replace(/-skill$/, "");
  return `rosalind-${spec.serviceId}-${base}`;
}

function stripFrontmatter(value: string): string {
  return value.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

export function createSkillRegistrations(
  specs: readonly SkillSpec[],
  packageRoot = findPackageRoot(),
): SkillRegistration[] {
  return specs.map((spec) => {
    const path = resolveInside(packageRoot, `skills/${spec.serviceId}/${spec.sourceName}/SKILL.md`);
    return {
      name: runtimeName(spec),
      description: spec.description,
      whenToUse: `Use for ${spec.title} research tasks in DSH-Rosalind.`,
      content: stripFrontmatter(readFileSync(path, "utf8")),
      source: "bundled",
      provider: "dsh-rosalind",
      path,
      resourceBase: { kind: "directory", path: dirname(path) },
      invocation: { modelInvocable: true, userInvocable: true },
    };
  });
}
