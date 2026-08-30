import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const coveragePath = process.env.ROSALIND_COVERAGE_PATH
  ? path.resolve(process.env.ROSALIND_COVERAGE_PATH)
  : path.join(repositoryRoot, "capabilities", "sources", "required-operations.json");
const contractSourceDirectory = process.env.ROSALIND_CAPABILITY_CONTRACT_DIR
  ? path.resolve(process.env.ROSALIND_CAPABILITY_CONTRACT_DIR)
  : path.join(repositoryRoot, "capabilities", "contracts");
const outputDirectory = process.env.ROSALIND_CAPABILITY_OUTPUT_DIR
  ? path.resolve(process.env.ROSALIND_CAPABILITY_OUTPUT_DIR)
  : path.join(repositoryRoot, "capabilities");

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const coverage = await readJson(coveragePath);
const targetCatalog = await readJson(path.join(repositoryRoot, "showcases", "catalog.json"));
const targetShowcaseIds = new Set(targetCatalog.plugins.flatMap((plugin) => plugin.showcases.map((item) => item.id)));
const verificationEvidencePath = "docs/evidence/capability-verification.md";
const verificationRunId = "capability-fixtures-2026-08-30";
const verificationMachineRecordPath = `capabilities/evidence/${verificationRunId}.json`;
let verificationMachineRecord = null;
try { verificationMachineRecord = await readJson(path.join(repositoryRoot, verificationMachineRecordPath)); } catch { /* A missing record keeps every item implemented. */ }
let verificationRecorded = false;

const annotations = new Set(["title", "description", "default", "examples"]);

async function readRuntimeOutputContracts() {
  const sourcePath = path.join(repositoryRoot, "src", "host", "science-tools.ts");
  const sourceText = await readFile(sourcePath, "utf8");
  const set = (name) => {
    const match = sourceText.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
    if (!match) throw new Error(`${name} could not be read from src/host/science-tools.ts`);
    return new Set([...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]));
  };
  const mapMatch = sourceText.match(/const OPERATION_OUTPUT_FIELDS:[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!mapMatch) throw new Error("OPERATION_OUTPUT_FIELDS could not be read from src/host/science-tools.ts");
  // This is a repository-controlled literal of quoted keys and string arrays.
  // Evaluating it preserves a single runtime/manifest source without importing
  // TypeScript from this Node-only generator.
  const fields = Function(`"use strict"; return ({${mapMatch[1]}});`)();
  return {
    fields,
    string: set("STRING_FIELDS"),
    number: set("NUMBER_FIELDS"),
    boolean: set("BOOLEAN_FIELDS"),
    array: set("ARRAY_FIELDS"),
    nullableNumber: set("NULLABLE_NUMBER_FIELDS"),
    nullableString: set("NULLABLE_STRING_FIELDS"),
    nullableObject: set("NULLABLE_OBJECT_FIELDS"),
  };
}

const runtimeOutputContracts = await readRuntimeOutputContracts();

function runtimeOutputSchema(serviceId, operation) {
  const fields = runtimeOutputContracts.fields[operation];
  if (!Array.isArray(fields)) throw new Error(`No runtime output-field contract for ${serviceId}.${operation}`);
  const payloadFields = serviceId === "ngs" ? [...new Set([...fields, "mcp_server"])] : fields;
  const fieldSchema = (field) => {
    if (field === "job") return { type: "object", properties: { id: { type: "string" }, durableId: { type: "string" }, state: { type: "string", enum: ["queued", "running", "completed", "failed", "cancelled"] } }, additionalProperties: true };
    if (field === "error") return { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, status: { type: "integer" }, details: { type: "object", additionalProperties: true } }, required: ["code", "message"], additionalProperties: false };
    if (operation === "structure.apply_scene" && field === "wouldApply") return { type: "object", additionalProperties: true };
    if (field === "ok" || runtimeOutputContracts.boolean.has(field)) return { type: "boolean" };
    if (field === "state" && serviceId === "sequence" && operation !== "sequence.run_analysis") return { type: "object", additionalProperties: true };
    if (field === "state" && serviceId === "structure") return { type: "object", additionalProperties: true };
    if (field === "executable" && serviceId === "ngs" && operation.startsWith("plan_")) return { type: "boolean" };
    if (field === "executable" && serviceId === "ngs") return { oneOf: [{ type: "string" }, { type: "null" }] };
    if (field === "spatial") return { oneOf: [{ type: "object", additionalProperties: true }, { type: "null" }] };
    if (field === "renderer") return { oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }] };
    if (field === "provenance") return { oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }] };
    if (field === "background" && operation === "structure.load_background") return { type: "object", additionalProperties: true };
    if (serviceId === "structure" && (field === "matrix" || field === "appliedMatrix")) return { type: "array" };
    if (serviceId === "structure" && field === "implementation") return { type: "object", additionalProperties: true };
    if (operation === "structure.align_structures" && field === "tmScore") return { oneOf: [{ type: "object", additionalProperties: true }, { type: "null" }] };
    if (operation === "structure.set_quality_assessment" && field === "metricId") return { oneOf: [{ type: "string" }, { type: "null" }] };
    if (operation === "structure.remove_structure" && field === "removed") return { type: "boolean" };
    if (runtimeOutputContracts.nullableString.has(field)) return { oneOf: [{ type: "string" }, { type: "null" }] };
    if (runtimeOutputContracts.nullableNumber.has(field)) return { oneOf: [{ type: "number" }, { type: "null" }] };
    if (runtimeOutputContracts.nullableObject.has(field)) return { oneOf: [{ type: "object", additionalProperties: true }, { type: "null" }] };
    if (field === "layers") return { oneOf: [{ type: "array" }, { type: "object", additionalProperties: true }] };
    if (runtimeOutputContracts.number.has(field)) return { type: "number" };
    if (runtimeOutputContracts.array.has(field)) return { type: "array" };
    if (runtimeOutputContracts.string.has(field)) return { type: "string" };
    return { type: "object", additionalProperties: true };
  };
  return {
    type: "object",
    properties: {
      ...Object.fromEntries(payloadFields.map((field) => [field, fieldSchema(field)])),
      serviceId: { type: "string", const: serviceId },
      operation: { type: "string", const: operation },
      status: { type: "string", enum: ["completed", "failed", "cancelled", "blocked", "configured"] },
      ok: { type: "boolean" },
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          status: { type: "integer" },
          details: { type: "object", additionalProperties: true },
        },
        required: ["code", "message"],
        additionalProperties: false,
      },
    },
    required: ["serviceId", "operation", "status"],
    additionalProperties: false,
  };
}

function localReference(root, reference) {
  if (!reference.startsWith("#/")) return undefined;
  return reference.slice(2).split("/").reduce((value, token) => value?.[token.replaceAll("~1", "/").replaceAll("~0", "~")], root);
}

function mergeObjectSchemas(schemas) {
  const objects = schemas.filter((schema) => schema && schema.type === "object");
  if (objects.length !== schemas.length) return schemas[0] ?? {};
  return {
    type: "object",
    properties: Object.assign({}, ...objects.map((schema) => schema.properties ?? {})),
    required: [...new Set(objects.flatMap((schema) => schema.required ?? []))],
    additionalProperties: objects.every((schema) => schema.additionalProperties !== false),
  };
}

function dshSchema(node, root, references = new Set()) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return {};
  if (typeof node.$ref === "string") {
    if (references.has(node.$ref)) return { type: "object", additionalProperties: true };
    const target = localReference(root, node.$ref);
    if (target) return dshSchema(target, root, new Set([...references, node.$ref]));
  }
  const siblingEntries = Object.entries(node).filter(([key]) => !["$ref", "allOf", "anyOf", "$defs", "definitions", "$schema"].includes(key));
  const sibling = Object.fromEntries(siblingEntries);
  if (Array.isArray(node.allOf)) {
    return mergeObjectSchemas([...node.allOf.map((item) => dshSchema(item, root, references)), dshSchema(sibling, root, references)]);
  }
  const union = node.oneOf ?? node.anyOf;
  if (Array.isArray(union)) {
    const result = { oneOf: union.map((item) => dshSchema(item, root, references)) };
    for (const key of annotations) if (node[key] !== undefined) result[key] = node[key];
    return result;
  }
  if (Array.isArray(node.type)) {
    return { oneOf: node.type.map((type) => dshSchema({ ...node, type }, root, references)) };
  }
  const result = {};
  if (["string", "number", "integer", "boolean", "null", "array", "object"].includes(node.type)) result.type = node.type;
  if (node.enum !== undefined) result.enum = node.enum;
  if (node.const !== undefined) result.const = node.const;
  for (const key of annotations) if (node[key] !== undefined) result[key] = node[key];
  if (node.type === "array") result.items = dshSchema(node.items ?? {}, root, references);
  if (node.type === "object" || node.properties) {
    result.type = "object";
    result.properties = Object.fromEntries(Object.entries(node.properties ?? {}).map(([key, value]) => [key, dshSchema(value, root, references)]));
    if (Array.isArray(node.required) && node.required.length > 0) result.required = node.required;
    result.additionalProperties = typeof node.additionalProperties === "boolean" ? node.additionalProperties : true;
  }
  return result;
}

const operationName = (groupId, coverageId) => {
  const suffix = coverageId.slice(groupId.length + 1);
  if (groupId === "sequence-viewer") return suffix.replace(/^sequence_/, "sequence.");
  if (groupId === "structure-viewer") return suffix.replace(/^structure_/, "structure.");
  if (groupId === "slide-viewer") return suffix.replace(/^slide_/, "slide.");
  if (groupId === "rosalind") return suffix.replace(/^rosalind_/, "rosalind.");
  return suffix;
};

const serviceByCoverageGroup = {
  rosalind: "rosalind",
  "ngs-analysis-workbench": "ngs",
  "ngs-compute": "ngs",
  "ngs-app": "ngs",
  "sequence-viewer": "sequence",
  "structure-viewer": "structure",
  "slide-viewer": "slide",
};

const contractServiceIds = [...new Set(Object.values(serviceByCoverageGroup))];
const contractsByService = new Map();
for (const serviceId of contractServiceIds) {
  const contract = await readJson(path.join(contractSourceDirectory, `${serviceId}.json`));
  if (contract.schemaVersion !== 1 || contract.serviceId !== serviceId || !Array.isArray(contract.tools)) {
    throw new Error(`Invalid fixed contract snapshot for ${serviceId}`);
  }
  const names = contract.tools.map((tool) => tool.name);
  if (new Set(names).size !== names.length) throw new Error(`Duplicate tool names in fixed contract snapshot for ${serviceId}`);
  for (const tool of contract.tools) {
    const derived = dshSchema(tool.inputSchema, tool.inputSchema);
    if (JSON.stringify(derived) !== JSON.stringify(tool.dshInputSchema)) {
      throw new Error(`Stored DSH schema differs from the fixed input contract for ${tool.name}`);
    }
  }
  contractsByService.set(serviceId, contract.tools);
}

const implementationByService = {
  literature: { path: "src/host/science/literature.ts", fixture: "tests/science-literature-databases.test.ts" },
  databases: { path: "src/host/science/databases.ts", fixture: "tests/science-literature-databases.test.ts" },
  sequence: { path: "src/host/science/sequence.ts", fixture: "tests/sequence-ngs-operation-matrix.test.ts" },
  ngs: { path: "src/host/science/ngs.ts", fixture: "tests/sequence-ngs-operation-matrix.test.ts" },
  structure: { path: "src/host/science/structure.ts", fixture: "tests/structure-operation-matrix.test.ts" },
  slide: { path: "src/host/science/slide.ts", fixture: "tests/science-slide-parity.test.ts" },
  rosalind: { path: "src/host/science/runtime.ts", fixture: "tests/rosalind-operation.test.ts" },
};

const operations = [];
for (const group of coverage.groups) {
  const serviceId = serviceByCoverageGroup[group.id];
  const contracted = contractsByService.get(serviceId);
  if (!contracted) throw new Error(`No fixed contract snapshot for ${group.id}`);
  for (const covered of group.operations) {
    const name = operationName(group.id, covered.id);
    const contractIndex = contracted.findIndex((candidate) => candidate.name === name);
    if (contractIndex < 0) throw new Error(`Fixed contract not found for ${covered.id} (${name})`);
    const tool = contracted[contractIndex];
    operations.push({
      id: covered.id,
      serviceId,
      pluginVersion: group.version,
      operation: name,
      inputSchema: { $ref: `contracts/${serviceId}.json#/tools/${contractIndex}/inputSchema` },
      dshInputSchema: { $ref: `contracts/${serviceId}.json#/tools/${contractIndex}/dshInputSchema` },
      outputSchema: runtimeOutputSchema(serviceId, name),
      presentation: { presentCall: "required", presentResult: "required", outputRender: "json-and-viewer-state" },
      cancellation: "required",
      authorization: tool.annotations?.readOnlyHint === false ? "operation-specific" : "read-only",
      sourceFormats: [],
      exports: [],
      implementationPath: implementationByService[serviceId].path,
      fixtureTest: implementationByService[serviceId].fixture,
      liveTest: null,
      relatedShowcases: covered.cases.filter((id) => targetShowcaseIds.has(id)),
      status: "implemented",
    });
  }
}

const literatureSkills = ["biorxiv-skill", "ncbi-entrez-skill", "ncbi-pmc-skill"];
const databaseSkills = [
  "alphafold-skill", "bgee-skill", "bindingdb-skill", "biobankjapan-phewas-skill",
  "biostudies-arrayexpress-skill", "cbioportal-skill", "cellxgene-skill", "chebi-skill",
  "chembl-skill", "civic-skill", "clinicaltrials-skill", "clinvar-variation-skill",
  "efo-ontology-skill", "encode-skill", "ensembl-skill", "epigraphdb-skill",
  "eqtl-catalogue-skill", "eva-skill", "finngen-phewas-skill", "genebass-gene-burden-skill",
  "gnomad-graphql-skill", "gtex-eqtl-skill", "gwas-catalog-skill", "human-protein-atlas-skill",
  "ipd-skill", "metabolights-skill", "mgnify-skill", "ncbi-clinicaltables-skill",
  "ncbi-datasets-skill", "ncbi-entrez-skill", "opentargets-skill", "pharmgkb-skill",
  "pride-skill", "proteomexchange-skill", "pubchem-pug-skill", "quickgo-skill",
  "rcsb-pdb-skill", "reactome-skill", "rhea-skill", "rnacentral-skill", "string-skill",
  "tpmi-phewas-skill", "ukb-topmed-phewas-skill", "uniprot-skill",
];
const skillGroups = {
  literature: literatureSkills,
  databases: databaseSkills,
  sequence: ["biological-sequence-viewer"],
  ngs: ["design-ngs-analysis", "ngs-analysis-workbench", "run-ngs-analysis", "understand-ngs-data", "understand-ngs-results"],
  structure: ["structure-viewer"],
  slide: ["slide-viewer"],
};

const skills = Object.entries(skillGroups).flatMap(([serviceId, names]) => names.map((name) => ({
  id: `${serviceId}:${name}`,
  name,
  serviceId,
  implementationPath: `skills/${serviceId}/${name}/SKILL.md`,
  triggerTest: "tests/science-integration.test.ts",
  workflowTest: implementationByService[serviceId].fixture,
  status: "implemented",
})));

const services = [
  { id: "literature", pluginId: "life-sciences-literature", pluginVersion: "0.1.5", mcpServer: "dsh-native:literature", originalMcpServer: null },
  { id: "databases", pluginId: "life-sciences-databases", pluginVersion: "0.1.5", mcpServer: "dsh-native:databases", originalMcpServer: null },
  { id: "sequence", pluginId: "biological-sequence-viewer", pluginVersion: "0.1.43", mcpServer: "dsh-native:sequence", originalMcpServer: "sequence-viewer stdio" },
  { id: "ngs", pluginId: "ngs-analysis-workbench", pluginVersion: "0.2.16", mcpServer: "dsh-native:ngs", originalMcpServer: "ngs-app + ngs-analysis-workbench + ngs-compute" },
  { id: "structure", pluginId: "molecular-structure-viewer", pluginVersion: "0.1.80", mcpServer: "dsh-native:structure", originalMcpServer: "structure-viewer stdio" },
  { id: "slide", pluginId: "slide-viewer", pluginVersion: "0.1.56", mcpServer: "dsh-native:slide", originalMcpServer: "slide-viewer stdio" },
  { id: "rosalind", pluginId: "rosalind-workbench", pluginVersion: "0.2.2-research-preview", mcpServer: "dsh-native:rosalind", originalMcpServer: "rosalind stdio" },
].map((service) => ({
  ...service,
  implementationPath: implementationByService[service.id].path,
  fixtureTest: implementationByService[service.id].fixture,
  liveTest: null,
  status: "implemented",
}));

const verificationTestFiles = [
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
  "tests/module-core.test.ts",
  "tests/science-module-registration.test.ts",
  "tests/source-modules.test.ts",
  "tests/workflow-modules.test.ts",
  "tests/dsh-isolated-profile-evidence.test.ts",
];

const verificationFixedInputFiles = [
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

const verificationIdentityFiles = [...new Set([
  ...verificationFixedInputFiles,
  ...verificationTestFiles,
  ...(await filesUnder("src")),
  ...(await filesUnder("skills")),
  ...(await filesUnder("capabilities/contracts")),
  ...(await filesUnder("capabilities/sources")),
])].filter((file) => file !== "src/generated/catalog.ts" && file !== "src/generated/.gitkeep").sort();

async function contentIdentity(relativePath) {
  return createHash("sha256").update(await readFile(path.join(repositoryRoot, relativePath))).digest("hex");
}

if (
  verificationMachineRecord?.schemaVersion >= 2
  && verificationMachineRecord.runId === verificationRunId
  && verificationMachineRecord.status === "passed"
  && verificationMachineRecord.package?.name === "@zichenwang114514/dsh-rosalind"
  && typeof verificationMachineRecord.contentIdentities === "object"
  && Array.isArray(verificationMachineRecord.testCases)
) {
  verificationRecorded = (await Promise.all(verificationIdentityFiles.map(async (file) => (
    verificationMachineRecord.contentIdentities[file] === await contentIdentity(file)
  )))).every(Boolean);
}

const passedTestCases = verificationRecorded
  ? verificationMachineRecord.testCases.filter((testCase) => (
    testCase?.status === "passed"
    && typeof testCase.file === "string"
    && typeof testCase.fullName === "string"
    && testCase.fullName.length > 0
  ))
  : [];

function testCaseFor(relativePath, selector) {
  if (typeof selector !== "string" || selector.length === 0) return null;
  const matches = passedTestCases.filter((testCase) => (
    testCase.file === relativePath && testCase.fullName.includes(selector)
  ));
  // A locator must identify one passing Vitest case.  Ambiguity must remain
  // referenced rather than allowing a suite-wide pass to certify an item.
  return matches.length === 1 ? matches[0].fullName : null;
}

const verificationRuns = [{
  id: verificationRunId,
  status: verificationRecorded ? "passed" : "not-recorded",
  evidencePath: verificationEvidencePath,
  machineEvidencePath: verificationMachineRecordPath,
  command: `npx vitest run ${verificationTestFiles.filter((file) => file !== "tests/dsh-isolated-profile-evidence.test.ts").join(" ")} --reporter=dot && npx vitest run --config vitest.dsh-profile-evidence.config.ts tests/dsh-isolated-profile-evidence.test.ts --reporter=dot`,
  testFiles: verificationTestFiles,
  contentIdentityFiles: verificationIdentityFiles,
  contentIdentityMatch: verificationRecorded,
  typecheck: "npx tsc --noEmit --pretty false",
}];

const fileText = new Map();
async function textAt(relativePath) {
  if (!fileText.has(relativePath)) {
    try { fileText.set(relativePath, await readFile(path.join(repositoryRoot, relativePath), "utf8")); }
    catch { fileText.set(relativePath, null); }
  }
  return fileText.get(relativePath);
}
async function locatedEvidence(relativePath, locator, extra = {}) {
  const text = await textAt(relativePath);
  const status = text !== null && text.includes(locator) ? "located" : "missing";
  return {
    status,
    path: relativePath,
    locator,
    ...(status === "missing" ? { reason: `locator was not found in ${relativePath}` } : {}),
    ...extra,
  };
}
function executionEvidence(located, scope = "fixture", testCaseSelector = located.locator) {
  const testCase = located.status === "located" ? testCaseFor(located.path, testCaseSelector) : null;
  const status = located.status === "located" && testCase ? "executed" : located.status === "located" ? "referenced" : "missing";
  return {
    ...located,
    status,
    executionId: status === "executed" ? verificationRunId : null,
    testCase,
    scope,
  };
}
function missingEvidence(scope, reason) {
  return { status: "missing", path: null, locator: null, executionId: null, testCase: null, scope, reason };
}
const serviceSourceLocator = {
  literature: "export class LiteratureService",
  databases: "export class DatabaseService",
  sequence: "export class SequenceService",
  ngs: "export class NgsService",
  structure: "export class StructureService",
  slide: "export class SlideService",
  rosalind: "export class ScienceRuntime",
};
const serviceFixtureLocator = {
  literature: "constructs biorxiv requests and retains publication records",
  databases: "registers all 44 public database skills",
  sequence: "executes every one of the 13 registered operations",
  ngs: "executes all 22 registered management, planning, run, and compute-target operations",
  structure: "covers exactly the registered structure operations without trusting implemented flags",
  slide: "asserts operation-specific results for the 33 previously classification-only operations",
  rosalind: "opens the molecular-design workbench from the real catalogue context and retained artifacts",
};
const serviceErrorLocator = {
  literature: "refuses unapproved live calls",
  databases: "reports provider and HTTP errors precisely",
  sequence: "ALREADY_COMPLETED",
  ngs: "REMOTE_EXECUTION_NOT_AUTHORIZED",
  structure: "TRAJECTORY_FORMAT_UNSUPPORTED",
  slide: "RENDER_CAPABILITY_UNAVAILABLE",
  rosalind: "reports unavailable live providers without selecting another service",
};
const serviceErrorPath = { rosalind: "tests/runtime.test.ts" };
const cancellationLocator = "reports cancellation before dispatch";

const sequenceAssertions = {
  "sequence.open_from_chat": "const sessionId = String(opened.viewerSessionId);",
  "sequence.acquire_public_example": "expect(example.viewer).toBe(\"alignment\")",
  "sequence.query_viewer": "expect((rows.records as unknown[])).toHaveLength(3)",
  "sequence.control_viewer": "expect(controlled.applied).toBe(true)",
  "sequence.run_analysis": "alignedLength).toBe(191)",
  "sequence.align": "rowCount).toBe(3)",
  "sequence.cancel_job": "expect(cancelled.reason).toBe(\"ALREADY_COMPLETED\")",
  "sequence.edit_copy": "length).toBe(10)",
  "sequence.load_track": "expect(track.track).toBeTruthy()",
  "sequence.manage_annotations": "expect(added.annotation).toBeTruthy()",
  "sequence.save_session": "savedSessionId: saved.savedSessionId",
  "sequence.restore_session": "expect(restored.restored).toBe(true)",
  "sequence.export_artifact": "expect(existsSync(exportedPath)).toBe(true)",
};
const ngsAssertions = {
  list_workflows: 'operation: "list_workflows", expectation: "returns the local workflow inventory"',
  save_workflow: 'operation: "save_workflow", expectation: "creates a local versioned workflow"',
  update_workflow: 'operation: "update_workflow", expectation: "creates a new workflow version"',
  list_workflow_versions: 'operation: "list_workflow_versions", expectation: "lists both local workflow versions"',
  activate_workflow_version: 'operation: "activate_workflow_version", expectation: "activates the requested workflow version"',
  archive_workflow: 'operation: "archive_workflow", expectation: "archives the selected workflow"',
  restore_workflow: 'operation: "restore_workflow", expectation: "restores the archived workflow"',
  get_runtime_environment: 'operation: "get_runtime_environment", expectation: "reports the local runtime environment"',
  check_nextflow_readiness: 'operation: "check_nextflow_readiness", expectation: "reports ready or compute-unavailable readiness"',
  check_snakemake_readiness: 'operation: "check_snakemake_readiness", expectation: "reports ready or compute-unavailable readiness"',
  plan_nextflow: 'operation: "plan_nextflow", expectation: "returns a checksum-bound Nextflow plan"',
  plan_snakemake: 'operation: "plan_snakemake", expectation: "returns a checksum-bound Snakemake plan"',
  execute_plan: 'operation: "execute_plan", expectation: "creates a durable local run record"',
  list_ngs_runs: 'operation: "list_ngs_runs", expectation: "lists the durable run record"',
  list_ngs_run_lineages: 'operation: "list_ngs_run_lineages", expectation: "lists local workflow lineage"',
  get_ngs_run: 'operation: "get_ngs_run", expectation: "retrieves the exact durable run identity"',
  observe_ngs_run: 'operation: "observe_ngs_run", expectation: "returns an observation for the durable run"',
  update_ngs_run_analysis_summary: 'operation: "update_ngs_run_analysis_summary", expectation: "links the local analysis summary"',
  cancel_ngs_run: 'operation: "cancel_ngs_run", expectation: "records terminal cancellation"',
  list_compute_targets: 'operation: "list_compute_targets", expectation: "lists configured compute targets"',
  configure_ssh_target: 'operation: "configure_ssh_target", expectation: "stores an SSH target without connecting"',
  inspect_compute_target: 'operation: "inspect_compute_target", expectation: "returns the exact offline authorization diagnosis"',
};
const slideAssertions = {
  "slide.open_from_chat": "viewerReady: false, renderState: \"renderer-unavailable\"",
  "slide.import_scientific_layer": "expect(imported.layer).toMatchObject({ featureCount: 3",
  "slide.get_scientific_entity": "expect(entity.entity).toMatchObject({ id: \"AAAGACCCAAGTCGCG-1\"",
  "slide.wait_for_render": "error: { code: \"RENDERER_UNAVAILABLE\" }",
  "slide.run_workflow": "error: { code: \"COMPUTE_ENGINE_UNAVAILABLE\" }",
  "slide.get_workflow": "expect(read.job).toMatchObject({ durableId: job.durableId, state: \"failed\" })",
  "slide.cancel_workflow": "expect(cancelled).toMatchObject({ ok: true, cancellationAccepted: false",
};

const structureToolRuntimeMainTestCase = "Structure tools through the strict DSH ToolRuntime contract opens, queries, and renders GFP without INVALID_TOOL_OUTPUT";
const structureToolRuntimeEightTestCase = "Structure tools through the strict DSH ToolRuntime contract executes the eight formerly diagnostic structure operations through ToolRuntime";
const slideToolRuntimeTestCase = "SlideService local Canvas renderer executes every formerly-unverified Slide operation by its registered ToolRuntime name";
const slideSkillToolRuntimeTestCase = "SlideService local Canvas renderer runs the Slide Viewer Skill ToolRuntime flow: open, state, pixel query, wait, frame acknowledgement, ready";
const structureSkillWorkflowLocator = "opens, queries, and renders GFP without INVALID_TOOL_OUTPUT";
const slideSkillWorkflowLocator = "runs the Slide Viewer Skill ToolRuntime flow: open, state, pixel query, wait, frame acknowledgement, ready";

const structureToolRuntimeEightOperations = new Set([
  "structure.discover_density", "structure.load_background", "structure.load_public_density", "structure.quality_assessment",
  "structure.render_movie", "structure.search_motif", "structure.set_assembly_symmetry", "structure.set_trajectory_state",
]);
const slideToolRuntimeOperations = new Set([
  "slide.export_dicom_object", "slide.import_dicom_object", "slide.inspect_dicomweb_instance", "slide.open_dicom_series",
  "slide.open_dicomweb_wsi", "slide.open_from_chat", "slide.open_ome_zarr", "slide.prepare_dicom_upload", "slide.query_dicomweb",
  "slide.read_dicomweb_object", "slide.read_live_workflow_artifact", "slide.read_workflow_artifact", "slide.resume_pathology",
  "slide.resume_workflow", "slide.run_pathology", "slide.run_workflow", "slide.submit_dicom_upload", "slide.wait_for_render",
]);

const structureToolRuntimeAssertions = {
  "structure.discover_density": 'expect(discovered.value).toMatchObject({ status: "completed"',
  "structure.load_background": 'expect(background.value).toMatchObject({ status: "completed"',
  "structure.load_public_density": 'expect(density.value).toMatchObject({ status: "completed"',
  "structure.quality_assessment": 'expect(quality.value).toMatchObject({ status: "completed"',
  "structure.render_movie": 'expect(movie.value).toMatchObject({ status: "completed"',
  "structure.search_motif": 'expect(motif.value).toMatchObject({ status: "completed"',
  "structure.set_assembly_symmetry": 'expect(symmetry.value).toMatchObject({ status: "completed"',
  "structure.set_trajectory_state": 'expect(advanced.value).toMatchObject({ status: "completed"',
};

// Cancellation evidence must identify the lifecycle state that was exercised.
// In particular, a terminal refusal after a job has already settled is not
// evidence that an in-flight job can be cancelled.  Keep these records close
// to the operation mapping so the generated manifest carries that distinction.
const operationCancellationEvidence = {
  "structure.cancel_render": {
    path: "tests/structure-runtime.test.ts",
    locator: "expect(cancelled).toMatchObject({ cancellationAccepted: false, job: { state: \"completed\" } });",
    assertionLocator: "expect(cancelled).toMatchObject({ cancellationAccepted: false, job: { state: \"completed\" } });",
    scope: "terminal-cancellation-refusal-after-completed-render",
    kind: "operation-cancellation-terminal-refusal-fixture",
    description: "Local rendering is synchronous; cancellation is refused after the verified image and rendering record have completed.",
    testCase: "StructureService local raster and scientific analyses renders GFP coordinates to a real PNG and retains a reproducible rendering record",
  },
  "slide.cancel_analysis_from_chat": {
    path: "tests/science-slide-parity.test.ts",
    locator: "slide.cancel_analysis_from_chat",
    assertionLocator: "await verify(\"slide.cancel_analysis_from_chat\"",
    scope: "terminal-cancellation-refusal-after-failed-run",
    kind: "operation-cancellation-terminal-refusal-fixture",
    description: "The analysis job is already failed when cancellation is requested; the service reports cancellationAccepted=false and preserves the settled job.",
  },
  "slide.cancel_pathology": {
    path: "tests/science-slide-parity.test.ts",
    locator: "slide.cancel_pathology",
    assertionLocator: "await verify(\"slide.cancel_pathology\"",
    scope: "terminal-cancellation-refusal-after-failed-run",
    kind: "operation-cancellation-terminal-refusal-fixture",
    description: "The pathology job is already failed when cancellation is requested; the service reports cancellationAccepted=false and preserves the settled job.",
  },
  "slide.cancel_scientific_layer_import": {
    path: "tests/science-slide-parity.test.ts",
    locator: "slide.cancel_scientific_layer_import",
    assertionLocator: "await verify(\"slide.cancel_scientific_layer_import\"",
    scope: "terminal-cancellation-refusal-after-completed-import",
    kind: "operation-cancellation-terminal-refusal-fixture",
    description: "The layer import is already completed when cancellation is requested; the service reports cancellationAccepted=false and retains the completed job.",
  },
  "slide.cancel_workflow": {
    path: "tests/science-slide-parity.test.ts",
    locator: "expect(cancelled).toMatchObject({ ok: true, cancellationAccepted: false",
    assertionLocator: "expect(cancelled).toMatchObject({ ok: true, cancellationAccepted: false",
    scope: "terminal-cancellation-refusal-after-failed-run",
    kind: "operation-cancellation-terminal-refusal-fixture",
    description: "The workflow is already failed when cancellation is requested; this fixture verifies settled-job identity, not cancellation of active work.",
    testCase: "SlideService fixed-contract parity preserves failed workflow identity and terminal cancellation semantics",
  },
};

// These operations now have successful local fixtures.  The remaining
// unavailable diagnostics are retained as error evidence, but they do not
// classify an operation as diagnostic when its valid local path succeeds.
const exactDiagnosticOperations = new Set();

function fixtureOutcome(operation) {
  if (operation.serviceId === "ngs") return operation.operation === "inspect_compute_target" ? "exact-diagnostic" : "successful-local-result";
  if (exactDiagnosticOperations.has(operation.operation)) return "exact-diagnostic";
  if (["literature", "databases"].includes(operation.serviceId)) return "mixed-success-and-diagnostic";
  return "successful-local-result";
}

function operationAssertion(operation) {
  if (operation.serviceId === "sequence") return sequenceAssertions[operation.operation];
  if (operation.serviceId === "ngs") return ngsAssertions[operation.operation];
  if (operation.serviceId === "structure") return structureToolRuntimeAssertions[operation.operation] ?? "%s has a real local result or its exact diagnostic";
  if (slideToolRuntimeOperations.has(operation.operation)) return "expect(validateJsonSchemaValue(tool.output.schema, result, registeredName)).toEqual([]);";
  if (operation.serviceId === "slide") return slideAssertions[operation.operation] ?? `await verify("${operation.operation}"`;
  if (operation.serviceId === "rosalind") return "expect(value).toMatchObject({";
  return undefined;
}

function operationTestCaseSelector(operation) {
  if (operation.serviceId === "sequence") return "Sequence operation matrix executes every one of the 13 registered operations through one scientific session";
  if (operation.serviceId === "ngs") return `NGS operation-specific local evidence '${operation.operation}'`;
  if (structureToolRuntimeEightOperations.has(operation.operation)) return structureToolRuntimeEightTestCase;
  if (operation.serviceId === "structure") return `StructureService 41-operation implementation matrix ${operation.operation} has a real local result or its exact diagnostic`;
  if (slideToolRuntimeOperations.has(operation.operation)) return slideToolRuntimeTestCase;
  if (operation.serviceId === "slide") return "SlideService fixed-contract parity asserts operation-specific results for the 33 previously classification-only operations";
  if (operation.serviceId === "rosalind") return "Rosalind operation contract opens the molecular-design workbench from the real catalogue context and retained artifacts";
  return null;
}

function operationDiagnosticTestCaseSelector(operation) {
  if (operation.serviceId === "sequence") return "Sequence operation matrix executes every one of the 13 registered operations through one scientific session";
  if (operation.serviceId === "ngs") return `NGS operation-specific local evidence '${operation.operation}'`;
  if (operation.serviceId === "structure") return `StructureService 41-operation implementation matrix ${operation.operation} has a real local result or its exact diagnostic`;
  if (operation.serviceId === "slide") return "SlideService fixed-contract parity asserts operation-specific results for the 33 previously classification-only operations";
  if (operation.serviceId === "rosalind") return "Rosalind operation contract opens the molecular-design workbench from the real catalogue context and retained artifacts";
  return operationTestCaseSelector(operation);
}

const registrationTestCase = "DSH bundle registration through Cordis services checks every registered schema and presentation contract, then dispatches all 140 names through ToolRuntime";
const profileTestCase = "isolated DSH profile evidence installs the selected packed bundle, mounts the real DSH services, and records offline behavior";
const serviceErrorTestCase = {
  literature: "LiteratureService normalizes Entrez search IDs and refuses unapproved live calls",
  databases: "DatabaseService reports provider and HTTP errors precisely",
  sequence: "Sequence operation matrix executes every one of the 13 registered operations through one scientific session",
  ngs: "NGS operation-specific local evidence 'inspect_compute_target'",
  structure: "StructureService contract semantics loads a secondary local coordinate fixture through load_data without treating it as density or trajectory data",
  slide: "SlideService fixed-contract parity retains ROI, measurements, GeoJSON entities, project state, and precise renderer diagnostics",
  rosalind: "run lifecycle reports unavailable live providers without selecting another service",
};

for (const operation of operations) {
  const operationFixtureTest = structureToolRuntimeEightOperations.has(operation.operation)
    ? "tests/structure-toolruntime.test.ts"
    : slideToolRuntimeOperations.has(operation.operation)
      ? "tests/science-slide-runtime.test.ts"
      : operation.fixtureTest;
  operation.fixtureTest = operationFixtureTest;
  const implementationLocator = JSON.stringify(["structure", "slide"].includes(operation.serviceId) ? operation.operation.replace(/^[^.]+\./, "") : operation.operation);
  const fixtureLocator = operation.serviceId === "rosalind"
    ? serviceFixtureLocator.rosalind
    : structureToolRuntimeEightOperations.has(operation.operation) || slideToolRuntimeOperations.has(operation.operation)
      ? operation.operation.replace(".", "_")
      : operation.operation;
  const implementation = await locatedEvidence(operation.implementationPath, implementationLocator, { kind: "source-locator" });
  const assertionLocator = operationAssertion(operation);
  const fixtureLocated = await locatedEvidence(operation.fixtureTest, fixtureLocator, {
    kind: assertionLocator ? "operation-contract-fixture" : "registry-or-call-only-fixture",
    assertionLocator: assertionLocator ?? null,
  });
  if (fixtureLocated.status === "located" && assertionLocator && !(await textAt(operation.fixtureTest))?.includes(assertionLocator)) {
    fixtureLocated.status = "missing";
    fixtureLocated.reason = `result or diagnostic assertion locator was not found in ${operation.fixtureTest}`;
  }
  const fixture = executionEvidence(
    fixtureLocated,
    assertionLocator ? "meaningful-input-and-result-or-diagnostic" : "implementation-reachability-only",
    operationTestCaseSelector(operation),
  );
  const live = missingEvidence("live-dsh-profile-or-public-service", "no real DSH profile or public-service call is recorded for this operation");
  const cancellationRecord = operationCancellationEvidence[operation.operation];
  let cancellation;
  if (cancellationRecord) {
    cancellation = executionEvidence(
      await locatedEvidence(cancellationRecord.path, cancellationRecord.locator, {
        kind: cancellationRecord.kind,
        assertionLocator: cancellationRecord.assertionLocator,
        description: cancellationRecord.description,
      }),
      cancellationRecord.scope,
      cancellationRecord.testCase ?? operationDiagnosticTestCaseSelector(operation),
    );
  } else {
    // Sequence and NGS retain their operation-specific assertions in their
    // shared operation matrices.  Other operations have no cancellation
    // claim until a test exercises one explicitly.
    const assertion = operation.operation === "sequence.cancel_job"
      ? sequenceAssertions["sequence.cancel_job"]
      : operation.operation === "cancel_ngs_run"
        ? ngsAssertions.cancel_ngs_run
        : null;
    const diagnosticFixtureTest = implementationByService[operation.serviceId].fixture;
    cancellation = assertion
      ? executionEvidence(await locatedEvidence(diagnosticFixtureTest, operation.operation, { kind: "operation-cancellation-fixture", assertionLocator: assertion }), "operation-specific-cancellation", operationDiagnosticTestCaseSelector(operation))
      : missingEvidence("operation-specific-cancellation", "no operation-specific cancellation assertion is recorded");
  }
  const diagnosticFixtureTest = implementationByService[operation.serviceId].fixture;
  const fixtureText = await textAt(diagnosticFixtureTest);
  const diagnosticPattern = new RegExp(`${operation.operation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*[A-Z][A-Z_]{3,}`);
  const errorLocated = fixtureText && diagnosticPattern.test(fixtureText)
    ? await locatedEvidence(diagnosticFixtureTest, operation.operation, { kind: "test-locator" })
    : { status: "missing", path: diagnosticFixtureTest, locator: operation.operation, kind: "test-locator", reason: "no operation-specific error assertion was located" };
  const error = executionEvidence(errorLocated, "operation-error-or-diagnostic", operationDiagnosticTestCaseSelector(operation));
  const required = [implementation.status === "located", fixture.status === "executed", fixture.kind === "operation-contract-fixture", Boolean(fixture.assertionLocator)];
  const registration = executionEvidence(await locatedEvidence(
    "tests/dsh-host-registration.test.ts",
    "for (const schema of schemas)",
    {
      kind: "dsh-tool-registry-and-presentation-fixture",
      assertionLocator: "const definition = ctx.tools.get(schema.name);",
    },
  ), "dsh-tool-registry-readback-presentation-and-dispatch", registrationTestCase);
  operation.evidence = { implementation, fixture, registration, live, cancellation, error };
  operation.fixtureOutcome = fixtureOutcome(operation);
  const verifiedExactDiagnostic = operation.serviceId === "ngs" && operation.fixtureOutcome === "exact-diagnostic";
  operation.verificationScope = operation.fixtureOutcome === "successful-local-result"
    ? "local-result-fixture-contract"
    : verifiedExactDiagnostic
      ? "local-exact-diagnostic-fixture-contract"
    : "implementation-and-diagnostic-fixture";
  operation.evidenceGaps = [
    ...(!required[0] ? ["implementation locator was not found"] : []),
    ...(!required[1] ? ["operation fixture has no recorded passing execution"] : []),
    ...(!required[2] ? ["fixture proves registration or reachability, but not an operation-specific result"] : []),
    ...(!required[3] ? ["operation fixture has no locatable result or exact diagnostic assertion"] : []),
    "no real DSH-profile or public-service live execution is recorded",
    ...(cancellation.status === "missing" ? ["no operation-specific cancellation assertion is recorded"] : []),
    ...(error.status === "missing" ? ["no operation-specific error assertion is recorded"] : []),
    ...(operation.fixtureOutcome === "exact-diagnostic" ? [verifiedExactDiagnostic
      ? "the fixture verifies the exact offline authorization diagnostic; no SSH connection or remote inspection was performed"
      : "the fixture proves an exact unavailable diagnostic, not a successful scientific result"] : []),
    ...(operation.fixtureOutcome === "mixed-success-and-diagnostic" ? ["the combined fixture does not prove a successful result for this individual operation"] : []),
  ];
  operation.status = required.every(Boolean) && (operation.fixtureOutcome === "successful-local-result" || verifiedExactDiagnostic) ? "verified" : "implemented";
}

for (const service of services) {
  service.liveTest = null;
  const implementation = await locatedEvidence(service.implementationPath, serviceSourceLocator[service.id], { kind: "source-locator" });
  const fixture = executionEvidence(await locatedEvidence(service.fixtureTest, serviceFixtureLocator[service.id], { kind: "test-locator" }), "service-fixture", `${service.id === "rosalind" ? "Rosalind operation contract" : service.id === "sequence" ? "Sequence operation matrix" : service.id === "ngs" ? "NGS operation matrix" : service.id === "structure" ? "StructureService 41-operation implementation matrix" : service.id === "slide" ? "SlideService fixed-contract parity" : service.id === "literature" ? "LiteratureService" : "DatabaseService"} ${serviceFixtureLocator[service.id]}`);
  const live = missingEvidence("live-dsh-profile-or-public-service", "no real DSH profile or public-service execution is recorded");
  const profileAssertionLocator = "expect(Object.keys(evidence.mount.representatives).sort()).toEqual([";
  const profile = executionEvidence(await locatedEvidence(
    "tests/dsh-isolated-profile-evidence.test.ts",
    "installs the selected packed bundle, mounts the real DSH services, and records offline behavior",
    { kind: "isolated-dsh-profile-service-fixture", assertionLocator: profileAssertionLocator },
  ), "offline-isolated-dsh-profile-install-mount-and-service-call", profileTestCase);
  const registration = executionEvidence(await locatedEvidence(
    "tests/dsh-host-registration.test.ts",
    "const operationNames = registry.operations.map((operation) => operation.registeredName);",
    { kind: "dsh-service-operation-registry-fixture", assertionLocator: "expect(operationNames.every((name) => registeredNames.has(name))).toBe(true);" },
  ), "dsh-service-operation-registry-readback", registrationTestCase);
  const serviceCancellation = {
    databases: {
      path: "tests/database-provider-matrix.test.ts",
      locator: "reports cancellation before any provider fetch",
      scope: "dispatch-cancellation-before-provider-fetch",
      kind: "service-cancellation-before-dispatch-fixture",
      description: "Provider calls are cancelled before dispatch; this does not claim cancellation of an already-running provider request.",
      testCase: "44 fixed-version database providers reports cancellation before any provider fetch",
    },
    sequence: {
      path: "tests/sequence-ngs-operation-matrix.test.ts",
      locator: "expect(cancelled.reason).toBe(\"ALREADY_COMPLETED\")",
      scope: "terminal-cancellation-refusal-after-completed-job",
      kind: "service-cancellation-terminal-refusal-fixture",
      description: "The sequence job is already completed when cancellation is attempted; the fixture records the terminal refusal.",
      testCase: "Sequence operation matrix executes every one of the 13 registered operations through one scientific session",
    },
    ngs: {
      path: "tests/sequence-ngs-operation-matrix.test.ts",
      locator: ")).state).toBe(\"cancelled\")",
      scope: "queued-or-running-cancellation-accepted",
      kind: "service-cancellation-accepted-fixture",
      description: "The NGS durable run transitions to cancelled and is read back in that terminal state.",
      testCase: "NGS operation-specific local evidence 'cancel_ngs_run'",
    },
    structure: {
      path: "tests/structure-runtime.test.ts",
      locator: "expect(cancelled).toMatchObject({ cancellationAccepted: false, job: { state: \"completed\" } });",
      assertionLocator: "expect(cancelled).toMatchObject({ cancellationAccepted: false, job: { state: \"completed\" } });",
      scope: "terminal-cancellation-refusal-after-completed-render",
      kind: "service-cancellation-terminal-refusal-fixture",
      description: "The local raster has completed synchronously before cancellation is requested; evidence covers terminal refusal only.",
      testCase: "StructureService local raster and scientific analyses renders GFP coordinates to a real PNG and retains a reproducible rendering record",
    },
    slide: {
      path: "tests/science-slide-parity.test.ts",
      locator: "expect(cancelled).toMatchObject({ ok: true, cancellationAccepted: false",
      scope: "terminal-cancellation-refusal-only",
      kind: "service-cancellation-terminal-refusal-fixture",
      description: "The representative workflow is already failed when cancellation is requested; evidence covers settled-job identity and terminal refusal only, not cancellation of active work.",
      testCase: "SlideService fixed-contract parity preserves failed workflow identity and terminal cancellation semantics",
    },
  }[service.id];
  const cancellation = serviceCancellation
    ? executionEvidence(await locatedEvidence(serviceCancellation.path, serviceCancellation.locator, {
      kind: serviceCancellation.kind,
      assertionLocator: serviceCancellation.assertionLocator ?? null,
      description: serviceCancellation.description,
    }), serviceCancellation.scope, serviceCancellation.testCase)
    : missingEvidence("service-specific-cancellation", "no service-specific cancellation assertion is recorded");
  const errorPath = serviceErrorPath[service.id] ?? service.fixtureTest;
  const error = executionEvidence(await locatedEvidence(errorPath, serviceErrorLocator[service.id], { kind: "test-locator" }), "service-error-behavior", serviceErrorTestCase[service.id]);
  const required = [implementation.status === "located", fixture.status === "executed", error.status === "executed", profile.status === "executed", registration.status === "executed"];
  service.evidence = { implementation, fixture, registration, profile, live, cancellation, error };
  service.verificationScope = "offline-dsh-profile-and-service-fixture";
  service.fixtureOutcome = "isolated-profile-mount-plus-local-fixture";
  service.evidenceGaps = [
    ...(!required.every(Boolean) ? ["service verification requires a located implementation and a meaningful service fixture with an asserted result or diagnostic"] : []),
    "no real DSH-profile or public-service live execution is recorded",
    ...(cancellation.status === "missing" ? ["no service-specific cancellation assertion is recorded"] : []),
  ];
  service.status = required.every(Boolean) ? "verified" : "implemented";
}

function skillWorkflowEvidence(skill) {
  if (skill.serviceId === "literature") {
    const bySkill = {
      "biorxiv-skill": "constructs biorxiv requests and retains publication records",
      "ncbi-entrez-skill": "normalizes Entrez search IDs and refuses unapproved live calls",
      "ncbi-pmc-skill": "retrieves compact, versioned PMC Article Dataset metadata",
    };
    return {
      path: "tests/science-literature-databases.test.ts",
      locator: bySkill[skill.name],
      assertionLocator: "expect(result.ok).toBe(true)",
      kind: "skill-linked-provider-workflow-fixture",
    };
  }
  if (skill.serviceId === "databases") {
    return {
      path: "tests/database-provider-matrix.test.ts",
      locator: skill.name.replace(/-skill$/, ""),
      assertionLocator: "it.each(DATABASE_PROVIDERS.map",
      kind: "skill-linked-provider-workflow-fixture",
    };
  }
  if (skill.serviceId === "ngs" && ["design-ngs-analysis", "ngs-analysis-workbench", "understand-ngs-data"].includes(skill.name)) {
    return {
      path: "tests/skills-workflow-matrix.test.ts",
      locator: skill.id.replace(`${skill.serviceId}:`, `rosalind-${skill.serviceId}-`),
      assertionLocator: "expect(registered?.content, `${evidence.id}: execution mode agrees with the source document`).toMatch(evidence.semanticEvidence!)",
      kind: "skill-instruction-mode-fixture",
    };
  }
  if (skill.serviceId === "structure") {
    return {
      path: "tests/structure-toolruntime.test.ts",
      locator: structureSkillWorkflowLocator,
      assertionLocator: "expect(opened.value).toMatchObject({ serviceId: \"structure\"",
      kind: "skill-linked-toolruntime-workflow-fixture",
    };
  }
  if (skill.serviceId === "slide") {
    return {
      path: "tests/science-slide-runtime.test.ts",
      locator: slideSkillWorkflowLocator,
      assertionLocator: "expect(ready).toMatchObject({ viewerReady: true, renderState: \"ready\", pending: false })",
      kind: "skill-linked-toolruntime-workflow-fixture",
    };
  }
  return {
    path: skill.workflowTest,
    locator: serviceFixtureLocator[skill.serviceId],
    assertionLocator: skill.serviceId === "sequence" ? "expect((rows.records as unknown[])).toHaveLength(3)"
      : skill.serviceId === "ngs" ? "const registryRunId = String(run.registry_run_id)"
        : skill.serviceId === "structure" ? "%s has a real local result or its exact diagnostic"
          : skill.serviceId === "slide" ? "retains ROI, measurements, GeoJSON entities, project state, and precise renderer diagnostics"
            : "expect(value).toMatchObject({",
    kind: "skill-linked-service-workflow-fixture",
  };
}

for (const skill of skills) {
  skill.triggerTest = "tests/skills-workflow-matrix.test.ts";
  skill.liveTest = null;
  const implementation = await locatedEvidence(skill.implementationPath, `name: ${skill.name}`, { kind: "source-locator" });
  const matrixId = skill.id.replace(`${skill.serviceId}:`, `rosalind-${skill.serviceId}-`).replace(/-skill$/, "");
  const skillRegistryTestCase = `55-Skill executable workflow evidence '${matrixId.slice(0, 32)}`;
  const fixture = executionEvidence(await locatedEvidence(skill.triggerTest, matrixId, {
    kind: "skill-specific-registry-and-tool-fixture",
    assertionLocator: "$id is registered from its source document with a resolvable tool and fixture",
  }), "skill-source-registry-tool-provider-and-fixture-mapping", skillRegistryTestCase);
  const workflowFixture = skillWorkflowEvidence(skill);
  skill.workflowTest = workflowFixture.path;
  const workflow = executionEvidence(await locatedEvidence(workflowFixture.path, workflowFixture.locator, {
    kind: workflowFixture.kind,
    assertionLocator: workflowFixture.assertionLocator,
  }), "skill-linked-workflow-fixture", workflowFixture.path === "tests/skills-workflow-matrix.test.ts"
    ? skillRegistryTestCase
    : skill.serviceId === "literature"
    ? `LiteratureService ${workflowFixture.locator}`
    : skill.serviceId === "databases"
      ? `44 fixed-version database providers ${skill.name.replace(/-skill$/, "")}`
      : skill.serviceId === "sequence"
        ? "Sequence operation matrix executes every one of the 13 registered operations through one scientific session"
        : skill.serviceId === "ngs"
          ? "NGS operation matrix executes all 22 registered management, planning, run, and compute-target operations"
          : skill.serviceId === "structure"
          ? structureToolRuntimeMainTestCase
            : skill.serviceId === "slide"
              ? slideSkillToolRuntimeTestCase
              : "SlideService fixed-contract parity");
  const registration = executionEvidence(await locatedEvidence(
    "tests/dsh-host-registration.test.ts",
    "registers 121 fixed operations, six Skill adapters, 13 Rosalind tools, and 55 Skills",
    { kind: "dsh-skill-registry-readback-fixture", assertionLocator: "expect(definition?.invocation).toEqual({ modelInvocable: true, userInvocable: true });" },
  ), "dsh-skill-registry-readback-and-invocation", "DSH bundle registration through Cordis services registers 121 fixed operations, six Skill adapters, 13 Rosalind tools, and 55 Skills");
  const live = missingEvidence("live-skill-invocation", "no Skill-specific invocation through a real DSH profile is recorded");
  const profile = executionEvidence(await locatedEvidence(
    "tests/dsh-isolated-profile-evidence.test.ts",
    "expect(evidence.mount.skills).toHaveLength(55)",
    { kind: "isolated-dsh-profile-skill-readback-fixture", assertionLocator: "skillsReadBack: 55" },
  ), "offline-isolated-dsh-profile-skill-readback", profileTestCase);
  const cancellation = { status: "not-applicable", path: null, locator: null, executionId: null, scope: "instruction-document" };
  const error = { status: "not-applicable", path: null, locator: null, executionId: null, scope: "instruction-document" };
  const required = [implementation.status === "located", fixture.status === "executed", workflow.status === "executed", registration.status === "executed", profile.status === "executed"];
  skill.evidence = { implementation, fixture, workflow, registration, profile, live, cancellation, error };
  skill.verificationScope = "offline-dsh-profile-skill-readback-and-workflow-fixture";
  skill.fixtureOutcome = "profile-mounted-skill-with-mapped-trigger-and-workflow-fixture";
  skill.evidenceGaps = ["no model-selected Skill choice or public-service execution is recorded; verification covers DSH registration, readable instructions, trigger mapping, and the linked tool workflow"];
  skill.status = required.every(Boolean) ? "verified" : "implemented";
}

const contractDirectory = path.join(outputDirectory, "contracts");
await mkdir(contractDirectory, { recursive: true });
for (const [serviceId, tools] of contractsByService) {
  await writeFile(path.join(contractDirectory, `${serviceId}.json`), `${JSON.stringify({ schemaVersion: 1, serviceId, tools }, null, 2)}\n`, "utf8");
}

const manifest = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  target: {
    dshVersion: "0.1.1-rc.2",
    showcaseCount: targetShowcaseIds.size,
    serviceCount: services.length,
    skillCount: skills.length,
    requiredOperationCount: operations.length,
    verifiedServiceCount: services.filter((item) => item.status === "verified").length,
    verifiedSkillCount: skills.filter((item) => item.status === "verified").length,
    verifiedOperationCount: operations.filter((item) => item.status === "verified").length,
    successfulLocalResultOperationCount: operations.filter((item) => item.fixtureOutcome === "successful-local-result").length,
    exactDiagnosticOperationCount: operations.filter((item) => item.fixtureOutcome === "exact-diagnostic").length,
    mixedFixtureOperationCount: operations.filter((item) => item.fixtureOutcome === "mixed-success-and-diagnostic").length,
  },
  statusDefinitions: {
    missing: "No implementation path is recorded.",
    implemented: "An implementation path exists, while the recorded fixture, DSH profile installation, or operation-specific result evidence remains incomplete.",
    verified: "Operations require an executed operation-specific local scientific result. The NGS compute-target inspection operation may instead verify its explicit offline authorization diagnostic, because the fixture deliberately avoids SSH and remote execution. Services require an executed isolated DSH profile mount plus local fixtures. Skills require profile readback, trigger mapping, and executed linked-tool workflow fixtures; this does not claim autonomous model selection or a public-network execution.",
  },
  evidencePolicy: "A directory, source locator, registry dispatch, test-file reference, exact unavailable diagnostic, or combined mixed fixture proves implementation reachability and failure behavior only. Operation verified status requires an executed operation-specific fixture with meaningful input and an asserted successful local scientific result, except NGS compute-target inspection where the asserted offline authorization diagnostic is the intended result and no SSH connection is attempted. Service verified status records an offline isolated DSH profile installation, mount, and representative call in addition to service fixtures. Skill verified status records an offline isolated DSH profile readback for all Skill documents plus individual trigger and linked-workflow fixtures; it never claims autonomous model selection or a public-network call. Shared null-argument dispatch is never labeled live.",
  verificationRuns,
  statusCounts: {
    services: Object.fromEntries(["verified", "implemented", "missing"].map((status) => [status, services.filter((item) => item.status === status).length])),
    skills: Object.fromEntries(["verified", "implemented", "missing"].map((status) => [status, skills.filter((item) => item.status === status).length])),
    operations: Object.fromEntries(["verified", "implemented", "missing"].map((status) => [status, operations.filter((item) => item.status === status).length])),
  },
  services,
  skills,
  operations,
};

// The operation total tracks the fixed contracts plus the coverage record, so it
// moves whenever a fixed operation is added. Keep the other totals pinned.
if (services.length !== 7 || skills.length !== 55 || operations.length !== 121 || targetShowcaseIds.size !== 23) {
  throw new Error(`Unexpected totals: ${services.length} services, ${skills.length} skills, ${operations.length} operations, ${targetShowcaseIds.size} showcases`);
}
await writeFile(path.join(outputDirectory, "capability-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${services.length} services, ${skills.length} skills, and ${operations.length} required operations for ${targetShowcaseIds.size} showcases.`);
