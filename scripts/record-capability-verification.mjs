#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const runId = "capability-fixtures-2026-08-30";
const evidencePath = path.join(repositoryRoot, "capabilities", "evidence", `${runId}.json`);
const testFiles = [
  "tests/runtime.test.ts",
  "tests/science-literature-databases.test.ts",
  "tests/database-provider-matrix.test.ts",
  "tests/sequence-ngs-operation-matrix.test.ts",
  "tests/structure-operation-matrix.test.ts",
  "tests/science-slide-parity.test.ts",
  "tests/skills-source.test.ts",
  "tests/skills-workflow-matrix.test.ts",
  "tests/science-integration.test.ts",
  "tests/rosalind-operation.test.ts",
  "tests/dsh-host-registration.test.ts",
];
const fixedInputFiles = [
  "package.json",
  "scripts/generate-capability-manifest.mjs",
  "scripts/record-capability-verification.mjs",
  "showcases/catalog.json",
  "showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/candidates.csv",
  "showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/top5_ensemble_ranking.csv",
];

function relativePath(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join("/");
}

async function filesUnder(relativeDirectory) {
  const directory = path.join(repositoryRoot, relativeDirectory);
  const files = [];
  async function visit(currentDirectory) {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      const file = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(relativePath(file));
    }
  }
  await visit(directory);
  return files.sort();
}

async function contentIdentityFiles() {
  return [...new Set([
    ...fixedInputFiles,
    ...testFiles,
    ...(await filesUnder("src")),
    ...(await filesUnder("skills")),
    ...(await filesUnder("capabilities/contracts")),
    ...(await filesUnder("capabilities/sources")),
  ])].sort();
}

async function digest(relativePath) {
  const content = await readFile(path.join(repositoryRoot, relativePath));
  return createHash("sha256").update(content).digest("hex");
}

const files = await contentIdentityFiles();
const beforeIdentities = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await digest(file)])));
const command = ["vitest", "run", ...testFiles, "--reporter=dot"];
const vitestCli = path.join(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
execFileSync(process.execPath, [vitestCli, ...command.slice(1)], {
  cwd: repositoryRoot,
  stdio: "inherit",
  env: { ...process.env, DSH_ROSALIND_ENABLE_LIVE_NETWORK: "" },
});

const afterIdentities = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await digest(file)])));
const changedFiles = files.filter((file) => beforeIdentities[file] !== afterIdentities[file]);
if (changedFiles.length > 0) {
  throw new Error(`Capability fixture inputs changed while tests ran: ${changedFiles.join(", ")}`);
}
const packageManifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
const record = {
  schemaVersion: 1,
  runId,
  status: "passed",
  recordedAt: new Date().toISOString(),
  package: { name: packageManifest.name, version: packageManifest.version },
  command: `npx ${command.join(" ")}`,
  testFiles,
  contentIdentityFiles: files,
  contentIdentities: afterIdentities,
};

await mkdir(path.dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
console.log(`Recorded ${runId} against ${files.length} unchanged source, fixed-input, contract, Skill, and fixture files.`);
