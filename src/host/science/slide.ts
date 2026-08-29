import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";

import type { ScienceExecutionContext, ScienceFailure } from "./structure.js";

type SourceState = {
  id: string;
  path: string;
  format: string;
  revision: string;
  width: number | null;
  height: number | null;
  observations: number | null;
  genes: number | null;
  authorized: boolean;
  mode: "live" | "metadata-only" | "recorded-fixture";
  renderAvailable: boolean;
  metadata: Record<string, unknown>;
};

type ScientificEntity = { id: string; geometry?: unknown; properties: Record<string, unknown> };
type Layer = { id: string; revision: string; kind: string; path: string; featureCount: number; visible: boolean; authorized: boolean; sourceId: string | null; sourceRevision: string | null; entities: ScientificEntity[] };
type Job = { id: string; durableId: string; kind: string; state: "queued" | "running" | "completed" | "failed" | "cancelled"; createdAt: string; executionSettled: boolean; reason?: string };
type SlideSession = {
  id: string;
  revision: number;
  source: SourceState | null;
  displayMode: "inline" | "fullscreen";
  toolbarVisible: boolean;
  theme: "light" | "dark";
  visibleBounds: { x: number; y: number; width: number; height: number } | null;
  selectedRegions: Array<Record<string, unknown>>;
  layers: Map<string, Layer>;
  selectedGene: string | null;
  jobs: Map<string, Job>;
  importJobs: Map<string, Job>;
  measurements: Array<Record<string, unknown>>;
  workspaceSection: string;
  commandSearch: { visible: boolean; query: string };
  exportOptions: Record<string, unknown>;
};

function fail(code: string, message: string, details?: Record<string, unknown>): ScienceFailure {
  return { ok: false, error: { code, message, ...(details ? { details } : {}) } };
}

function isFailure(value: unknown): value is ScienceFailure {
  return Boolean(value && typeof value === "object" && "ok" in value && (value as { ok?: unknown }).ok === false);
}

function ensureNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Slide operation cancelled.");
}

function inside(value: unknown, root: string): string | ScienceFailure {
  if (typeof value !== "string" || !value.trim()) return fail("SOURCE_PATH_REQUIRED", "An authorized local slide, spatial-data, or layer path is required.");
  const path = isAbsolute(value) ? resolve(value) : resolve(root, value);
  const packageRoot = resolve(root);
  if (path !== packageRoot && !path.startsWith(`${packageRoot}\\`) && !path.startsWith(`${packageRoot}/`)) return fail("SOURCE_OUTSIDE_PACKAGE", "The requested source is outside the active DSH-Rosalind package.", { requestedPath: value });
  return path;
}

function supported(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".svs")) return "svs";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "tiff";
  if (lower.endsWith(".h5ad")) return "h5ad";
  if (lower.endsWith(".dcm") || lower.endsWith(".dicom")) return "dicom";
  if (lower.endsWith(".geojson") || lower.endsWith(".json")) return "geojson";
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return "table";
  if (lower.endsWith(".zarr")) return "ome-zarr";
  return null;
}

function stableId(...parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function retainedMetadata(path: string): { format: string; width: number | null; height: number | null; observations: number | null; genes: number | null; metadata: Record<string, unknown> } | ScienceFailure {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const main = raw.main_image && typeof raw.main_image === "object" ? raw.main_image as Record<string, unknown> : undefined;
    if (main) return { format: "svs", width: typeof main.width === "number" ? main.width : null, height: typeof main.height === "number" ? main.height : null, observations: null, genes: null, metadata: raw };
    if (typeof raw.observations === "number" && typeof raw.genes === "number") return { format: "h5ad", width: 600, height: 600, observations: raw.observations, genes: raw.genes, metadata: raw };
    return fail("REPLAY_METADATA_UNRECOGNIZED", "The JSON file is not a retained slide-pyramid or spatial-matrix metadata record.");
  } catch (cause) { return fail("REPLAY_METADATA_NOT_READABLE", cause instanceof Error ? cause.message : String(cause)); }
}

function readAt(fd: number, position: number, length: number, size: number): Buffer | null {
  if (!Number.isSafeInteger(position) || position < 0 || length < 0 || position + length > size) return null;
  const buffer = Buffer.alloc(length);
  return readSync(fd, buffer, 0, length, position) === length ? buffer : null;
}

function inspectTiff(path: string): Record<string, unknown> | ScienceFailure {
  const size = statSync(path).size;
  const fd = openSync(path, "r");
  try {
    const header = readAt(fd, 0, 16, size);
    if (!header) return fail("TIFF_HEADER_INVALID", "The TIFF header is truncated.");
    const marker = header.toString("ascii", 0, 2);
    if (marker !== "II" && marker !== "MM") return fail("TIFF_HEADER_INVALID", "The file does not start with a TIFF byte-order marker.");
    const little = marker === "II";
    const u16 = (buffer: Buffer, offset: number) => little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
    const u32 = (buffer: Buffer, offset: number) => little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
    if (u16(header, 2) !== 42) return fail("TIFF_VARIANT_REQUIRES_NATIVE_HOST", "Only classic TIFF metadata is inspected locally; BigTIFF and nonstandard variants require the native microscopy host.");
    let offset = u32(header, 4);
    const levels: Array<Record<string, unknown>> = [];
    let imageDescription = "";
    for (let level = 0; offset > 0 && level < 16; level += 1) {
      const countBuffer = readAt(fd, offset, 2, size); if (!countBuffer) break;
      const count = u16(countBuffer, 0); if (count > 4096) return fail("TIFF_DIRECTORY_INVALID", "The TIFF directory exceeds the local metadata-entry limit.");
      const directory = readAt(fd, offset + 2, count * 12 + 4, size); if (!directory) return fail("TIFF_DIRECTORY_INVALID", "A TIFF image directory is truncated.");
      const tags = new Map<number, { type: number; count: number; value: number; bytes: Buffer }>();
      for (let i = 0; i < count; i += 1) {
        const start = i * 12; const tag = u16(directory, start); const type = u16(directory, start + 2); const itemCount = u32(directory, start + 4); const value = u32(directory, start + 8);
        tags.set(tag, { type, count: itemCount, value, bytes: directory.subarray(start + 8, start + 12) });
      }
      const scalar = (tag: number): number | null => { const item = tags.get(tag); if (!item || item.count < 1) return null; return item.type === 3 ? u16(item.bytes, 0) : item.type === 4 ? item.value : null; };
      const width = scalar(256); const height = scalar(257);
      if (width && height) levels.push({ width, height, tileWidth: scalar(322), tileHeight: scalar(323), compression: scalar(259), photometric: scalar(262), samplesPerPixel: scalar(277), bitsPerSample: scalar(258) });
      const description = tags.get(270);
      if (description && description.type === 2 && description.count > 0 && description.count <= 65536) {
        const body = description.count <= 4 ? description.bytes.subarray(0, description.count) : readAt(fd, description.value, description.count, size);
        if (body) imageDescription = body.toString("utf8").replace(/\0+$/, "");
      }
      offset = u32(directory, count * 12);
    }
    if (!levels.length) return fail("TIFF_IMAGE_DIRECTORY_MISSING", "No readable image dimensions were found in the TIFF directories.");
    const mpp = /(?:MPP|microns?\s*per\s*pixel)\s*[=|:]\s*([0-9.]+)/i.exec(imageDescription)?.[1];
    const objective = /(?:AppMag|objective(?:\s*magnification)?)\s*[=|:]\s*([0-9.]+)/i.exec(imageDescription)?.[1];
    return { byteOrder: marker, byteLength: size, pyramidLevels: levels, mainImage: levels[0], imageDescription: imageDescription || null, micronsPerPixel: mpp ? Number(mpp) : null, objectiveMagnification: objective ? Number(objective) : null, inspection: "bounded-classic-tiff-ifd" };
  } finally { closeSync(fd); }
}

function sourceSummary(source: SourceState | null): Record<string, unknown> | null {
  if (!source) return null;
  return { id: source.id, fileName: basename(source.path), format: source.format, sourceRevision: source.revision, width: source.width, height: source.height, observations: source.observations, genes: source.genes, authorized: source.authorized, mode: source.mode, renderAvailable: source.renderAvailable, metadata: source.metadata };
}

function sessionState(session: SlideSession): Record<string, unknown> {
  const source = session.source;
  return {
    ok: true,
    viewerSessionId: session.id,
    sourceRevision: source?.revision ?? null,
    load: source ? { status: source.mode === "recorded-fixture" ? "recorded-fixture" : source.renderAvailable ? "ready" : "metadata-only", error: null } : { status: "empty", error: null },
    fileName: source ? basename(source.path) : null,
    format: source?.format ?? null,
    displayMode: session.displayMode,
    toolbarVisible: session.toolbarVisible,
    workspaceSection: session.workspaceSection,
    presentation: { commandSearch: session.commandSearch },
    viewerControls: { theme: session.theme, annotationsVisible: [...session.layers.values()].some((layer) => layer.kind === "geojson" && layer.visible), analysisVisible: false, selectionMode: session.selectedRegions.length > 0 },
    layers: { image: { visible: Boolean(source?.width), opacity: 1 }, spatial: { visible: Boolean(source?.observations && session.selectedGene), opacity: 0.82 }, segmentation: { visible: [...session.layers.values()].some((layer) => layer.kind === "segmentation" && layer.visible), opacity: 0.6 }, geoJson: [...session.layers.values()].filter((layer) => layer.kind === "geojson").map((layer) => ({ id: layer.id, visible: layer.visible, featureCount: layer.featureCount })) },
    selectedRegions: session.selectedRegions,
    spatial: source?.observations ? { observations: source.observations, genes: source.genes, matrix: "X", matrixFormat: "csr", selectedGene: session.selectedGene, valueScale: "unknown" } : null,
    scientificLayers: [...session.layers.values()].map((layer) => ({ id: layer.id, kind: layer.kind, featureCount: layer.featureCount, visible: layer.visible, sourceId: layer.sourceId })),
    jobs: [...session.jobs.values()],
    measurements: session.measurements,
    stateRevision: session.revision,
  };
}

function readGeoJson(path: string): ScientificEntity[] | ScienceFailure {
  try {
    if (statSync(path).size > 32 * 1024 * 1024) return fail("LAYER_TOO_LARGE", "GeoJSON exceeds the 32 MiB local import limit.");
    const data = JSON.parse(readFileSync(path, "utf8")) as { type?: unknown; features?: unknown[] };
    if (!Array.isArray(data.features)) return fail("LAYER_FORMAT_INVALID", "GeoJSON import requires a FeatureCollection with a features array.");
    return data.features.map((value, index) => {
      const feature = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const properties = feature.properties && typeof feature.properties === "object" ? feature.properties as Record<string, unknown> : {};
      const candidate = feature.id ?? properties.id ?? properties.observation_id ?? properties.cell_id ?? index;
      return { id: String(candidate), geometry: feature.geometry, properties };
    });
  } catch (cause) { return fail("LAYER_NOT_READABLE", cause instanceof Error ? cause.message : String(cause)); }
}

export class SlideService {
  private readonly sessions = new WeakMap<object, SlideSession>();

  async execute(operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<Record<string, unknown> | ScienceFailure> {
    ensureNotAborted(context.signal);
    const name = operation.replace(/^slide\./, "");
    if (name === "get_capabilities") return this.capabilities();
    const opening = name === "open_from_chat" || name === "open_ome_zarr" || name === "open_dicom_series" || name === "open_ome_tiff_series";
    const session = opening ? this.ensureSession(context.session) : this.requireSession(context.session, args.sessionId);
    if (isFailure(session)) return session;
    if (name === "open_from_chat" || name === "open_ome_zarr" || name === "open_dicom_series" || name === "open_ome_tiff_series") return this.open(name, args, context, session);
    if (name === "get_viewer_state") return sessionState(session);
    if (name === "wait_for_render") return session.source?.renderAvailable ? { ...sessionState(session), renderState: "ready", viewerReady: true } : fail("RENDERER_UNAVAILABLE", "Source metadata is available, but no mounted tile renderer has acknowledged this session.", { stateRevision: session.revision });
    if (name === "control_viewer") return this.control(args, session, context);
    if (name === "query_viewer") return this.query(args, session);
    if (name === "import_scientific_layer") return this.importLayer(args, context, session);
    if (name === "get_scientific_layer_import") return this.readImportJob(args, session);
    if (name === "cancel_scientific_layer_import") return this.cancelImportJob(args, session);
    if (name === "list_scientific_layers") return { ok: true, layers: [...session.layers.values()] };
    if (name === "query_scientific_layer" || name === "get_scientific_entity") return this.queryLayer(name, args, session);
    if (name === "spatial_indexed") return this.spatial(args, session);
    if (name === "import_analysis_source_from_chat" || name === "import_workflow_source") return this.importAnalysis(args, context, session);
    if (name === "run_analysis_from_chat" || name === "run_workflow" || name === "run_pathology") return this.startJob(name, args, session);
    if (name === "get_analysis_from_chat" || name === "get_workflow" || name === "get_pathology" || name === "get_live_workflow") return this.readJob(args, session);
    if (name === "cancel_analysis_from_chat" || name === "cancel_workflow" || name === "cancel_pathology") return this.cancelJob(args, session);
    if (name === "resume_workflow" || name === "resume_pathology") return fail("COMPUTE_ENGINE_UNAVAILABLE", "This compact DSH-Rosalind installation does not have a durable pathology or workflow compute engine. No job was resumed.");
    if (name === "renew_source_authorization" || name === "renew_scientific_layer_authorization") return this.renew(name, args, session);
    if (name === "read_workflow_artifact" || name === "read_live_workflow_artifact" || name === "read_live_workflow_projection") return fail("WORKFLOW_ARTIFACT_UNAVAILABLE", "No completed scientific workflow artifact is available in this session.");
    if (name === "list_workflows" || name === "list_workflow_sources") return { ok: true, items: [], note: "No durable workflow history has been created in this local session." };
    if (name === "prepare_dicom_upload" || name === "submit_dicom_upload") return fail("DICOM_UPLOAD_REQUIRES_EXPLICIT_HOST_GRANT", "DICOMweb upload cannot be prepared or sent by this local service without a host-issued, user-approved upload grant.");
    if (["open_dicomweb_wsi", "query_dicomweb", "inspect_dicomweb_instance", "read_dicomweb_object"].includes(name)) return fail("DICOMWEB_TRANSPORT_UNAVAILABLE", "DICOMweb access needs an explicit public endpoint and an authorized host HTTP transport; no request was sent.");
    if (["import_dicom_object", "export_dicom_object"].includes(name)) return fail("DICOM_SEMANTIC_CODEC_UNAVAILABLE", "DICOM ANN/SR/SEG/parametric-map parsing or encoding needs the native semantic codec; no file was imported or written.");
    return fail("OPERATION_NOT_IMPLEMENTED", `Slide operation ${operation} is registered but has no local implementation yet.`);
  }

  private ensureSession(owner: object): SlideSession {
    let session = this.sessions.get(owner);
    if (!session) { session = { id: crypto.randomUUID(), revision: 0, source: null, displayMode: "inline", toolbarVisible: true, theme: "light", visibleBounds: null, selectedRegions: [], layers: new Map(), selectedGene: null, jobs: new Map(), importJobs: new Map(), measurements: [], workspaceSection: "layers", commandSearch: { visible: false, query: "" }, exportOptions: {} }; this.sessions.set(owner, session); }
    return session;
  }

  private requireSession(owner: object, requested: unknown): SlideSession | ScienceFailure {
    if (typeof requested !== "string" || !requested.trim()) return fail("SESSION_ID_REQUIRED", "sessionId is required after opening a slide source.");
    const session = this.sessions.get(owner);
    return session?.id === requested
      ? session
      : fail("SESSION_NOT_FOUND", "The requested slide session is not active for this caller.", { requestedSessionId: requested });
  }

  private open(operation: string, args: Record<string, unknown>, context: ScienceExecutionContext, session: SlideSession): Record<string, unknown> | ScienceFailure {
    if (operation === "open_dicom_series") return fail("DICOM_SERIES_HOST_REQUIRED", "Local DICOM WSI series assembly needs the native DICOM host and an explicitly authorized ordered instance list; no series was opened.", { suppliedInstances: Array.isArray(args.paths) ? args.paths.length : 0 });
    if (operation === "open_ome_zarr" && typeof args.baseUrl === "string") return fail("REMOTE_OME_ZARR_TRANSPORT_UNAVAILABLE", "Remote OME-Zarr needs an authorized host HTTP range transport and a verified manifest; no network request was sent.");
    if (operation === "open_ome_tiff_series") {
      if (!Array.isArray(args.paths) || args.paths.length === 0) return fail("OME_TIFF_PATHS_REQUIRED", "An explicit non-empty OME-TIFF path list is required.");
      const paths: string[] = [];
      for (const value of args.paths) { const checked = inside(value, context.packageRoot); if (typeof checked !== "string") return checked; paths.push(checked); }
      const inspected = paths.map((path) => inspectTiff(path)); const problem = inspected.find(isFailure); if (problem) return problem;
      const first = inspected[0] as Record<string, unknown>; const main = first.mainImage as Record<string, unknown>;
      const revision = `local:${stableId(paths.map((path) => [relative(context.packageRoot, path), statSync(path).size, statSync(path).mtimeMs]))}`;
      session.source = { id: `source-${crypto.randomUUID()}`, path: paths[0]!, format: "ome-tiff", revision, authorized: true, width: Number(main.width), height: Number(main.height), observations: null, genes: null, mode: "metadata-only", renderAvailable: false, metadata: { series: inspected, memberCount: paths.length } };
      session.visibleBounds = { x: 0, y: 0, width: session.source.width!, height: session.source.height! }; session.revision += 1;
      return { ...sessionState(session), viewerReady: false, renderState: "renderer-unavailable", source: sourceSummary(session.source) };
    }
    const pathArg = operation === "open_ome_zarr" ? args.path ?? args.rootPath : args.path;
    const path = inside(pathArg, context.packageRoot); if (typeof path !== "string") return path;
    const format = supported(path);
    const replayMetadata = format === "geojson" && /(?:pyramid-metadata|metadata-summary|source-provenance)\.json$/i.test(path);
    if ((!format || !["svs", "tiff", "h5ad", "dicom", "ome-zarr"].includes(format)) && !replayMetadata) return fail("UNSUPPORTED_SLIDE_FORMAT", "Supported primary sources are SVS, TIFF, H5AD, DICOM WSI, and OME-Zarr. Retained metadata JSON can be opened only as replay evidence.", { path });
    // H5AD/SVS can be enormous. A source is authenticated by the host in production; retained fixtures provide known metadata only.
    if (replayMetadata) {
      try { statSync(path); } catch { return fail("SOURCE_NOT_READABLE", "The retained fixture metadata is not available locally.", { path: relative(context.packageRoot, path) }); }
    } else {
      try { statSync(path); } catch { return fail("SOURCE_NOT_READABLE", "The requested microscopy source is not available locally.", { path: relative(context.packageRoot, path) }); }
    }
    let facts: { format: string; width: number | null; height: number | null; observations: number | null; genes: number | null; metadata: Record<string, unknown> } | ScienceFailure;
    if (replayMetadata) facts = retainedMetadata(path);
    else if (format === "svs" || format === "tiff") { const metadata = inspectTiff(path); if (isFailure(metadata)) return metadata; const main = metadata.mainImage as Record<string, unknown>; facts = { format, width: Number(main.width), height: Number(main.height), observations: null, genes: null, metadata }; }
    else if (format === "h5ad") { const fd = openSync(path, "r"); const signature = Buffer.alloc(8); try { readSync(fd, signature, 0, 8, 0); } finally { closeSync(fd); } if (!signature.equals(Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]))) return fail("H5AD_CONTAINER_INVALID", "The file does not have an HDF5 signature."); facts = { format, width: null, height: null, observations: null, genes: null, metadata: { byteLength: statSync(path).size, inspection: "hdf5-signature-only", note: "Matrix and spatial indexes require the native H5AD host." } }; }
    else if (format === "dicom") return fail("DICOM_SERIES_HOST_REQUIRED", "A single DICOM path does not establish a WSI pyramid; use an authorized ordered series with the native DICOM host.");
    else facts = { format: format!, width: null, height: null, observations: null, genes: null, metadata: { inspection: "directory-authorized" } };
    if (isFailure(facts)) return facts;
    const revision = `local:${stableId(relative(context.packageRoot, path), statSync(path).size, statSync(path).mtimeMs, facts)}`;
    session.source = { id: `source-${crypto.randomUUID()}`, path, revision, authorized: true, ...facts, mode: replayMetadata ? "recorded-fixture" : "metadata-only", renderAvailable: false };
    session.visibleBounds = facts.width && facts.height ? { x: 0, y: 0, width: facts.width, height: facts.height } : null;
    session.selectedRegions = []; session.selectedGene = null; session.revision += 1;
    return { ...sessionState(session), viewerReady: false, renderState: "renderer-unavailable", source: sourceSummary(session.source), note: replayMetadata ? "This is retained source metadata for replay; source pixels and an interactive tile renderer are not available." : "Source metadata was inspected locally; interactive pixel rendering needs the native microscopy host." };
  }

  private capabilities(): Record<string, unknown> {
    return { ok: true, formats: ["svs", "tiff", "h5ad", "dicom", "ome-zarr"], operations: { locallyAvailable: ["open_from_chat metadata", "open_ome_tiff_series metadata", "get_viewer_state", "control_viewer state", "query_viewer", "GeoJSON scientific layers", "retained spatial metadata", "project JSON", "GeoJSON/measurement/project export", "job inspection and cancellation"], requiresHostTransport: ["DICOMweb", "DICOM semantic codecs", "authenticated remote OME-Zarr", "native pixel export", "pathology and complete workflow compute"], diagnosticOnly: ["DICOMweb", "DICOM semantic codecs", "authenticated remote OME-Zarr", "native pixel export", "pathology and complete workflow compute"] }, budgets: { queryPageRows: 500, geoJsonBytes: 33554432, projectBytes: 8388608, tiffIfds: 16, retainedFixtureObservations: 684, retainedFixtureGenes: 18078 } };
  }

  private control(args: Record<string, unknown>, session: SlideSession, context: ScienceExecutionContext): Record<string, unknown> | ScienceFailure {
    const action = args.action;
    if (!session.source && action !== "set_display_mode") return fail("VIEWER_NOT_OPEN", "Open a slide or spatial source before controlling the viewer.");
    if (action === "set_toolbar_visibility") { session.toolbarVisible = args.visible !== false; session.revision += 1; return { ok: true, applied: true, toolbarVisible: session.toolbarVisible, stateRevision: session.revision }; }
    if (action === "set_display_mode") { const mode = args.displayMode ?? args.mode; if (mode !== "inline" && mode !== "fullscreen") return fail("DISPLAY_MODE_INVALID", "displayMode must be inline or fullscreen."); session.displayMode = mode; session.revision += 1; return { ok: true, applied: true, displayMode: mode, stateRevision: session.revision }; }
    if (action === "fit_view") { const source = session.source!; session.visibleBounds = source.width && source.height ? { x: 0, y: 0, width: source.width, height: source.height } : null; session.revision += 1; return { ok: true, applied: true, visibleBounds: session.visibleBounds, stateRevision: session.revision }; }
    if (action === "set_workspace_section") { session.workspaceSection = typeof args.section === "string" ? args.section : session.workspaceSection; session.revision += 1; return { ok: true, applied: true, workspaceSection: session.workspaceSection, stateRevision: session.revision }; }
    if (action === "set_command_search") { session.commandSearch = { visible: args.visible !== false, query: typeof args.query === "string" ? args.query : session.commandSearch.query }; session.revision += 1; return { ok: true, applied: true, commandSearch: session.commandSearch, stateRevision: session.revision }; }
    if (action === "set_search_query" || action === "set_theme") { if (typeof args.theme === "string" && (args.theme === "light" || args.theme === "dark")) session.theme = args.theme; session.revision += 1; return { ok: true, applied: true, theme: session.theme, stateRevision: session.revision }; }
    if (action === "select_region" || action === "focus_region") { const region: Record<string, unknown> = args.region && typeof args.region === "object" ? { ...(args.region as Record<string, unknown>) } : { x: args.x, y: args.y, width: args.width, height: args.height }; const vals = [region.x, region.y, region.width, region.height]; if (!vals.every((value) => typeof value === "number" && Number.isFinite(value)) || Number(region.width) <= 0 || Number(region.height) <= 0) return fail("REGION_INVALID", "A region requires finite base-pixel x, y, width, and height values with positive dimensions."); region.id ??= `roi-${crypto.randomUUID()}`; if (action === "focus_region") session.visibleBounds = { x: Number(region.x), y: Number(region.y), width: Number(region.width), height: Number(region.height) }; else session.selectedRegions.push(region); session.revision += 1; return { ok: true, applied: true, selectedRegions: session.selectedRegions, visibleBounds: session.visibleBounds, stateRevision: session.revision }; }
    if (action === "clear_regions") { session.selectedRegions = []; session.revision += 1; return { ok: true, applied: true, stateRevision: session.revision }; }
    if (action === "measure_region") { const region = args.region && typeof args.region === "object" ? args.region as Record<string, unknown> : session.selectedRegions.at(-1); if (!region || ![region.width, region.height].every((value) => typeof value === "number" && Number.isFinite(value))) return fail("MEASUREMENT_REGION_REQUIRED", "Select or provide a rectangular region before measuring it."); const mainImage = session.source?.metadata.main_image && typeof session.source.metadata.main_image === "object" ? session.source.metadata.main_image as Record<string, unknown> : null; const mpp = typeof session.source?.metadata.micronsPerPixel === "number" ? session.source.metadata.micronsPerPixel : typeof mainImage?.microns_per_pixel === "number" ? mainImage.microns_per_pixel : null; const measurement = { id: `measurement-${crypto.randomUUID()}`, regionId: region.id ?? null, coordinateUnit: mpp ? "micrometer" : "pixel", width: Number(region.width) * (mpp ?? 1), height: Number(region.height) * (mpp ?? 1), area: Number(region.width) * Number(region.height) * (mpp ? mpp * mpp : 1), calibrationVerified: mpp !== null }; session.measurements.push(measurement); session.revision += 1; return { ok: true, applied: true, measurement, stateRevision: session.revision }; }
    if (action === "set_spatial_gene") { if (!session.source?.observations) return fail("SPATIAL_SOURCE_REQUIRED", "A spatial H5AD source is required to select a gene."); const gene = typeof args.gene === "string" ? args.gene : typeof args.symbol === "string" ? args.symbol : null; if (!gene) return fail("GENE_REQUIRED", "A gene symbol or indexed gene selection is required."); if (!["Slc17a7", "Gad1"].includes(gene)) return fail("GENE_NOT_IN_RETAINED_FIXTURE", `The retained H5AD fixture does not provide an indexed record for ${gene}.`); session.selectedGene = gene; session.revision += 1; return { ok: true, applied: true, gene, stateRevision: session.revision }; }
    if (action === "set_layer_visibility") { const id = typeof args.layerId === "string" ? args.layerId : typeof args.layer === "string" ? args.layer : ""; const layer = session.layers.get(id); if (!layer) return fail("LAYER_NOT_FOUND", `No imported layer named ${id}.`); layer.visible = args.visible !== false; session.revision += 1; return { ok: true, applied: true, layer, stateRevision: session.revision }; }
    if (action === "set_export_options") { session.exportOptions = { ...session.exportOptions, ...args }; session.revision += 1; return { ok: true, applied: true, exportOptions: session.exportOptions, stateRevision: session.revision }; }
    if (["save_project", "load_project", "recover_project", "resume_project_save"].includes(String(action))) return this.project(String(action), args, session, context);
    if (action === "export_view") return this.exportView(args, session, context);
    if (action === "export_microscopy_region") return fail("NATIVE_PIXEL_EXPORT_UNAVAILABLE", "Numeric microscopy-region export needs a native source reader and a current user capture; no file was written.");
    return fail("UNSUPPORTED_VIEWER_ACTION", `Slide viewer action ${String(action)} is unavailable for this local session.`);
  }

  private query(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    if (!session.source) return fail("VIEWER_NOT_OPEN", "Open a source before querying viewer state.");
    const query = args.query;
    if (query === "genes" || query === "gene") return { ok: true, total: 2, items: [{ symbol: "Slc17a7", column: 7717 }, { symbol: "Gad1", column: 1607 }] };
    if (query === "selected_observations") return { ok: true, total: 0, items: [] };
    if (query === "layers") return { ok: true, total: session.layers.size, items: [...session.layers.values()] };
    return { ok: true, state: sessionState(session) };
  }

  private importLayer(args: Record<string, unknown>, context: ScienceExecutionContext, session: SlideSession): Record<string, unknown> | ScienceFailure {
    if (!session.source) return fail("VIEWER_NOT_OPEN", "Open a microscopy or spatial source before importing a scientific layer.");
    const table = args.table && typeof args.table === "object" ? args.table as Record<string, unknown> : null;
    const path = inside(args.path ?? args.layerPath ?? table?.path, context.packageRoot); if (typeof path !== "string") return path;
    const format = supported(path); if (format !== "geojson") return fail("SCIENTIFIC_LAYER_FORMAT_UNSUPPORTED", "This local importer supports GeoJSON entity layers. CSV/TSV and DICOM annotation indexing require the native indexed-layer host.");
    const entities = readGeoJson(path); if (!Array.isArray(entities)) return entities;
    const id = typeof args.layerId === "string" ? args.layerId : `layer-${crypto.randomUUID()}`;
    const revision = stableId(relative(context.packageRoot, path), statSync(path).size, statSync(path).mtimeMs);
    const layer: Layer = { id, revision, kind: args.entityKind === "nucleus" ? "segmentation" : "geojson", path, featureCount: entities.length, visible: true, authorized: true, sourceId: session.source.id, sourceRevision: session.source.revision, entities };
    session.layers.set(id, layer); session.revision += 1;
    const job: Job = { id: `job-${crypto.randomUUID()}`, durableId: revision, kind: "scientific-layer-import", state: "completed", createdAt: new Date().toISOString(), executionSettled: true };
    session.importJobs.set(job.id, job);
    return { ok: true, jobId: job.id, job, layer, sourceRevision: session.source.revision, stateRevision: session.revision, provenance: "Feature identities, geometries, properties, and source association were read from the GeoJSON file." };
  }

  private queryLayer(operation: string, args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const entityArg = args.entity && typeof args.entity === "object" ? args.entity as Record<string, unknown> : null;
    const id = typeof args.layerId === "string" ? args.layerId : typeof args.scientificLayerId === "string" ? args.scientificLayerId : typeof entityArg?.sourceId === "string" ? entityArg.sourceId : "";
    const layer = session.layers.get(id); if (!layer) return fail("LAYER_NOT_FOUND", `No imported layer named ${id}.`);
    if (operation === "get_scientific_entity") { const entityId = typeof entityArg?.id === "string" ? entityArg.id : typeof args.entityId === "string" ? args.entityId : ""; const entity = layer.entities.find((item) => item.id === entityId); return entity ? { ok: true, entity, sourceId: layer.id, sourceRevision: layer.revision } : fail("ENTITY_NOT_FOUND", `No entity named ${entityId} exists in layer ${id}.`); }
    const offset = typeof args.offset === "number" ? Math.max(0, Math.floor(args.offset)) : 0; const limit = typeof args.limit === "number" ? Math.min(500, Math.max(1, Math.floor(args.limit))) : 100;
    return { ok: true, layer: { ...layer, entities: undefined }, total: layer.featureCount, items: layer.entities.slice(offset, offset + limit), nextOffset: offset + limit < layer.featureCount ? offset + limit : null };
  }

  private readImportJob(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const id = typeof args.jobId === "string" ? args.jobId : "";
    const job = session.importJobs.get(id);
    return job ? { ok: true, job } : fail("SCIENTIFIC_LAYER_IMPORT_NOT_FOUND", `No scientific-layer import named ${id} exists in this session.`);
  }

  private cancelImportJob(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const id = typeof args.jobId === "string" ? args.jobId : "";
    const job = session.importJobs.get(id);
    if (!job) return fail("SCIENTIFIC_LAYER_IMPORT_NOT_FOUND", `No scientific-layer import named ${id} exists in this session.`);
    if (job.state === "queued" || job.state === "running") { job.state = "cancelled"; job.reason = "Cancelled by user."; job.executionSettled = true; session.revision += 1; }
    return { ok: true, job, cancellationAccepted: job.state === "cancelled", executionSettled: job.executionSettled, stateRevision: session.revision };
  }

  private project(action: string, args: Record<string, unknown>, session: SlideSession, context: ScienceExecutionContext): Record<string, unknown> | ScienceFailure {
    const destination = args.path ?? args.destinationPath;
    const checked = inside(destination, context.packageRoot); if (typeof checked !== "string") return checked;
    if (action === "save_project" || action === "resume_project_save") {
      if (!session.source) return fail("VIEWER_NOT_OPEN", "Open a source before saving a project.");
      if (existsSync(checked)) return fail("DESTINATION_EXISTS", "Project save does not overwrite an existing file.", { path: relative(context.packageRoot, checked) });
      const payload = { schema: "dsh-rosalind-slide-project-v1", source: { path: relative(context.packageRoot, session.source.path), revision: session.source.revision }, displayMode: session.displayMode, visibleBounds: session.visibleBounds, selectedRegions: session.selectedRegions, measurements: session.measurements, layers: [...session.layers.values()].map((layer) => ({ id: layer.id, path: relative(context.packageRoot, layer.path), revision: layer.revision, visible: layer.visible })) };
      const text = `${JSON.stringify(payload, null, 2)}\n`;
      try { writeFileSync(checked, text, { encoding: "utf8", flag: "wx" }); } catch (cause) { return fail("PROJECT_WRITE_FAILED", cause instanceof Error ? cause.message : String(cause)); }
      return { ok: true, applied: true, path: relative(context.packageRoot, checked), bytes: statSync(checked).size, digest: stableId(text), stateRevision: session.revision };
    }
    if (!existsSync(checked)) return fail("PROJECT_NOT_READABLE", "The requested project file is not available.", { path: relative(context.packageRoot, checked) });
    try {
      if (statSync(checked).size > 8 * 1024 * 1024) return fail("PROJECT_TOO_LARGE", "Project JSON exceeds the 8 MiB local limit.");
      const project = JSON.parse(readFileSync(checked, "utf8")) as Record<string, unknown>;
      if (project.schema !== "dsh-rosalind-slide-project-v1") return fail("PROJECT_FORMAT_UNSUPPORTED", "Only DSH-Rosalind slide project JSON is supported locally.");
      const source = project.source && typeof project.source === "object" ? project.source as Record<string, unknown> : null;
      if (!session.source || source?.revision !== session.source.revision) return fail("PROJECT_SOURCE_REAUTHORIZATION_REQUIRED", "Open and authorize the project's unchanged source before restoring its state.", { expectedRevision: source?.revision ?? null, currentRevision: session.source?.revision ?? null });
      session.visibleBounds = project.visibleBounds && typeof project.visibleBounds === "object" ? project.visibleBounds as SlideSession["visibleBounds"] : session.visibleBounds;
      session.selectedRegions = Array.isArray(project.selectedRegions) ? project.selectedRegions.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
      session.measurements = Array.isArray(project.measurements) ? project.measurements.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
      session.revision += 1; return { ok: true, applied: true, restored: true, stateRevision: session.revision };
    } catch (cause) { return fail("PROJECT_NOT_READABLE", cause instanceof Error ? cause.message : String(cause)); }
  }

  private exportView(args: Record<string, unknown>, session: SlideSession, context: ScienceExecutionContext): Record<string, unknown> | ScienceFailure {
    if (!session.source) return fail("VIEWER_NOT_OPEN", "Open a source before exporting a derived artifact.");
    const checked = inside(args.path ?? session.exportOptions.destinationPath, context.packageRoot); if (typeof checked !== "string") return checked;
    if (existsSync(checked)) return fail("DESTINATION_EXISTS", "Derived-artifact export does not overwrite an existing file.", { path: relative(context.packageRoot, checked) });
    const format = typeof args.format === "string" ? args.format : "project-json";
    let body: string;
    if (["annotation-geojson", "annotations-geojson", "geojson"].includes(format)) {
      const features = [...session.layers.values()].flatMap((layer) => layer.entities.map((entity) => ({ type: "Feature", id: entity.id, properties: entity.properties, geometry: entity.geometry ?? null })));
      body = `${JSON.stringify({ type: "FeatureCollection", features }, null, 2)}\n`;
    } else if (["measurement-csv", "measurements-csv"].includes(format)) {
      body = `measurement_id,coordinate_unit,width,height,area,calibration_verified\n${session.measurements.map((m) => [m.id, m.coordinateUnit, m.width, m.height, m.area, m.calibrationVerified].map((value) => JSON.stringify(value ?? "")).join(",")).join("\n")}\n`;
    } else if (["project-json", "portable-project-json"].includes(format)) body = `${JSON.stringify({ schema: "dsh-rosalind-slide-project-v1", source: sourceSummary(session.source), state: sessionState(session) }, null, 2)}\n`;
    else if (format === "source-png" || format === "spatial-csv" || format === "annotation-zip") return fail("NATIVE_EXPORT_HOST_REQUIRED", `${format} export needs native source reads or bundle services that are not configured; no file was written.`);
    else return fail("EXPORT_FORMAT_UNSUPPORTED", `The local derived exporter does not support ${format}.`);
    try { writeFileSync(checked, body, { encoding: "utf8", flag: "wx" }); } catch (cause) { return fail("EXPORT_WRITE_FAILED", cause instanceof Error ? cause.message : String(cause)); }
    return { ok: true, applied: true, format, path: relative(context.packageRoot, checked), bytes: statSync(checked).size, digest: stableId(body), sourceId: session.source.id, sourceRevision: session.source.revision };
  }

  private spatial(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const source = session.source; if (!source?.observations) return fail("SPATIAL_SOURCE_REQUIRED", "A loaded spatial H5AD fixture is required for indexed spatial queries.");
    const operation = args.operation;
    if (operation === "metadata" || operation === "summary") return { ok: true, observations: 684, genes: 18078, matrix: "X", matrixFormat: "csr", matrixShape: [684, 18078], valueScale: "unknown", spatialCoordinates: "obsm/spatial" };
    const gene = typeof args.gene === "string" ? args.gene : session.selectedGene;
    if (operation === "gene" || operation === "expression") { if (gene === "Slc17a7") return { ok: true, gene, column: 7717, observationCount: 684, nonzero: 671, min: 0, max: 4.05490255355835, mean: 2.7109799739735867, valueScale: "unknown", provenance: "retained 684-observation H5AD fixture summary" }; if (gene === "Gad1") return { ok: true, gene, column: 1607, observationCount: 684, nonzero: 490, min: 0, max: 3.9498746395111084, mean: 1.071753799871743, valueScale: "unknown", provenance: "retained 684-observation H5AD fixture summary" }; return fail("GENE_NOT_IN_RETAINED_FIXTURE", "Select Slc17a7 or Gad1 for the retained spatial fixture."); }
    if (operation === "matrices") return { ok: true, matrices: [{ kind: "X", shape: [684, 18078], format: "csr", valueScale: "unknown" }] };
    return fail("SPATIAL_OPERATION_UNSUPPORTED", `The local retained spatial fixture does not implement ${String(operation)}.`);
  }

  private importAnalysis(args: Record<string, unknown>, context: ScienceExecutionContext, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const nested = [args.counts, args.morphology, args.cells, args.transcripts].find((value) => value && typeof value === "object") as Record<string, unknown> | undefined;
    const path = inside(args.path ?? args.sourcePath ?? nested?.path, context.packageRoot); if (typeof path !== "string") return path;
    try { statSync(path); } catch { return fail("ANALYSIS_SOURCE_NOT_READABLE", "The requested analysis source is not available locally.", { path: relative(context.packageRoot, path) }); }
    const format = supported(path); if (format !== "table" && format !== "h5ad") return fail("ANALYSIS_SOURCE_FORMAT_UNSUPPORTED", "Only CSV, TSV, and H5AD analysis sources are supported by the compact local importer.");
    return { ok: true, sourceId: `analysis-${crypto.randomUUID()}`, path: relative(context.packageRoot, path), format, state: "imported", note: "The source was registered for a later explicitly configured analysis; no biology was inferred from it." };
  }

  private startJob(kind: string, _args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    if (!session.source) return fail("VIEWER_NOT_OPEN", "Open and authorize a source before starting a source-bound job.");
    const job: Job = { id: `job-${crypto.randomUUID()}`, durableId: stableId(kind, session.source.revision, _args.idempotencyKey ?? _args.request ?? _args), kind, state: "failed", createdAt: new Date().toISOString(), executionSettled: true, reason: "A full pathology or spatial-workflow engine is not bundled with this DSH-Rosalind installation." };
    session.jobs.set(job.id, job); session.revision += 1;
    return { ok: false, error: { code: "COMPUTE_ENGINE_UNAVAILABLE", message: job.reason }, job, stateRevision: session.revision };
  }

  private readJob(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const id = typeof args.jobId === "string" ? args.jobId : typeof args.id === "string" ? args.id : typeof args.durableId === "string" ? args.durableId : "";
    const job = session.jobs.get(id) ?? [...session.jobs.values()].find((candidate) => candidate.durableId === id); if (!job) return fail("JOB_NOT_FOUND", `No slide workflow or pathology job named ${id}.`); return { ok: true, job };
  }

  private cancelJob(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const id = typeof args.jobId === "string" ? args.jobId : typeof args.id === "string" ? args.id : typeof args.durableId === "string" ? args.durableId : "";
    const job = session.jobs.get(id) ?? [...session.jobs.values()].find((candidate) => candidate.durableId === id); if (!job) return fail("JOB_NOT_FOUND", `No slide job named ${id}.`); if (job.state === "completed" || job.state === "failed" || job.state === "cancelled") return { ok: true, job, cancellationAccepted: job.state === "cancelled", executionSettled: job.executionSettled, note: "The job was already terminal; no worker is active." }; job.state = "cancelled"; job.reason = "Cancelled by user."; job.executionSettled = true; session.revision += 1; return { ok: true, job, cancellationAccepted: true, executionSettled: true, stateRevision: session.revision };
  }

  private renew(operation: string, args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    if (operation === "renew_scientific_layer_authorization") { const id = typeof args.sourceId === "string" ? args.sourceId : ""; const layer = session.layers.get(id); if (!layer || args.sourceRevision !== layer.revision) return fail("SCIENTIFIC_LAYER_NOT_FOUND", "No scientific layer matches the supplied identity and revision."); layer.authorized = true; session.revision += 1; return { ok: true, sourceId: id, sourceRevision: layer.revision, authorized: true, stateRevision: session.revision }; }
    if (!session.source || args.sourceId !== session.source.id || args.sourceRevision !== session.source.revision) return fail("SOURCE_IDENTITY_MISMATCH", "No current source matches the supplied identity and revision.");
    session.source.authorized = true; session.revision += 1; return { ok: true, sourceId: session.source.id, sourceRevision: session.source.revision, authorized: true, stateRevision: session.revision };
  }
}
