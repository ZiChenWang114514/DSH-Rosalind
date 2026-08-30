import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { gunzipSync } from "node:zlib";

import { npmArchiveBaseName } from "./lib/release-paths.mjs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const archiveName = npmArchiveBaseName(pkg);
const archivePath = process.argv[2] ?? process.env.DSH_ROSALIND_BUNDLE_ARCHIVE ?? archiveName;
if (!existsSync(archivePath)) {
  throw new Error(`Expected npm pack archive ${archivePath} was not found.`);
}

const SKILL_ADAPTER_TOOL_NAMES = [
  "literature_request", "database_request", "slide_control_viewer",
  "slide_run_analysis_from_chat", "slide_run_pathology", "slide_query_scientific_layer",
];
const SLIDE_COMPATIBILITY_NAMES = SKILL_ADAPTER_TOOL_NAMES.slice(2);
const ROSALIND_TOOL_NAMES = [
  "rosalind_catalog_list", "rosalind_showcase_get", "rosalind_provider_status",
  "rosalind_showcase_import", "rosalind_plan", "rosalind_approve", "rosalind_run",
  "rosalind_status", "rosalind_cancel", "rosalind_artifact_list",
  "rosalind_artifact_open", "rosalind_export", "rosalind_review",
];
const PUBLIC_PROVIDER_IDS = ["gtex-eqtl", "clinvar-variation", "ukb-topmed-phewas", "gnomad-graphql"];
const PUBLIC_PROVIDER_CONTRACTS = ["article-dataset", ...PUBLIC_PROVIDER_IDS];
const EXPECTED_TOOL_COUNT = 121 + SKILL_ADAPTER_TOOL_NAMES.length + ROSALIND_TOOL_NAMES.length;

function readEntries(buffer) {
  const entries = [];
  let position = 0;
  while (position + 512 <= buffer.length) {
    const header = buffer.subarray(position, position + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const sizeText = header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    if (!Number.isFinite(size) || size < 0) throw new Error(`Invalid tar entry size for ${name || "unnamed entry"}.`);
    const entryName = prefix ? `${prefix}/${name}` : name;
    entries.push({ name: entryName, data: buffer.subarray(position + 512, position + 512 + size) });
    position += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

const entries = readEntries(gunzipSync(readFileSync(archivePath)));
const entryMap = new Map(entries.map((entry) => [entry.name, entry.data]));
const entryNames = entries.map((entry) => entry.name);
const required = [
  "package/package.json",
  "package/lib/index.js",
  "package/lib/client.js",
  "package/lib/types/index.d.ts",
  "package/lib/types/client/index.d.ts",
  "package/cordis.patch.yml",
  "package/capabilities/capability-manifest.json",
  "package/capabilities/sources/skill-source-inventory.json",
  "package/workflows/oai_fastq_qc/workflow/Snakefile",
  "package/workflows/oai_bulk_rnaseq_counts_qc/workflow/Snakefile",
  "package/workflows/oai_scrnaseq_fastq_to_count/workflow/Snakefile",
  "package/README.md",
  "package/README.zh-CN.md",
  "package/THIRD_PARTY_NOTICES.md",
  "package/schema/catalog.schema.json",
];
const missing = required.filter((entry) => !entryMap.has(entry));
if (EXPECTED_TOOL_COUNT !== 140) missing.push(`140-tool contract arithmetic (found ${EXPECTED_TOOL_COUNT})`);
const skillCount = entryNames.filter((entry) => entry.startsWith("package/skills/") && entry.endsWith("/SKILL.md")).length;
const showcaseCount = entryNames.filter((entry) => entry.startsWith("package/showcases/") && entry.endsWith("showcase.json")).length;
if (skillCount !== 55) missing.push(`55 project Skill documents (found ${skillCount})`);
if (showcaseCount !== 100) missing.push(`100 showcase manifests (found ${showcaseCount})`);
const packedCatalogText = entryMap.get("package/showcases/catalog.json")?.toString("utf8");
if (!packedCatalogText) {
  missing.push("showcase catalogue");
} else {
  const packedCatalog = JSON.parse(packedCatalogText);
  const catalogueIds = [];
  for (const plugin of packedCatalog.plugins ?? []) {
    for (const summary of plugin.showcases ?? []) {
      catalogueIds.push(summary.id);
      const caseRoot = `package/${summary.case_path}`;
      const manifestPath = `${caseRoot}/showcase.json`;
      const manifestText = entryMap.get(manifestPath)?.toString("utf8");
      if (!manifestText) {
        missing.push(manifestPath);
        continue;
      }
      const manifest = JSON.parse(manifestText);
      const referenced = new Set(["README.md", manifest.prompt]);
      for (const group of [manifest.inputs, manifest.outputs, manifest.previews, manifest.dependencies?.artifacts]) {
        for (const item of group ?? []) referenced.add(item.repository_path ?? item.path);
      }
      for (const record of manifest.provenance ?? []) {
        for (const group of [record.inputs, record.outputs, record.previews]) {
          for (const item of group ?? []) referenced.add(typeof item === "string" ? item : item.repository_path ?? item.path);
        }
      }
      for (const relative of referenced) {
        if (!relative) continue;
        const packedPath = relative.startsWith("showcases/") ? `package/${relative}` : `${caseRoot}/${relative}`;
        if (!entryMap.has(packedPath)) missing.push(`${summary.id} reference ${packedPath}`);
      }
    }
  }
  if (catalogueIds.length !== 100 || new Set(catalogueIds).size !== 100) {
    missing.push(`100 unique catalogue IDs (found ${catalogueIds.length}/${new Set(catalogueIds).size} unique)`);
  }
}
const forbidden = entryNames.filter((entry) => /^package\/(?:src|tests|node_modules|reference-plugins|assets\/upstream)\//.test(entry));
for (const workflowId of ["oai_fastq_qc", "oai_bulk_rnaseq_counts_qc", "oai_scrnaseq_fastq_to_count"]) {
  const prefix = `package/workflows/${workflowId}/`;
  const requiredWorkflowFiles = ["workflow/Snakefile", "config/config.yaml", "config/config.schema.yaml", "config/smoke.yaml", "README.md"];
  for (const relative of requiredWorkflowFiles) if (!entryMap.has(`${prefix}${relative}`)) missing.push(`${workflowId}/${relative}`);
}

function fileText(path) {
  const data = entryMap.get(path);
  return data ? data.toString("utf8") : "";
}

function requireTokens(path, tokens, label) {
  const content = fileText(path);
  const absent = tokens.filter((token) => !content.includes(token));
  if (absent.length) missing.push(`${label} in ${path}: ${absent.join(", ")}`);
}

const capabilityManifestText = fileText("package/capabilities/capability-manifest.json");
if (capabilityManifestText) {
  const capabilityManifest = JSON.parse(capabilityManifestText);
  const operationCount = capabilityManifest.target?.requiredOperationCount;
  if (operationCount !== 121) missing.push(`121 fixed operations in capability manifest (found ${String(operationCount)})`);
}
const skillSourceInventoryText = fileText("package/capabilities/sources/skill-source-inventory.json");
if (skillSourceInventoryText) {
  const inventory = JSON.parse(skillSourceInventoryText);
  if (inventory.schemaVersion !== 2 || inventory.sourceDistribution !== "openai-curated-remote") {
    missing.push("portable fixed-version Skill provenance inventory v2");
  }
  if (!Array.isArray(inventory.skills) || inventory.skills.length !== 55) {
    missing.push(`55 Skill provenance records (found ${String(inventory.skills?.length)})`);
  } else {
    for (const item of inventory.skills) {
      const bundledPath = `package/${item.bundledSkillDocument}`;
      const content = entryMap.get(bundledPath);
      if (!content) {
        missing.push(`bundled Skill provenance target ${bundledPath}`);
        continue;
      }
      if (!/^codex-plugin:\/\/openai-curated-remote\//.test(item.sourceUri ?? "")) missing.push(`Skill source URI for ${item.sourceName}`);
      if (!/^[a-f0-9]{64}$/.test(item.sourceContentSha256 ?? "")) missing.push(`Skill source digest for ${item.sourceName}`);
      const canonicalContent = Buffer.from(content.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
      const bundledDigest = (await import("node:crypto")).createHash("sha256").update(canonicalContent).digest("hex");
      if (bundledDigest !== item.bundledContentSha256) missing.push(`bundled Skill digest for ${item.sourceName}`);
    }
  }
}
requireTokens("package/lib/index.js", SKILL_ADAPTER_TOOL_NAMES, "Skill adapter tools");
requireTokens("package/lib/index.js", ROSALIND_TOOL_NAMES, "Rosalind tools");
requireTokens("package/lib/index.js", PUBLIC_PROVIDER_CONTRACTS, "PMC/provider contracts");
requireTokens("package/lib/client.js", PUBLIC_PROVIDER_IDS, "client provider contracts");
const clientText = fileText("package/lib/client.js");
for (const marker of ["drr-upstream-app__frame", "Full Sequence Viewer connected to DSH", "fixed NGS application"]) {
  if (clientText.includes(marker)) forbidden.push(`third-party application marker in package/lib/client.js: ${marker}`);
}
if (missing.length || forbidden.length) {
  const details = [
    missing.length ? `Missing: ${missing.join(", ")}` : "",
    forbidden.length ? `Unexpected development files: ${forbidden.join(", ")}` : "",
  ].filter(Boolean).join("\n");
  throw new Error(`Packed DSH bundle failed content inspection.\n${details}`);
}
console.log(`Packed bundle inspection passed: ${basename(archivePath)} contains ${entries.length} files, ${skillCount} project Skills, ${showcaseCount} showcase manifests, and the 140-tool contract (121 fixed operations + ${SKILL_ADAPTER_TOOL_NAMES.length} Skill adapters, including ${SLIDE_COMPATIBILITY_NAMES.length} Slide compatibility tools + ${ROSALIND_TOOL_NAMES.length} Rosalind tools).`);
