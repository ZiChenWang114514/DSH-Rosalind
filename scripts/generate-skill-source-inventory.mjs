import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = resolve(process.env.DSH_ROSALIND_CODEX_PLUGIN_ROOT ?? resolve(homedir(), ".codex", "plugins", "cache", "openai-curated-remote"));
const outputPath = resolve(repositoryRoot, "capabilities", "sources", "skill-source-inventory.json");

const packages = [
  ["life-sciences-literature", "literature", "0.1.5"],
  ["life-sciences-databases", "databases", "0.1.5"],
  ["sequence-viewer", "sequence", "0.1.43"],
  ["ngs-analysis-workbench", "ngs", "0.2.16"],
  ["structure-viewer", "structure", "0.1.80"],
  ["slide-viewer", "slide", "0.1.56"],
];

function frontmatterName(path) {
  const source = readFileSync(path, "utf8");
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  return frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? null;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const skills = [];
for (const [packageName, serviceId, pluginVersion] of packages) {
  const skillsRoot = resolve(referenceRoot, packageName, pluginVersion, "skills");
  if (!existsSync(skillsRoot)) throw new Error(`Fixed-version Skill source directory is missing: ${skillsRoot}`);
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const sourcePath = resolve(skillsRoot, entry.name, "SKILL.md");
    if (!existsSync(sourcePath)) continue;
    const sourceContent = readFileSync(sourcePath);
    const bundledSkillDocument = `skills/${serviceId}/${entry.name}/SKILL.md`;
    const bundledSkillPath = resolve(repositoryRoot, bundledSkillDocument);
    if (!existsSync(bundledSkillPath)) throw new Error(`Bundled Skill document is missing: ${bundledSkillPath}`);
    const pluginId = packageName;
    const sourcePackage = `${packageName}-${pluginVersion}`;
    skills.push({
      serviceId,
      pluginVersion,
      sourcePackage,
      sourceName: entry.name,
      sourceDocument: `${sourcePackage}/skills/${entry.name}/SKILL.md`,
      sourceUri: `codex-plugin://openai-curated-remote/${pluginId}@${pluginVersion}/skills/${entry.name}/SKILL.md`,
      sourceContentSha256: sha256(sourceContent),
      declaredName: frontmatterName(sourcePath),
      bundledSkillDocument,
      bundledContentSha256: sha256(readFileSync(bundledSkillPath)),
    });
  }
}

skills.sort((left, right) => left.sourceDocument.localeCompare(right.sourceDocument));
if (skills.length !== 55) throw new Error(`Expected 55 fixed-version Skill sources, found ${skills.length}.`);

writeFileSync(outputPath, `${JSON.stringify({ schemaVersion: 2, sourceDistribution: "openai-curated-remote", skills }, null, 2)}\n`, "utf8");
console.log(`Recorded ${skills.length} fixed-version Skill source mappings from ${referenceRoot} in ${outputPath}.`);
