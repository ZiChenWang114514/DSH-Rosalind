#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { publicVitestCommand, sanitizeVitestReport } from "./lib/capability-evidence.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const runId = "capability-fixtures-2026-08-30";
const evidenceDirectory = path.join(repositoryRoot, "capabilities", "evidence");
const evidencePath = path.join(evidenceDirectory, `${runId}.json`);
const standardReportPath = path.join(evidenceDirectory, `${runId}.vitest.json`);
const profileReportPath = path.join(evidenceDirectory, `${runId}.profile-vitest.json`);

// Keep this list deliberately explicit. Capability verification must exercise
// the production NGS lifecycle, strict output schemas, native ToolRuntime
// integration, and the two interactive local viewers rather than merely the
// source-to-manifest catalogue tests.
const testFiles = [
  "tests/runtime.test.ts",
  "tests/capability-evidence-trust.test.ts",
  "tests/science-literature-databases.test.ts",
  "tests/database-provider-matrix.test.ts",
  "tests/sequence-ngs-operation-matrix.test.ts",
  "tests/rosalind-ngs-production.test.ts",
  "tests/ngs-local-execution.test.ts",
  "tests/ngs-mcp-facades.test.ts",
  "tests/ngs-persistence.test.ts",
  "tests/science-output-schema.test.ts",
  "tests/structure-operation-matrix.test.ts",
  "tests/structure-toolruntime.test.ts",
  "tests/structure-runtime.test.ts",
  "tests/structure-canvas.test.tsx",
  "tests/science-slide-parity.test.ts",
  "tests/science-slide-runtime.test.ts",
  "tests/science-slide-canvas.test.tsx",
  "tests/skills-source.test.ts",
  "tests/skills-workflow-matrix.test.ts",
  "tests/skills-registry-trace.test.ts",
  "tests/science-integration.test.ts",
  "tests/rosalind-operation.test.ts",
  "tests/dsh-host-registration.test.ts",
  "tests/dsh-isolated-profile-evidence.test.ts",
];
const isolatedProfileTest = "tests/dsh-isolated-profile-evidence.test.ts";
const standardTestFiles = testFiles.filter((file) => file !== isolatedProfileTest);
const fixedInputFiles = [
  "package.json",
  "scripts/generate-capability-manifest.mjs",
  "scripts/lib/capability-evidence.mjs",
  "scripts/record-capability-verification.mjs",
  "scripts/verify-dsh-registration.mjs",
  "scripts/validate-capabilities.mjs",
  "vitest.dsh-profile-evidence.config.ts",
  "showcases/catalog.json",
  "showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/candidates.csv",
  "showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/top5_ensemble_ranking.csv",
];

function relativePath(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join("/");
}

function normaliseReportPath(file) {
  const publicPath = String(file ?? "").split("\\").join("/");
  if (publicPath.toLowerCase().startsWith("<repo>/")) {
    return path.join(repositoryRoot, publicPath.slice("<repo>/".length)).split(path.sep).join("/").toLowerCase();
  }
  return path.resolve(publicPath).split(path.sep).join("/").toLowerCase();
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

async function digest(relativeFile) {
  const content = await readFile(path.join(repositoryRoot, relativeFile));
  return createHash("sha256").update(content).digest("hex");
}

function runVitest(vitestCli, files, reportPath, config) {
  const args = ["run", ...files, "--reporter=json", `--outputFile=${reportPath}`];
  if (config) args.splice(1, 0, "--config", config);
  execFileSync(process.execPath, [vitestCli, ...args], {
    cwd: repositoryRoot,
    stdio: "inherit",
    env: { ...process.env, DSH_ROSALIND_ENABLE_LIVE_NETWORK: "" },
  });
  return args;
}

function extractTestCases(report, expectedFiles, reportLabel) {
  if (!report?.success) throw new Error(`${reportLabel}: Vitest did not report success`);
  const results = Array.isArray(report.testResults) ? report.testResults : [];
  const expected = new Map(expectedFiles.map((file) => [normaliseReportPath(path.join(repositoryRoot, file)), file]));
  const seenFiles = new Set();
  const cases = [];
  for (const result of results) {
    const relativeFile = expected.get(normaliseReportPath(result.name));
    if (!relativeFile) continue;
    seenFiles.add(relativeFile);
    const assertions = Array.isArray(result.assertionResults) ? result.assertionResults : [];
    if (assertions.length === 0) throw new Error(`${reportLabel}: ${relativeFile} reported no assertions`);
    for (const assertion of assertions) {
      if (assertion.status !== "passed") {
        throw new Error(`${reportLabel}: ${relativeFile} :: ${assertion.fullName ?? assertion.title ?? "unnamed assertion"} is ${assertion.status}`);
      }
      cases.push({ file: relativeFile, fullName: assertion.fullName, title: assertion.title, status: assertion.status });
    }
  }
  const absent = expectedFiles.filter((file) => !seenFiles.has(file));
  if (absent.length > 0) throw new Error(`${reportLabel}: required test files were absent from the JSON report: ${absent.join(", ")}`);
  return cases;
}

function verifyProfileArchive(profileReport) {
  const installation = profileReport?.isolatedProfileEvidence?.installation;
  if (!installation || typeof installation !== "object") throw new Error("profile verifier returned no isolated-profile installation evidence");
  for (const key of ["archive", "archiveSha256", "archiveSource"]) {
    if (typeof installation[key] !== "string" || installation[key].length === 0) throw new Error(`profile verifier omitted installation.${key}`);
  }
  if (!Number.isInteger(installation.archiveBytes) || installation.archiveBytes <= 0) throw new Error("profile verifier omitted a positive archive byte count");
  const explicitlySelected = installation.archiveSource === "DSH_ROSALIND_PROFILE_ARCHIVE";
  const expectedArchive = process.env.DSH_ROSALIND_PROFILE_ARCHIVE;
  if (expectedArchive && !explicitlySelected) throw new Error("profile verifier did not use DSH_ROSALIND_PROFILE_ARCHIVE");
  return {
    archive: installation.archive,
    archiveBytes: installation.archiveBytes,
    archiveSha256: installation.archiveSha256,
    archiveSource: installation.archiveSource,
    archiveKind: explicitlySelected ? "explicit-tgz" : "source-smoke",
    releaseArchiveValidated: explicitlySelected,
    dshVersion: installation.dshVersion,
  };
}

async function main() {
  const files = await contentIdentityFiles();
  const beforeIdentities = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await digest(file)])));
  await mkdir(evidenceDirectory, { recursive: true });
  const vitestCli = path.join(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  const standardCommand = runVitest(vitestCli, standardTestFiles, standardReportPath);
  const profileCommand = runVitest(vitestCli, [isolatedProfileTest], profileReportPath, "vitest.dsh-profile-evidence.config.ts");
  const standardReport = JSON.parse(await readFile(standardReportPath, "utf8"));
  const profileVitestReport = JSON.parse(await readFile(profileReportPath, "utf8"));
  const testCases = [
    ...extractTestCases(standardReport, standardTestFiles, "standard capability report"),
    ...extractTestCases(profileVitestReport, [isolatedProfileTest], "isolated profile report"),
  ];
  const privateRoots = [repositoryRoot, process.env.USERPROFILE].filter(Boolean);
  await writeFile(standardReportPath, `${JSON.stringify(sanitizeVitestReport(standardReport, privateRoots), null, 2)}\n`, "utf8");
  await writeFile(profileReportPath, `${JSON.stringify(sanitizeVitestReport(profileVitestReport, privateRoots), null, 2)}\n`, "utf8");

  // Vitest stores outcomes only. Run the same verifier once more to retain the
  // selected bundle identity in machine-readable evidence. It is source-smoke
  // evidence unless the caller explicitly supplied a tgz archive.
  const profileOutput = execFileSync(process.execPath, ["scripts/verify-dsh-registration.mjs"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, DSH_ROSALIND_ENABLE_LIVE_NETWORK: "" },
    timeout: 420_000,
  });
  const profileInstallation = verifyProfileArchive(JSON.parse(profileOutput));

  const afterIdentities = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await digest(file)])));
  const changedFiles = files.filter((file) => beforeIdentities[file] !== afterIdentities[file]);
  if (changedFiles.length > 0) throw new Error(`Capability fixture inputs changed while tests ran: ${changedFiles.join(", ")}`);
  const packageManifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  const record = {
    schemaVersion: 2,
    runId,
    status: "passed",
    recordedAt: new Date().toISOString(),
    package: { name: packageManifest.name, version: packageManifest.version },
    command: `${publicVitestCommand(standardCommand, relativePath(standardReportPath))} && ${publicVitestCommand(profileCommand, relativePath(profileReportPath))}`,
    testFiles,
    reports: [
      { path: relativePath(standardReportPath), type: "vitest-json", success: standardReport.success === true },
      { path: relativePath(profileReportPath), type: "vitest-json", success: profileVitestReport.success === true },
    ],
    testCases,
    profileInstallation,
    contentIdentityFiles: files,
    contentIdentities: afterIdentities,
  };
  await writeFile(evidencePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`Recorded ${runId}: ${testCases.length} passed Vitest cases across ${testFiles.length} required files; profile archive is ${profileInstallation.archiveKind}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
