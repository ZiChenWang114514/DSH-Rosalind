import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SlideService } from "../src/host/science/slide.js";

const packageRoot = process.cwd();
const retainedPyramid = "showcases/slide-viewer/cases/slide-tissue-architecture/outputs/pyramid-metadata.json";
const retainedSpatial = "showcases/slide-viewer/cases/slide-spatial-expression/outputs/metadata-summary.json";
const geoJson = "showcases/slide-viewer/cases/slide-segmentation-overlay/outputs/source-aligned-annotations.geojson";
const spatialCsv = "showcases/slide-viewer/cases/slide-research-export/outputs/spatial-observations-expression.csv";

function context(session: object) {
  return { session, signal: new AbortController().signal, packageRoot };
}

function minimalTiff(width: number, height: number): Buffer {
  const value = Buffer.alloc(38);
  value.write("II", 0, "ascii"); value.writeUInt16LE(42, 2); value.writeUInt32LE(8, 4); value.writeUInt16LE(2, 8);
  value.writeUInt16LE(256, 10); value.writeUInt16LE(4, 12); value.writeUInt32LE(1, 14); value.writeUInt32LE(width, 18);
  value.writeUInt16LE(257, 22); value.writeUInt16LE(4, 24); value.writeUInt32LE(1, 26); value.writeUInt32LE(height, 30);
  value.writeUInt32LE(0, 34);
  return value;
}

describe("SlideService fixed-contract parity", () => {
  it("rejects absent, stale, and other-caller session IDs without creating state", async () => {
    const service = new SlideService(); const owner = {}; const otherOwner = {};
    expect(await service.execute("slide.get_viewer_state", { sessionId: "missing" }, context(owner))).toMatchObject({ ok: false, error: { code: "SESSION_NOT_FOUND" } });
    const opened = await service.execute("slide.open_from_chat", { path: retainedPyramid }, context(owner)) as Record<string, unknown>;
    const sessionId = String(opened.viewerSessionId);
    expect(await service.execute("slide.get_viewer_state", { sessionId: "stale" }, context(owner))).toMatchObject({ ok: false, error: { code: "SESSION_NOT_FOUND" } });
    expect(await service.execute("slide.get_viewer_state", { sessionId }, context(otherOwner))).toMatchObject({ ok: false, error: { code: "SESSION_NOT_FOUND" } });
    expect(await service.execute("slide.get_viewer_state", { sessionId }, context(owner))).toMatchObject({ ok: true, viewerSessionId: sessionId });
  });

  it("asserts operation-specific results for the 33 previously classification-only operations", async () => {
    const contract = JSON.parse(readFileSync("capabilities/contracts/slide.json", "utf8")) as { tools: Array<{ name: string }> };
    expect(contract.tools).toHaveLength(40);

    const service = new SlideService();
    const session = {};
    const ctx = context(session);
    const opened = await service.execute("slide.open_from_chat", { path: retainedSpatial }, ctx) as Record<string, unknown>;
    const sessionId = opened.viewerSessionId as string;
    const source = opened.source as { id: string; sourceRevision: string };
    const imported = await service.execute("slide.import_scientific_layer", { sessionId, kind: "geojson", path: geoJson, layerId: "spots" }, ctx) as Record<string, unknown>;
    const importJobId = imported.jobId as string;
    const layer = imported.layer as { revision: string };
    const analysis = await service.execute("slide.run_analysis_from_chat", { sessionId, analysis: "spatial-summary" }, ctx) as Record<string, unknown>;
    const analysisJob = analysis.job as { id: string };
    const pathology = await service.execute("slide.run_pathology", { sessionId, workflow: "tissue-segmentation" }, ctx) as Record<string, unknown>;
    const pathologyJob = pathology.job as { id: string };
    const workflow = await service.execute("slide.run_workflow", { sessionId, idempotencyKey: "parity", request: { kind: "hvg-cluster" } }, ctx) as Record<string, unknown>;
    const workflowJob = workflow.job as { durableId: string };
    const temp = mkdtempSync(join(packageRoot, ".slide-parity-"));
    const tiffPath = join(temp, "series-001.ome.tiff");
    writeFileSync(tiffPath, minimalTiff(320, 240));

    const covered = new Set<string>();
    const spatialCsvNative = spatialCsv.replace(/\//g, "\\");
    const verify = async (operation: string, args: Record<string, unknown>, expected: object) => {
      const result = await service.execute(operation, args, ctx) as Record<string, unknown>;
      expect(result, operation).toMatchObject(expected);
      covered.add(operation);
    };
    const location = { studyInstanceUid: "1.2.840.10008.1", seriesInstanceUid: "1.2.840.10008.2", sopInstanceUid: "1.2.840.10008.3" };
    try {
      await verify("slide.cancel_analysis_from_chat", { sessionId, jobId: analysisJob.id }, { ok: true, cancellationAccepted: false, executionSettled: true, job: { id: analysisJob.id, kind: "run_analysis_from_chat", state: "failed" } });
      await verify("slide.cancel_pathology", { sessionId, jobId: pathologyJob.id }, { ok: true, cancellationAccepted: false, executionSettled: true, job: { id: pathologyJob.id, kind: "run_pathology", state: "failed" } });
      await verify("slide.cancel_scientific_layer_import", { sessionId, jobId: importJobId }, { ok: true, cancellationAccepted: false, executionSettled: true, job: { id: importJobId, kind: "scientific-layer-import", state: "completed" } });
      await verify("slide.export_dicom_object", { sessionId, path: "derived-segmentation.dcm", outputPath: "exported-segmentation.dcm" }, { ok: false, error: { code: "DICOM_SEMANTIC_CODEC_UNAVAILABLE" } });
      await verify("slide.get_analysis_from_chat", { sessionId, jobId: analysisJob.id }, { ok: true, job: { id: analysisJob.id, kind: "run_analysis_from_chat", state: "failed" } });
      await verify("slide.get_capabilities", {}, { ok: true, formats: ["svs", "tiff", "h5ad", "dicom", "ome-zarr"], operations: { locallyAvailable: expect.any(Array), requiresHostTransport: expect.any(Array), diagnosticOnly: expect.any(Array) }, budgets: { retainedFixtureObservations: 684, retainedFixtureGenes: 18078 } });
      await verify("slide.get_live_workflow", { sessionId, durableId: workflowJob.durableId }, { ok: true, job: { durableId: workflowJob.durableId, kind: "run_workflow", state: "failed" } });
      await verify("slide.get_pathology", { sessionId, jobId: pathologyJob.id }, { ok: true, job: { id: pathologyJob.id, kind: "run_pathology", state: "failed" } });
      await verify("slide.get_scientific_layer_import", { sessionId, jobId: importJobId }, { ok: true, job: { id: importJobId, kind: "scientific-layer-import", state: "completed" } });
      await verify("slide.get_viewer_state", { sessionId }, { ok: true, viewerSessionId: sessionId, format: "h5ad", spatial: { observations: 684, genes: 18078, matrixFormat: "csr" }, scientificLayers: [{ id: "spots", featureCount: 3 }] });
      await verify("slide.import_analysis_source_from_chat", { sessionId, coordinateUnit: "pixel", kind: "molecular", counts: { path: spatialCsv, format: "csv", columns: { id: "observation_id", genes: { Slc17a7: "Slc17a7" } } } }, { ok: true, path: spatialCsvNative, format: "table", state: "imported" });
      await verify("slide.import_dicom_object", { sessionId, path: "derived-segmentation.dcm", imageSopInstanceUid: location.sopInstanceUid }, { ok: false, error: { code: "DICOM_SEMANTIC_CODEC_UNAVAILABLE" } });
      await verify("slide.import_workflow_source", { sessionId, path: spatialCsv }, { ok: true, path: spatialCsvNative, format: "table", state: "imported" });
      await verify("slide.inspect_dicomweb_instance", { sessionId, baseUrl: "https://example.invalid/dicomweb", location }, { ok: false, error: { code: "DICOMWEB_TRANSPORT_UNAVAILABLE" } });
      await verify("slide.list_scientific_layers", { sessionId }, { ok: true, layers: [{ id: "spots", featureCount: 3, sourceId: source.id }] });
      await verify("slide.list_workflow_sources", { sessionId }, { ok: true, items: [] });
      await verify("slide.list_workflows", { sessionId }, { ok: true, items: [] });
      await verify("slide.open_dicom_series", { paths: ["wsi-level-0.dcm", "wsi-level-1.dcm"], presentation: "inline" }, { ok: false, error: { code: "DICOM_SERIES_HOST_REQUIRED", details: { suppliedInstances: 2 } } });
      await verify("slide.open_dicomweb_wsi", { sessionId, baseUrl: "https://example.invalid/dicomweb", studyInstanceUid: location.studyInstanceUid, seriesInstanceUid: location.seriesInstanceUid, sopInstanceUids: [location.sopInstanceUid], encoding: "jpeg2000-lossless" }, { ok: false, error: { code: "DICOMWEB_TRANSPORT_UNAVAILABLE" } });
      await verify("slide.open_ome_zarr", { baseUrl: "https://example.invalid/ngff", groupPath: "0", consistency: "metadata-and-object-validators" }, { ok: false, error: { code: "REMOTE_OME_ZARR_TRANSPORT_UNAVAILABLE" } });
      await verify("slide.prepare_dicom_upload", { sessionId, paths: ["derived-segmentation.dcm"], endpoint: "https://example.invalid/dicomweb/studies" }, { ok: false, error: { code: "DICOM_UPLOAD_REQUIRES_EXPLICIT_HOST_GRANT" } });
      await verify("slide.query_dicomweb", { sessionId, baseUrl: "https://example.invalid/dicomweb", studyInstanceUid: location.studyInstanceUid, seriesInstanceUid: location.seriesInstanceUid, scope: "instances", modality: "ANN", limit: 10, offset: 0 }, { ok: false, error: { code: "DICOMWEB_TRANSPORT_UNAVAILABLE" } });
      await verify("slide.query_viewer", { sessionId, query: "layers" }, { ok: true, total: 1, items: [{ id: "spots", featureCount: 3 }] });
      await verify("slide.read_dicomweb_object", { sessionId, baseUrl: "https://example.invalid/dicomweb", location, page: { groupIndex: 0, offset: 0, limit: 16 } }, { ok: false, error: { code: "DICOMWEB_TRANSPORT_UNAVAILABLE" } });
      await verify("slide.read_live_workflow_artifact", { sessionId, durableId: workflowJob.durableId, artifactId: "spatial-clusters.csv", sequence: 0 }, { ok: false, error: { code: "WORKFLOW_ARTIFACT_UNAVAILABLE" } });
      await verify("slide.read_workflow_artifact", { sessionId, durableId: workflowJob.durableId, artifactId: "spatial-clusters.csv", sequence: 0 }, { ok: false, error: { code: "WORKFLOW_ARTIFACT_UNAVAILABLE" } });
      await verify("slide.renew_scientific_layer_authorization", { sessionId, sourceId: "spots", sourceRevision: layer.revision }, { ok: true, sourceId: "spots", sourceRevision: layer.revision, authorized: true });
      await verify("slide.renew_source_authorization", { sessionId, sourceId: source.id, sourceRevision: source.sourceRevision }, { ok: true, sourceId: source.id, sourceRevision: source.sourceRevision, authorized: true });
      await verify("slide.resume_pathology", { sessionId, durableId: workflowJob.durableId, sourceId: source.id, sourceRevision: source.sourceRevision }, { ok: false, error: { code: "COMPUTE_ENGINE_UNAVAILABLE" } });
      await verify("slide.resume_workflow", { sessionId, durableId: workflowJob.durableId, sourceId: source.id, sourceRevision: source.sourceRevision }, { ok: false, error: { code: "COMPUTE_ENGINE_UNAVAILABLE" } });
      await verify("slide.spatial_indexed", { sessionId, operation: "expression", gene: "Slc17a7" }, { ok: true, gene: "Slc17a7", column: 7717, observationCount: 684, nonzero: 671, valueScale: "unknown" });
      await verify("slide.submit_dicom_upload", { sessionId, preparedOperation: "host-grant:fixture-not-authorized" }, { ok: false, error: { code: "DICOM_UPLOAD_REQUIRES_EXPLICIT_HOST_GRANT" } });
      await verify("slide.open_ome_tiff_series", { paths: [tiffPath], presentation: "inline" }, { ok: true, viewerReady: false, renderState: "renderer-unavailable", source: { format: "ome-tiff", width: 320, height: 240, metadata: { memberCount: 1 } } });
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }

    const expected = [
      "slide.cancel_analysis_from_chat", "slide.cancel_pathology", "slide.cancel_scientific_layer_import", "slide.export_dicom_object",
      "slide.get_analysis_from_chat", "slide.get_capabilities", "slide.get_live_workflow", "slide.get_pathology",
      "slide.get_scientific_layer_import", "slide.get_viewer_state", "slide.import_analysis_source_from_chat", "slide.import_dicom_object",
      "slide.import_workflow_source", "slide.inspect_dicomweb_instance", "slide.list_scientific_layers", "slide.list_workflow_sources",
      "slide.list_workflows", "slide.open_dicom_series", "slide.open_dicomweb_wsi", "slide.open_ome_tiff_series", "slide.open_ome_zarr",
      "slide.prepare_dicom_upload", "slide.query_dicomweb", "slide.query_viewer", "slide.read_dicomweb_object",
      "slide.read_live_workflow_artifact", "slide.read_workflow_artifact", "slide.renew_scientific_layer_authorization",
      "slide.renew_source_authorization", "slide.resume_pathology", "slide.resume_workflow", "slide.spatial_indexed", "slide.submit_dicom_upload",
    ];
    expect(expected).toHaveLength(33);
    expect([...covered].sort()).toEqual(expected.sort());
    expect(expected.every((name) => contract.tools.some((tool) => tool.name === name))).toBe(true);
  });

  it("retains ROI, measurements, GeoJSON entities, project state, and precise renderer diagnostics", async () => {
    const service = new SlideService(); const session = {}; const ctx = context(session);
    const opened = await service.execute("slide.open_from_chat", { path: retainedPyramid }, ctx) as Record<string, unknown>;
    const sessionId = String(opened.viewerSessionId);
    expect((opened.source as Record<string, unknown>)).toMatchObject({ width: 46000, height: 32893, format: "svs", renderAvailable: false });
    const selected = await service.execute("slide.control_viewer", { sessionId, action: "select_region", region: { x: 10, y: 20, width: 30, height: 40 } }, ctx) as Record<string, unknown>;
    expect(selected).toMatchObject({ ok: true, applied: true });
    const measured = await service.execute("slide.control_viewer", { sessionId, action: "measure_region" }, ctx) as Record<string, unknown>;
    expect(measured.measurement).toMatchObject({ coordinateUnit: "micrometer", width: 14.97, height: 19.96, area: 298.8012, calibrationVerified: true });
    const imported = await service.execute("slide.import_scientific_layer", { sessionId, kind: "geojson", path: geoJson, layerId: "spots" }, ctx) as Record<string, unknown>;
    expect(imported.layer).toMatchObject({ featureCount: 3, sourceId: (opened.source as Record<string, unknown>).id });
    const entity = await service.execute("slide.get_scientific_entity", { sessionId, entity: { sourceId: "spots", sourceRevision: (imported.layer as Record<string, unknown>).revision, id: "AAAGACCCAAGTCGCG-1" } }, ctx) as Record<string, unknown>;
    expect(entity.entity).toMatchObject({ id: "AAAGACCCAAGTCGCG-1", properties: { observation_index: 0 } });
    expect(await service.execute("slide.wait_for_render", { sessionId, stateRevision: 1 }, ctx)).toMatchObject({ ok: false, error: { code: "RENDERER_UNAVAILABLE" } });

    const temp = mkdtempSync(join(packageRoot, ".slide-parity-"));
    try {
      const projectPath = join(temp, "project.json"); const geoJsonPath = join(temp, "annotations.geojson"); const measurementsPath = join(temp, "measurements.csv");
      expect(await service.execute("slide.control_viewer", { sessionId, action: "save_project", path: projectPath }, ctx)).toMatchObject({ ok: true, applied: true });
      expect(await service.execute("slide.control_viewer", { sessionId, action: "load_project", path: projectPath }, ctx)).toMatchObject({ ok: true, restored: true });
      expect(await service.execute("slide.control_viewer", { sessionId, action: "export_view", format: "annotation-geojson", path: geoJsonPath }, ctx)).toMatchObject({ ok: true, format: "annotation-geojson" });
      expect(JSON.parse(readFileSync(geoJsonPath, "utf8")).features).toHaveLength(3);
      expect(await service.execute("slide.control_viewer", { sessionId, action: "export_view", format: "measurement-csv", path: measurementsPath }, ctx)).toMatchObject({ ok: true, format: "measurement-csv" });
      expect(readFileSync(measurementsPath, "utf8")).toContain("calibration_verified");
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("reads bounded classic TIFF dimensions without decoding pixels", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-parity-"));
    try {
      const path = join(temp, "tiny.tiff"); writeFileSync(path, minimalTiff(1024, 768));
      const value = await new SlideService().execute("slide.open_from_chat", { path }, context({})) as Record<string, unknown>;
      expect(value).toMatchObject({ ok: true, viewerReady: false, renderState: "renderer-unavailable", source: { format: "tiff", width: 1024, height: 768, metadata: { inspection: "bounded-classic-tiff-ifd" } } });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("preserves failed workflow identity and terminal cancellation semantics", async () => {
    const service = new SlideService(); const session = {}; const ctx = context(session);
    const opened = await service.execute("slide.open_from_chat", { path: retainedSpatial }, ctx) as Record<string, unknown>;
    const sessionId = String(opened.viewerSessionId);
    const started = await service.execute("slide.run_workflow", { sessionId, idempotencyKey: "workflow-a", request: { kind: "hvg-cluster" } }, ctx) as Record<string, unknown>;
    expect(started).toMatchObject({ ok: false, error: { code: "COMPUTE_ENGINE_UNAVAILABLE" }, job: { state: "failed", executionSettled: true } });
    const job = started.job as { durableId: string };
    const read = await service.execute("slide.get_workflow", { sessionId, durableId: job.durableId }, ctx) as Record<string, unknown>;
    expect(read.job).toMatchObject({ durableId: job.durableId, state: "failed" });
    const cancelled = await service.execute("slide.cancel_workflow", { sessionId, durableId: job.durableId }, ctx) as Record<string, unknown>;
    expect(cancelled).toMatchObject({ ok: true, cancellationAccepted: false, executionSettled: true, job: { state: "failed" } });
  });
});
