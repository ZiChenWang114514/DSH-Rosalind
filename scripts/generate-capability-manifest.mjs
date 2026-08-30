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

async function readRuntimeOutputFields() {
  const sourcePath = path.join(repositoryRoot, "src", "host", "science-tools.ts");
  const sourceText = await readFile(sourcePath, "utf8");
  const declaration = sourceText.match(/const SERVICE_OUTPUT_FIELDS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!declaration) {
    throw new Error("SERVICE_OUTPUT_FIELDS could not be read from src/host/science-tools.ts");
  }
  const result = {};
  for (const serviceId of ["literature", "databases", "sequence", "ngs", "structure", "slide", "rosalind"]) {
    const property = declaration[1].match(new RegExp(`${serviceId}:\\s*\\[([\\s\\S]*?)\\],`));
    if (!property) throw new Error(`Output fields could not be read for ${serviceId}`);
    result[serviceId] = [...property[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  }
  return result;
}

const runtimeOutputFields = await readRuntimeOutputFields();

function runtimeOutputSchema(serviceId, operation) {
  const fields = runtimeOutputFields[serviceId];
  if (!Array.isArray(fields)) throw new Error(`No runtime output-field contract for ${serviceId}`);
  return {
    type: "object",
    properties: {
      ...Object.fromEntries(fields.map((field) => [field, field === "diagnostics" ? { type: "array", items: { type: "string" } } : {}])),
      serviceId: { type: "string", const: serviceId },
      operation: { type: "string", const: operation },
      status: { type: "string" },
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

const verificationFixedInputFiles = [
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

const verificationIdentityFiles = [...new Set([
  ...verificationFixedInputFiles,
  ...verificationTestFiles,
  ...(await filesUnder("src")),
  ...(await filesUnder("skills")),
  ...(await filesUnder("capabilities/contracts")),
  ...(await filesUnder("capabilities/sources")),
])].sort();

async function contentIdentity(relativePath) {
  return createHash("sha256").update(await readFile(path.join(repositoryRoot, relativePath))).digest("hex");
}

if (
  verificationMachineRecord?.schemaVersion === 1
  && verificationMachineRecord.runId === verificationRunId
  && verificationMachineRecord.status === "passed"
  && verificationMachineRecord.package?.name === "@zichenwang114514/dsh-rosalind"
  && typeof verificationMachineRecord.contentIdentities === "object"
) {
  verificationRecorded = (await Promise.all(verificationIdentityFiles.map(async (file) => (
    verificationMachineRecord.contentIdentities[file] === await contentIdentity(file)
  )))).every(Boolean);
}

const verificationRuns = [{
  id: verificationRunId,
  status: verificationRecorded ? "passed" : "not-recorded",
  evidencePath: verificationEvidencePath,
  machineEvidencePath: verificationMachineRecordPath,
  command: `npx vitest run ${verificationTestFiles.join(" ")} --reporter=dot`,
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
function executionEvidence(located, scope = "fixture") {
  const status = located.status === "located" ? (verificationRecorded ? "executed" : "referenced") : "missing";
  return {
    ...located,
    status,
    executionId: status === "executed" ? verificationRunId : null,
    scope,
  };
}
function missingEvidence(scope, reason) {
  return { status: "missing", path: null, locator: null, executionId: null, scope, reason };
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
  structure: "RENDERER_UNAVAILABLE",
  slide: "RENDERER_UNAVAILABLE",
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
  list_workflows: "length).toBeGreaterThanOrEqual(3)",
  save_workflow: "expect(saved.created).toBe(true)",
  update_workflow: "const versionId = String((updated.version",
  list_workflow_versions: "expect((versions.versions as unknown[])).toHaveLength(2)",
  activate_workflow_version: "expect(activated.active_version_id).toBe(versionId)",
  archive_workflow: ")).archived).toBe(true)",
  restore_workflow: ")).archived).toBe(false)",
  get_runtime_environment: "expect(runtime.runtime).toBeTruthy()",
  check_nextflow_readiness: "toContain(nextflow.code)",
  check_snakemake_readiness: "toContain(snakemake.code)",
  plan_nextflow: "expect(nextflowPlan).toMatchObject({",
  plan_snakemake: "plan_id: plan.plan_id",
  execute_plan: "const registryRunId = String(run.registry_run_id)",
  list_ngs_runs: ")).runs).toBeTruthy()",
  list_ngs_run_lineages: ")).lineages).toBeTruthy()",
  get_ngs_run: ")).registry_run_id).toBe(registryRunId)",
  observe_ngs_run: ")).observation).toBeTruthy()",
  update_ngs_run_analysis_summary: "expect(linked.updated).toBe(true)",
  cancel_ngs_run: ")).state).toBe(\"cancelled\")",
  list_compute_targets: ")).targets).toBeTruthy()",
  configure_ssh_target: "expect(configured.status).toBe(\"configured\")",
  inspect_compute_target: "expect(inspected.code).toBe(\"REMOTE_EXECUTION_NOT_AUTHORIZED\")",
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

const exactDiagnosticOperations = new Set([
  "structure.assembly_symmetry", "structure.browse_related_data", "structure.cancel_render", "structure.discover_density",
  "structure.get_render_status", "structure.load_background", "structure.load_data", "structure.load_public_density",
  "structure.quality_assessment", "structure.render_image", "structure.render_movie", "structure.search_motif",
  "structure.set_assembly_symmetry", "structure.set_trajectory_state", "structure.validate_render",
  "slide.export_dicom_object", "slide.import_dicom_object", "slide.inspect_dicomweb_instance", "slide.open_dicom_series",
  "slide.open_dicomweb_wsi", "slide.open_ome_zarr", "slide.prepare_dicom_upload", "slide.query_dicomweb",
  "slide.read_dicomweb_object", "slide.read_live_workflow_artifact", "slide.read_workflow_artifact",
  "slide.resume_pathology", "slide.resume_workflow", "slide.run_analysis_from_chat", "slide.run_pathology",
  "slide.run_workflow", "slide.submit_dicom_upload",
]);

function fixtureOutcome(operation) {
  if (exactDiagnosticOperations.has(operation.operation)) return "exact-diagnostic";
  if (["literature", "databases", "ngs"].includes(operation.serviceId)) return "mixed-success-and-diagnostic";
  return "successful-local-result";
}

function operationAssertion(operation) {
  if (operation.serviceId === "sequence") return sequenceAssertions[operation.operation];
  if (operation.serviceId === "ngs") return ngsAssertions[operation.operation];
  if (operation.serviceId === "structure") return "%s has a real local result or its exact diagnostic";
  if (operation.serviceId === "slide") return slideAssertions[operation.operation] ?? `await verify("${operation.operation}"`;
  if (operation.serviceId === "rosalind") return "expect(value).toMatchObject({";
  return undefined;
}

for (const operation of operations) {
  const implementationLocator = JSON.stringify(["structure", "slide"].includes(operation.serviceId) ? operation.operation.replace(/^[^.]+\./, "") : operation.operation);
  const fixtureLocator = operation.serviceId === "rosalind" ? serviceFixtureLocator.rosalind : operation.operation;
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
  const fixture = executionEvidence(fixtureLocated, assertionLocator ? "meaningful-input-and-result-or-diagnostic" : "implementation-reachability-only");
  const live = missingEvidence("live-dsh-profile-or-public-service", "no real DSH profile or public-service call is recorded for this operation");
  const operationCancellationAssertions = {
    "sequence.cancel_job": sequenceAssertions["sequence.cancel_job"],
    cancel_ngs_run: ngsAssertions.cancel_ngs_run,
    "slide.cancel_analysis_from_chat": "await verify(\"slide.cancel_analysis_from_chat\"",
    "slide.cancel_pathology": "await verify(\"slide.cancel_pathology\"",
    "slide.cancel_scientific_layer_import": "await verify(\"slide.cancel_scientific_layer_import\"",
    "slide.cancel_workflow": slideAssertions["slide.cancel_workflow"],
    "structure.cancel_render": "%s has a real local result or its exact diagnostic",
  };
  const cancellationAssertion = operationCancellationAssertions[operation.operation];
  const cancellation = cancellationAssertion
    ? executionEvidence(await locatedEvidence(operation.fixtureTest, operation.operation, { kind: "operation-cancellation-fixture", assertionLocator: cancellationAssertion }), "operation-specific-cancellation")
    : missingEvidence("operation-specific-cancellation", "no operation-specific cancellation assertion is recorded");
  const fixtureText = await textAt(operation.fixtureTest);
  const diagnosticPattern = new RegExp(`${operation.operation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*[A-Z][A-Z_]{3,}`);
  const errorLocated = fixtureText && diagnosticPattern.test(fixtureText)
    ? await locatedEvidence(operation.fixtureTest, operation.operation, { kind: "test-locator" })
    : { status: "missing", path: operation.fixtureTest, locator: operation.operation, kind: "test-locator", reason: "no operation-specific error assertion was located" };
  const error = executionEvidence(errorLocated, "operation-error-or-diagnostic");
  const required = [implementation.status === "located", fixture.status === "executed", fixture.kind === "operation-contract-fixture", Boolean(fixture.assertionLocator)];
  operation.evidence = { implementation, fixture, live, cancellation, error };
  operation.fixtureOutcome = fixtureOutcome(operation);
  operation.verificationScope = operation.fixtureOutcome === "successful-local-result"
    ? "local-result-fixture-contract"
    : "implementation-and-diagnostic-fixture";
  operation.evidenceGaps = [
    ...(!required[0] ? ["implementation locator was not found"] : []),
    ...(!required[1] ? ["operation fixture has no recorded passing execution"] : []),
    ...(!required[2] ? ["fixture proves registration or reachability, but not an operation-specific result"] : []),
    ...(!required[3] ? ["operation fixture has no locatable result or exact diagnostic assertion"] : []),
    "no real DSH-profile or public-service live execution is recorded",
    ...(cancellation.status === "missing" ? ["no operation-specific cancellation assertion is recorded"] : []),
    ...(error.status === "missing" ? ["no operation-specific error assertion is recorded"] : []),
    ...(operation.fixtureOutcome === "exact-diagnostic" ? ["the fixture proves an exact unavailable diagnostic, not a successful scientific result"] : []),
    ...(operation.fixtureOutcome === "mixed-success-and-diagnostic" ? ["the combined fixture does not prove a successful result for this individual operation"] : []),
  ];
  operation.status = required.every(Boolean) && operation.fixtureOutcome === "successful-local-result" ? "verified" : "implemented";
}

for (const service of services) {
  service.liveTest = null;
  const implementation = await locatedEvidence(service.implementationPath, serviceSourceLocator[service.id], { kind: "source-locator" });
  const fixture = executionEvidence(await locatedEvidence(service.fixtureTest, serviceFixtureLocator[service.id], { kind: "test-locator" }), "service-fixture");
  const live = missingEvidence("live-dsh-profile-or-public-service", "no real DSH profile or public-service execution is recorded");
  const serviceCancellation = {
    databases: ["tests/database-provider-matrix.test.ts", "reports cancellation before any provider fetch"],
    sequence: ["tests/sequence-ngs-operation-matrix.test.ts", "expect(cancelled.reason).toBe(\"ALREADY_COMPLETED\")"],
    ngs: ["tests/sequence-ngs-operation-matrix.test.ts", ")).state).toBe(\"cancelled\")"],
    structure: ["tests/structure-operation-matrix.test.ts", "structure.cancel_render"],
    slide: ["tests/science-slide-parity.test.ts", "slide.cancel_workflow"],
  }[service.id];
  const cancellation = serviceCancellation
    ? executionEvidence(await locatedEvidence(serviceCancellation[0], serviceCancellation[1], { kind: "service-cancellation-fixture" }), "service-specific-cancellation")
    : missingEvidence("service-specific-cancellation", "no service-specific cancellation assertion is recorded");
  const errorPath = serviceErrorPath[service.id] ?? service.fixtureTest;
  const error = executionEvidence(await locatedEvidence(errorPath, serviceErrorLocator[service.id], { kind: "test-locator" }), "service-error-behavior");
  const meaningfulFixture = true;
  const required = [implementation.status === "located", fixture.status === "executed", meaningfulFixture, error.status === "executed"];
  service.evidence = { implementation, fixture, live, cancellation, error };
  service.verificationScope = "service-fixture-contract";
  service.fixtureOutcome = "mixed-success-and-diagnostic";
  service.evidenceGaps = [
    ...(!required.every(Boolean) ? ["service verification requires a located implementation and a meaningful service fixture with an asserted result or diagnostic"] : []),
    "no real DSH-profile or public-service live execution is recorded",
    ...(cancellation.status === "missing" ? ["no service-specific cancellation assertion is recorded"] : []),
  ];
  service.status = required.every(Boolean) && live.status === "executed" ? "verified" : "implemented";
}

for (const skill of skills) {
  skill.triggerTest = "tests/skills-workflow-matrix.test.ts";
  skill.liveTest = null;
  const implementation = await locatedEvidence(skill.implementationPath, `name: ${skill.name}`, { kind: "source-locator" });
  const matrixId = skill.id.replace(`${skill.serviceId}:`, `rosalind-${skill.serviceId}-`).replace(/-skill$/, "");
  const fixture = executionEvidence(await locatedEvidence(skill.triggerTest, matrixId, {
    kind: "skill-specific-registry-and-tool-fixture",
    assertionLocator: "$id is registered from its source document with a resolvable tool and fixture",
  }), "skill-source-registry-tool-provider-and-fixture-mapping");
  const workflow = executionEvidence(await locatedEvidence(skill.workflowTest, serviceFixtureLocator[skill.serviceId], { kind: "test-locator" }), "service-workflow-fixture");
  const registration = executionEvidence(await locatedEvidence(
    "tests/dsh-host-registration.test.ts",
    "registers 117 fixed operations, six Skill adapters, 13 Rosalind tools, and 55 Skills",
    { kind: "dsh-skill-registry-readback-fixture", assertionLocator: "expect(definition?.invocation).toEqual({ modelInvocable: true, userInvocable: true });" },
  ), "dsh-skill-registry-readback-and-invocation");
  const live = missingEvidence("live-skill-invocation", "no Skill-specific invocation through a real DSH profile is recorded");
  const cancellation = { status: "not-applicable", path: null, locator: null, executionId: null, scope: "instruction-document" };
  const error = { status: "not-applicable", path: null, locator: null, executionId: null, scope: "instruction-document" };
  const required = [implementation.status === "located", fixture.status === "executed", workflow.status === "executed", registration.status === "executed"];
  skill.evidence = { implementation, fixture, workflow, registration, live, cancellation, error };
  skill.verificationScope = "instruction-registration-and-workflow-fixture";
  skill.fixtureOutcome = "registered-skill-with-mapped-workflow-fixture";
  skill.evidenceGaps = ["no model-selected Skill invocation or real public-service execution is recorded"];
  skill.status = required.every(Boolean) && live.status === "executed" ? "verified" : "implemented";
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
    implemented: "An implementation path exists, but successful operation-specific scientific output or live DSH execution remains incomplete.",
    verified: "A successful operation-specific local scientific result is asserted by an executed fixture, or equivalent live DSH evidence is recorded. Exact unavailable diagnostics and combined mixed fixtures do not qualify.",
  },
  evidencePolicy: "A directory, source locator, registry dispatch, test-file reference, exact unavailable diagnostic, or combined mixed fixture proves implementation reachability and failure behavior only. Operation verified status requires an executed operation-specific fixture with meaningful input and an asserted successful local scientific result, or equivalent live DSH evidence. Service and Skill verified status require real DSH-profile execution. Shared null-argument dispatch is never labeled live.",
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

if (services.length !== 7 || skills.length !== 55 || operations.length !== 117 || targetShowcaseIds.size !== 23) {
  throw new Error(`Unexpected totals: ${services.length} services, ${skills.length} skills, ${operations.length} operations, ${targetShowcaseIds.size} showcases`);
}
await writeFile(path.join(outputDirectory, "capability-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${services.length} services, ${skills.length} skills, and ${operations.length} required operations for ${targetShowcaseIds.size} showcases.`);
