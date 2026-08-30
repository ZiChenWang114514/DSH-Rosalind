import type {
  JsonSchemaNode, JsonValue, ObjectJsonSchema, ObjectValueSchemaSpec, ParameterSchemaSpec,
  ToolDefinition, ToolResult,
} from "@deepseek-ai/dsh-tools";
import { resolve } from "node:path";

import { CapabilityRegistry, type RuntimeOperationContract } from "./capabilities.js";

export interface ScienceExecutionContext {
  session: object;
  /** Stable DSH agent/session identity when the host provides one. */
  sessionId?: string;
  signal: AbortSignal;
  packageRoot: string;
  allowNetwork?: boolean;
  /** Exact files and directories selected in an immutable Rosalind plan. */
  authorizedPaths?: readonly string[];
}

export interface ScienceExecutor {
  execute(
    serviceId: string,
    operation: string,
    args: Record<string, unknown>,
    context: ScienceExecutionContext,
  ): Promise<Record<string, JsonValue>>;
}

export type ScienceServiceId = "literature" | "databases" | "sequence" | "ngs" | "structure" | "slide" | "rosalind";

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
    "action", "alignedAtomCount", "alignedResidueCount", "annotations", "annotationId", "applied", "appliedMatrix", "appliedRevision", "areaSquareAngstrom", "artifact", "assumption", "atomContactCount", "atomCount", "axes",
    "atomic", "atoms", "background", "baseAtoms", "bytes", "candidateCount", "cancellationAccepted", "cancelled", "centroid", "clashCount", "clashes", "cleared", "color", "componentSasaSquareAngstrom", "contacts",
    "coordinateLoad", "coordinatePreview", "correspondence", "deleted", "density", "densityMaps", "display", "displayClashes", "displayMode", "dryRun", "durationSeconds", "eigenvalues", "focus", "format", "fps", "frameCount",
    "geometry", "guide", "guides", "history", "hydrogenBonds", "id", "implementation", "interaction", "interfaceAreaSquareAngstrom", "items", "job", "kind", "layerId", "layers",
    "hits", "level", "load", "matchedAtomCount", "matrix", "measurement", "measurements", "method", "metricId", "metrics", "mode", "name",
    "named", "nextCursor", "normal", "object", "objectId", "objects", "outputPath", "overwritten", "path",
    "probeRadiusAngstrom", "provenance", "queryHash", "reason", "removed", "renderedAtomCount", "renderer", "renderJobs", "representation", "representations", "reset", "residuePairCount", "residuePairs", "restored", "rmsd",
    "rmsdAngstrom", "rotation", "scene", "sceneRevision", "scenes", "selected", "selectedAtomCount",
    "selectedResidueCount", "selection", "selectionAtomCount", "selectionLanguage", "sessionReady", "showHydrogens", "sideChains",
    "samplesPerAtom", "scale", "state", "structure", "supportedActions", "supportedFormats", "targetAtomCount", "thresholdAngstrom", "tmScore", "toolbarVisible", "total", "totalSasaLossSquareAngstrom", "transform", "translation",
    "trajectory", "truncated", "unsupportedActions", "unsupportedFormats", "unsupportedReason", "valid", "viewerOpen", "viewerReady", "viewerSessionId", "visible",
    "workspace", "wouldApply", "x", "y", "z", "dimensions", "estimatedPixels",
  ],
  slide: [
    "annotation", "applied", "artifact", "authorized", "budgets", "byteLength", "byteOrder", "bytes", "cancellationAccepted", "canRedo", "canUndo", "column", "coordinatePreview",
    "commandSearch", "decoderAvailable", "digest", "displayMode", "entities", "entity", "executionSettled", "exportOptions", "fileName", "format", "formats",
    "dataUrl", "gene", "genes", "geometry", "height", "id", "imageDescription", "inspection", "items", "job", "jobId",
    "jobs", "layer", "layerEntityCounts", "layers", "load", "mainImage", "matrices", "matrix", "matrixFormat", "matrixShape", "max", "mimeType",
    "mean", "measurement", "measurements", "metadata", "micronsPerPixel", "min", "mode", "nextOffset", "nonzero",
    "note", "objectiveMagnification", "observationCount", "observations", "operations", "originalPixelsAvailable", "path", "pending", "presentation", "previewTile", "projectHistory",
    "properties", "provenance", "pyramidLevels", "region", "renderAvailable", "renderer", "renderState", "requestedRevision", "restored", "restoredLayers", "result", "scientificLayers", "selectedGene", "sha256",
    "resumed", "reused", "selectedRegions", "source", "sourceHeight", "sourceId", "sourceRevision", "sourceWidth", "spatial", "spatialCoordinates", "spatialExpression", "state",
    "stateRevision", "theme", "timedOut", "toolbarVisible", "total", "valueScale", "viewerControls", "viewerReady", "viewerState",
    "viewerSessionId", "visibleBounds", "width", "workspaceSection",
  ],
  rosalind: [
    "area", "availableServices", "operationCount", "providerId", "retainedDesign", "skillCount", "viewer",
  ],
};

/** The normalizer in science/runtime.ts is deliberately small; this is the
 * public, operation-level result vocabulary.  Do not widen this list without
 * adding a runtime result and a fixture which exercises it. */
const RESULT_STATUSES = ["completed", "failed", "cancelled", "blocked", "configured", "unavailable"] as const;

const MODULE_STATUS_SCHEMA: JsonSchemaNode = {
  type: "object",
  properties: {
    enabled: { type: "boolean" },
    status: { type: "string", enum: ["available", "disabled"] },
    diagnostic: { oneOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["enabled", "status", "diagnostic"],
  additionalProperties: false,
};

const MODULE_STATUS_SCHEMA_SPEC = {
  type: "object",
  properties: {
    enabled: { type: "boolean", required: true },
    status: { type: "string", enum: ["available", "disabled"], required: true },
    diagnostic: { oneOf: [{ type: "string" }, { type: "null" }], required: true },
  },
  additionalProperties: false,
} as const;

const REGISTRY_DIAGNOSTIC_SCHEMA: JsonSchemaNode = {
  type: "object",
  properties: {
    code: { type: "string" },
    path: { type: "string" },
    original_preserved: { type: "boolean" },
    byte_length: { type: "number" },
    message: { type: "string" },
    observed_schema: { oneOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["code", "path", "original_preserved"],
  additionalProperties: false,
};

const REGISTRY_DIAGNOSTIC_SCHEMA_SPEC = {
  type: "object",
  properties: {
    code: { type: "string", required: true },
    path: { type: "string", required: true },
    original_preserved: { type: "boolean", required: true },
    byte_length: { type: "number" },
    message: { type: "string" },
    observed_schema: { oneOf: [{ type: "string" }, { type: "null" }] },
  },
  additionalProperties: false,
} as const;

const STRING_FIELDS = new Set([
  "action", "activeVersionId", "active_version_checksum", "active_version_id", "area", "background", "callerId", "code", "commandId", "dataUrl", "directoryToken",
  "analysis", "checkedAt", "cwd", "description", "displayMode", "engine", "expectedEngine", "explanation", "fileName", "format", "gene",
  "id", "implementation", "jobId", "kind", "layerId", "level", "message", "method", "metricId", "mimeType", "mode",
  "name", "note", "objectId", "operation", "outputPath", "path", "plan_checksum", "plan_id", "plan_name",
  "provider", "providerId", "queryHash", "reason", "registry_run_id", "renderer", "representation", "requestedEngine", "run_dir", "savedSessionId", "service",
  "selectionLanguage", "sourceId", "sourceRevision", "state", "summary_path", "target_id", "title", "translationTable", "unsupportedReason", "endpoint", "preparedOperation", "expiresAt", "response", "sha256", "schemaVersion", "view",
  "viewer", "viewerSessionId", "viewerState", "renderState", "workflow_id", "workflow_version_id", "workspaceSection", "xml_url", "text_url", "pdf_url", "pmcid", "pmid", "doi", "url", "mcp_server", "created_at", "updated_at",
]);
const NUMBER_FIELDS = new Set([
  "alignedAtomCount", "alignedLength", "alignedResidueCount", "appliedRevision", "areaSquareAngstrom", "artifactCount", "atomContactCount",
  "atomCount", "bases", "byteLength", "bytes", "candidateCount", "clashCount", "codingBases", "column", "componentSasaSquareAngstrom",
  "durationSeconds", "estimatedPixels", "exit_code", "fps", "frameCount", "height", "identity", "interfaceAreaSquareAngstrom", "limit", "matchedAtomCount", "max", "mean", "offset", "operationCount",
  "meanConservationNormalized", "meanIdentity", "media_url_count", "min", "nextOffset", "nonzero", "observationCount",
  "objectiveMagnification", "probeRadiusAngstrom", "q30Fraction", "readCount", "recordCount", "renderedAtomCount", "instanceCount",
  "residuePairCount", "rmsd", "rmsdAngstrom", "rowCount", "samplesPerAtom", "scale", "sceneRevision", "selectedAtomCount",
  "selectedResidueCount", "selectionAtomCount", "skillCount", "sourceHeight", "sourceWidth", "stateRevision", "targetAtomCount",
  "thresholdAngstrom", "tmScore", "total", "totalSasaLossSquareAngstrom", "translatedResidues", "width", "x", "y", "z", "requestedRevision",
]);
const BOOLEAN_FIELDS = new Set([
  "applied", "archived", "authorized", "canRedo", "canUndo", "cancellationAccepted", "cancellation_accepted", "cancelled", "cleared", "created", "decoderAvailable",
  "atomic", "deleted", "displayClashes", "dryRun", "executionSettled", "is_historical_ocr", "is_manuscript", "is_pmc_openaccess", "is_retracted", "imported", "exported", "prepared", "submitted", "localMock",
  "execution_settled", "matchesAnnotatedTranslation", "originalPixelsAvailable", "overwritten", "pending", "process_started", "reachable", "ready", "renderAvailable",
  "restored", "reused", "resumed", "sessionReady", "showHydrogens", "sideChains", "source_available", "terminalStopPresent", "timedOut",
  "toolbarVisible", "truncated", "valid", "viewerReady", "visible", "wouldApply",
]);
const ARRAY_FIELDS = new Set([
  "annotations", "artifacts", "atoms", "axes", "baseAtoms", "clashes", "columns", "contacts", "declared_input_paths", "densityMaps", "diagnostics", "eigenvalues", "entities", "errors", "events",
  "availableServices", "formats", "genes", "guides", "hits", "hydrogenBonds", "items", "jobs", "layers", "lineages", "matrices", "measurements", "media_urls", "metrics", "scientificLayers",
  "objects", "pairs", "records", "renderJobs", "representations", "residuePairs", "runs", "scenes", "scientific_input_paths", "selectedRows", "selectedRegions",
  "sources", "supportedActions", "supportedFormats", "targets", "tracks", "unsupportedActions", "unsupportedFormats", "versions", "workflows",
]);
const NULLABLE_NUMBER_FIELDS = new Set(["exit_code", "nextOffset", "process_id", "sourceHeight", "sourceWidth"]);
const NULLABLE_STRING_FIELDS = new Set(["providerId", "nextCursor"]);
const NULLABLE_OBJECT_FIELDS = new Set(["command", "diagnostic", "previewTile"]);

/**
 * Every registered operation owns a finite list of top-level payload fields.
 * The common identity/error fields are appended separately.  This is kept in
 * the host source so the running tools and generated capability manifest are
 * driven by the same contract rather than by a service-wide permissive list.
 */
const OPERATION_OUTPUT_FIELDS: Record<string, readonly string[]> = {
  "rosalind.open": ["viewer", "area", "providerId", "availableServices", "skillCount", "operationCount", "retainedDesign"],
  "rosalind.settings": ["schemaVersion", "ready", "view"],

  "sequence.acquire_public_example": ["viewer", "viewerSessionId", "artifact", "state"],
  "sequence.align": ["jobId", "artifact", "result", "state"],
  "sequence.cancel_job": ["jobId", "cancelled", "reason"],
  "sequence.control_viewer": ["applied", "action", "state", "selection"],
  "sequence.edit_copy": ["operation", "editableCopy"],
  "sequence.export_artifact": ["artifact"],
  "sequence.load_track": ["track"],
  "sequence.manage_annotations": ["annotations", "annotation", "removed"],
  "sequence.open_from_chat": ["viewer", "viewerSessionId", "artifact", "state"],
  "sequence.query_viewer": ["target", "state", "note", "records", "jobs", "annotations", "tracks", "artifacts", "query", "hits", "selectedHit", "rowCount", "alignedLength", "meanIdentity", "meanConservationNormalized", "pairs", "columns"],
  "sequence.restore_session": ["restored", "savedSessionId", "state"],
  "sequence.run_analysis": ["jobId", "state", "analysis", "result"],
  "sequence.save_session": ["savedSessionId", "name", "viewerSessionId"],

  "activate_workflow_version": ["workflow", "workflow_id", "active_version_id", "active_version_checksum", "version"],
  "archive_workflow": ["workflow", "workflow_id", "archived", "updated_at"],
  "cancel_ngs_run": ["registry_run_id", "cancelled", "cancellation_requested", "cancellation_accepted", "executionSettled", "execution_settled", "state", "process_id", "reason", "diagnostic"],
  "check_nextflow_readiness": ["ok", "ready", "engine", "executable", "run_dir", "workflow_id", "workflow_version_id", "target_id", "declared_input_paths", "scientific_input_paths", "checkedAt", "diagnostics", "code", "expectedEngine", "requestedEngine", "requestedExecutables", "runtime"],
  "check_snakemake_readiness": ["ok", "ready", "engine", "executable", "run_dir", "workflow_id", "workflow_version_id", "target_id", "declared_input_paths", "scientific_input_paths", "checkedAt", "diagnostics", "code", "expectedEngine", "requestedEngine", "requestedExecutables", "runtime"],
  "execute_plan": ["ok", "registry_run_id", "state", "plan_id", "plan_checksum", "workflow_id", "command", "process_id", "process_started", "diagnostic", "events", "reused", "execution_receipt", "reason", "code", "diagnostics"],
  "get_ngs_run": ["ok", "registry_run_id", "workflow_id", "plan_id", "state", "created_at", "updated_at", "events", "command", "process_id", "exit_code", "stdout_summary", "stderr_summary", "summary_path", "diagnostic", "cancellation_requested", "execution_settled"],
  "get_runtime_environment": ["target_id", "target", "runtime", "executable", "version", "ready", "diagnostics", "code", "mcp_server"],
  "list_ngs_run_lineages": ["lineages"],
  "list_ngs_runs": ["runs"],
  "list_workflow_versions": ["workflow_id", "versions", "active_version_id", "version_count"],
  "list_workflows": ["workflows", "mcp_server"],
  "observe_ngs_run": ["ok", "registry_run_id", "workflow_id", "plan_id", "state", "created_at", "updated_at", "events", "command", "process_id", "exit_code", "stdout_summary", "stderr_summary", "summary_path", "diagnostic", "cancellation_requested", "execution_settled", "observation"],
  "plan_nextflow": ["plan_id", "plan_name", "plan_checksum", "workflow_id", "engine", "readiness", "command", "executable", "explanation"],
  "plan_snakemake": ["plan_id", "plan_name", "plan_checksum", "workflow_id", "engine", "readiness", "command", "executable", "explanation"],
  "restore_workflow": ["workflow", "workflow_id", "archived", "updated_at"],
  "save_workflow": ["workflow", "workflow_id", "active_version_id", "active_version_checksum", "created", "created_at"],
  "update_ngs_run_analysis_summary": ["registry_run_id", "summary_path", "updated"],
  "update_workflow": ["workflow", "workflow_id", "active_version_id", "active_version_checksum", "updated", "updated_at"],
  "configure_ssh_target": ["target", "status", "diagnostics"],
  "inspect_compute_target": ["target", "reachable", "code", "diagnostics", "requestedExecutables", "runtime"],
  "list_compute_targets": ["targets"],
  "open_ngs_workbench": ["viewer", "viewerReady", "workspaceSection"],
  "list_compute_target_summaries": ["targets"],
  "get_ngs_run_report": ["ok", "registry_run_id", "availability", "report", "summary_path", "errors"],

  "structure.add_structure": ["ok", "object", "appliedRevision"],
  "structure.align_structures": ["ok", "method", "alignedAtomCount", "alignedResidueCount", "rmsdAngstrom", "matrix", "appliedMatrix", "tmScore", "correspondence", "implementation", "appliedRevision", "objectId", "targetAtomCount", "provenance"],
  "structure.analyze": ["ok", "kind", "atomCount", "centroid", "axes", "eigenvalues", "normal", "areaSquareAngstrom", "componentSasaSquareAngstrom", "interfaceAreaSquareAngstrom", "totalSasaLossSquareAngstrom", "probeRadiusAngstrom", "samplesPerAtom", "contacts", "clashes", "hydrogenBonds", "residuePairs", "rmsdAngstrom", "tmScore", "matchedAtomCount", "matrix", "provenance", "truncated", "assumption", "candidateCount", "clashCount", "atomContactCount", "residuePairCount"],
  "structure.apply_scene": ["ok", "applied", "dryRun", "atomic", "valid", "wouldApply", "sceneRevision", "appliedRevision", "state", "layers", "display", "workspace"],
  "structure.assembly_symmetry": ["ok", "action", "objectId", "source", "items", "total", "offset", "limit", "nextOffset", "provenance"],
  "structure.browse_related_data": ["ok", "callerId", "commandId", "directoryToken", "items", "total", "truncated", "nextCursor", "provenance"],
  "structure.cancel_render": ["ok", "job", "cancelled", "cancellationAccepted", "reason", "sceneRevision"],
  "structure.control_viewer": ["ok", "applied", "representation", "color", "display", "displayMode", "toolbarVisible", "workspace", "reset", "cancelled", "reason", "sceneRevision", "appliedRevision"],
  "structure.delete_scene": ["ok", "deleted", "name", "sceneRevision", "appliedRevision"],
  "structure.derive_object": ["ok", "object", "objectId", "appliedRevision", "provenance"],
  "structure.discover_density": ["ok", "source", "items", "total", "provenance"],
  "structure.export": ["ok", "artifact", "format", "path", "bytes", "outputPath", "overwritten", "sceneRevision", "selectionAtomCount", "provenance"],
  "structure.get_render_status": ["ok", "job"],
  "structure.get_state": ["ok", "viewerSessionId", "sessionReady", "viewerReady", "sceneRevision", "load", "interaction", "structure", "atoms", "coordinatePreview", "display", "workspace", "selection", "focus", "objects", "densityMaps", "layers", "annotations", "measurements", "guides", "renderJobs", "history"],
  "structure.list_scenes": ["ok", "scenes"],
  "structure.list_structures": ["ok", "objects"],
  "structure.load_background": ["ok", "background", "appliedRevision", "provenance"],
  "structure.load_data": ["ok", "kind", "object", "trajectory", "appliedRevision", "provenance"],
  "structure.load_public_density": ["ok", "density", "appliedRevision", "provenance"],
  "structure.load_scene": ["ok", "scene", "name", "applied", "restored", "sceneRevision", "appliedRevision"],
  "structure.manage_guides": ["ok", "guide", "guides", "removed", "cleared", "deleted", "geometry", "appliedRevision"],
  "structure.measure": ["ok", "measurement", "appliedRevision"],
  "structure.open_from_chat": ["ok", "viewerSessionId", "sessionReady", "viewerReady", "sceneRevision", "load", "interaction", "structure", "atoms", "coordinatePreview", "display", "workspace", "selection", "focus", "objects", "densityMaps", "layers", "annotations", "measurements", "guides", "renderJobs", "history", "coordinateLoad", "viewerOpen"],
  "structure.pymol_action": ["ok", "action", "applied", "representation", "color", "display", "workspace", "selectedAtomCount", "selectedResidueCount", "targetAtomCount", "layerId", "annotationId", "objectId", "scene", "name", "restored", "deleted", "removed", "history", "state", "measurement", "kind", "result", "appliedRevision"],
  "structure.pymol_actions": ["ok", "sceneRevision", "selectionLanguage", "implementation", "supportedActions", "representations", "unsupportedActions", "unsupportedReason"],
  "structure.quality_assessment": ["ok", "objectId", "metricId", "metrics", "items", "total", "nextCursor", "provenance"],
  "structure.query": ["ok", "level", "items", "total", "nextCursor", "sceneRevision"],
  "structure.redo": ["ok", "action", "restored", "sceneRevision", "appliedRevision", "history", "state"],
  "structure.remove_structure": ["ok", "removed", "objectId", "sceneRevision", "appliedRevision"],
  "structure.render_image": ["ok", "job", "artifact", "renderedAtomCount", "sceneRevision", "provenance"],
  "structure.render_movie": ["ok", "job", "artifact", "frameCount", "fps", "durationSeconds", "sceneRevision", "provenance"],
  "structure.save_scene": ["ok", "scene", "name", "sceneRevision", "appliedRevision"],
  "structure.search_motif": ["ok", "queryHash", "hits", "total", "nextCursor", "provenance"],
  "structure.set_assembly_symmetry": ["ok", "objectId", "display", "appliedRevision", "provenance"],
  "structure.set_object_visibility": ["ok", "objectId", "visible", "appliedRevision"],
  "structure.set_quality_assessment": ["ok", "objectId", "metricId", "displayClashes", "appliedRevision"],
  "structure.set_selection": ["ok", "applied", "selectedAtomCount", "selectedResidueCount", "appliedRevision"],
  "structure.set_trajectory_state": ["ok", "objectId", "state", "appliedRevision", "provenance"],
  "structure.transform_object": ["ok", "objectId", "mode", "transform", "matrix", "appliedMatrix", "atomCount", "implementation", "appliedRevision", "wouldApply"],
  "structure.undo": ["ok", "action", "restored", "sceneRevision", "appliedRevision", "history", "state"],
  "structure.validate_render": ["ok", "valid", "dimensions", "estimatedPixels", "renderer", "supportedFormats", "unsupportedFormats", "sceneRevision", "provenance"],

  "slide.cancel_analysis_from_chat": ["ok", "job", "cancellationAccepted", "executionSettled", "stateRevision", "note"],
  "slide.cancel_pathology": ["ok", "job", "cancellationAccepted", "executionSettled", "stateRevision", "note"],
  "slide.cancel_scientific_layer_import": ["ok", "job", "cancellationAccepted", "executionSettled", "stateRevision"],
  "slide.cancel_workflow": ["ok", "job", "cancellationAccepted", "executionSettled", "stateRevision", "note"],
  "slide.export_dicom_object": ["ok", "exported", "path", "bytes", "sha256", "original", "dicomObject", "stateRevision"],
  "slide.get_analysis_from_chat": ["ok", "job"],
  "slide.get_capabilities": ["ok", "formats", "operations", "renderer", "budgets"],
  "slide.get_live_workflow": ["ok", "job"],
  "slide.get_pathology": ["ok", "job"],
  "slide.get_scientific_entity": ["ok", "layer", "entity", "total", "items", "nextOffset"],
  "slide.get_scientific_layer_import": ["ok", "job"],
  "slide.get_viewer_state": ["ok", "viewerSessionId", "stateRevision", "source", "sourceRevision", "fileName", "format", "load", "presentation", "viewerControls", "selectedRegions", "measurements", "layers", "scientificLayers", "spatial", "jobs", "projectHistory", "previewTile", "renderer", "renderAvailable", "viewerReady", "viewerState", "renderState", "workspaceSection", "commandSearch", "theme", "toolbarVisible", "displayMode", "visibleBounds"],
  "slide.get_workflow": ["ok", "job"],
  "slide.import_analysis_source_from_chat": ["ok", "sourceId", "path", "format", "state", "note"],
  "slide.import_dicom_object": ["ok", "imported", "layer", "dicomObject", "stateRevision"],
  "slide.import_scientific_layer": ["ok", "jobId", "job", "layer", "sourceRevision", "stateRevision", "provenance"],
  "slide.import_workflow_source": ["ok", "sourceId", "path", "format", "state", "note"],
  "slide.inspect_dicomweb_instance": ["ok", "object", "location", "provenance"],
  "slide.list_scientific_layers": ["ok", "layers"],
  "slide.list_workflow_sources": ["ok", "items", "note"],
  "slide.list_workflows": ["ok", "items", "note"],
  "slide.open_dicom_series": ["ok", "viewerSessionId", "stateRevision", "source", "sourceRevision", "fileName", "format", "load", "presentation", "viewerControls", "scientificLayers", "spatial", "jobs", "projectHistory", "previewTile", "renderer", "viewerReady", "viewerState", "renderState", "displayMode", "toolbarVisible", "theme", "visibleBounds", "selectedRegions", "layers", "measurements", "workspaceSection", "commandSearch"],
  "slide.open_dicomweb_wsi": ["ok", "viewerSessionId", "stateRevision", "source", "sourceRevision", "fileName", "format", "load", "presentation", "viewerControls", "scientificLayers", "spatial", "jobs", "projectHistory", "previewTile", "renderer", "viewerReady", "viewerState", "renderState", "displayMode", "toolbarVisible", "theme", "visibleBounds", "selectedRegions", "layers", "measurements", "workspaceSection", "commandSearch"],
  "slide.open_from_chat": ["ok", "viewerSessionId", "stateRevision", "source", "sourceRevision", "fileName", "format", "load", "presentation", "viewerControls", "scientificLayers", "spatial", "jobs", "projectHistory", "previewTile", "renderer", "viewerReady", "viewerState", "renderState", "displayMode", "toolbarVisible", "theme", "visibleBounds", "selectedRegions", "layers", "measurements", "workspaceSection", "commandSearch", "note"],
  "slide.open_ome_tiff_series": ["ok", "viewerSessionId", "stateRevision", "source", "sourceRevision", "fileName", "format", "load", "presentation", "viewerControls", "scientificLayers", "spatial", "jobs", "projectHistory", "previewTile", "renderer", "viewerReady", "viewerState", "renderState", "displayMode", "toolbarVisible", "theme", "visibleBounds", "selectedRegions", "layers", "measurements", "workspaceSection", "commandSearch", "note"],
  "slide.open_ome_zarr": ["ok", "viewerSessionId", "stateRevision", "source", "sourceRevision", "fileName", "format", "load", "presentation", "viewerControls", "scientificLayers", "spatial", "jobs", "projectHistory", "previewTile", "renderer", "viewerReady", "viewerState", "renderState", "displayMode", "toolbarVisible", "theme", "visibleBounds", "selectedRegions", "layers", "measurements", "workspaceSection", "commandSearch", "note"],
  "slide.prepare_dicom_upload": ["ok", "prepared", "preparedOperation", "endpoint", "instanceCount", "bytes", "expiresAt", "localMock", "stateRevision"],
  "slide.query_dicomweb": ["ok", "items", "total", "provenance"],
  "slide.query_viewer": ["ok", "mimeType", "dataUrl", "x", "y", "width", "height", "sourceWidth", "sourceHeight", "sourceId", "sourceRevision", "provenance", "total", "items", "canUndo", "canRedo", "state"],
  "slide.read_dicomweb_object": ["ok", "object", "location", "provenance"],
  "slide.read_live_workflow_artifact": ["ok", "job", "artifact", "result", "provenance"],
  "slide.read_workflow_artifact": ["ok", "job", "artifact", "result", "provenance"],
  "slide.renew_scientific_layer_authorization": ["ok", "sourceId", "sourceRevision", "authorized", "stateRevision"],
  "slide.renew_source_authorization": ["ok", "sourceId", "sourceRevision", "authorized", "stateRevision"],
  "slide.resume_pathology": ["ok", "resumed", "reused", "job", "artifact", "note", "stateRevision"],
  "slide.resume_workflow": ["ok", "resumed", "reused", "job", "artifact", "note", "stateRevision"],
  "slide.run_workflow": ["ok", "job", "result", "artifact", "stateRevision", "error"],
  "slide.spatial_indexed": ["ok", "observations", "genes", "matrix", "matrixFormat", "matrixShape", "valueScale", "spatialCoordinates", "gene", "column", "observationCount", "nonzero", "min", "max", "mean", "matrices", "provenance"],
  "slide.submit_dicom_upload": ["ok", "submitted", "endpoint", "instanceCount", "bytes", "response", "localMock", "stateRevision"],
  "slide.wait_for_render": ["ok", "viewerSessionId", "stateRevision", "requestedRevision", "viewerReady", "viewerState", "renderState", "pending", "timedOut", "source", "sourceRevision", "fileName", "format", "load", "presentation", "viewerControls", "scientificLayers", "spatial", "jobs", "projectHistory", "previewTile", "renderer", "displayMode", "toolbarVisible", "theme", "visibleBounds", "selectedRegions", "layers", "measurements", "workspaceSection", "commandSearch", "note"],

  "literature.request": ["ok", "service", "records", "sources", "diagnostics", "request", "pagination"],
  "database.request": ["ok", "provider", "records", "sources", "diagnostics", "request", "pagination"],
  "slide.control_viewer": ["ok", "applied", "viewerReady", "viewerState", "renderState", "sourceRevision", "stateRevision", "toolbarVisible", "displayMode", "visibleBounds", "workspaceSection", "commandSearch", "theme", "selectedRegions", "annotation", "measurement", "gene", "layer", "exportOptions"],
  "slide.run_analysis_from_chat": ["ok", "job", "result", "artifact", "stateRevision", "error"],
  "slide.run_pathology": ["ok", "job", "result", "artifact", "stateRevision", "error"],
  "slide.query_scientific_layer": ["ok", "layer", "entity", "total", "items", "nextOffset"],
};

function fieldSchema(field: string, serviceId: ScienceServiceId, operation: string): JsonSchemaNode {
  if (field === "job") return { type: "object", properties: { id: { type: "string" }, durableId: { type: "string" }, state: { type: "string", enum: ["queued", "running", "completed", "failed", "cancelled"] } }, additionalProperties: true };
  if (field === "error") return ERROR_SCHEMA;
  if (field === "ok") return { type: "boolean" };
  if (field === "checkedAt") return { type: "string" };
  if (field === "jobId") return { type: "string" };
  if (field === "analysis") return { type: "string" };
  if (serviceId === "sequence" && operation === "sequence.query_viewer" && field === "target") return { type: "string" };
  if (serviceId === "sequence" && operation === "sequence.query_viewer" && field === "query") return { type: "string" };
  if (serviceId === "sequence" && operation === "sequence.query_viewer" && field === "selectedHit") return { oneOf: [{ type: "number" }, { type: "null" }] };
  if (serviceId === "sequence" && operation === "sequence.query_viewer" && field === "hits") return { type: "array", items: { type: "object", properties: { record: { type: "string" }, start: { type: "number" }, end: { type: "number" } }, required: ["record", "start", "end"], additionalProperties: false } };
  if (serviceId === "slide" && field === "note" && ["slide.open_from_chat", "slide.open_ome_zarr", "slide.open_ome_tiff_series"].includes(operation)) return { oneOf: [{ type: "string" }, { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, diagnostic: ERROR_SCHEMA }, required: ["code", "message"], additionalProperties: false }] };
  if (field === "state" && serviceId === "sequence" && operation !== "sequence.run_analysis") return { type: "object", additionalProperties: true };
  if (field === "state" && serviceId === "structure") return { type: "object", additionalProperties: true };
  if (field === "background" && operation === "structure.load_background") return { type: "object", additionalProperties: true };
  if (serviceId === "structure" && (field === "matrix" || field === "appliedMatrix")) return { type: "array" };
  if (serviceId === "structure" && field === "implementation") return { type: "object", additionalProperties: true };
  if (operation === "structure.align_structures" && field === "tmScore") return { oneOf: [{ type: "object", additionalProperties: true }, { type: "null" }] };
  if (operation === "structure.set_quality_assessment" && field === "metricId") return { oneOf: [{ type: "string" }, { type: "null" }] };
  if (operation === "structure.remove_structure" && field === "removed") return { type: "boolean" };
  if (operation === "structure.apply_scene" && field === "wouldApply") return { type: "object", additionalProperties: true };
  if (field === "executable" && serviceId === "ngs" && operation.startsWith("plan_")) return { type: "boolean" };
  if (field === "executable" && serviceId === "ngs") return { oneOf: [{ type: "string" }, { type: "null" }] };
  if (field === "spatial") return { oneOf: [{ type: "object", additionalProperties: true }, { type: "null" }] };
  if (field === "renderer") return { oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }] };
  if (field === "provenance") return { oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }] };
  if (BOOLEAN_FIELDS.has(field)) return { type: "boolean" };
  if (NULLABLE_STRING_FIELDS.has(field)) return { oneOf: [{ type: "string" }, { type: "null" }] };
  if (NULLABLE_NUMBER_FIELDS.has(field)) return { oneOf: [{ type: "number" }, { type: "null" }] };
  if (NULLABLE_OBJECT_FIELDS.has(field)) return { oneOf: [{ type: "object", additionalProperties: true }, { type: "null" }] };
  if (field === "layers") return { oneOf: [{ type: "array" }, { type: "object", additionalProperties: true }] };
  if (NUMBER_FIELDS.has(field)) return { type: "number" };
  if (ARRAY_FIELDS.has(field)) return { type: "array" };
  if (STRING_FIELDS.has(field)) return { type: "string" };
  return { type: "object", additionalProperties: true };
}

function fieldSpec(field: string, serviceId: ScienceServiceId, operation: string): ParameterSchemaSpec[string] {
  if (field === "job") return { type: "object", properties: { id: { type: "string" }, durableId: { type: "string" }, state: { type: "string", enum: ["queued", "running", "completed", "failed", "cancelled"] } }, additionalProperties: true };
  if (field === "error") return ERROR_SCHEMA_SPEC;
  if (field === "checkedAt") return { type: "string" };
  if (field === "jobId") return { type: "string" };
  if (field === "analysis") return { type: "string" };
  if (serviceId === "sequence" && operation === "sequence.query_viewer" && field === "target") return { type: "string" };
  if (serviceId === "sequence" && operation === "sequence.query_viewer" && field === "query") return { type: "string" };
  if (serviceId === "sequence" && operation === "sequence.query_viewer" && field === "selectedHit") return { oneOf: [{ type: "number" }, { type: "null" }] };
  if (serviceId === "sequence" && operation === "sequence.query_viewer" && field === "hits") return { type: "array", items: { type: "object", properties: { record: { type: "string" }, start: { type: "number" }, end: { type: "number" } }, additionalProperties: false } };
  if (serviceId === "slide" && field === "note" && ["slide.open_from_chat", "slide.open_ome_zarr", "slide.open_ome_tiff_series"].includes(operation)) return { oneOf: [{ type: "string" }, { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, diagnostic: ERROR_SCHEMA_SPEC }, additionalProperties: false }] };
  if (operation === "structure.apply_scene" && field === "wouldApply") return { type: "object", additionalProperties: true };
  if (field === "ok" || BOOLEAN_FIELDS.has(field)) return { type: "boolean" };
  if (field === "state" && serviceId === "sequence" && operation !== "sequence.run_analysis") return { type: "object", additionalProperties: true };
  if (field === "state" && serviceId === "structure") return { type: "object", additionalProperties: true };
  if (field === "background" && operation === "structure.load_background") return { type: "object", additionalProperties: true };
  if (serviceId === "structure" && (field === "matrix" || field === "appliedMatrix")) return { type: "array" };
  if (serviceId === "structure" && field === "implementation") return { type: "object", additionalProperties: true };
  if (operation === "structure.align_structures" && field === "tmScore") return { oneOf: [{ type: "object", additionalProperties: true }, { type: "null" }] };
  if (operation === "structure.set_quality_assessment" && field === "metricId") return { oneOf: [{ type: "string" }, { type: "null" }] };
  if (operation === "structure.remove_structure" && field === "removed") return { type: "boolean" };
  if (field === "executable" && serviceId === "ngs" && operation.startsWith("plan_")) return { type: "boolean" };
  if (field === "executable" && serviceId === "ngs") return { oneOf: [{ type: "string" }, { type: "null" }] };
  if (field === "spatial") return { oneOf: [{ type: "object", additionalProperties: true }, { type: "null" }] };
  if (field === "renderer") return { oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }] };
  if (field === "provenance") return { oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }] };
  if (NULLABLE_STRING_FIELDS.has(field)) return { oneOf: [{ type: "string" }, { type: "null" }] };
  if (NULLABLE_NUMBER_FIELDS.has(field)) return { oneOf: [{ type: "number" }, { type: "null" }] };
  if (NULLABLE_OBJECT_FIELDS.has(field)) return { oneOf: [{ type: "object", additionalProperties: true }, { type: "null" }] };
  if (NUMBER_FIELDS.has(field)) return { type: "number" };
  if (ARRAY_FIELDS.has(field)) return { type: "array" };
  if (STRING_FIELDS.has(field)) return { type: "string" };
  return { type: "object", additionalProperties: true };
}

function operationOutputFields(serviceId: ScienceServiceId, operation: string): readonly string[] {
  const fields = OPERATION_OUTPUT_FIELDS[operation];
  if (!fields) throw new Error(`No operation-specific output schema is registered for ${serviceId}.${operation}`);
  return fields;
}

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

function outputProperties(serviceId: ScienceServiceId, operation: string): ParameterSchemaSpec {
  return Object.fromEntries(operationOutputFields(serviceId, operation).map((field) => [field, fieldSpec(field, serviceId, operation)]));
}

/** Build the defineTool authoring form; defineTool compiles required flags into JSON Schema. */
export function scienceOutputSpec(serviceId: ScienceServiceId, operation: string): ObjectValueSchemaSpec {
  const properties = outputProperties(serviceId, operation);
  if (serviceId === "ngs") {
    properties.mcp_server = { type: "string" };
    properties.module = { type: "string", const: "ngs-analysis-workbench" };
    properties.moduleStatus = MODULE_STATUS_SCHEMA_SPEC;
    properties.registry_restoration = REGISTRY_DIAGNOSTIC_SCHEMA_SPEC;
    properties.registry_persistence = REGISTRY_DIAGNOSTIC_SCHEMA_SPEC;
  }
  Object.assign(properties, {
    serviceId: { type: "string", const: serviceId, required: true },
    operation: { type: "string", const: operation, required: true },
    status: { type: "string", enum: RESULT_STATUSES, required: true },
    ok: { type: "boolean" },
    error: ERROR_SCHEMA_SPEC,
  } satisfies ParameterSchemaSpec);
  return { type: "object", properties, additionalProperties: false };
}

/** Build the enforced DSH output contract for one normalized science call. */
export function scienceOutputSchema(serviceId: ScienceServiceId, operation: string): ObjectJsonSchema {
  const properties: Record<string, JsonSchemaNode> = Object.fromEntries(
    operationOutputFields(serviceId, operation).map((field) => [field, fieldSchema(field, serviceId, operation)]),
  );
  if (serviceId === "ngs") {
    properties.mcp_server = { type: "string" };
    properties.module = { type: "string", const: "ngs-analysis-workbench" };
    properties.moduleStatus = MODULE_STATUS_SCHEMA;
    properties.registry_restoration = REGISTRY_DIAGNOSTIC_SCHEMA;
    properties.registry_persistence = REGISTRY_DIAGNOSTIC_SCHEMA;
  }
  Object.assign(properties, {
    serviceId: { type: "string", const: serviceId },
    operation: { type: "string", const: operation },
    status: { type: "string", enum: [...RESULT_STATUSES] },
    ok: { type: "boolean" },
    error: ERROR_SCHEMA,
  } satisfies Record<string, JsonSchemaNode>);
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
        session: exec.agent ?? {},
        ...(exec.agent?.id ? { sessionId: String(exec.agent.id) } : {}),
        signal: exec.signal,
        packageRoot,
        ...(contract.record.operation === "sequence.export_artifact"
          ? { authorizedWritePaths: [resolve(packageRoot, "artifacts", "sequence-exports")] }
          : {}),
      });
    },
    presentCall: (args) => callView(contract, args),
    presentResult: (_args, result) => resultView(contract, result),
  };
}

export function createScienceTools(
  executor: ScienceExecutor,
  registry = new CapabilityRegistry(),
  serviceSelection?: ScienceServiceId | ReadonlySet<string> | readonly ScienceServiceId[],
): ToolDefinition[] {
  const operations = serviceSelection === undefined
    ? registry.operations
    : typeof serviceSelection === "string"
      ? registry.operations.filter((contract) => contract.record.serviceId === serviceSelection)
      : Array.isArray(serviceSelection)
        ? registry.operations.filter((contract) => (serviceSelection as readonly string[]).includes(contract.record.serviceId))
        : registry.operations.filter((contract) => (serviceSelection as ReadonlySet<string>).has(contract.record.serviceId));
  return operations.map((contract) => toolDefinition(contract, executor, registry.packageRoot));
}
