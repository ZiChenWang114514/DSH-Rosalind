import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { SCIENCE_SKILL_SPECS, createScienceSkills } from "../src/host/skills.js";

const repositoryRoot = resolve(import.meta.dirname, "..");
const fixedPluginRoot = resolve(process.env.DSH_ROSALIND_CODEX_PLUGIN_ROOT ?? resolve(homedir(), ".codex", "plugins", "cache", "openai-curated-remote"));
const inventoryPath = resolve(repositoryRoot, "capabilities", "sources", "skill-source-inventory.json");

interface SourceInventory {
  schemaVersion: number;
  sourceDistribution: string;
  skills: Array<{
    serviceId: string;
    pluginVersion: string;
    sourcePackage: string;
    sourceName: string;
    sourceDocument: string;
    sourceUri: string;
    sourceContentSha256: string;
    declaredName: string | null;
    bundledSkillDocument: string;
    bundledContentSha256: string;
  }>;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sourcePackage(serviceId: (typeof SCIENCE_SKILL_SPECS)[number]["serviceId"]): string {
  if (serviceId === "literature") return "life-sciences-literature-0.1.5";
  if (serviceId === "databases") return "life-sciences-databases-0.1.5";
  if (serviceId === "sequence") return "sequence-viewer-0.1.43";
  if (serviceId === "ngs") return "ngs-analysis-workbench-0.2.16";
  if (serviceId === "structure") return "structure-viewer-0.1.80";
  return "slide-viewer-0.1.56";
}

function fixedSourcePath(serviceId: (typeof SCIENCE_SKILL_SPECS)[number]["serviceId"], sourceName: string): string {
  const packageName = sourcePackage(serviceId);
  const version = packageName.match(/-(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)$/)?.[1];
  if (!version) throw new Error(`Cannot parse fixed version from ${packageName}`);
  const pluginId = packageName.slice(0, -(version.length + 1));
  return resolve(fixedPluginRoot, pluginId, version, "skills", sourceName, "SKILL.md");
}

describe("fixed-version Skill compatibility references", () => {
  it("ships a portable inventory for every fixed-version compatibility reference", () => {
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as SourceInventory;
    expect(inventory.schemaVersion).toBe(2);
    expect(inventory.sourceDistribution).toBe("openai-curated-remote");
    expect(inventory.skills).toHaveLength(55);
    expect(new Set(inventory.skills.map((item) => item.sourceDocument)).size).toBe(55);

    for (const spec of SCIENCE_SKILL_SPECS) {
      const packageName = sourcePackage(spec.serviceId);
      const expectedSource = `${packageName}/skills/${spec.sourceName}/SKILL.md`;
      const recorded = inventory.skills.find((item) => item.serviceId === spec.serviceId && item.sourceName === spec.sourceName);
      expect(recorded, expectedSource).toMatchObject({ sourcePackage: packageName, sourceDocument: expectedSource });
      expect(recorded?.pluginVersion, expectedSource).toBe(packageName.match(/-(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)$/)?.[1]);
      expect(recorded?.declaredName, expectedSource).toBeTruthy();
      expect(recorded?.sourceUri, expectedSource).toBe(
        `codex-plugin://openai-curated-remote/${packageName.slice(0, -(recorded!.pluginVersion.length + 1))}@${recorded!.pluginVersion}/skills/${spec.sourceName}/SKILL.md`,
      );
      expect(recorded?.sourceContentSha256, expectedSource).toMatch(/^[a-f0-9]{64}$/);
      expect(recorded?.bundledSkillDocument, expectedSource).toBe(`skills/${spec.serviceId}/${spec.sourceName}/SKILL.md`);
      expect(recorded?.bundledContentSha256, expectedSource).toBe(
        sha256(resolve(repositoryRoot, `skills/${spec.serviceId}/${spec.sourceName}/SKILL.md`)),
      );
    }
  });

  it("records one named fixed-version compatibility reference in every bundled Skill", () => {
    const byName = new Map(createScienceSkills(repositoryRoot).map((skill) => [skill.name, skill]));

    for (const spec of SCIENCE_SKILL_SPECS) {
      const packageName = sourcePackage(spec.serviceId);
      const expectedSource = `${packageName}/skills/${spec.sourceName}/SKILL.md`;
      const registeredName = `rosalind-${spec.serviceId}-${spec.sourceName.replace(/-skill$/, "")}`;
      const generated = byName.get(registeredName);

      expect(generated, registeredName).toBeDefined();
      expect(generated?.content, registeredName).toContain(`\`${expectedSource}\``);
      expect(generated?.content, registeredName).not.toContain("<!-- dsh-rosalind-adaptation:v1 -->");
      expect(generated?.content, registeredName).toContain("## Tool call sequence");
    }
  });

  it.skipIf(!existsSync(fixedPluginRoot))("checks compatibility metadata without copying installed Skill text", () => {
    for (const spec of SCIENCE_SKILL_SPECS) {
      const packageName = sourcePackage(spec.serviceId);
      const relative = `${packageName}/skills/${spec.sourceName}/SKILL.md`;
      const referencePath = fixedSourcePath(spec.serviceId, spec.sourceName);

      expect(existsSync(referencePath), relative).toBe(true);
      const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as SourceInventory;
      const recorded = inventory.skills.find((item) => item.sourceDocument === relative)!;
      expect(sha256(referencePath), relative).toBe(recorded.sourceContentSha256);
      const bundledContent = readFileSync(resolve(repositoryRoot, recorded.bundledSkillDocument), "utf8");
      expect(sha256(resolve(repositoryRoot, recorded.bundledSkillDocument)), relative).toBe(recorded.bundledContentSha256);
      expect(recorded.bundledContentSha256, relative).not.toBe(recorded.sourceContentSha256);
      expect(bundledContent, relative).not.toContain("<!-- dsh-rosalind-adaptation:v1 -->");
      expect(bundledContent, relative).toContain(`\`${relative}\``);
    }
  });
});
