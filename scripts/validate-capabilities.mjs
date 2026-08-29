import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { assertObjectJsonSchema } from "@deepseek-ai/dsh-tools";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(root, "capabilities", "capability-manifest.json"), "utf8"));
const failures = [];
const expectTotal = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label}: expected ${expected}, received ${actual}`);
};

expectTotal("services", manifest.services.length, 7);
expectTotal("skills", manifest.skills.length, 55);
expectTotal("operations", manifest.operations.length, 117);
expectTotal("showcases", manifest.target.showcaseCount, 23);

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
for (const run of runs.values()) {
  if (!run.id || !["passed", "not-recorded"].includes(run.status)) failures.push("verification run has an invalid id or status");
  if (!run.evidencePath || !existsSync(path.join(root, run.evidencePath))) failures.push(`${run.id}: verification evidence document is missing`);
  if (!Array.isArray(run.testFiles)) failures.push(`${run.id}: testFiles must be an array`);
  else for (const test of run.testFiles) if (!existsSync(path.join(root, test))) failures.push(`${run.id}: recorded test file does not exist: ${test}`);
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
  }
}

for (const [itemKind, items] of [["service", manifest.services], ["skill", manifest.skills], ["operation", manifest.operations]]) for (const item of items) {
  if (item.status === "missing") continue;
  if (!item.implementationPath || !existsSync(path.join(root, item.implementationPath))) {
    failures.push(`${item.id}: ${item.status} requires an existing implementationPath`);
  }
  for (const name of ["implementation", "fixture", "live", "cancellation", "error"]) validateEvidence(item, name, item.evidence?.[name]);
  if (item.evidence?.workflow) validateEvidence(item, "workflow", item.evidence.workflow);
  if (item.evidence?.registration) validateEvidence(item, "registration", item.evidence.registration);
  if (item.evidence?.implementation?.path !== item.implementationPath) failures.push(`${item.id}: implementation evidence must point to implementationPath`);
  if (item.status === "implemented" && (!Array.isArray(item.evidenceGaps) || item.evidenceGaps.length === 0)) failures.push(`${item.id}: implemented status requires explicit missing evidence`);
  if (item.status === "verified") {
    if (item.evidence?.implementation?.status !== "located") failures.push(`${item.id}: verified requires located implementation evidence`);
    if (item.evidence?.fixture?.status !== "executed") failures.push(`${item.id}: verified requires executed fixture evidence`);
    if (itemKind === "operation") {
      if (!["successful-local-result", "mixed-success-and-diagnostic", "exact-diagnostic"].includes(item.fixtureOutcome)) failures.push(`${item.id}: verified operation requires an explicit fixtureOutcome`);
      if (item.verificationScope !== "fixture-contract") failures.push(`${item.id}: verified operation must identify fixture-contract scope`);
      if (item.evidence.fixture.kind !== "operation-contract-fixture") failures.push(`${item.id}: verified operation requires an operation-contract fixture`);
      if (typeof item.evidence.fixture.assertionLocator !== "string" || !item.evidence.fixture.assertionLocator) failures.push(`${item.id}: verified operation requires a result or exact-diagnostic assertion locator`);
    }
    if (itemKind === "skill") {
      if (item.evidence?.fixture?.kind !== "skill-specific-registry-and-tool-fixture") failures.push(`${item.id}: verified Skill requires a Skill-specific registry and tool fixture`);
      if (item.evidence?.workflow?.status !== "executed") failures.push(`${item.id}: verified Skill requires an executed operation or provider workflow fixture`);
      if (item.evidence?.registration?.status !== "executed") failures.push(`${item.id}: verified Skill requires executed whenToUse and invocation metadata checks`);
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
