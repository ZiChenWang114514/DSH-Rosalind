import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { assertObjectJsonSchema } from "@deepseek-ai/dsh-tools";
import { capabilityContentDigest, hasArchiveIdentity, hasPassedVitestCase } from "./lib/capability-evidence.mjs";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(root, "capabilities", "capability-manifest.json"), "utf8"));
const failures = [];
const expectTotal = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label}: expected ${expected}, received ${actual}`);
};

expectTotal("services", manifest.services.length, 7);
expectTotal("skills", manifest.skills.length, 55);
expectTotal("operations", manifest.operations.length, 121);
expectTotal("showcases", manifest.target.showcaseCount, 100);

const seen = new Set();
for (const operation of manifest.operations) {
  if (seen.has(operation.id)) failures.push(`duplicate operation: ${operation.id}`);
  seen.add(operation.id);
  const match = /^contracts\/([^#]+)#\/tools\/(\d+)\/dshInputSchema$/.exec(operation.dshInputSchema.$ref);
  if (!match) {
    failures.push(`${operation.id}: invalid DSH schema reference`);
    continue;
  }
  const contract = JSON.parse(readFileSync(path.join(root, "capabilities", "contracts", match[1]), "utf8"));
  const tool = contract.tools[Number(match[2])];
  if (!tool || tool.name !== operation.operation) {
    failures.push(`${operation.id}: contract index does not resolve to ${operation.operation}`);
    continue;
  }
  try {
    assertObjectJsonSchema(tool.dshInputSchema);
  } catch (cause) {
    failures.push(`${operation.id}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

const runs = new Map((manifest.verificationRuns ?? []).map((run) => [run.id, run]));
const machineRecords = new Map();
for (const run of runs.values()) {
  if (!run.id || !["passed", "not-recorded"].includes(run.status)) failures.push("verification run has an invalid id or status");
  if (!run.evidencePath || !existsSync(path.join(root, run.evidencePath))) failures.push(`${run.id}: verification evidence document is missing`);
  if (!run.machineEvidencePath || !existsSync(path.join(root, run.machineEvidencePath))) failures.push(`${run.id}: machine-readable verification evidence is missing`);
  if (run.status === "passed" && run.contentIdentityMatch !== true) failures.push(`${run.id}: passing verification evidence does not match current content`);
  if (!Array.isArray(run.testFiles)) failures.push(`${run.id}: testFiles must be an array`);
  else for (const test of run.testFiles) if (!existsSync(path.join(root, test))) failures.push(`${run.id}: recorded test file does not exist: ${test}`);
  if (!Array.isArray(run.contentIdentityFiles) || run.contentIdentityFiles.length === 0) {
    failures.push(`${run.id}: contentIdentityFiles must list the test inputs`);
    continue;
  }
  if (run.testFiles?.some((test) => !run.contentIdentityFiles.includes(test))) {
    failures.push(`${run.id}: every executed test must be content-bound`);
  }
  if (!run.machineEvidencePath || !existsSync(path.join(root, run.machineEvidencePath))) continue;
  const machineRecord = JSON.parse(readFileSync(path.join(root, run.machineEvidencePath), "utf8"));
  machineRecords.set(run.id, machineRecord);
  if (machineRecord.runId !== run.id || machineRecord.status !== "passed") {
    failures.push(`${run.id}: machine evidence does not identify a passing matching run`);
    continue;
  }
  const recordedFiles = machineRecord.contentIdentityFiles;
  if (!Array.isArray(recordedFiles) || JSON.stringify([...recordedFiles].sort()) !== JSON.stringify([...run.contentIdentityFiles].sort())) {
    failures.push(`${run.id}: machine evidence content-identity file list differs from the manifest`);
    continue;
  }
  for (const file of run.contentIdentityFiles) {
    const absolutePath = path.join(root, file);
    if (!existsSync(absolutePath)) {
      failures.push(`${run.id}: content-identity file does not exist: ${file}`);
      continue;
    }
    const digest = capabilityContentDigest(readFileSync(absolutePath));
    if (machineRecord.contentIdentities?.[file] !== digest) failures.push(`${run.id}: machine evidence hash differs for ${file}`);
  }
  if (machineRecord.schemaVersion !== 2) failures.push(`${run.id}: machine evidence must use schemaVersion 2 with per-case Vitest records`);
  if (!Array.isArray(machineRecord.testCases) || machineRecord.testCases.length === 0) failures.push(`${run.id}: machine evidence has no per-case Vitest results`);
  if (!Array.isArray(machineRecord.reports) || machineRecord.reports.length === 0) failures.push(`${run.id}: machine evidence has no Vitest JSON report index`);
  else for (const report of machineRecord.reports) {
    if (report?.type !== "vitest-json" || report?.success !== true || typeof report.path !== "string" || !existsSync(path.join(root, report.path))) {
      failures.push(`${run.id}: a declared Vitest JSON report is missing or unsuccessful`);
      continue;
    }
    try {
      const payload = JSON.parse(readFileSync(path.join(root, report.path), "utf8"));
      if (payload.success !== true) failures.push(`${run.id}: ${report.path} does not contain a successful Vitest report`);
    } catch {
      failures.push(`${run.id}: ${report.path} is not readable JSON`);
    }
  }
  if (!hasArchiveIdentity(machineRecord)) failures.push(`${run.id}: profile/install evidence must record a tgz name, byte count, SHA-256, source, and source-smoke versus explicit archive status`);
}

const evidenceStatuses = new Set(["located", "executed", "referenced", "missing", "not-applicable"]);
function validateEvidence(item, name, evidence) {
  if (!evidence || !evidenceStatuses.has(evidence.status)) {
    failures.push(`${item.id}: ${name} evidence is absent or has an invalid status`);
    return;
  }
  if (evidence.status === "not-applicable") return;
  if (evidence.status === "missing") {
    if (typeof evidence.reason !== "string" || !evidence.reason) failures.push(`${item.id}: missing ${name} evidence requires a reason`);
    return;
  }
  if (typeof evidence.path !== "string" || !evidence.path || !existsSync(path.join(root, evidence.path))) {
    failures.push(`${item.id}: ${name} evidence path does not exist`);
    return;
  }
  if (typeof evidence.locator !== "string" || !evidence.locator) {
    failures.push(`${item.id}: ${name} evidence requires a locator`);
    return;
  }
  const text = readFileSync(path.join(root, evidence.path), "utf8");
  if (!text.includes(evidence.locator) && evidence.status !== "missing") failures.push(`${item.id}: ${name} locator is not present in ${evidence.path}`);
  if (evidence.assertionLocator && !text.includes(evidence.assertionLocator)) failures.push(`${item.id}: ${name} assertion locator is not present in ${evidence.path}`);
  if (evidence.status === "executed") {
    const run = runs.get(evidence.executionId);
    if (!run || run.status !== "passed") failures.push(`${item.id}: ${name} execution does not resolve to a passing run`);
    else if (!run.testFiles.includes(evidence.path)) failures.push(`${item.id}: ${name} execution path is absent from its passing run`);
    const requiresCaseEvidence = item.status === "verified" && ["fixture", "workflow", "registration", "profile"].includes(name);
    if (requiresCaseEvidence) {
      const machineRecord = machineRecords.get(evidence.executionId);
      if (!hasPassedVitestCase(machineRecord, evidence)) {
        failures.push(`${item.id}: ${name} cannot be verified without an exact passed Vitest case; skipped or absent cases are not execution evidence`);
      }
      if (name === "profile" && !hasArchiveIdentity(machineRecord)) {
        failures.push(`${item.id}: profile evidence is missing selected/source-smoke archive identity`);
      }
      if (name === "profile" && evidence.scope === "release-archive-install" && machineRecord?.profileInstallation?.releaseArchiveValidated !== true) {
        failures.push(`${item.id}: profile evidence claims a release archive although only source-smoke evidence exists`);
      }
    }
  }
}

for (const [itemKind, items] of [["service", manifest.services], ["skill", manifest.skills], ["operation", manifest.operations]]) for (const item of items) {
  if (item.status === "missing") continue;
  if (!item.implementationPath || !existsSync(path.join(root, item.implementationPath))) {
    failures.push(`${item.id}: ${item.status} requires an existing implementationPath`);
  }
  for (const name of ["implementation", "fixture", "registration", "profile", "live", "cancellation", "error"]) {
    if (item.evidence?.[name]) validateEvidence(item, name, item.evidence[name]);
  }
  if (item.evidence?.workflow) validateEvidence(item, "workflow", item.evidence.workflow);
  if (item.evidence?.registration) validateEvidence(item, "registration", item.evidence.registration);
  if (itemKind === "skill") {
    const registration = item.evidence?.registration;
    if (registration?.kind !== "dsh-skill-registry-readback-fixture") failures.push(`${item.id}: Skill registration evidence must be a DSH SkillRegistry readback fixture`);
    if (registration?.path !== "tests/dsh-host-registration.test.ts") failures.push(`${item.id}: Skill registration evidence must not rely on the manifest-validation test`);
    if (registration?.scope !== "dsh-skill-registry-readback-and-invocation") failures.push(`${item.id}: Skill registration evidence must identify DSH SkillRegistry readback and invocation`);
  }
  if (itemKind === "operation") {
    const registration = item.evidence?.registration;
    if (registration?.status !== "executed" || registration.kind !== "dsh-tool-registry-and-presentation-fixture") {
      failures.push(`${item.id}: operation requires executed DSH ToolRuntime registry and presentation evidence`);
    }
  }
  if (item.evidence?.implementation?.path !== item.implementationPath) failures.push(`${item.id}: implementation evidence must point to implementationPath`);
  if (item.status === "implemented" && (!Array.isArray(item.evidenceGaps) || item.evidenceGaps.length === 0)) failures.push(`${item.id}: implemented status requires explicit missing evidence`);
  if (item.status === "verified") {
    if (item.evidence?.implementation?.status !== "located") failures.push(`${item.id}: verified requires located implementation evidence`);
    if (item.evidence?.fixture?.status !== "executed") failures.push(`${item.id}: verified requires executed fixture evidence`);
    if (itemKind === "operation") {
      const verifiedExactNgsDiagnostic = item.serviceId === "ngs" && item.fixtureOutcome === "exact-diagnostic";
      if (!verifiedExactNgsDiagnostic && item.fixtureOutcome !== "successful-local-result") failures.push(`${item.id}: verified operation requires a successful local-result fixtureOutcome`);
      if (verifiedExactNgsDiagnostic && item.verificationScope !== "local-exact-diagnostic-fixture-contract") failures.push(`${item.id}: verified NGS diagnostic must identify local-exact-diagnostic-fixture-contract scope`);
      if (!verifiedExactNgsDiagnostic && item.verificationScope !== "local-result-fixture-contract") failures.push(`${item.id}: verified operation must identify local-result-fixture-contract scope`);
      if (item.evidence.fixture.kind !== "operation-contract-fixture") failures.push(`${item.id}: verified operation requires an operation-contract fixture`);
      if (typeof item.evidence.fixture.assertionLocator !== "string" || !item.evidence.fixture.assertionLocator) failures.push(`${item.id}: verified operation requires a result or exact-diagnostic assertion locator`);
    }
    if (itemKind === "skill") {
      if (item.evidence?.fixture?.kind !== "skill-specific-registry-and-tool-fixture") failures.push(`${item.id}: verified Skill requires a Skill-specific registry and tool fixture`);
      if (item.evidence?.workflow?.status !== "executed") failures.push(`${item.id}: verified Skill requires an executed operation or provider workflow fixture`);
      if (item.evidence?.registration?.status !== "executed") failures.push(`${item.id}: verified Skill requires executed DSH SkillRegistry readback and invocation checks`);
      if (item.evidence?.profile?.status !== "executed" || item.evidence.profile.kind !== "isolated-dsh-profile-skill-readback-fixture") {
        failures.push(`${item.id}: verified Skill requires isolated DSH profile readback evidence`);
      }
    }
    if (itemKind === "service") {
      if (item.evidence?.registration?.status !== "executed" || item.evidence.registration.kind !== "dsh-service-operation-registry-fixture") {
        failures.push(`${item.id}: verified service requires executed DSH operation-registry evidence`);
      }
      if (item.evidence?.profile?.status !== "executed" || item.evidence.profile.kind !== "isolated-dsh-profile-service-fixture") {
        failures.push(`${item.id}: verified service requires an isolated DSH profile mount and representative-call fixture`);
      }
    }
  }
  if (item.evidence?.live?.status === "executed" && !String(item.evidence.live.scope).startsWith("live-")) failures.push(`${item.id}: live evidence must come from a real DSH profile or public-service scope`);
}

expectTotal("successful local-result operations", manifest.target.successfulLocalResultOperationCount, manifest.operations.filter((item) => item.fixtureOutcome === "successful-local-result").length);
expectTotal("exact-diagnostic operations", manifest.target.exactDiagnosticOperationCount, manifest.operations.filter((item) => item.fixtureOutcome === "exact-diagnostic").length);
expectTotal("mixed-fixture operations", manifest.target.mixedFixtureOperationCount, manifest.operations.filter((item) => item.fixtureOutcome === "mixed-success-and-diagnostic").length);

for (const [label, items] of [["services", manifest.services], ["skills", manifest.skills], ["operations", manifest.operations]]) {
  for (const status of ["verified", "implemented", "missing"]) expectTotal(`${label}.${status}`, manifest.statusCounts?.[label]?.[status], items.filter((item) => item.status === status).length);
}
expectTotal("verified services", manifest.target.verifiedServiceCount, manifest.services.filter((item) => item.status === "verified").length);
expectTotal("verified Skills", manifest.target.verifiedSkillCount, manifest.skills.filter((item) => item.status === "verified").length);
expectTotal("verified operations", manifest.target.verifiedOperationCount, manifest.operations.filter((item) => item.status === "verified").length);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${manifest.services.length} services, ${manifest.skills.length} Skills, and ${manifest.operations.length} operations: ${manifest.target.verifiedServiceCount}/${manifest.target.verifiedSkillCount}/${manifest.target.verifiedOperationCount} verified.`);
}
