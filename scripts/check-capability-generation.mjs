import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const committedDirectory = path.join(repositoryRoot, "capabilities");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "dsh-rosalind-capabilities-"));
const isolatedRepository = path.join(temporaryRoot, "checkout");
const outputDirectory = path.join(temporaryRoot, "generated");
const staleFixedInputOutputDirectory = path.join(temporaryRoot, "generated-after-fixed-input-change");
const staleSourceOutputDirectory = path.join(temporaryRoot, "generated-after-source-change");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const requiredRepositoryPaths = [
  "package.json",
  "scripts/generate-capability-manifest.mjs",
  "scripts/lib/capability-evidence.mjs",
  "scripts/record-capability-verification.mjs",
  "scripts/validate-capabilities.mjs",
  "scripts/verify-dsh-registration.mjs",
  "vitest.dsh-profile-evidence.config.ts",
  "capabilities/sources",
  "capabilities/contracts",
  "showcases",
  "docs/evidence/capability-verification.md",
  "capabilities/evidence",
  "src",
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
  assert.equal(generatedManifest.target.requiredOperationCount, 121);

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

  const candidatesPath = path.join(
    isolatedRepository,
    "showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/candidates.csv",
  );
  const originalCandidates = await readFile(candidatesPath, "utf8");
  await appendFile(candidatesPath, "\n", "utf8");
  execFileSync(process.execPath, ["scripts/generate-capability-manifest.mjs"], {
    cwd: isolatedRepository,
    env: { ...cleanEnvironment, ROSALIND_CAPABILITY_OUTPUT_DIR: staleFixedInputOutputDirectory },
    stdio: "pipe",
  });
  const staleFixedInputManifest = await readJson(path.join(staleFixedInputOutputDirectory, "capability-manifest.json"));
  assert.equal(staleFixedInputManifest.verificationRuns[0].status, "not-recorded");
  assert.equal(staleFixedInputManifest.verificationRuns[0].contentIdentityMatch, false);
  assert.equal(staleFixedInputManifest.target.verifiedOperationCount, 0);
  await writeFile(candidatesPath, originalCandidates, "utf8");

  await appendFile(
    path.join(isolatedRepository, "src", "host", "science", "ngs.ts"),
    "\n// capability evidence invalidation probe\n",
    "utf8",
  );
  execFileSync(process.execPath, ["scripts/generate-capability-manifest.mjs"], {
    cwd: isolatedRepository,
    env: { ...cleanEnvironment, ROSALIND_CAPABILITY_OUTPUT_DIR: staleSourceOutputDirectory },
    stdio: "pipe",
  });
  const staleSourceManifest = await readJson(path.join(staleSourceOutputDirectory, "capability-manifest.json"));
  assert.equal(staleSourceManifest.verificationRuns[0].status, "not-recorded");
  assert.equal(staleSourceManifest.verificationRuns[0].contentIdentityMatch, false);
  assert.equal(staleSourceManifest.target.verifiedOperationCount, 0);

  console.log(`Capability generation reproduced 7 services, 55 Skills, 121 operations, and ${contractFiles.length} contracts; fixed-input and source mutations invalidated executed evidence.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
