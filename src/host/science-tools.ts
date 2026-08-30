import type {
  JsonSchemaNode, JsonValue, ObjectJsonSchema, ObjectValueSchemaSpec, ParameterSchemaSpec,
  ToolDefinition, ToolResult,
} from "@deepseek-ai/dsh-tools";

import { CapabilityRegistry, type RuntimeOperationContract } from "./capabilities.js";

export interface ScienceExecutionContext {
  session: object;
  /** Stable DSH agent/session identity when the host provides one. */
  sessionId?: string;
  signal: AbortSignal;
  packageRoot: string;
  allowNetwork?: boolean;
}

export interface ScienceExecutor {
  execute(
    serviceId: string,
    operation: string,
    args: Record<string, unknown>,
    context: ScienceExecutionContext,
  ): Promise<Record<string, JsonValue>>;
}

const FALLBACK_SESSION = {};

type ScienceServiceId = "literature" | "databases" | "sequence" | "ngs" | "structure" | "slide" | "rosalind";

/**
 * Known result fields emitted by each fixed-version service. The runtime adds
 * serviceId, operation, and status to every result; service implementations
 * retain their operation-specific payload fields at the top level.
 */
const SERVICE_OUTPUT_FIELDS: Record<ScienceServiceId, readonly string[]> = {
  literature: [
    "checkedAt", "citation", "diagnostics", "doi", "is_historical_ocr", "is_manuscript",
    "is_pmc_openaccess", "is_retracted", "license_code", "media_url_count", "media_urls",
    "media_urls_truncated", "name", "pagination", "pdf_url", "pmcid", "pmid", "records",
    "request", "service", "sources", "text_url", "title", "url", "version", "xml_url",
  ],
  databases: [
    "diagnostics", "method", "pagination", "path", "provider", "query", "records", "request",
    "sources", "style", "variables",
  ],
  sequence: [
    "action", "alignedLength", "analysis", "annotatedPeptide", "annotation", "annotations",
    "applied", "artifact", "artifactCount", "artifacts", "bases", "cancelled", "code", "codingBases", "columns", "compared",
    "computedPeptide", "distance", "editableCopy", "format", "gene", "identical", "identity",
    "jobId", "jobs", "location", "matchesAnnotatedTranslation", "meanConservationNormalized",
    "meanIdentity", "meanQualityByCycle", "message", "name", "note", "options", "pairs",
    "proteinId", "q30Fraction", "readCount", "reason", "recordCount", "records", "removed",
    "restored", "result", "rowCount", "savedSessionId", "selectedRange", "selectedRows",
    "selection", "source", "state", "target", "terminalStopPresent", "track", "tracks",
    "translatedResidues", "translationTable", "viewer", "viewerSessionId",
  ],
  ngs: [
    "activeVersionId", "active_version_checksum", "active_version_id", "archived", "arguments", "availability",
    "cancellation_requested", "cancelled", "catalog_source_checksum", "checkedAt", "code", "command",
    "created", "created_at", "cwd", "description", "diagnostic", "diagnostics", "engine", "errors", "events",
    "executable", "exit_code", "expectedEngine", "explanation", "id", "lineages", "message", "name",
    "observation", "plan_checksum", "plan_id", "plan_name", "process_id", "reachable", "readiness",
    "ready", "reason", "registry_run_id", "requestedEngine", "requestedExecutables", "run_dir", "runs",
    "runtime", "source_available", "source_entrypoint", "state", "stderr_summary", "stdout_summary",
    "summary_path", "target", "target_id", "targets", "updated", "updated_at", "version",
    "version_count", "versions", "workflow", "workflow_id", "workflow_version_id", "workflows",
    "execution_receipt", "mcp_server", "report", "reused", "viewer", "viewerReady", "workspaceSection",
  ],
  structure: [
    "alignedResidueCount", "applied", "appliedMatrix", "appliedRevision", "atomContactCount", "atomCount",
    "atomic", "atoms", "background", "baseAtoms", "bytes", "centroid", "cleared", "color", "contacts",
    "coordinateLoad", "correspondence", "deleted", "display", "displayClashes", "dryRun", "focus", "format",
    "geometry", "guide", "guides", "history", "id", "implementation", "interaction", "items", "kind",
    "level", "load", "matrix", "measurement", "measurements", "method", "metricId", "mode", "name",
    "named", "nextCursor", "object", "objectId", "objects", "outputPath", "overwritten", "path",
    "provenance", "removed", "representation", "representations", "residuePairCount", "residuePairs", "rmsd",
    "rmsdAngstrom", "rotation", "scene", "sceneRevision", "scenes", "selected", "selectedAtomCount",
    "selectedResidueCount", "selection", "selectionLanguage", "sessionReady", "showHydrogens", "sideChains",
    "state", "structure", "supportedActions", "thresholdAngstrom", "total", "transform", "translation",
    "truncated", "unsupportedReason", "valid", "viewerOpen", "viewerReady", "viewerSessionId", "visible",
    "wouldApply", "x", "y", "z",
  ],
  slide: [
    "applied", "authorized", "budgets", "byteLength", "byteOrder", "bytes", "cancellationAccepted", "column",
    "commandSearch", "digest", "displayMode", "executionSettled", "exportOptions", "fileName", "format", "formats",
    "gene", "genes", "geometry", "height", "id", "imageDescription", "inspection", "items", "job", "jobId",
    "jobs", "layer", "layers", "load", "mainImage", "matrices", "matrix", "matrixFormat", "matrixShape", "max",
    "mean", "measurement", "measurements", "metadata", "micronsPerPixel", "min", "mode", "nextOffset", "nonzero",
    "note", "objectiveMagnification", "observationCount", "observations", "operations", "path", "presentation",
    "properties", "provenance", "pyramidLevels", "renderAvailable", "renderState", "restored", "scientificLayers",
    "selectedRegions", "source", "sourceId", "sourceRevision", "spatial", "spatialCoordinates", "state",
    "stateRevision", "theme", "toolbarVisible", "total", "valueScale", "viewerControls", "viewerReady",
    "viewerSessionId", "visibleBounds", "width", "workspaceSection",
  ],
  rosalind: [
    "area", "availableServices", "operationCount", "providerId", "retainedDesign", "skillCount", "viewer",
  ],
};

const ERROR_SCHEMA: JsonSchemaNode = {
  type: "object",
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    status: { type: "integer" },
    details: { type: "object", additionalProperties: true },
  },
  required: ["code", "message"],
  additionalProperties: false,
};

const ERROR_SCHEMA_SPEC = {
  type: "object",
  properties: {
    code: { type: "string", required: true },
    message: { type: "string", required: true },
    status: { type: "integer" },
    details: { type: "object", additionalProperties: true },
  },
  additionalProperties: false,
} as const;

function outputProperties(serviceId: ScienceServiceId): ParameterSchemaSpec {
  return Object.fromEntries(
    SERVICE_OUTPUT_FIELDS[serviceId].map((field) => [field, { type: "json" }]),
  );
}

/** Build the defineTool authoring form; defineTool compiles required flags into JSON Schema. */
export function scienceOutputSpec(serviceId: ScienceServiceId, operation: string): ObjectValueSchemaSpec {
  const properties = outputProperties(serviceId);
  Object.assign(properties, {
    serviceId: { type: "string", const: serviceId, required: true },
    operation: { type: "string", const: operation, required: true },
    status: { type: "string", required: true },
    ok: { type: "boolean" },
    error: ERROR_SCHEMA_SPEC,
  } satisfies ParameterSchemaSpec);
  if (Object.hasOwn(properties, "diagnostics")) properties.diagnostics = { type: "array", items: { type: "string" } };
  return { type: "object", properties, additionalProperties: false };
}

/** Build the enforced DSH output contract for one normalized science call. */
export function scienceOutputSchema(serviceId: ScienceServiceId, operation: string): ObjectJsonSchema {
  const properties: Record<string, JsonSchemaNode> = Object.fromEntries(
    SERVICE_OUTPUT_FIELDS[serviceId].map((field) => [field, {}]),
  );
  Object.assign(properties, {
    serviceId: { type: "string", const: serviceId },
    operation: { type: "string", const: operation },
    status: { type: "string" },
    ok: { type: "boolean" },
    error: ERROR_SCHEMA,
  } satisfies Record<string, JsonSchemaNode>);
  if (Object.hasOwn(properties, "diagnostics")) properties.diagnostics = { type: "array", items: { type: "string" } };
  return {
    type: "object",
    properties,
    required: ["serviceId", "operation", "status"],
    additionalProperties: false,
  };
}

function callView(contract: RuntimeOperationContract, args: unknown) {
  return {
    card: "generic" as const,
    title: contract.tool.title,
    rawInput: JSON.stringify(args, null, 2),
  };
}

function resultView(contract: RuntimeOperationContract, result: ToolResult) {
  return {
    card: "generic" as const,
    title: result.isError ? `${contract.tool.title} failed` : contract.tool.title,
  };
}

function toolDefinition(contract: RuntimeOperationContract, executor: ScienceExecutor, packageRoot: string): ToolDefinition {
  return {
    name: contract.registeredName,
    description: contract.tool.description,
    parameters: contract.parameters as unknown as Record<string, unknown>,
    output: {
      schema: scienceOutputSchema(contract.record.serviceId as ScienceServiceId, contract.record.operation),
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }],
      presentationMeta: (_args, value) => {
        const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, JsonValue> : {};
        return {
          serviceId: contract.record.serviceId,
          operation: contract.record.operation,
          status: typeof record.status === "string" ? record.status : "completed",
        };
      },
    },
    timeoutMs: 30 * 60 * 1000,
    isConcurrencySafe: () => contract.tool.annotations.readOnlyHint === true,
    async execute(args, exec) {
      const record = args && typeof args === "object" && !Array.isArray(args) ? args as Record<string, unknown> : {};
      return executor.execute(contract.record.serviceId, contract.record.operation, record, {
        session: exec.agent ?? FALLBACK_SESSION,
        ...(exec.agent?.id ? { sessionId: String(exec.agent.id) } : {}),
        signal: exec.signal,
        packageRoot,
      });
    },
    presentCall: (args) => callView(contract, args),
    presentResult: (_args, result) => resultView(contract, result),
  };
}

export function createScienceTools(executor: ScienceExecutor, registry = new CapabilityRegistry()): ToolDefinition[] {
  return registry.operations.map((contract) => toolDefinition(contract, executor, registry.packageRoot));
}
