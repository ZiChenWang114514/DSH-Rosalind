import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const committedDirectory = path.join(repositoryRoot, "capabilities");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "dsh-rosalind-capabilities-"));
const isolatedRepository = path.join(temporaryRoot, "checkout");
const outputDirectory = path.join(temporaryRoot, "generated");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const requiredRepositoryPaths = [
  "scripts/generate-capability-manifest.mjs",
  "capabilities/sources",
  "capabilities/contracts",
  "showcases/catalog.json",
  "docs/evidence/capability-verification.md",
  "src/host/science",
  "src/host/science-tools.ts",
  "tests",
  "skills",
];

function withoutGeneratedAt(manifest) {
  const { generatedAt: _generatedAt, ...semanticManifest } = manifest;
  return semanticManifest;
}

try {
  await mkdir(isolatedRepository, { recursive: true });
  for (const relativePath of requiredRepositoryPaths) {
    await cp(
      path.join(repositoryRoot, relativePath),
      path.join(isolatedRepository, relativePath),
      { recursive: true },
    );
  }

  const {
    ROSALIND_COVERAGE_PATH: _coverageOverride,
    ROSALIND_CAPABILITY_CONTRACT_DIR: _contractOverride,
    ROSALIND_MCP_AUDIT_DIR: _legacyAuditOverride,
    ...cleanEnvironment
  } = process.env;
  execFileSync(process.execPath, ["scripts/generate-capability-manifest.mjs"], {
    cwd: isolatedRepository,
    env: { ...cleanEnvironment, ROSALIND_CAPABILITY_OUTPUT_DIR: outputDirectory },
    stdio: "pipe",
  });

  const committedManifest = await readJson(path.join(committedDirectory, "capability-manifest.json"));
  const generatedManifest = await readJson(path.join(outputDirectory, "capability-manifest.json"));
  assert.deepStrictEqual(withoutGeneratedAt(generatedManifest), withoutGeneratedAt(committedManifest));
  assert.equal(generatedManifest.target.serviceCount, 7);
  assert.equal(generatedManifest.target.skillCount, 55);
  assert.equal(generatedManifest.target.requiredOperationCount, 117);

  const committedContractDirectory = path.join(committedDirectory, "contracts");
  const generatedContractDirectory = path.join(outputDirectory, "contracts");
  const contractFiles = (await readdir(committedContractDirectory)).filter((file) => file.endsWith(".json")).sort();
  assert.deepStrictEqual(
    (await readdir(generatedContractDirectory)).filter((file) => file.endsWith(".json")).sort(),
    contractFiles,
  );
  for (const file of contractFiles) {
    assert.deepStrictEqual(
      await readJson(path.join(generatedContractDirectory, file)),
      await readJson(path.join(committedContractDirectory, file)),
      `${file} differs from its generated contract`,
    );
  }

  console.log(`Capability generation reproduced 7 services, 55 Skills, 117 operations, and ${contractFiles.length} contracts from repository inputs.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
