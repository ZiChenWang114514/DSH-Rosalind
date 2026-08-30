import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { deflateSync } from "node:zlib";

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
  rendererMode: "local-canvas" | "local-zarr" | "coordinate-preview" | "metadata";
  metadata: Record<string, unknown>;
};

type ScientificEntity = { id: string; geometry?: unknown; properties: Record<string, unknown> };
type SourceAssociation = { dataset?: string; file_sha256?: string; matrix_revision?: string };
type CoordinateSystem = { name?: string; origin?: string; units?: string };
type GeoJsonDocument = { entities: ScientificEntity[]; sourceAssociation: SourceAssociation | null; coordinateSystem: CoordinateSystem | null };
type Layer = { id: string; revision: string; kind: string; path: string; featureCount: number; visible: boolean; authorized: boolean; sourceId: string | null; sourceRevision: string | null; sourceAssociation: SourceAssociation | null; coordinateSystem: CoordinateSystem | null; associationVerified: boolean; entities: ScientificEntity[] };
type WorkflowArtifact = { id: string; fileName: string; sequence: number; mimeType: string; bytes: number; content: Record<string, unknown>; provenance: string };
type Job = { id: string; durableId: string; kind: string; state: "queued" | "running" | "completed" | "failed" | "cancelled"; createdAt: string; executionSettled: boolean; reason?: string; result?: Record<string, unknown>; artifacts?: WorkflowArtifact[] };
type PreparedDicomUpload = { token: string; endpoint: string; paths: string[]; bytes: number; expiresAt: number; used: boolean };
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
  history: Array<{ revision: number; action: string; at: string; detail?: Record<string, unknown> }>;
  undone: Array<{ revision: number; action: string; at: string; detail?: Record<string, unknown> }>;
  /** This is set only by an explicit renderer acknowledgement. Decoding a tile is
   * intentionally insufficient: it does not establish that a viewer frame exists. */
  mountedSourceRevision: string | null;
  preparedDicomUploads: Map<string, PreparedDicomUpload>;
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

function inside(value: unknown, root: string, authorizedPaths: readonly string[] = []): string | ScienceFailure {
  if (typeof value !== "string" || !value.trim()) return fail("SOURCE_PATH_REQUIRED", "An authorized local slide, spatial-data, or layer path is required.");
  const path = isAbsolute(value) ? resolve(value) : resolve(root, value);
  const packageRoot = resolve(root);
  const selected = authorizedPaths.map((candidate) => isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate));
  const allowed = path === packageRoot
    || path.startsWith(`${packageRoot}\\`)
    || path.startsWith(`${packageRoot}/`)
    || selected.some((candidate) => {
      if (path === candidate) return true;
      try { return statSync(candidate).isDirectory() && (path.startsWith(`${candidate}\\`) || path.startsWith(`${candidate}/`)); } catch { return false; }
    });
  if (!allowed) return fail("SOURCE_NOT_AUTHORIZED", "The requested path was not selected in this immutable DSH-Rosalind plan.", { requestedPath: value });
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

function record(session: SlideSession, action: string, detail?: Record<string, unknown>): void {
  session.revision += 1;
  session.history.push({ revision: session.revision, action, at: new Date().toISOString(), ...(detail ? { detail } : {}) });
  if (session.history.length > 200) session.history.shift();
  session.undone = [];
}

function checksum(data: Buffer): number {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(kind: string, body: Buffer): Buffer {
  const tag = Buffer.from(kind, "ascii");
  const header = Buffer.alloc(4); header.writeUInt32BE(body.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(checksum(Buffer.concat([tag, body])), 0);
  return Buffer.concat([header, tag, body, crc]);
}

function pngRgb(width: number, height: number, pixels: Buffer, channels: 1 | 3): Buffer {
  const colorType = channels === 3 ? 2 : 0;
  const stride = width * channels;
  if (pixels.length !== stride * height) throw new Error("PNG pixel buffer does not match the requested dimensions.");
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) pixels.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = colorType;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(scanlines)), pngChunk("IEND", Buffer.alloc(0))]);
}

function retainedMetadata(path: string): { format: string; width: number | null; height: number | null; observations: number | null; genes: number | null; metadata: Record<string, unknown> } | ScienceFailure {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const main = raw.main_image && typeof raw.main_image === "object" ? raw.main_image as Record<string, unknown> : undefined;
    if (main) {
      const micronsPerPixel = typeof main.microns_per_pixel_metadata === "number" ? main.microns_per_pixel_metadata : undefined;
      return { format: "svs", width: typeof main.width === "number" ? main.width : null, height: typeof main.height === "number" ? main.height : null, observations: null, genes: null, metadata: { ...raw, ...(micronsPerPixel === undefined ? {} : { micronsPerPixel }) } };
    }
    if (typeof raw.observations === "number" && typeof raw.genes === "number") {
      let sourceDataset: string | undefined;
      let sourceFileSha256: string | undefined;
      try {
        const provenance = JSON.parse(readFileSync(join(dirname(path), "source-provenance.json"), "utf8")) as Record<string, unknown>;
        if (typeof provenance.sha256 === "string") sourceFileSha256 = provenance.sha256;
        if (typeof provenance.citation === "string") {
          const match = provenance.citation.match(/\),\s*(.*?),\s*Figshare\b/i);
          if (match?.[1]) sourceDataset = match[1];
        }
      } catch { /* The retained matrix can still be inspected without companion provenance. */ }
      return { format: "h5ad", width: 600, height: 600, observations: raw.observations, genes: raw.genes, metadata: { ...raw, ...(sourceDataset ? { source_dataset: sourceDataset } : {}), ...(sourceFileSha256 ? { source_file_sha256: sourceFileSha256 } : {}) } };
    }
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

type ClassicRaster = { width: number; height: number; channels: 1 | 3; layout: "strips" | "tiles"; rowsPerStrip: number; tileWidth?: number; tileHeight?: number; offsets: number[]; byteCounts: number[]; compression: number; bitsPerSample: number; photometric: number; planarConfiguration: number };

/** Read only the simple, lossless TIFF subset that the browser canvas renderer can
 * faithfully display without installing a native codec. Compressed pathology files
 * stay inspectable, but are never represented as invented pixels. */
function classicRaster(path: string): ClassicRaster | ScienceFailure {
  const size = statSync(path).size; const fd = openSync(path, "r");
  try {
    const header = readAt(fd, 0, 8, size); if (!header) return fail("TIFF_HEADER_INVALID", "The TIFF header is truncated.");
    const marker = header.toString("ascii", 0, 2); if (marker !== "II" && marker !== "MM") return fail("TIFF_HEADER_INVALID", "The file does not start with a TIFF byte-order marker.");
    const little = marker === "II";
    const u16 = (b: Buffer, n: number) => little ? b.readUInt16LE(n) : b.readUInt16BE(n);
    const u32 = (b: Buffer, n: number) => little ? b.readUInt32LE(n) : b.readUInt32BE(n);
    if (u16(header, 2) !== 42) return fail("TIFF_VARIANT_REQUIRES_NATIVE_HOST", "BigTIFF requires the native microscopy host.");
    const offset = u32(header, 4); const countBuffer = readAt(fd, offset, 2, size); if (!countBuffer) return fail("TIFF_DIRECTORY_INVALID", "The TIFF image directory is truncated.");
    const count = u16(countBuffer, 0); if (count > 4096) return fail("TIFF_DIRECTORY_INVALID", "The TIFF directory exceeds the local metadata-entry limit.");
    const directory = readAt(fd, offset + 2, count * 12 + 4, size); if (!directory) return fail("TIFF_DIRECTORY_INVALID", "The TIFF image directory is truncated.");
    const values = (tag: number): number[] | null => {
      for (let index = 0; index < count; index += 1) {
        const start = index * 12; if (u16(directory, start) !== tag) continue;
        const type = u16(directory, start + 2); const entries = u32(directory, start + 4); const sizePerItem = type === 3 ? 2 : type === 4 ? 4 : 0;
        if (!sizePerItem || entries < 1 || entries > 1_000_000) return null;
        const bytes = entries * sizePerItem; const raw = bytes <= 4 ? directory.subarray(start + 8, start + 8 + bytes) : readAt(fd, u32(directory, start + 8), bytes, size);
        if (!raw) return null;
        const out: number[] = []; for (let item = 0; item < entries; item += 1) out.push(type === 3 ? u16(raw, item * 2) : u32(raw, item * 4)); return out;
      }
      return null;
    };
    const width = values(256)?.[0]; const height = values(257)?.[0]; const compression = values(259)?.[0] ?? 1; const photometric = values(262)?.[0] ?? 1;
    const samples = values(277)?.[0] ?? 1; const bits = values(258)?.[0] ?? 8; const planarConfiguration = values(284)?.[0] ?? 1; const rowsPerStrip = values(278)?.[0] ?? height;
    const stripOffsets = values(273); const stripByteCounts = values(279); const tileOffsets = values(324); const tileByteCounts = values(325); const tileWidth = values(322)?.[0]; const tileHeight = values(323)?.[0];
    const layout = tileOffsets && tileByteCounts ? "tiles" : "strips"; const offsets = layout === "tiles" ? tileOffsets : stripOffsets; const byteCounts = layout === "tiles" ? tileByteCounts : stripByteCounts;
    if (!width || !height || !offsets || !byteCounts || offsets.length !== byteCounts.length) return fail("TIFF_PIXEL_LAYOUT_UNAVAILABLE", "The TIFF does not have a readable strip layout for local canvas rendering.");
    if (layout === "tiles" && (!tileWidth || !tileHeight)) return fail("TIFF_PIXEL_LAYOUT_UNAVAILABLE", "The tiled TIFF is missing tile dimensions.");
    if (samples !== 1 && samples !== 3) return fail("TIFF_PIXEL_LAYOUT_UNAVAILABLE", "Local canvas rendering supports one- or three-channel TIFF samples only.", { samplesPerPixel: samples });
    if (bits !== 8 || compression !== 1) return fail("TIFF_PIXEL_CODEC_UNAVAILABLE", "The source uses a TIFF pixel codec that is not bundled with this local renderer.", { compression, bitsPerSample: bits });
    if (samples === 3 && photometric !== 2) return fail("TIFF_PHOTOMETRIC_UNSUPPORTED", "Three-sample TIFF rendering requires RGB photometric interpretation.", { photometric, samplesPerPixel: samples });
    if (samples === 3 && planarConfiguration !== 1) return fail("TIFF_PLANAR_CONFIGURATION_UNSUPPORTED", "Three-sample TIFF rendering requires chunky PlanarConfiguration=1 samples.", { planarConfiguration, samplesPerPixel: samples });
    if (samples === 1 && photometric !== 0 && photometric !== 1) return fail("TIFF_PHOTOMETRIC_UNSUPPORTED", "One-sample TIFF rendering supports only WhiteIsZero or BlackIsZero photometric interpretation.", { photometric, samplesPerPixel: samples });
    return { width, height, channels: samples as 1 | 3, layout, rowsPerStrip: rowsPerStrip ?? height, ...(layout === "tiles" ? { tileWidth: tileWidth!, tileHeight: tileHeight! } : {}), offsets, byteCounts, compression, bitsPerSample: bits, photometric, planarConfiguration };
  } finally { closeSync(fd); }
}

function localRasterTile(path: string, requested: Record<string, unknown>): { width: number; height: number; channels: 1 | 3; png: Buffer; x: number; y: number } | ScienceFailure {
  const raster = classicRaster(path); if (isFailure(raster)) return raster;
  const x = typeof requested.x === "number" ? Math.floor(requested.x) : 0; const y = typeof requested.y === "number" ? Math.floor(requested.y) : 0;
  const width = typeof requested.width === "number" ? Math.floor(requested.width) : Math.min(512, raster.width); const height = typeof requested.height === "number" ? Math.floor(requested.height) : Math.min(512, raster.height);
  if (x < 0 || y < 0 || width < 1 || height < 1 || x + width > raster.width || y + height > raster.height) return fail("TILE_REGION_INVALID", "The requested tile must stay within the source image dimensions.", { width: raster.width, height: raster.height });
  if (width * height * raster.channels > 4 * 1024 * 1024) return fail("TILE_TOO_LARGE", "The local renderer limits a decoded tile to 4 MiB of source samples.");
  const out = Buffer.alloc(width * height * raster.channels); const fd = openSync(path, "r"); const size = statSync(path).size;
  try {
    if (raster.layout === "strips") {
      const firstStrip = Math.floor(y / raster.rowsPerStrip); const lastStrip = Math.floor((y + height - 1) / raster.rowsPerStrip);
      for (let strip = firstStrip; strip <= lastStrip; strip += 1) {
        const stripY = strip * raster.rowsPerStrip; const rows = Math.min(raster.rowsPerStrip, raster.height - stripY); const expected = raster.width * rows * raster.channels;
        const raw = readAt(fd, raster.offsets[strip]!, raster.byteCounts[strip]!, size); if (!raw || raw.length < expected) return fail("TIFF_PIXEL_LAYOUT_UNAVAILABLE", "A required uncompressed TIFF strip is incomplete.");
        const copyY0 = Math.max(y, stripY); const copyY1 = Math.min(y + height, stripY + rows);
        for (let row = copyY0; row < copyY1; row += 1) { const sourceStart = ((row - stripY) * raster.width + x) * raster.channels; const destinationStart = ((row - y) * width) * raster.channels; raw.copy(out, destinationStart, sourceStart, sourceStart + width * raster.channels); }
      }
    } else {
      const tileWidth = raster.tileWidth!; const tileHeight = raster.tileHeight!; const across = Math.ceil(raster.width / tileWidth); const firstX = Math.floor(x / tileWidth); const lastX = Math.floor((x + width - 1) / tileWidth); const firstY = Math.floor(y / tileHeight); const lastY = Math.floor((y + height - 1) / tileHeight);
      for (let tileY = firstY; tileY <= lastY; tileY += 1) for (let tileX = firstX; tileX <= lastX; tileX += 1) {
        const index = tileY * across + tileX; const raw = readAt(fd, raster.offsets[index]!, raster.byteCounts[index]!, size); const expected = tileWidth * tileHeight * raster.channels;
        if (!raw || raw.length < expected) return fail("TIFF_PIXEL_LAYOUT_UNAVAILABLE", "A required uncompressed TIFF tile is incomplete.");
        const sourceX = tileX * tileWidth; const sourceY = tileY * tileHeight; const copyX0 = Math.max(x, sourceX); const copyX1 = Math.min(x + width, sourceX + tileWidth, raster.width); const copyY0 = Math.max(y, sourceY); const copyY1 = Math.min(y + height, sourceY + tileHeight, raster.height);
        for (let row = copyY0; row < copyY1; row += 1) { const sourceStart = ((row - sourceY) * tileWidth + (copyX0 - sourceX)) * raster.channels; const destinationStart = ((row - y) * width + (copyX0 - x)) * raster.channels; raw.copy(out, destinationStart, sourceStart, sourceStart + (copyX1 - copyX0) * raster.channels); }
      }
    }
  } finally { closeSync(fd); }
  if (raster.channels === 1 && raster.photometric === 0) for (let index = 0; index < out.length; index += 1) out[index] = 255 - out[index]!;
  return { width, height, channels: raster.channels, png: pngRgb(width, height, out, raster.channels), x, y };
}

type OmeZarrRaster = { width: number; height: number; chunkPath: string; dtype: "u1"; byteLength: number };

/** Inspect a deliberately small but real NGFF v0.4 Zarr group. The local codec
 * accepts one uncompressed uint8 YX chunk; other layouts keep their metadata and
 * return a specific codec diagnostic instead of fabricated pixels. */
function omeZarrRaster(path: string): OmeZarrRaster | ScienceFailure {
  try {
    const zattrsPath = join(path, ".zattrs"); const attrs = JSON.parse(readFileSync(zattrsPath, "utf8")) as Record<string, unknown>;
    const multiscales = Array.isArray(attrs.multiscales) ? attrs.multiscales[0] as Record<string, unknown> | undefined : undefined;
    const datasets = multiscales && Array.isArray(multiscales.datasets) ? multiscales.datasets : null;
    const level = datasets?.[0] && typeof datasets[0] === "object" ? datasets[0] as Record<string, unknown> : null;
    const levelPath = typeof level?.path === "string" ? level.path : "0";
    if (!level || levelPath.includes("..") || isAbsolute(levelPath)) return fail("OME_ZARR_METADATA_INVALID", "The OME-Zarr multiscales metadata must name a local first dataset.");
    const array = JSON.parse(readFileSync(join(path, levelPath, ".zarray"), "utf8")) as Record<string, unknown>;
    const shape = Array.isArray(array.shape) ? array.shape : []; const chunks = Array.isArray(array.chunks) ? array.chunks : [];
    if (shape.length !== 2 || chunks.length !== 2 || !shape.every((v) => Number.isInteger(v) && Number(v) > 0) || !chunks.every((v) => Number.isInteger(v) && Number(v) > 0)) return fail("OME_ZARR_LAYOUT_UNSUPPORTED", "The local OME-Zarr renderer currently supports a two-dimensional YX array.", { shape, chunks });
    if (chunks[0] !== shape[0] || chunks[1] !== shape[1]) return fail("OME_ZARR_LAYOUT_UNSUPPORTED", "The local OME-Zarr renderer currently requires one YX chunk for the selected level.", { shape, chunks });
    if (array.dtype !== "|u1" && array.dtype !== "<u1") return fail("OME_ZARR_DTYPE_UNSUPPORTED", "The local OME-Zarr renderer supports uint8 pixels only.", { dtype: array.dtype });
    if (array.compressor !== null || (Array.isArray(array.filters) && array.filters.length > 0)) return fail("OME_ZARR_CODEC_UNAVAILABLE", "The local OME-Zarr renderer requires uncompressed, unfiltered chunks.");
    const chunkPath = join(path, levelPath, "0.0"); const byteLength = Number(shape[0]) * Number(shape[1]);
    if (!existsSync(chunkPath) || statSync(chunkPath).size !== byteLength) return fail("OME_ZARR_CHUNK_NOT_READABLE", "The expected local OME-Zarr chunk is missing or has an unexpected size.", { chunkPath, expectedBytes: byteLength });
    return { width: Number(shape[1]), height: Number(shape[0]), chunkPath, dtype: "u1", byteLength };
  } catch (cause) { return fail("OME_ZARR_METADATA_NOT_READABLE", cause instanceof Error ? cause.message : String(cause)); }
}

function localOmeZarrTile(path: string, requested: Record<string, unknown>): { width: number; height: number; channels: 1; png: Buffer; x: number; y: number } | ScienceFailure {
  const raster = omeZarrRaster(path); if (isFailure(raster)) return raster;
  const x = typeof requested.x === "number" ? Math.floor(requested.x) : 0; const y = typeof requested.y === "number" ? Math.floor(requested.y) : 0;
  const width = typeof requested.width === "number" ? Math.floor(requested.width) : Math.min(512, raster.width); const height = typeof requested.height === "number" ? Math.floor(requested.height) : Math.min(512, raster.height);
  if (x < 0 || y < 0 || width < 1 || height < 1 || x + width > raster.width || y + height > raster.height) return fail("TILE_REGION_INVALID", "The requested tile must stay within the source image dimensions.", { width: raster.width, height: raster.height });
  if (width * height > 4 * 1024 * 1024) return fail("TILE_TOO_LARGE", "The local renderer limits a decoded tile to 4 MiB of source samples.");
  const raw = readFileSync(raster.chunkPath); const pixels = Buffer.alloc(width * height);
  for (let row = 0; row < height; row += 1) raw.copy(pixels, row * width, (y + row) * raster.width + x, (y + row) * raster.width + x + width);
  return { width, height, channels: 1, png: pngRgb(width, height, pixels, 1), x, y };
}

type DicomInstance = { path: string; studyInstanceUid: string; seriesInstanceUid: string; sopInstanceUid: string; width: number | null; height: number | null; transferSyntaxUid: string | null };
type DicomSemanticObject = DicomInstance & { modality: string | null; sopClassUid: string | null; seriesDescription: string | null };

function dicomText(data: Buffer): string { return data.toString("utf8").replace(/[\0 ]+$/g, ""); }

/** Bounded Explicit-VR Little Endian Part-10 reader for local WSI identity and
 * dimensions. Pixel codecs and DICOM semantic objects remain outside this codec. */
function inspectDicom(path: string): DicomInstance | ScienceFailure {
  try {
    const body = readFileSync(path); if (body.length < 132 || body.toString("ascii", 128, 132) !== "DICM") return fail("DICOM_PART10_INVALID", "The local DICOM reader requires a Part-10 file with a DICM preamble.");
    let offset = 132; let transferSyntaxUid: string | null = null; const values = new Map<string, Buffer>();
    while (offset + 8 <= body.length && offset < 1024 * 1024) {
      const group = body.readUInt16LE(offset); const element = body.readUInt16LE(offset + 2); const vr = body.toString("ascii", offset + 4, offset + 6);
      const longVr = ["OB", "OD", "OF", "OL", "OW", "SQ", "UC", "UR", "UT", "UN"].includes(vr); const header = longVr ? 12 : 8;
      if (offset + header > body.length) break;
      const length = longVr ? body.readUInt32LE(offset + 8) : body.readUInt16LE(offset + 6); if (length === 0xffffffff || offset + header + length > body.length) return fail("DICOM_TRANSFER_SYNTAX_UNSUPPORTED", "Undefined-length or encapsulated DICOM values require the native DICOM codec.");
      const key = `${group.toString(16).padStart(4, "0")},${element.toString(16).padStart(4, "0")}`; const value = body.subarray(offset + header, offset + header + length);
      if (key === "0002,0010") transferSyntaxUid = dicomText(value);
      if (["0020,000d", "0020,000e", "0008,0018", "0028,0010", "0028,0011"].includes(key)) values.set(key, value);
      offset += header + length;
      if (group > 0x0028) break;
    }
    if (transferSyntaxUid && transferSyntaxUid !== "1.2.840.10008.1.2.1") return fail("DICOM_TRANSFER_SYNTAX_UNSUPPORTED", "The local DICOM reader supports Explicit VR Little Endian metadata only.", { transferSyntaxUid });
    const studyInstanceUid = values.get("0020,000d"); const seriesInstanceUid = values.get("0020,000e"); const sopInstanceUid = values.get("0008,0018");
    if (!studyInstanceUid || !seriesInstanceUid || !sopInstanceUid) return fail("DICOM_IDENTITY_MISSING", "The local DICOM instance is missing Study, Series, or SOP Instance UID metadata.");
    const number = (key: string): number | null => { const value = values.get(key); return value && value.length >= 2 ? value.readUInt16LE(0) : null; };
    return { path, studyInstanceUid: dicomText(studyInstanceUid), seriesInstanceUid: dicomText(seriesInstanceUid), sopInstanceUid: dicomText(sopInstanceUid), width: number("0028,0011"), height: number("0028,0010"), transferSyntaxUid };
  } catch (cause) { return fail("DICOM_NOT_READABLE", cause instanceof Error ? cause.message : String(cause)); }
}

/** A deliberately small Part-10 semantic-object reader.  It accepts only
 * Explicit-VR Little Endian files and retains identities plus the modality/SOP
 * class metadata used to associate a local ANN, SR, SEG, or PMAP object.  It
 * never claims to decode geometry, segments, or report content that it did not
 * parse. */
function inspectDicomSemanticObject(path: string): DicomSemanticObject | ScienceFailure {
  const base = inspectDicom(path); if (isFailure(base)) return base;
  try {
    const body = readFileSync(path); let offset = 132; const values = new Map<string, Buffer>();
    while (offset + 8 <= body.length && offset < 1024 * 1024) {
      const group = body.readUInt16LE(offset); const element = body.readUInt16LE(offset + 2); const vr = body.toString("ascii", offset + 4, offset + 6);
      const longVr = ["OB", "OD", "OF", "OL", "OW", "SQ", "UC", "UR", "UT", "UN"].includes(vr); const header = longVr ? 12 : 8;
      if (offset + header > body.length) break;
      const length = longVr ? body.readUInt32LE(offset + 8) : body.readUInt16LE(offset + 6);
      if (length === 0xffffffff || offset + header + length > body.length) return fail("DICOM_SEMANTIC_CODEC_UNAVAILABLE", "Undefined-length DICOM semantic content needs the native codec; no object was imported.");
      const key = `${group.toString(16).padStart(4, "0")},${element.toString(16).padStart(4, "0")}`;
      if (["0008,0016", "0008,0060", "0008,103e"].includes(key)) values.set(key, body.subarray(offset + header, offset + header + length));
      offset += header + length;
    }
    const modality = values.get("0008,0060") ? dicomText(values.get("0008,0060")!) : null;
    const semanticKinds: Record<string, string> = { ANN: "annotation", SR: "structured-report", SEG: "segmentation", PM: "parametric-map" };
    if (!modality || !semanticKinds[modality]) return fail("DICOM_SEMANTIC_OBJECT_UNSUPPORTED", "Only local ANN, SR, SEG, and PMAP metadata objects are supported by this compact semantic reader.", { modality });
    return { ...base, modality, sopClassUid: values.get("0008,0016") ? dicomText(values.get("0008,0016")!) : null, seriesDescription: values.get("0008,103e") ? dicomText(values.get("0008,103e")!) : null };
  } catch (cause) { return fail("DICOM_NOT_READABLE", cause instanceof Error ? cause.message : String(cause)); }
}

function dicomElement(group: number, element: number, vr: string, value: Buffer): Buffer {
  const head = Buffer.alloc(["OB", "OD", "OF", "OL", "OW", "SQ", "UC", "UR", "UT", "UN"].includes(vr) ? 12 : 8);
  head.writeUInt16LE(group, 0); head.writeUInt16LE(element, 2); head.write(vr, 4, 2, "ascii");
  if (head.length === 12) head.writeUInt32LE(value.length, 8); else head.writeUInt16LE(value.length, 6);
  return Buffer.concat([head, value]);
}

function dicomUi(value: string): Buffer { const raw = Buffer.from(`${value}\0`, "ascii"); return raw.length % 2 ? Buffer.concat([raw, Buffer.from([0])]) : raw; }
function dicomTextValue(value: string): Buffer { const raw = Buffer.from(value, "ascii"); return raw.length % 2 ? Buffer.concat([raw, Buffer.from([0x20])]) : raw; }

function freshUid(): string { return `2.25.${BigInt(`0x${randomBytes(16).toString("hex")}`).toString(10)}`; }

function encodeMinimalDicomSemanticObject(source: DicomSemanticObject): Buffer {
  const preamble = Buffer.alloc(128);
  const transferSyntax = dicomElement(0x0002, 0x0010, "UI", dicomUi("1.2.840.10008.1.2.1"));
  const sopClass = dicomElement(0x0008, 0x0016, "UI", dicomUi(source.sopClassUid || "1.2.840.10008.5.1.4.1.1.91.1"));
  const sopInstance = dicomElement(0x0008, 0x0018, "UI", dicomUi(freshUid()));
  const modality = dicomElement(0x0008, 0x0060, "CS", dicomTextValue(source.modality || "ANN"));
  const description = dicomElement(0x0008, 0x103e, "LO", dicomTextValue(source.seriesDescription || "DSH-Rosalind compact semantic object"));
  const study = dicomElement(0x0020, 0x000d, "UI", dicomUi(source.studyInstanceUid));
  const series = dicomElement(0x0020, 0x000e, "UI", dicomUi(freshUid()));
  return Buffer.concat([preamble, Buffer.from("DICM"), transferSyntax, sopClass, sopInstance, modality, description, study, series]);
}

function renderState(source: SourceState | null, mounted = false): "awaiting-viewer" | "ready" | "coordinate-preview" | "metadata-only" {
  if (!source) return "awaiting-viewer";
  if (source.rendererMode === "local-canvas" || source.rendererMode === "local-zarr") return mounted ? "ready" : "awaiting-viewer";
  return source.rendererMode === "coordinate-preview" ? "coordinate-preview" : "metadata-only";
}

function sourceSummary(source: SourceState | null): Record<string, unknown> | null {
  if (!source) return null;
  const preview = source.rendererMode === "local-canvas" ? localRasterTile(source.path, {}) : source.rendererMode === "local-zarr" ? localOmeZarrTile(source.path, {}) : null;
  const previewTile = preview && !isFailure(preview) ? { dataUrl: `data:image/png;base64,${preview.png.toString("base64")}`, mimeType: "image/png", x: preview.x, y: preview.y, width: preview.width, height: preview.height, sourceRevision: source.revision, decoder: source.rendererMode } : null;
  return { id: source.id, fileName: basename(source.path), format: source.format, sourceRevision: source.revision, width: source.width, height: source.height, observations: source.observations, genes: source.genes, authorized: source.authorized, mode: source.mode, renderAvailable: source.renderAvailable, rendererMode: source.rendererMode, coordinatePreview: source.rendererMode === "coordinate-preview", originalPixelsAvailable: source.rendererMode === "local-canvas" || source.rendererMode === "local-zarr", previewTile, ...(preview && isFailure(preview) ? { previewDiagnostic: preview.error } : {}), metadata: source.metadata };
}

function sessionState(session: SlideSession): Record<string, unknown> {
  const source = session.source;
  const mounted = Boolean(source && session.mountedSourceRevision === source.revision);
  const sourceDetails = sourceSummary(source);
  return {
    ok: true,
    viewerSessionId: session.id,
    sourceRevision: source?.revision ?? null,
    load: source ? { status: source.mode === "recorded-fixture" ? "recorded-fixture" : source.renderAvailable ? "awaiting-viewer" : "metadata-only", error: null } : { status: "empty", error: null },
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
    projectHistory: { total: session.history.length, canUndo: session.history.length > 0, canRedo: session.undone.length > 0, items: session.history.slice(-20) },
    source: sourceDetails,
    previewTile: sourceDetails?.previewTile ?? null,
    viewerReady: mounted,
    viewerState: renderState(source, mounted),
    renderState: renderState(source, mounted),
    renderer: source ? { ready: mounted, decoderAvailable: source.renderAvailable, mounted, mode: source.rendererMode, tileQuery: source.rendererMode === "local-canvas" || source.rendererMode === "local-zarr" ? "query_viewer:{query:'tile',x,y,width,height}" : null } : null,
    stateRevision: session.revision,
  };
}

function readGeoJson(path: string): GeoJsonDocument | ScienceFailure {
  try {
    if (statSync(path).size > 32 * 1024 * 1024) return fail("LAYER_TOO_LARGE", "GeoJSON exceeds the 32 MiB local import limit.");
    const data = JSON.parse(readFileSync(path, "utf8")) as { type?: unknown; features?: unknown[]; source_association?: unknown; coordinate_system?: unknown };
    if (!Array.isArray(data.features)) return fail("LAYER_FORMAT_INVALID", "GeoJSON import requires a FeatureCollection with a features array.");
    const entities = data.features.map((value, index) => {
      const feature = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const properties = feature.properties && typeof feature.properties === "object" ? feature.properties as Record<string, unknown> : {};
      const candidate = feature.id ?? properties.id ?? properties.observation_id ?? properties.cell_id ?? index;
      return { id: String(candidate), geometry: feature.geometry, properties };
    });
    const association = data.source_association && typeof data.source_association === "object" && !Array.isArray(data.source_association) ? data.source_association as Record<string, unknown> : null;
    const coordinateSystem = data.coordinate_system && typeof data.coordinate_system === "object" && !Array.isArray(data.coordinate_system) ? data.coordinate_system as Record<string, unknown> : null;
    return {
      entities,
      sourceAssociation: association ? {
        ...(typeof association.dataset === "string" ? { dataset: association.dataset } : {}),
        ...(typeof association.file_sha256 === "string" ? { file_sha256: association.file_sha256 } : {}),
        ...(typeof association.matrix_revision === "string" ? { matrix_revision: association.matrix_revision } : {}),
      } : null,
      coordinateSystem: coordinateSystem ? {
        ...(typeof coordinateSystem.name === "string" ? { name: coordinateSystem.name } : {}),
        ...(typeof coordinateSystem.origin === "string" ? { origin: coordinateSystem.origin } : {}),
        ...(typeof coordinateSystem.units === "string" ? { units: coordinateSystem.units } : {}),
      } : null,
    };
  } catch (cause) { return fail("LAYER_NOT_READABLE", cause instanceof Error ? cause.message : String(cause)); }
}

function validateLayerAssociation(source: SourceState, document: GeoJsonDocument): { verified: boolean } | ScienceFailure {
  const association = document.sourceAssociation;
  if (!association && !document.coordinateSystem) return { verified: false };
  if (!association || !association.dataset || !association.file_sha256 || !association.matrix_revision) {
    return fail("SOURCE_ASSOCIATION_REQUIRED", "Scientific GeoJSON must declare dataset, file_sha256, and matrix_revision before it can be associated with the active source.");
  }
  if (!document.coordinateSystem?.name || !document.coordinateSystem.origin || !document.coordinateSystem.units) {
    return fail("COORDINATE_SYSTEM_REQUIRED", "Scientific GeoJSON must declare its coordinate system name, origin, and units.");
  }
  const metadata = source.metadata;
  const actual = {
    dataset: typeof metadata.source_dataset === "string" ? metadata.source_dataset : null,
    file_sha256: typeof metadata.source_file_sha256 === "string" ? metadata.source_file_sha256 : null,
    matrix_revision: typeof metadata.matrix_revision === "string" ? metadata.matrix_revision : null,
  };
  const matches = actual.dataset === association.dataset && actual.file_sha256 === association.file_sha256 && actual.matrix_revision === association.matrix_revision;
  return matches ? { verified: true } : fail("SOURCE_ASSOCIATION_MISMATCH", "The scientific layer does not belong to the active source dataset and matrix revision.", { declared: association, active: actual, sourceFormat: source.format });
}

export class SlideService {
  private readonly sessions = new WeakMap<object, SlideSession>();

  async execute(operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<Record<string, unknown> | ScienceFailure> {
    ensureNotAborted(context.signal);
    const name = operation.replace(/^slide\./, "");
    if (name === "get_capabilities") return this.capabilities();
    const opening = name === "open_from_chat" || name === "open_ome_zarr" || name === "open_dicom_series" || name === "open_ome_tiff_series" || name === "open_dicomweb_wsi";
    const session = opening ? this.ensureSession(context.session) : this.requireSession(context.session, args.sessionId);
    if (isFailure(session)) return session;
    if (name === "open_from_chat" || name === "open_ome_zarr" || name === "open_dicom_series" || name === "open_ome_tiff_series") return this.open(name, args, context, session);
    if (name === "open_dicomweb_wsi") return this.openDicomweb(args, context, session);
    if (name === "get_viewer_state") return sessionState(session);
    if (name === "wait_for_render") return this.waitForRender(args, session);
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
    if (name === "resume_workflow" || name === "resume_pathology") return this.resumeJob(args, session);
    if (name === "renew_source_authorization" || name === "renew_scientific_layer_authorization") return this.renew(name, args, session);
    if (name === "read_workflow_artifact" || name === "read_live_workflow_artifact" || name === "read_live_workflow_projection") return this.readWorkflowArtifact(args, session);
    if (name === "list_workflows" || name === "list_workflow_sources") return { ok: true, items: [...session.jobs.values()], note: session.jobs.size ? "Session workflow history includes retained local results." : "No durable workflow history has been created in this local session." };
    if (name === "prepare_dicom_upload") return this.prepareDicomUpload(args, context, session);
    if (name === "submit_dicom_upload") return this.submitDicomUpload(args, context, session);
    if (["query_dicomweb", "inspect_dicomweb_instance", "read_dicomweb_object"].includes(name)) return this.dicomweb(name, args, context);
    if (name === "import_dicom_object") return this.importDicomObject(args, context, session);
    if (name === "export_dicom_object") return this.exportDicomObject(args, context, session);
    return fail("OPERATION_NOT_IMPLEMENTED", `Slide operation ${operation} is registered but has no local implementation yet.`);
  }

  private ensureSession(owner: object): SlideSession {
    let session = this.sessions.get(owner);
    if (!session) { session = { id: crypto.randomUUID(), revision: 0, source: null, displayMode: "inline", toolbarVisible: true, theme: "light", visibleBounds: null, selectedRegions: [], layers: new Map(), selectedGene: null, jobs: new Map(), importJobs: new Map(), measurements: [], workspaceSection: "layers", commandSearch: { visible: false, query: "" }, exportOptions: {}, history: [], undone: [], mountedSourceRevision: null, preparedDicomUploads: new Map() }; this.sessions.set(owner, session); }
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
    if (operation === "open_dicom_series") {
      if (!Array.isArray(args.paths) || !args.paths.length) return fail("DICOM_SERIES_PATHS_REQUIRED", "An explicit non-empty ordered local DICOM instance list is required.");
      const members: DicomInstance[] = [];
      for (const requested of args.paths) { const path = inside(requested, context.packageRoot, context.authorizedPaths); if (typeof path !== "string") return path; const item = inspectDicom(path); if (isFailure(item)) return item; members.push(item); }
      const first = members[0]!;
      if (members.some((item) => item.studyInstanceUid !== first.studyInstanceUid || item.seriesInstanceUid !== first.seriesInstanceUid)) return fail("DICOM_SERIES_IDENTITY_MISMATCH", "All local DICOM instances must share Study and Series Instance UIDs.");
      const width = first.width; const height = first.height;
      const revision = `local:${stableId(members.map((item) => [relative(context.packageRoot, item.path), statSync(item.path).size, statSync(item.path).mtimeMs]))}`;
      session.source = { id: `source-${crypto.randomUUID()}`, path: first.path, format: "dicom", revision, authorized: true, width, height, observations: null, genes: null, mode: "metadata-only", renderAvailable: false, rendererMode: "metadata", metadata: { inspection: "bounded-part10-explicit-vr-le", studyInstanceUid: first.studyInstanceUid, seriesInstanceUid: first.seriesInstanceUid, instances: members.map((item) => ({ sopInstanceUid: item.sopInstanceUid, width: item.width, height: item.height, path: relative(context.packageRoot, item.path) })), pixelDiagnostic: { code: "DICOM_PIXEL_CODEC_UNAVAILABLE", message: "The local DICOM reader verifies WSI identities and dimensions but does not decode DICOM pixel data." } } };
      session.mountedSourceRevision = null; session.visibleBounds = width && height ? { x: 0, y: 0, width, height } : null; session.selectedRegions = []; session.layers.clear(); session.measurements = []; record(session, "open-dicom-series", { instanceCount: members.length });
      return { ...sessionState(session), source: sourceSummary(session.source), viewerReady: false, viewerState: "metadata-only", renderState: "metadata-only" };
    }
    if (operation === "open_ome_zarr" && typeof args.baseUrl === "string") return fail("REMOTE_OME_ZARR_TRANSPORT_UNAVAILABLE", "Remote OME-Zarr needs an authorized host HTTP range transport and a verified manifest; no network request was sent.");
    if (operation === "open_ome_tiff_series") {
      if (!Array.isArray(args.paths) || args.paths.length === 0) return fail("OME_TIFF_PATHS_REQUIRED", "An explicit non-empty OME-TIFF path list is required.");
      const paths: string[] = [];
      for (const value of args.paths) { const checked = inside(value, context.packageRoot, context.authorizedPaths); if (typeof checked !== "string") return checked; paths.push(checked); }
      const inspected = paths.map((path) => inspectTiff(path)); const problem = inspected.find(isFailure); if (problem) return problem;
      const first = inspected[0] as Record<string, unknown>; const main = first.mainImage as Record<string, unknown>;
      const revision = `local:${stableId(paths.map((path) => [relative(context.packageRoot, path), statSync(path).size, statSync(path).mtimeMs]))}`;
      const raster = classicRaster(paths[0]!); const renderAvailable = !isFailure(raster);
      session.source = { id: `source-${crypto.randomUUID()}`, path: paths[0]!, format: "ome-tiff", revision, authorized: true, width: Number(main.width), height: Number(main.height), observations: null, genes: null, mode: "live", renderAvailable, rendererMode: renderAvailable ? "local-canvas" : "metadata", metadata: { series: inspected, memberCount: paths.length, ...(isFailure(raster) ? { pixelDiagnostic: raster.error } : { localRaster: { channels: raster.channels, rowsPerStrip: raster.rowsPerStrip } }) } };
      session.visibleBounds = { x: 0, y: 0, width: session.source.width!, height: session.source.height! }; record(session, "open-ome-tiff-series", { memberCount: paths.length });
      return { ...sessionState(session), viewerReady: false, viewerState: renderState(session.source), renderState: renderState(session.source), source: sourceSummary(session.source) };
    }
    const pathArg = operation === "open_ome_zarr" ? args.path ?? args.rootPath : args.path;
    const path = inside(pathArg, context.packageRoot, context.authorizedPaths); if (typeof path !== "string") return path;
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
    else if (format === "dicom") return fail("DICOM_SERIES_PATHS_REQUIRED", "Use open_dicom_series with an explicit ordered local DICOM instance list.");
    else {
      const raster = omeZarrRaster(path);
      if (isFailure(raster)) return raster;
      facts = { format: "ome-zarr", width: raster.width, height: raster.height, observations: null, genes: null, metadata: { inspection: "ngff-v0.4-local-yx-u8", localOmeZarr: { width: raster.width, height: raster.height, byteLength: raster.byteLength } } };
    }
    if (isFailure(facts)) return facts;
    const revision = `local:${stableId(relative(context.packageRoot, path), statSync(path).size, statSync(path).mtimeMs, facts)}`;
    const raster = format === "svs" || format === "tiff" ? classicRaster(path) : null;
    const zarrRaster = format === "ome-zarr" ? omeZarrRaster(path) : null;
    const renderAvailable = Boolean((raster && !isFailure(raster)) || (zarrRaster && !isFailure(zarrRaster)));
    const rendererMode = replayMetadata ? "coordinate-preview" : zarrRaster && !isFailure(zarrRaster) ? "local-zarr" : renderAvailable ? "local-canvas" : "metadata";
    session.source = { id: `source-${crypto.randomUUID()}`, path, revision, authorized: true, ...facts, metadata: { ...facts.metadata, ...(raster && isFailure(raster) ? { pixelDiagnostic: raster.error } : {}), ...(zarrRaster && isFailure(zarrRaster) ? { pixelDiagnostic: zarrRaster.error } : {}) }, mode: replayMetadata ? "recorded-fixture" : renderAvailable ? "live" : "metadata-only", renderAvailable, rendererMode };
    session.visibleBounds = facts.width && facts.height ? { x: 0, y: 0, width: facts.width, height: facts.height } : null;
    session.mountedSourceRevision = null; session.selectedRegions = []; session.selectedGene = null; session.layers.clear(); session.measurements = []; record(session, "open-source", { format: facts.format, rendererMode: session.source.rendererMode });
    return { ...sessionState(session), viewerReady: false, viewerState: renderState(session.source), renderState: renderState(session.source), source: sourceSummary(session.source), note: replayMetadata ? "Recorded dimensions and source provenance provide a coordinate preview only; the retained record does not include original slide pixels." : renderAvailable ? "A decoded preview tile is included for the ToolView. viewerReady remains false until the canvas reports the matching source revision." : { code: "PIXEL_CODEC_UNAVAILABLE", message: "Source metadata was inspected locally, but its compressed pixel codec is not bundled with this renderer.", ...(raster && isFailure(raster) ? { diagnostic: raster.error } : {}) } };
  }

  private capabilities(): Record<string, unknown> {
    return { ok: true, formats: ["svs", "tiff", "ome-tiff", "h5ad", "dicom", "ome-zarr"], operations: { locallyAvailable: ["classic TIFF/SVS metadata inspection", "uncompressed 8-bit TIFF Canvas tile query", "coordinate previews for retained metadata", "ROI annotations and measurements", "GeoJSON scientific layers", "region geometry statistics", "retained spatial metadata and validated gene summaries", "project JSON save/restore/history", "GeoJSON/measurement/project/source-PNG export", "local region/annotation summaries", "job inspection and cancellation"], requiresHostTransport: ["JPEG/JPEG2000/LZW TIFF tile codecs", "H5AD expression vectors", "DICOMweb", "DICOM semantic codecs", "authenticated remote OME-Zarr", "full pathology and full-assay workflow compute"], diagnosticOnly: ["DICOMweb", "DICOM semantic codecs", "authenticated remote OME-Zarr", "full pathology and full-assay workflow compute"] }, renderer: { localCanvas: { formats: ["classic TIFF", "OME-TIFF member"], requirements: "8-bit, uncompressed, 1 or 3 samples per pixel; RGB requires photometric RGB and PlanarConfiguration=1; supports strip and tile layout", frameConfirmation: "A host-mounted frame acknowledgement is required before reporting viewerReady." }, coordinatePreview: { formats: ["retained showcase metadata JSON"], pixels: "not original source pixels", renderState: "coordinate-preview" } }, budgets: { queryPageRows: 500, tileDecodedBytes: 4194304, geoJsonBytes: 33554432, projectBytes: 8388608, tiffIfds: 16, retainedFixtureObservations: 684, retainedFixtureGenes: 18078 } };
  }

  /** DICOMweb is deliberately restricted to an opt-in loopback mock in this
   * bundle. This makes the protocol path testable without sending study data to
   * a network service; production remote transport remains host-authorized. */
  private async dicomweb(operation: string, args: Record<string, unknown>, _context: ScienceExecutionContext): Promise<Record<string, unknown> | ScienceFailure> {
    const baseUrl = typeof args.baseUrl === "string" ? args.baseUrl : "";
    if (!baseUrl) return fail("DICOMWEB_BASE_URL_REQUIRED", "A DICOMweb baseUrl is required.");
    let url: URL;
    try { url = new URL(baseUrl); } catch { return fail("DICOMWEB_BASE_URL_INVALID", "The DICOMweb baseUrl is not a valid URL."); }
    const localMockEnabled = args.allowLocalMock === true || process.env.DSH_ROSALIND_LOCAL_DICOMWEB_MOCK === "1";
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(url.hostname) || !localMockEnabled) return fail("DICOMWEB_TRANSPORT_UNAVAILABLE", "Remote DICOMweb requires an authorized host HTTP transport. This local bundle permits only an explicit loopback mock; no request was sent.");
    const location = args.location && typeof args.location === "object" ? args.location as Record<string, unknown> : args;
    const suffix = operation === "query_dicomweb" ? "/instances" : operation === "read_dicomweb_object" ? `/instances/${encodeURIComponent(String(location.sopInstanceUid ?? ""))}` : `/instances/${encodeURIComponent(String(location.sopInstanceUid ?? ""))}/metadata`;
    try {
      const response = await fetch(new URL(suffix, url).toString(), { method: "GET", headers: { accept: "application/dicom+json" }, signal: _context.signal });
      if (!response.ok) return fail("DICOMWEB_HTTP_ERROR", `The loopback DICOMweb mock returned HTTP ${response.status}.`, { status: response.status });
      const body = await response.json() as unknown;
      return operation === "query_dicomweb" ? { ok: true, items: Array.isArray(body) ? body : [body], total: Array.isArray(body) ? body.length : 1, provenance: "Retrieved from an explicit local DICOMweb mock." } : { ok: true, object: body, location, provenance: "Retrieved from an explicit local DICOMweb mock." };
    } catch (cause) { return fail("DICOMWEB_LOCAL_MOCK_UNREACHABLE", cause instanceof Error ? cause.message : String(cause)); }
  }

  private async openDicomweb(args: Record<string, unknown>, context: ScienceExecutionContext, session: SlideSession): Promise<Record<string, unknown> | ScienceFailure> {
    const location = args.location && typeof args.location === "object" ? args.location as Record<string, unknown> : {
      studyInstanceUid: args.studyInstanceUid,
      seriesInstanceUid: args.seriesInstanceUid,
      sopInstanceUid: args.sopInstanceUid ?? (Array.isArray(args.sopInstanceUids) ? args.sopInstanceUids[0] : undefined),
    };
    const inspected = await this.dicomweb("inspect_dicomweb_instance", { ...args, location }, context); if (isFailure(inspected)) return inspected;
    const studyInstanceUid = typeof location.studyInstanceUid === "string" ? location.studyInstanceUid : null; const seriesInstanceUid = typeof location.seriesInstanceUid === "string" ? location.seriesInstanceUid : null;
    if (!studyInstanceUid || !seriesInstanceUid) return fail("DICOM_IDENTITY_MISSING", "Opening a DICOMweb WSI requires Study and Series Instance UIDs.");
    const object = inspected.object && typeof inspected.object === "object" ? inspected.object as Record<string, unknown> : {};
    const width = typeof object.columns === "number" ? object.columns : null; const height = typeof object.rows === "number" ? object.rows : null;
    const revision = `dicomweb-mock:${stableId(args.baseUrl, studyInstanceUid, seriesInstanceUid, object)}`;
    session.source = { id: `source-${crypto.randomUUID()}`, path: String(args.baseUrl), format: "dicomweb", revision, authorized: true, width, height, observations: null, genes: null, mode: "metadata-only", renderAvailable: false, rendererMode: "metadata", metadata: { inspection: "loopback-dicomweb-mock", studyInstanceUid, seriesInstanceUid, object, pixelDiagnostic: { code: "DICOMWEB_PIXEL_CODEC_UNAVAILABLE", message: "The local mock confirms DICOMweb metadata only; no remote pixel data was decoded." } } };
    session.mountedSourceRevision = null; session.visibleBounds = width && height ? { x: 0, y: 0, width, height } : null; record(session, "open-dicomweb-wsi", { studyInstanceUid, seriesInstanceUid });
    return { ...sessionState(session), source: sourceSummary(session.source), viewerReady: false, viewerState: "metadata-only", renderState: "metadata-only" };
  }

  private importDicomObject(args: Record<string, unknown>, context: ScienceExecutionContext, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const checked = inside(args.path, context.packageRoot, context.authorizedPaths); if (typeof checked !== "string") return checked;
    const semantic = inspectDicomSemanticObject(checked); if (isFailure(semantic)) return semantic;
    const expectedSop = typeof args.imageSopInstanceUid === "string" ? args.imageSopInstanceUid : null;
    if (expectedSop && session.source?.format === "dicom") {
      const sourceSops = Array.isArray(session.source.metadata.instances) ? session.source.metadata.instances.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).sopInstanceUid : null) : [];
      if (!sourceSops.includes(expectedSop)) return fail("DICOM_IMAGE_REFERENCE_MISMATCH", "The requested image SOP UID is not a member of the current local DICOM series.", { imageSopInstanceUid: expectedSop });
    }
    const kindByModality: Record<string, string> = { ANN: "dicom-annotation", SR: "dicom-structured-report", SEG: "segmentation", PM: "dicom-parametric-map" };
    const id = `dicom-${crypto.randomUUID()}`;
    const layer: Layer = { id, revision: `local:${stableId(semantic.path, statSync(semantic.path).size, statSync(semantic.path).mtimeMs)}`, kind: kindByModality[semantic.modality!]!, path: checked, featureCount: 0, visible: true, authorized: true, sourceId: session.source?.id ?? null, sourceRevision: session.source?.revision ?? null, sourceAssociation: null, coordinateSystem: null, associationVerified: false, entities: [] };
    session.layers.set(id, layer); record(session, "import-dicom-object", { id, modality: semantic.modality, sopInstanceUid: semantic.sopInstanceUid });
    return { ok: true, imported: true, layer, dicomObject: { modality: semantic.modality, sopClassUid: semantic.sopClassUid, studyInstanceUid: semantic.studyInstanceUid, seriesInstanceUid: semantic.seriesInstanceUid, sopInstanceUid: semantic.sopInstanceUid, seriesDescription: semantic.seriesDescription, semanticContent: "metadata-only" }, stateRevision: session.revision };
  }

  private exportDicomObject(args: Record<string, unknown>, context: ScienceExecutionContext, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const sourcePath = inside(args.path, context.packageRoot, context.authorizedPaths); if (typeof sourcePath !== "string") return sourcePath;
    const outputPath = inside(args.outputPath, context.packageRoot, context.authorizedPaths); if (typeof outputPath !== "string") return outputPath;
    if (existsSync(outputPath)) return fail("DESTINATION_EXISTS", "DICOM semantic export does not overwrite an existing file.", { path: relative(context.packageRoot, outputPath) });
    const semantic = inspectDicomSemanticObject(sourcePath); if (isFailure(semantic)) return semantic;
    if (typeof args.imageSopInstanceUid === "string" && session.source?.format === "dicom") {
      const sourceSops = Array.isArray(session.source.metadata.instances) ? session.source.metadata.instances.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).sopInstanceUid : null) : [];
      if (!sourceSops.includes(args.imageSopInstanceUid)) return fail("DICOM_IMAGE_REFERENCE_MISMATCH", "The requested image SOP UID is not a member of the current local DICOM series.", { imageSopInstanceUid: args.imageSopInstanceUid });
    }
    const encoded = encodeMinimalDicomSemanticObject(semantic);
    try { writeFileSync(outputPath, encoded, { flag: "wx" }); } catch (cause) { return fail("DICOM_EXPORT_WRITE_FAILED", cause instanceof Error ? cause.message : String(cause)); }
    const exported = inspectDicomSemanticObject(outputPath); if (isFailure(exported)) return exported;
    record(session, "export-dicom-object", { modality: semantic.modality, path: relative(context.packageRoot, outputPath) });
    return { ok: true, exported: true, path: relative(context.packageRoot, outputPath), bytes: encoded.length, sha256: createHash("sha256").update(encoded).digest("hex"), original: { studyInstanceUid: semantic.studyInstanceUid, seriesInstanceUid: semantic.seriesInstanceUid, sopInstanceUid: semantic.sopInstanceUid }, dicomObject: { modality: exported.modality, studyInstanceUid: exported.studyInstanceUid, seriesInstanceUid: exported.seriesInstanceUid, sopInstanceUid: exported.sopInstanceUid, semanticContent: "metadata-only" }, stateRevision: session.revision };
  }

  private prepareDicomUpload(args: Record<string, unknown>, context: ScienceExecutionContext, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const endpoint = typeof args.endpoint === "string" ? args.endpoint : "";
    let url: URL; try { url = new URL(endpoint); } catch { return fail("DICOMWEB_BASE_URL_INVALID", "The upload endpoint is not a valid URL."); }
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) return fail("DICOM_UPLOAD_REQUIRES_EXPLICIT_HOST_GRANT", "This local bundle can only prepare an opt-in loopback DICOMweb mock upload. Remote upload requires a host-issued, user-approved grant; no request was sent.");
    if (!Array.isArray(args.paths) || args.paths.length < 1 || args.paths.length > 16) return fail("DICOM_UPLOAD_PATHS_INVALID", "A loopback upload requires one to sixteen explicit local DICOM paths.");
    const paths: string[] = []; let bytes = 0;
    for (const requested of args.paths) { const path = inside(requested, context.packageRoot, context.authorizedPaths); if (typeof path !== "string") return path; const info = inspectDicom(path); if (isFailure(info)) return info; const size = statSync(path).size; bytes += size; paths.push(path); }
    if (bytes > 32 * 1024 * 1024) return fail("DICOM_UPLOAD_TOO_LARGE", "The local loopback upload limit is 32 MiB across all selected instances.", { bytes });
    const token = randomBytes(32).toString("base64url"); const grant: PreparedDicomUpload = { token, endpoint: url.toString(), paths, bytes, expiresAt: Date.now() + 30_000, used: false };
    session.preparedDicomUploads.set(token, grant); record(session, "prepare-dicom-upload", { count: paths.length, bytes, loopback: true });
    return { ok: true, prepared: true, preparedOperation: token, endpoint: url.toString(), instanceCount: paths.length, bytes, expiresAt: new Date(grant.expiresAt).toISOString(), localMock: true, stateRevision: session.revision };
  }

  private async submitDicomUpload(args: Record<string, unknown>, context: ScienceExecutionContext, session: SlideSession): Promise<Record<string, unknown> | ScienceFailure> {
    const token = typeof args.preparedOperation === "string" ? args.preparedOperation : ""; const grant = session.preparedDicomUploads.get(token);
    if (!grant) return fail("DICOM_UPLOAD_GRANT_NOT_FOUND", "The one-use local upload receipt is not active for this session.");
    if (grant.used || Date.now() > grant.expiresAt) { session.preparedDicomUploads.delete(token); return fail("DICOM_UPLOAD_GRANT_EXPIRED", "The one-use local upload receipt has expired or was already consumed."); }
    const boundary = `dsh-rosalind-${randomBytes(12).toString("hex")}`; const chunks: Buffer[] = [];
    for (const path of grant.paths) { const name = basename(path).replace(/[\r\n"]/g, "_"); chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/dicom\r\n\r\n`, "utf8"), readFileSync(path), Buffer.from("\r\n")); }
    const body = Buffer.concat([...chunks, Buffer.from(`--${boundary}--\r\n`)]);
    try {
      const response = await fetch(grant.endpoint, { method: "POST", headers: { "content-type": `multipart/related; type=application/dicom; boundary=${boundary}`, "content-length": String(body.length) }, body, signal: context.signal });
      grant.used = true; session.preparedDicomUploads.delete(token);
      if (!response.ok) return fail("DICOMWEB_HTTP_ERROR", `The loopback DICOMweb mock returned HTTP ${response.status}.`, { status: response.status });
      const text = await response.text(); record(session, "submit-dicom-upload", { count: grant.paths.length, bytes: grant.bytes, loopback: true });
      return { ok: true, submitted: true, endpoint: grant.endpoint, instanceCount: grant.paths.length, bytes: grant.bytes, response: text ? text.slice(0, 4096) : null, localMock: true, stateRevision: session.revision };
    } catch (cause) { return fail("DICOMWEB_LOCAL_MOCK_UNREACHABLE", cause instanceof Error ? cause.message : String(cause)); }
  }

  private waitForRender(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const requestedRevision = args.stateRevision;
    if (typeof requestedRevision !== "number" || !Number.isInteger(requestedRevision) || requestedRevision < 0) return fail("RENDER_STATE_REVISION_REQUIRED", "wait_for_render requires the exact non-negative stateRevision returned by get_viewer_state.", { currentRevision: session.revision });
    if (requestedRevision < session.revision) return { ...fail("RENDER_STATE_SUPERSEDED", "The requested render revision has been superseded; read the current viewer state and wait on its exact revision.", { requestedRevision, currentRevision: session.revision }), viewerReady: false, viewerState: "superseded", renderState: "superseded", stateRevision: session.revision, requestedRevision, pending: false, timedOut: false };
    if (requestedRevision > session.revision) return { ...fail("RENDER_STATE_UNKNOWN", "The requested render revision has not been created by this viewer session.", { requestedRevision, currentRevision: session.revision }), viewerReady: false, viewerState: "awaiting-viewer", renderState: "awaiting-viewer", stateRevision: session.revision, requestedRevision, pending: false, timedOut: false };
    const source = session.source;
    if (!source || !source.renderAvailable) return { ...fail("RENDER_CAPABILITY_UNAVAILABLE", "This source has metadata or coordinate-preview state only; no locally decodable source pixels are available for a mounted frame.", { stateRevision: session.revision, rendererMode: source?.rendererMode ?? null }), viewerReady: false, viewerState: renderState(source), renderState: renderState(source), stateRevision: session.revision, requestedRevision, pending: false, timedOut: false };
    if (session.mountedSourceRevision === source.revision) return { ...sessionState(session), viewerReady: true, viewerState: "ready", renderState: "ready", requestedRevision, pending: false, timedOut: false };
    const timeoutRequested = typeof args.timeoutMs === "number";
    return { ...sessionState(session), viewerReady: false, viewerState: "awaiting-viewer", renderState: timeoutRequested ? "timeout" : "pending", requestedRevision, pending: !timeoutRequested, timedOut: timeoutRequested, note: "The local decoder can supply source tiles, but this service has no host frame-confirmation channel for this revision." };
  }

  private control(args: Record<string, unknown>, session: SlideSession, context: ScienceExecutionContext): Record<string, unknown> | ScienceFailure {
    const action = args.action;
    if (typeof args.expectedRevision === "number" && args.expectedRevision !== session.revision) return fail("STALE_VIEWER_REVISION", "The viewer state changed; read the current state before applying this command.", { expectedRevision: args.expectedRevision, actualRevision: session.revision });
    if (!session.source && action !== "set_display_mode") return fail("VIEWER_NOT_OPEN", "Open a slide or spatial source before controlling the viewer.");
    if (action === "acknowledge_render") {
      if (!session.source?.renderAvailable) return fail("RENDER_CAPABILITY_UNAVAILABLE", "Only a locally decodable source can acknowledge a rendered frame.");
      if (args.sourceRevision !== session.source.revision) return fail("RENDER_ACKNOWLEDGEMENT_STALE", "The frame acknowledgement does not match the current source revision.", { expectedSourceRevision: session.source.revision, receivedSourceRevision: args.sourceRevision ?? null });
      session.mountedSourceRevision = session.source.revision; record(session, "acknowledge-render", { sourceRevision: session.source.revision });
      return { ok: true, applied: true, viewerReady: true, viewerState: "ready", renderState: "ready", sourceRevision: session.source.revision, stateRevision: session.revision };
    }
    if (action === "set_toolbar_visibility") { session.toolbarVisible = args.visible !== false; record(session, "set-toolbar-visibility"); return { ok: true, applied: true, toolbarVisible: session.toolbarVisible, stateRevision: session.revision }; }
    if (action === "set_display_mode") { const mode = args.displayMode ?? args.mode; if (mode !== "inline" && mode !== "fullscreen") return fail("DISPLAY_MODE_INVALID", "displayMode must be inline or fullscreen."); session.displayMode = mode; record(session, "set-display-mode", { mode }); return { ok: true, applied: true, displayMode: mode, stateRevision: session.revision }; }
    if (action === "fit_view") { const source = session.source!; session.visibleBounds = source.width && source.height ? { x: 0, y: 0, width: source.width, height: source.height } : null; record(session, "fit-view"); return { ok: true, applied: true, visibleBounds: session.visibleBounds, stateRevision: session.revision }; }
    if (action === "set_workspace_section") { session.workspaceSection = typeof args.section === "string" ? args.section : session.workspaceSection; record(session, "set-workspace-section", { section: session.workspaceSection }); return { ok: true, applied: true, workspaceSection: session.workspaceSection, stateRevision: session.revision }; }
    if (action === "set_command_search") { session.commandSearch = { visible: args.visible !== false, query: typeof args.query === "string" ? args.query : session.commandSearch.query }; record(session, "set-command-search"); return { ok: true, applied: true, commandSearch: session.commandSearch, stateRevision: session.revision }; }
    if (action === "set_search_query" || action === "set_theme") { if (typeof args.theme === "string" && (args.theme === "light" || args.theme === "dark")) session.theme = args.theme; record(session, "set-theme", { theme: session.theme }); return { ok: true, applied: true, theme: session.theme, stateRevision: session.revision }; }
    if (action === "select_region" || action === "focus_region" || action === "create_annotation") { const region: Record<string, unknown> = args.region && typeof args.region === "object" ? { ...(args.region as Record<string, unknown>) } : { x: args.x, y: args.y, width: args.width, height: args.height }; const vals = [region.x, region.y, region.width, region.height]; if (!vals.every((value) => typeof value === "number" && Number.isFinite(value)) || Number(region.width) <= 0 || Number(region.height) <= 0) return fail("REGION_INVALID", "A region requires finite base-pixel x, y, width, and height values with positive dimensions."); region.id ??= `roi-${crypto.randomUUID()}`; if (typeof args.label === "string") region.label = args.label; if (action === "focus_region") session.visibleBounds = { x: Number(region.x), y: Number(region.y), width: Number(region.width), height: Number(region.height) }; else session.selectedRegions.push(region); record(session, action === "create_annotation" ? "create-annotation" : action); return { ok: true, applied: true, selectedRegions: session.selectedRegions, visibleBounds: session.visibleBounds, stateRevision: session.revision }; }
    if (action === "update_annotation") { const id = typeof args.regionId === "string" ? args.regionId : typeof args.id === "string" ? args.id : ""; const target = session.selectedRegions.find((item) => item.id === id); if (!target) return fail("ANNOTATION_NOT_FOUND", `No annotation named ${id} is available.`); for (const key of ["x", "y", "width", "height", "label"]) if (key in args) target[key] = args[key]; record(session, "update-annotation", { id }); return { ok: true, applied: true, annotation: target, stateRevision: session.revision }; }
    if (action === "delete_annotation") { const id = typeof args.regionId === "string" ? args.regionId : typeof args.id === "string" ? args.id : ""; const before = session.selectedRegions.length; session.selectedRegions = session.selectedRegions.filter((item) => item.id !== id); if (before === session.selectedRegions.length) return fail("ANNOTATION_NOT_FOUND", `No annotation named ${id} is available.`); record(session, "delete-annotation", { id }); return { ok: true, applied: true, stateRevision: session.revision }; }
    if (action === "clear_regions") { session.selectedRegions = []; record(session, "clear-regions"); return { ok: true, applied: true, stateRevision: session.revision }; }
    if (action === "measure_region") { const region = args.region && typeof args.region === "object" ? args.region as Record<string, unknown> : session.selectedRegions.at(-1); if (!region || ![region.width, region.height].every((value) => typeof value === "number" && Number.isFinite(value))) return fail("MEASUREMENT_REGION_REQUIRED", "Select or provide a rectangular region before measuring it."); const mainImage = session.source?.metadata.main_image && typeof session.source.metadata.main_image === "object" ? session.source.metadata.main_image as Record<string, unknown> : null; const mpp = typeof session.source?.metadata.micronsPerPixel === "number" ? session.source.metadata.micronsPerPixel : typeof mainImage?.microns_per_pixel === "number" ? mainImage.microns_per_pixel : null; const measurement = { id: `measurement-${crypto.randomUUID()}`, regionId: region.id ?? null, coordinateUnit: mpp ? "micrometer" : "pixel", width: Number(region.width) * (mpp ?? 1), height: Number(region.height) * (mpp ?? 1), area: Number(region.width) * Number(region.height) * (mpp ? mpp * mpp : 1), calibrationVerified: mpp !== null }; session.measurements.push(measurement); record(session, "measure-region", { measurementId: measurement.id }); return { ok: true, applied: true, measurement, stateRevision: session.revision }; }
    if (action === "set_spatial_gene") { if (!session.source?.observations) return fail("SPATIAL_SOURCE_REQUIRED", "A spatial H5AD source is required to select a gene."); const gene = typeof args.gene === "string" ? args.gene : typeof args.symbol === "string" ? args.symbol : null; if (!gene) return fail("GENE_REQUIRED", "A gene symbol or indexed gene selection is required."); if (!["Slc17a7", "Gad1"].includes(gene)) return fail("GENE_NOT_IN_RETAINED_FIXTURE", `The retained H5AD fixture does not provide an indexed record for ${gene}.`); session.selectedGene = gene; record(session, "set-spatial-gene", { gene }); return { ok: true, applied: true, gene, stateRevision: session.revision }; }
    if (action === "set_layer_visibility") { const id = typeof args.layerId === "string" ? args.layerId : typeof args.layer === "string" ? args.layer : ""; const layer = session.layers.get(id); if (!layer) return fail("LAYER_NOT_FOUND", `No imported layer named ${id}.`); layer.visible = args.visible !== false; record(session, "set-layer-visibility", { layerId: id, visible: layer.visible }); return { ok: true, applied: true, layer, stateRevision: session.revision }; }
    if (action === "set_export_options") { session.exportOptions = { ...session.exportOptions, ...args }; record(session, "set-export-options"); return { ok: true, applied: true, exportOptions: session.exportOptions, stateRevision: session.revision }; }
    if (["save_project", "load_project", "recover_project", "resume_project_save"].includes(String(action))) return this.project(String(action), args, session, context);
    if (action === "export_view") return this.exportView(args, session, context);
    if (action === "export_microscopy_region") return fail("NATIVE_PIXEL_EXPORT_UNAVAILABLE", "Numeric microscopy-region export needs a native source reader and a current user capture; no file was written.");
    return fail("UNSUPPORTED_VIEWER_ACTION", `Slide viewer action ${String(action)} is unavailable for this local session.`);
  }

  private query(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    if (!session.source) return fail("VIEWER_NOT_OPEN", "Open a source before querying viewer state.");
    const query = args.query;
    if (query === "tile" || query === "raster_tile") {
      if (session.source.rendererMode === "coordinate-preview") return fail("TILE_SOURCE_PIXELS_UNAVAILABLE", "The retained record supplies coordinates and metadata only; it contains no original source pixels for a tile query.", { rendererMode: session.source.rendererMode, originalPixelsAvailable: false });
      if (session.source.rendererMode !== "local-canvas" && session.source.rendererMode !== "local-zarr") return fail("TILE_CODEC_UNAVAILABLE", "This source has no locally decodable pixel tile. Provide a supported uncompressed TIFF, tiny uncompressed OME-Zarr, or a host pixel codec.", { rendererMode: session.source.rendererMode });
      const tile = session.source.rendererMode === "local-zarr" ? localOmeZarrTile(session.source.path, args) : localRasterTile(session.source.path, args); if (isFailure(tile)) return tile;
      return { ok: true, mimeType: "image/png", dataUrl: `data:image/png;base64,${tile.png.toString("base64")}`, x: tile.x, y: tile.y, width: tile.width, height: tile.height, sourceWidth: session.source.width, sourceHeight: session.source.height, sourceId: session.source.id, sourceRevision: session.source.revision, provenance: session.source.rendererMode === "local-zarr" ? "Decoded directly from an authorized local uncompressed NGFF OME-Zarr chunk." : "Decoded directly from an authorized local uncompressed TIFF strip." };
    }
    if (query === "genes" || query === "gene") return { ok: true, total: 2, items: [{ symbol: "Slc17a7", column: 7717 }, { symbol: "Gad1", column: 1607 }] };
    if (query === "selected_observations") return { ok: true, total: 0, items: [] };
    if (query === "layers") return { ok: true, total: session.layers.size, items: [...session.layers.values()] };
    if (query === "project_history") return { ok: true, total: session.history.length, items: session.history.slice(-Math.min(200, typeof args.limit === "number" ? Math.max(1, args.limit) : 50)), canUndo: session.history.length > 0, canRedo: session.undone.length > 0 };
    if (query === "region_statistics") {
      const region = args.region && typeof args.region === "object" ? args.region as Record<string, unknown> : session.selectedRegions.at(-1);
      if (!region || ![region.x, region.y, region.width, region.height].every((value) => typeof value === "number")) return fail("REGION_STATISTICS_REGION_REQUIRED", "Select or provide a rectangular region before requesting region statistics.");
      const x0 = Number(region.x); const y0 = Number(region.y); const x1 = x0 + Number(region.width); const y1 = y0 + Number(region.height);
      const entitySummary = [...session.layers.values()].map((layer) => ({ layerId: layer.id, total: layer.featureCount, pointsInRegion: layer.entities.filter((entity) => {
        const geometry = entity.geometry as { type?: unknown; coordinates?: unknown } | undefined; const coordinates = geometry?.type === "Point" && Array.isArray(geometry.coordinates) ? geometry.coordinates : null;
        return coordinates && typeof coordinates[0] === "number" && typeof coordinates[1] === "number" && coordinates[0] >= x0 && coordinates[0] <= x1 && coordinates[1] >= y0 && coordinates[1] <= y1;
      }).length }));
      return { ok: true, region: { x: x0, y: y0, width: Number(region.width), height: Number(region.height), areaPixels: Number(region.width) * Number(region.height) }, layerEntityCounts: entitySummary, selectedGene: session.selectedGene, spatialExpression: session.source.observations ? { available: false, reason: "The retained spatial replay contains validated gene summaries but not per-observation values for a new region calculation." } : null, provenance: "Geometry statistics were computed from the session's imported source-aligned entities." };
    }
    return { ok: true, state: sessionState(session) };
  }

  private importLayer(args: Record<string, unknown>, context: ScienceExecutionContext, session: SlideSession): Record<string, unknown> | ScienceFailure {
    if (!session.source) return fail("VIEWER_NOT_OPEN", "Open a microscopy or spatial source before importing a scientific layer.");
    const table = args.table && typeof args.table === "object" ? args.table as Record<string, unknown> : null;
    const path = inside(args.path ?? args.layerPath ?? table?.path, context.packageRoot, context.authorizedPaths); if (typeof path !== "string") return path;
    const format = supported(path); if (format !== "geojson") return fail("SCIENTIFIC_LAYER_FORMAT_UNSUPPORTED", "This local importer supports GeoJSON entity layers. CSV/TSV and DICOM annotation indexing require the native indexed-layer host.");
    const document = readGeoJson(path); if (isFailure(document)) return document;
    const association = validateLayerAssociation(session.source, document); if (isFailure(association)) return association;
    const id = typeof args.layerId === "string" ? args.layerId : `layer-${crypto.randomUUID()}`;
    const revision = stableId(relative(context.packageRoot, path), statSync(path).size, statSync(path).mtimeMs);
    const layer: Layer = { id, revision, kind: args.entityKind === "nucleus" ? "segmentation" : "geojson", path, featureCount: document.entities.length, visible: true, authorized: true, sourceId: association.verified ? session.source.id : null, sourceRevision: association.verified ? session.source.revision : null, sourceAssociation: document.sourceAssociation, coordinateSystem: document.coordinateSystem, associationVerified: association.verified, entities: document.entities };
    session.layers.set(id, layer); record(session, "import-scientific-layer", { layerId: id, featureCount: document.entities.length });
    const job: Job = { id: `job-${crypto.randomUUID()}`, durableId: revision, kind: "scientific-layer-import", state: "completed", createdAt: new Date().toISOString(), executionSettled: true };
    session.importJobs.set(job.id, job);
    return { ok: true, jobId: job.id, job, layer, sourceRevision: session.source.revision, stateRevision: session.revision, provenance: "Feature identities, geometries, coordinate frame, and verified source association were read from the GeoJSON file." };
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
    const checked = inside(destination, context.packageRoot, context.authorizedPaths); if (typeof checked !== "string") return checked;
    if (action === "save_project" || action === "resume_project_save") {
      if (!session.source) return fail("VIEWER_NOT_OPEN", "Open a source before saving a project.");
      if (existsSync(checked)) return fail("DESTINATION_EXISTS", "Project save does not overwrite an existing file.", { path: relative(context.packageRoot, checked) });
      const payload = { schema: "dsh-rosalind-slide-project-v2", source: { path: relative(context.packageRoot, session.source.path), revision: session.source.revision }, displayMode: session.displayMode, visibleBounds: session.visibleBounds, selectedRegions: session.selectedRegions, measurements: session.measurements, history: session.history, layers: [...session.layers.values()].map((layer) => ({ id: layer.id, path: relative(context.packageRoot, layer.path), revision: layer.revision, kind: layer.kind, visible: layer.visible, sourceId: layer.sourceId, sourceRevision: layer.sourceRevision })) };
      const text = `${JSON.stringify(payload, null, 2)}\n`;
      try { writeFileSync(checked, text, { encoding: "utf8", flag: "wx" }); } catch (cause) { return fail("PROJECT_WRITE_FAILED", cause instanceof Error ? cause.message : String(cause)); }
      record(session, "save-project", { path: relative(context.packageRoot, checked) });
      return { ok: true, applied: true, path: relative(context.packageRoot, checked), bytes: statSync(checked).size, sha256: createHash("sha256").update(text).digest("hex"), stateRevision: session.revision };
    }
    if (!existsSync(checked)) return fail("PROJECT_NOT_READABLE", "The requested project file is not available.", { path: relative(context.packageRoot, checked) });
    try {
      if (statSync(checked).size > 8 * 1024 * 1024) return fail("PROJECT_TOO_LARGE", "Project JSON exceeds the 8 MiB local limit.");
      const project = JSON.parse(readFileSync(checked, "utf8")) as Record<string, unknown>;
      if (project.schema !== "dsh-rosalind-slide-project-v1" && project.schema !== "dsh-rosalind-slide-project-v2") return fail("PROJECT_FORMAT_UNSUPPORTED", "Only DSH-Rosalind slide project JSON is supported locally.");
      const source = project.source && typeof project.source === "object" ? project.source as Record<string, unknown> : null;
      if (!session.source || source?.revision !== session.source.revision) return fail("PROJECT_SOURCE_REAUTHORIZATION_REQUIRED", "Open and authorize the project's unchanged source before restoring its state.", { expectedRevision: source?.revision ?? null, currentRevision: session.source?.revision ?? null });
      session.visibleBounds = project.visibleBounds && typeof project.visibleBounds === "object" ? project.visibleBounds as SlideSession["visibleBounds"] : session.visibleBounds;
      session.selectedRegions = Array.isArray(project.selectedRegions) ? project.selectedRegions.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
      session.measurements = Array.isArray(project.measurements) ? project.measurements.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
      const restoredLayers: string[] = [];
      if (Array.isArray(project.layers)) for (const candidate of project.layers) {
        if (!candidate || typeof candidate !== "object") continue;
        const item = candidate as Record<string, unknown>; const relativePath = typeof item.path === "string" ? inside(item.path, context.packageRoot, context.authorizedPaths) : null;
        if (typeof relativePath !== "string" || !existsSync(relativePath) || supported(relativePath) !== "geojson") continue;
        const document = readGeoJson(relativePath); if (isFailure(document)) continue;
        const association = validateLayerAssociation(session.source, document); if (isFailure(association)) continue;
        const id = typeof item.id === "string" ? item.id : `layer-${crypto.randomUUID()}`;
        const revision = stableId(relative(context.packageRoot, relativePath), statSync(relativePath).size, statSync(relativePath).mtimeMs);
        session.layers.set(id, { id, revision, kind: typeof item.kind === "string" ? item.kind : "geojson", path: relativePath, featureCount: document.entities.length, visible: item.visible !== false, authorized: true, sourceId: association.verified ? session.source.id : null, sourceRevision: association.verified ? session.source.revision : null, sourceAssociation: document.sourceAssociation, coordinateSystem: document.coordinateSystem, associationVerified: association.verified, entities: document.entities }); restoredLayers.push(id);
      }
      record(session, "load-project", { path: relative(context.packageRoot, checked), restoredLayers }); return { ok: true, applied: true, restored: true, restoredLayers, stateRevision: session.revision };
    } catch (cause) { return fail("PROJECT_NOT_READABLE", cause instanceof Error ? cause.message : String(cause)); }
  }

  private exportView(args: Record<string, unknown>, session: SlideSession, context: ScienceExecutionContext): Record<string, unknown> | ScienceFailure {
    if (!session.source) return fail("VIEWER_NOT_OPEN", "Open a source before exporting a derived artifact.");
    const checked = inside(args.path ?? session.exportOptions.destinationPath, context.packageRoot, context.authorizedPaths); if (typeof checked !== "string") return checked;
    if (existsSync(checked)) return fail("DESTINATION_EXISTS", "Derived-artifact export does not overwrite an existing file.", { path: relative(context.packageRoot, checked) });
    const format = typeof args.format === "string" ? args.format : "project-json";
    let body: string | Buffer;
    if (["annotation-geojson", "annotations-geojson", "geojson"].includes(format)) {
      const features = [...session.layers.values()].flatMap((layer) => layer.entities.map((entity) => ({ type: "Feature", id: entity.id, properties: entity.properties, geometry: entity.geometry ?? null })));
      body = `${JSON.stringify({ type: "FeatureCollection", features }, null, 2)}\n`;
    } else if (["measurement-csv", "measurements-csv"].includes(format)) {
      body = `measurement_id,coordinate_unit,width,height,area,calibration_verified\n${session.measurements.map((m) => [m.id, m.coordinateUnit, m.width, m.height, m.area, m.calibrationVerified].map((value) => JSON.stringify(value ?? "")).join(",")).join("\n")}\n`;
    } else if (["project-json", "portable-project-json"].includes(format)) body = `${JSON.stringify({ schema: "dsh-rosalind-slide-project-v1", source: sourceSummary(session.source), state: sessionState(session) }, null, 2)}\n`;
    else if (format === "source-png") {
      if (session.source.rendererMode !== "local-canvas") return fail("SOURCE_PNG_CODEC_UNAVAILABLE", "Source PNG export requires a locally decodable uncompressed TIFF source; no file was written.", { rendererMode: session.source.rendererMode });
      const capture = args.capture && typeof args.capture === "object" ? args.capture as Record<string, unknown> : session.selectedRegions.at(-1);
      if (!capture) return fail("SOURCE_PNG_CAPTURE_REQUIRED", "Select a current region or provide its exact capture rectangle before exporting source samples.");
      const tile = localRasterTile(session.source.path, capture); if (isFailure(tile)) return tile;
      body = tile.png;
    } else if (format === "spatial-csv") return fail("SPATIAL_VECTOR_UNAVAILABLE", "The retained spatial replay has validated summaries only, not a source-backed per-observation vector for CSV export. No file was written.");
    else if (format === "annotation-zip") return fail("ANNOTATION_BUNDLE_CODEC_UNAVAILABLE", "The local service writes portable project JSON and GeoJSON, but does not label a non-ZIP payload as an annotation bundle.");
    else return fail("EXPORT_FORMAT_UNSUPPORTED", `The local derived exporter does not support ${format}.`);
    try { writeFileSync(checked, body, { ...(typeof body === "string" ? { encoding: "utf8" as const } : {}), flag: "wx" }); } catch (cause) { return fail("EXPORT_WRITE_FAILED", cause instanceof Error ? cause.message : String(cause)); }
    record(session, "export-view", { format, path: relative(context.packageRoot, checked) });
    const output = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    return { ok: true, applied: true, format, path: relative(context.packageRoot, checked), bytes: statSync(checked).size, sha256: createHash("sha256").update(output).digest("hex"), sourceId: session.source.id, sourceRevision: session.source.revision, stateRevision: session.revision };
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
    const path = inside(args.path ?? args.sourcePath ?? nested?.path, context.packageRoot, context.authorizedPaths); if (typeof path !== "string") return path;
    try { statSync(path); } catch { return fail("ANALYSIS_SOURCE_NOT_READABLE", "The requested analysis source is not available locally.", { path: relative(context.packageRoot, path) }); }
    const format = supported(path); if (format !== "table" && format !== "h5ad") return fail("ANALYSIS_SOURCE_FORMAT_UNSUPPORTED", "Only CSV, TSV, and H5AD analysis sources are supported by the compact local importer.");
    return { ok: true, sourceId: `analysis-${crypto.randomUUID()}`, path: relative(context.packageRoot, path), format, state: "imported", note: "The source was registered for a later explicitly configured analysis; no biology was inferred from it." };
  }

  private startJob(kind: string, _args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    if (!session.source) return fail("VIEWER_NOT_OPEN", "Open and authorize a source before starting a source-bound job.");
    const requested = typeof _args.analysis === "string" ? _args.analysis : typeof _args.workflow === "string" ? _args.workflow : (_args.request && typeof _args.request === "object" ? String((_args.request as Record<string, unknown>).kind ?? "") : "");
    const durableId = stableId(kind, session.source.revision, _args.idempotencyKey ?? _args.request ?? _args);
    if (["region-summary", "spatial-summary", "annotation-summary"].includes(requested)) {
      const result = requested === "annotation-summary"
        ? { sourceId: session.source.id, layers: [...session.layers.values()].map((layer) => ({ id: layer.id, kind: layer.kind, featureCount: layer.featureCount, visible: layer.visible })), annotationCount: session.selectedRegions.length, measurementCount: session.measurements.length, provenance: "Summary of session-authored regions and imported source-aligned layers." }
        : this.query({ query: "region_statistics", region: _args.region }, session);
      if (isFailure(result)) {
        const job: Job = { id: `job-${crypto.randomUUID()}`, durableId, kind, state: "failed", createdAt: new Date().toISOString(), executionSettled: true, reason: result.error.message };
        session.jobs.set(job.id, job); record(session, "reject-local-analysis", { requested, jobId: job.id, reason: result.error.code });
        return { ok: false, error: result.error, job, stateRevision: session.revision };
      }
      const artifact: WorkflowArtifact = { id: stableId("artifact", durableId, "result.json"), fileName: "result.json", sequence: 0, mimeType: "application/json", bytes: Buffer.byteLength(JSON.stringify(result)), content: result, provenance: "Serialized result of the local source-bound summary." };
      const job: Job = { id: `job-${crypto.randomUUID()}`, durableId, kind, state: "completed", createdAt: new Date().toISOString(), executionSettled: true, result, artifacts: [artifact] };
      session.jobs.set(job.id, job); record(session, "complete-local-analysis", { requested, jobId: job.id });
      return { ok: true, job, result, artifact, stateRevision: session.revision };
    }
    const job: Job = { id: `job-${crypto.randomUUID()}`, durableId, kind, state: "failed", createdAt: new Date().toISOString(), executionSettled: true, reason: "This requested full-assay or pathology computation requires a separately installed, explicitly authorized compute engine; no substitute computation was started." };
    session.jobs.set(job.id, job); record(session, "reject-unavailable-analysis", { requested, jobId: job.id });
    return { ok: false, error: { code: "COMPUTE_ENGINE_UNAVAILABLE", message: job.reason }, job, stateRevision: session.revision };
  }

  private readWorkflowArtifact(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const durableId = typeof args.durableId === "string" ? args.durableId : typeof args.jobId === "string" ? args.jobId : "";
    const job = session.jobs.get(durableId) ?? [...session.jobs.values()].find((candidate) => candidate.durableId === durableId);
    if (!job) return fail("WORKFLOW_NOT_FOUND", `No workflow named ${durableId} is available in this session.`);
    const artifactId = typeof args.artifactId === "string" ? args.artifactId : job.artifacts?.[0]?.id ?? "";
    const artifact = job.artifacts?.find((item) => item.id === artifactId && (typeof args.sequence !== "number" || item.sequence === args.sequence));
    if (!artifact) return fail("WORKFLOW_ARTIFACT_UNAVAILABLE", "The requested artifact was not produced by this completed local workflow.", { durableId: job.durableId, artifactId, state: job.state });
    return { ok: true, job, artifact, result: artifact.content, provenance: artifact.provenance };
  }

  private resumeJob(args: Record<string, unknown>, session: SlideSession): Record<string, unknown> | ScienceFailure {
    const durableId = typeof args.durableId === "string" ? args.durableId : typeof args.jobId === "string" ? args.jobId : "";
    const job = session.jobs.get(durableId) ?? [...session.jobs.values()].find((candidate) => candidate.durableId === durableId);
    if (!job) return fail("WORKFLOW_NOT_FOUND", `No workflow named ${durableId} is available in this session.`);
    if (job.state === "completed" && job.artifacts?.length) return { ok: true, resumed: false, reused: true, job, artifact: job.artifacts[0], note: "The local workflow was already completed; its verified retained result was reused without starting new computation." };
    return fail("COMPUTE_ENGINE_UNAVAILABLE", "This workflow has no resumable local checkpoint. No computation was restarted.", { durableId: job.durableId, state: job.state });
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
