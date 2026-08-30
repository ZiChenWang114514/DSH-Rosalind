import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import { createServer } from "node:http";

import { describe, expect, it } from "vitest";
import { validateJsonSchemaValue } from "@deepseek-ai/dsh-tools";

import { CapabilityRegistry } from "../src/host/capabilities.js";
import { createScienceGatewayTools } from "../src/host/science-gateway-tools.js";
import { SlideService } from "../src/host/science/slide.js";
import { ScienceRuntime } from "../src/host/science/runtime.js";
import { createScienceTools } from "../src/host/science-tools.js";

const packageRoot = process.cwd();
const context = (session: object) => ({ session, packageRoot, signal: new AbortController().signal });

function rgbTiff(width: number, height: number): Buffer {
  const tags = 10; const ifdOffset = 8; const pixelsOffset = ifdOffset + 2 + tags * 12 + 4; const pixels = Buffer.alloc(width * height * 3);
  for (let row = 0; row < height; row += 1) for (let column = 0; column < width; column += 1) { const at = (row * width + column) * 3; pixels[at] = column * 30; pixels[at + 1] = row * 40; pixels[at + 2] = 160; }
  const body = Buffer.alloc(pixelsOffset + pixels.length); body.write("II", 0, "ascii"); body.writeUInt16LE(42, 2); body.writeUInt32LE(ifdOffset, 4); body.writeUInt16LE(tags, ifdOffset);
  const put = (index: number, tag: number, type: number, count: number, value: number) => { const at = ifdOffset + 2 + index * 12; body.writeUInt16LE(tag, at); body.writeUInt16LE(type, at + 2); body.writeUInt32LE(count, at + 4); if (type === 3) body.writeUInt16LE(value, at + 8); else body.writeUInt32LE(value, at + 8); };
  put(0, 256, 4, 1, width); put(1, 257, 4, 1, height); put(2, 258, 3, 1, 8); put(3, 259, 3, 1, 1); put(4, 262, 3, 1, 2); put(5, 273, 4, 1, pixelsOffset); put(6, 277, 3, 1, 3); put(7, 278, 4, 1, height); put(8, 279, 4, 1, pixels.length); put(9, 284, 3, 1, 1); body.writeUInt32LE(0, ifdOffset + 2 + tags * 12); pixels.copy(body, pixelsOffset); return body;
}

function tiledRgbTiff(width: number, height: number, tileWidth = 4, tileHeight = 4): Buffer {
  const tags = 11; const ifdOffset = 8; const arrayOffset = ifdOffset + 2 + tags * 12 + 4; const tilesAcross = Math.ceil(width / tileWidth); const tilesDown = Math.ceil(height / tileHeight); const tileCount = tilesAcross * tilesDown; const countsOffset = arrayOffset + tileCount * 4; const pixelsOffset = countsOffset + tileCount * 4; const tileBytes = tileWidth * tileHeight * 3;
  const body = Buffer.alloc(pixelsOffset + tileCount * tileBytes); body.write("II", 0, "ascii"); body.writeUInt16LE(42, 2); body.writeUInt32LE(ifdOffset, 4); body.writeUInt16LE(tags, ifdOffset);
  const put = (index: number, tag: number, type: number, count: number, value: number) => { const at = ifdOffset + 2 + index * 12; body.writeUInt16LE(tag, at); body.writeUInt16LE(type, at + 2); body.writeUInt32LE(count, at + 4); if (type === 3) body.writeUInt16LE(value, at + 8); else body.writeUInt32LE(value, at + 8); };
  put(0, 256, 4, 1, width); put(1, 257, 4, 1, height); put(2, 258, 3, 1, 8); put(3, 259, 3, 1, 1); put(4, 262, 3, 1, 2); put(5, 277, 3, 1, 3); put(6, 284, 3, 1, 1); put(7, 322, 4, 1, tileWidth); put(8, 323, 4, 1, tileHeight); put(9, 324, 4, tileCount, arrayOffset); put(10, 325, 4, tileCount, countsOffset); body.writeUInt32LE(0, ifdOffset + 2 + tags * 12);
  for (let tile = 0; tile < tileCount; tile += 1) {
    const offset = pixelsOffset + tile * tileBytes; body.writeUInt32LE(offset, arrayOffset + tile * 4); body.writeUInt32LE(tileBytes, countsOffset + tile * 4);
    const tileX = (tile % tilesAcross) * tileWidth; const tileY = Math.floor(tile / tilesAcross) * tileHeight;
    for (let row = 0; row < tileHeight; row += 1) for (let column = 0; column < tileWidth; column += 1) { const at = offset + (row * tileWidth + column) * 3; body[at] = (tileX + column) * 20; body[at + 1] = (tileY + row) * 25; body[at + 2] = 90 + tile * 10; }
  }
  return body;
}

function grayTiff(width: number, height: number, photometric: 0 | 1): Buffer {
  const tags = 10; const ifdOffset = 8; const pixelsOffset = ifdOffset + 2 + tags * 12 + 4; const pixels = Buffer.from([0, 32, 96, 255].slice(0, width * height)); const body = Buffer.alloc(pixelsOffset + pixels.length); body.write("II", 0, "ascii"); body.writeUInt16LE(42, 2); body.writeUInt32LE(ifdOffset, 4); body.writeUInt16LE(tags, ifdOffset);
  const put = (index: number, tag: number, type: number, count: number, value: number) => { const at = ifdOffset + 2 + index * 12; body.writeUInt16LE(tag, at); body.writeUInt16LE(type, at + 2); body.writeUInt32LE(count, at + 4); if (type === 3) body.writeUInt16LE(value, at + 8); else body.writeUInt32LE(value, at + 8); };
  put(0, 256, 4, 1, width); put(1, 257, 4, 1, height); put(2, 258, 3, 1, 8); put(3, 259, 3, 1, 1); put(4, 262, 3, 1, photometric); put(5, 273, 4, 1, pixelsOffset); put(6, 277, 3, 1, 1); put(7, 278, 4, 1, height); put(8, 279, 4, 1, pixels.length); put(9, 284, 3, 1, 1); body.writeUInt32LE(0, ifdOffset + 2 + tags * 12); pixels.copy(body, pixelsOffset); return body;
}

function pngRaw(dataUrl: string): Buffer {
  const png = Buffer.from(dataUrl.split(",")[1]!, "base64"); let offset = 8; const chunks: Buffer[] = [];
  while (offset < png.length) { const length = png.readUInt32BE(offset); const type = png.toString("ascii", offset + 4, offset + 8); if (type === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length)); offset += 12 + length; }
  return inflateSync(Buffer.concat(chunks));
}

function explicitVrElement(group: number, element: number, vr: string, value: Buffer): Buffer {
  const header = Buffer.alloc(["OB", "OD", "OF", "OL", "OW", "SQ", "UC", "UR", "UT", "UN"].includes(vr) ? 12 : 8);
  header.writeUInt16LE(group, 0); header.writeUInt16LE(element, 2); header.write(vr, 4, "ascii");
  if (header.length === 12) header.writeUInt32LE(value.length, 8); else header.writeUInt16LE(value.length, 6);
  return Buffer.concat([header, value]);
}

function ui(value: string): Buffer { const raw = Buffer.from(`${value}\0`, "ascii"); return raw.length % 2 ? Buffer.concat([raw, Buffer.from([0])]) : raw; }
function us(value: number): Buffer { const raw = Buffer.alloc(2); raw.writeUInt16LE(value); return raw; }

function dicomPart10(study: string, series: string, sop: string, width = 4, height = 3): Buffer {
  const preamble = Buffer.alloc(128); const meta = explicitVrElement(0x0002, 0x0010, "UI", ui("1.2.840.10008.1.2.1"));
  const data = Buffer.concat([
    explicitVrElement(0x0008, 0x0018, "UI", ui(sop)), explicitVrElement(0x0020, 0x000d, "UI", ui(study)), explicitVrElement(0x0020, 0x000e, "UI", ui(series)),
    explicitVrElement(0x0028, 0x0010, "US", us(height)), explicitVrElement(0x0028, 0x0011, "US", us(width)),
  ]);
  return Buffer.concat([preamble, Buffer.from("DICM"), meta, data]);
}

function dicomSemanticPart10(study: string, series: string, sop: string, modality: "ANN" | "SR" | "SEG" | "PM"): Buffer {
  const preamble = Buffer.alloc(128); const meta = explicitVrElement(0x0002, 0x0010, "UI", ui("1.2.840.10008.1.2.1"));
  const sopClass = modality === "ANN" ? "1.2.840.10008.5.1.4.1.1.91.1" : modality === "SR" ? "1.2.840.10008.5.1.4.1.1.88.34" : modality === "SEG" ? "1.2.840.10008.5.1.4.1.1.66.4" : "1.2.840.10008.5.1.4.1.1.30";
  const text = (value: string) => { const bytes = Buffer.from(value, "ascii"); return bytes.length % 2 ? Buffer.concat([bytes, Buffer.from([0x20])]) : bytes; };
  return Buffer.concat([preamble, Buffer.from("DICM"), meta,
    explicitVrElement(0x0008, 0x0016, "UI", ui(sopClass)), explicitVrElement(0x0008, 0x0018, "UI", ui(sop)), explicitVrElement(0x0008, 0x0060, "CS", text(modality)), explicitVrElement(0x0008, 0x103e, "LO", text("local semantic fixture")),
    explicitVrElement(0x0020, 0x000d, "UI", ui(study)), explicitVrElement(0x0020, 0x000e, "UI", ui(series))]);
}

describe("SlideService local Canvas renderer", () => {
  it("reads actual local TIFF samples, exports a source PNG, and records ROI history", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-runtime-"));
    try {
      const tiff = join(temp, "source.tiff"); const png = join(temp, "roi.png"); const geojson = join(temp, "regions.geojson"); const project = join(temp, "project.json");
      writeFileSync(tiff, rgbTiff(8, 6));
      writeFileSync(geojson, JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", id: "p1", properties: { kind: "spot" }, geometry: { type: "Point", coordinates: [2, 2] } }, { type: "Feature", id: "p2", properties: { kind: "spot" }, geometry: { type: "Point", coordinates: [7, 5] } }] }));
      const service = new SlideService(); const session = {}; const ctx = context(session);
      const opened = await service.execute("slide.open_from_chat", { path: tiff }, ctx) as Record<string, unknown>; const sessionId = String(opened.viewerSessionId);
      expect(opened).toMatchObject({ ok: true, viewerReady: false, viewerState: "awaiting-viewer", renderState: "awaiting-viewer", source: { format: "tiff", renderAvailable: true, rendererMode: "local-canvas", width: 8, height: 6 } });
      const tile = await service.execute("slide.query_viewer", { sessionId, query: "tile", x: 1, y: 1, width: 4, height: 3 }, ctx) as Record<string, unknown>;
      expect(tile).toMatchObject({ ok: true, mimeType: "image/png", width: 4, height: 3 });
      expect(Buffer.from(String(tile.dataUrl).split(",")[1]!, "base64").subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
      await service.execute("slide.control_viewer", { sessionId, action: "create_annotation", region: { x: 1, y: 1, width: 4, height: 3 }, label: "tumour-adjacent" }, ctx);
      const imported = await service.execute("slide.import_scientific_layer", { sessionId, path: geojson, layerId: "spots" }, ctx) as Record<string, unknown>;
      expect(imported).toMatchObject({ ok: true, layer: { featureCount: 2 } });
      const stats = await service.execute("slide.query_viewer", { sessionId, query: "region_statistics" }, ctx) as Record<string, unknown>;
      expect(stats).toMatchObject({ ok: true, region: { areaPixels: 12 }, layerEntityCounts: [{ layerId: "spots", pointsInRegion: 1 }] });
      const exported = await service.execute("slide.control_viewer", { sessionId, action: "export_view", format: "source-png", path: png }, ctx) as Record<string, unknown>;
      expect(exported).toMatchObject({ ok: true, format: "source-png", bytes: expect.any(Number), sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
      expect(readFileSync(png).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
      expect(await service.execute("slide.control_viewer", { sessionId, action: "save_project", path: project }, ctx)).toMatchObject({ ok: true, applied: true });
      const state = await service.execute("slide.get_viewer_state", { sessionId }, ctx) as Record<string, unknown>;
      expect(state).toMatchObject({ projectHistory: { canUndo: true, items: expect.any(Array) } });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("does not invent PNG samples for compressed TIFF sources", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-runtime-"));
    try {
      const tiff = join(temp, "source.tiff"); const png = join(temp, "roi.png"); const source = rgbTiff(4, 4); source.writeUInt16LE(7, 8 + 2 + 3 * 12 + 8); writeFileSync(tiff, source);
      const service = new SlideService(); const session = {}; const ctx = context(session); const opened = await service.execute("slide.open_from_chat", { path: tiff }, ctx) as Record<string, unknown>; const sessionId = String(opened.viewerSessionId);
      expect(opened).toMatchObject({ ok: true, viewerReady: false, source: { rendererMode: "metadata" } });
      expect(await service.execute("slide.control_viewer", { sessionId, action: "export_view", format: "source-png", path: png }, ctx)).toMatchObject({ ok: false, error: { code: "SOURCE_PNG_CODEC_UNAVAILABLE" } });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("reads a local tiled TIFF across tile seams", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-runtime-"));
    try {
      const tiff = join(temp, "tiled.tiff"); writeFileSync(tiff, tiledRgbTiff(7, 6));
      const service = new SlideService(); const session = {}; const ctx = context(session); const opened = await service.execute("slide.open_from_chat", { path: tiff }, ctx) as Record<string, unknown>; const sessionId = String(opened.viewerSessionId);
      expect(opened).toMatchObject({ ok: true, viewerReady: false, source: { rendererMode: "local-canvas", width: 7, height: 6 } });
      const tile = await service.execute("slide.query_viewer", { sessionId, query: "tile", x: 3, y: 2, width: 3, height: 3 }, ctx) as Record<string, unknown>;
      expect(tile).toMatchObject({ ok: true, width: 3, height: 3, mimeType: "image/png" });
      expect(Buffer.from(String(tile.dataUrl).split(",")[1]!, "base64").subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("keeps wait_for_render revision-exact and pending without a host frame acknowledgement", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-runtime-"));
    try {
      const tiff = join(temp, "source.tiff"); writeFileSync(tiff, rgbTiff(4, 4)); const service = new SlideService(); const session = {}; const ctx = context(session);
      const opened = await service.execute("slide.open_from_chat", { path: tiff }, ctx) as Record<string, unknown>; const sessionId = String(opened.viewerSessionId); const revision = Number(opened.stateRevision);
      expect(await service.execute("slide.wait_for_render", { sessionId }, ctx)).toMatchObject({ ok: false, error: { code: "RENDER_STATE_REVISION_REQUIRED" } });
      expect(await service.execute("slide.wait_for_render", { sessionId, stateRevision: revision - 1 }, ctx)).toMatchObject({ ok: false, error: { code: "RENDER_STATE_SUPERSEDED" }, renderState: "superseded" });
      expect(await service.execute("slide.wait_for_render", { sessionId, stateRevision: revision + 1 }, ctx)).toMatchObject({ ok: false, error: { code: "RENDER_STATE_UNKNOWN" } });
      expect(await service.execute("slide.wait_for_render", { sessionId, stateRevision: revision }, ctx)).toMatchObject({ ok: true, viewerReady: false, renderState: "pending", pending: true, timedOut: false });
      expect(await service.execute("slide.wait_for_render", { sessionId, stateRevision: revision, timeoutMs: 0 }, ctx)).toMatchObject({ ok: true, viewerReady: false, renderState: "timeout", pending: true, timedOut: true });
      await service.execute("slide.control_viewer", { sessionId, action: "set_toolbar_visibility", visible: false }, ctx);
      expect(await service.execute("slide.wait_for_render", { sessionId, stateRevision: revision }, ctx)).toMatchObject({ ok: false, error: { code: "RENDER_STATE_SUPERSEDED" }, renderState: "superseded" });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("supports BlackIsZero and WhiteIsZero grayscale while rejecting palette and planar RGB", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-runtime-"));
    try {
      const black = join(temp, "black.tiff"); const white = join(temp, "white.tiff"); const palette = join(temp, "palette.tiff"); const planar = join(temp, "planar.tiff"); writeFileSync(black, grayTiff(2, 2, 1)); writeFileSync(white, grayTiff(2, 2, 0)); const paletteBytes = grayTiff(2, 2, 1); paletteBytes.writeUInt16LE(3, 8 + 2 + 4 * 12 + 8); writeFileSync(palette, paletteBytes); const planarBytes = rgbTiff(2, 2); planarBytes.writeUInt16LE(2, 8 + 2 + 9 * 12 + 8); writeFileSync(planar, planarBytes);
      const service = new SlideService(); const session = {}; const ctx = context(session); const blackOpen = await service.execute("slide.open_from_chat", { path: black }, ctx) as Record<string, unknown>; const blackTile = await service.execute("slide.query_viewer", { sessionId: blackOpen.viewerSessionId, query: "tile", width: 2, height: 2 }, ctx) as Record<string, unknown>; expect(pngRaw(String(blackTile.dataUrl)).subarray(0, 5)).toEqual(Buffer.from([0, 0, 32, 0, 96]));
      const whiteOpen = await service.execute("slide.open_from_chat", { path: white }, ctx) as Record<string, unknown>; const whiteTile = await service.execute("slide.query_viewer", { sessionId: whiteOpen.viewerSessionId, query: "tile", width: 2, height: 2 }, ctx) as Record<string, unknown>; expect(pngRaw(String(whiteTile.dataUrl)).subarray(0, 5)).toEqual(Buffer.from([0, 255, 223, 0, 159]));
      expect(await service.execute("slide.open_from_chat", { path: palette }, ctx)).toMatchObject({ ok: true, source: { rendererMode: "metadata", metadata: { pixelDiagnostic: { code: "TIFF_PHOTOMETRIC_UNSUPPORTED" } } } });
      expect(await service.execute("slide.open_from_chat", { path: planar }, ctx)).toMatchObject({ ok: true, source: { rendererMode: "metadata", metadata: { pixelDiagnostic: { code: "TIFF_PLANAR_CONFIGURATION_UNSUPPORTED" } } } });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("opens a real local DICOM Part-10 series and rejects mismatched identities", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-dicom-"));
    try {
      const a = join(temp, "level-0.dcm"); const b = join(temp, "level-1.dcm"); const mismatch = join(temp, "other.dcm");
      writeFileSync(a, dicomPart10("1.2.3", "1.2.3.4", "1.2.3.4.1")); writeFileSync(b, dicomPart10("1.2.3", "1.2.3.4", "1.2.3.4.2")); writeFileSync(mismatch, dicomPart10("1.2.99", "1.2.3.4", "1.2.3.4.3"));
      const service = new SlideService(); const session = {}; const ctx = context(session);
      const opened = await service.execute("slide.open_dicom_series", { paths: [a, b] }, ctx) as Record<string, unknown>;
      expect(opened).toMatchObject({ ok: true, viewerReady: false, source: { format: "dicom", width: 4, height: 3, metadata: { studyInstanceUid: "1.2.3", seriesInstanceUid: "1.2.3.4", instances: [{ sopInstanceUid: "1.2.3.4.1" }, { sopInstanceUid: "1.2.3.4.2" }] } } });
      expect(await service.execute("slide.query_viewer", { sessionId: opened.viewerSessionId, query: "tile", width: 1, height: 1 }, ctx)).toMatchObject({ ok: false, error: { code: "TILE_CODEC_UNAVAILABLE" } });
      expect(await new SlideService().execute("slide.open_dicom_series", { paths: [a, mismatch] }, context({}))).toMatchObject({ ok: false, error: { code: "DICOM_SERIES_IDENTITY_MISMATCH" } });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("decodes a real tiny local OME-Zarr fixture and keeps unsupported layouts explicit", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-zarr-"));
    try {
      const zarr = join(temp, "tiny.zarr"); mkdirSync(join(zarr, "0"), { recursive: true });
      writeFileSync(join(zarr, ".zattrs"), JSON.stringify({ multiscales: [{ version: "0.4", datasets: [{ path: "0" }] }] }));
      writeFileSync(join(zarr, "0", ".zarray"), JSON.stringify({ zarr_format: 2, shape: [2, 3], chunks: [2, 3], dtype: "|u1", compressor: null, filters: null, order: "C" }));
      writeFileSync(join(zarr, "0", "0.0"), Buffer.from([1, 2, 3, 4, 5, 6]));
      const service = new SlideService(); const session = {}; const ctx = context(session); const opened = await service.execute("slide.open_ome_zarr", { path: zarr }, ctx) as Record<string, unknown>;
      expect(opened).toMatchObject({ ok: true, source: { format: "ome-zarr", rendererMode: "local-zarr", renderAvailable: true, width: 3, height: 2, previewTile: { mimeType: "image/png" } } });
      const tile = await service.execute("slide.query_viewer", { sessionId: opened.viewerSessionId, query: "tile", x: 1, y: 0, width: 2, height: 2 }, ctx) as Record<string, unknown>;
      expect(pngRaw(String(tile.dataUrl)).subarray(0, 6)).toEqual(Buffer.from([0, 2, 3, 0, 5, 6]));
      writeFileSync(join(zarr, "0", ".zarray"), JSON.stringify({ zarr_format: 2, shape: [1, 2, 3], chunks: [1, 2, 3], dtype: "|u1", compressor: null, filters: null, order: "C" }));
      expect(await new SlideService().execute("slide.open_ome_zarr", { path: zarr }, context({}))).toMatchObject({ ok: false, error: { code: "OME_ZARR_LAYOUT_UNSUPPORTED" } });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("uses an explicit loopback DICOMweb mock without attempting remote transport", async () => {
    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/dicom+json");
      if (request.url === "/instances") response.end(JSON.stringify([{ sopInstanceUid: "1.2.3.4.5", rows: 3, columns: 4 }]));
      else response.end(JSON.stringify({ sopInstanceUid: "1.2.3.4.5", rows: 3, columns: 4 }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port; const baseUrl = `http://127.0.0.1:${port}`;
    try {
      const service = new SlideService(); const session = {}; const ctx = context(session); const location = { studyInstanceUid: "1.2.3", seriesInstanceUid: "1.2.3.4", sopInstanceUid: "1.2.3.4.5" };
      const opened = await service.execute("slide.open_dicomweb_wsi", { baseUrl, allowLocalMock: true, location }, ctx) as Record<string, unknown>;
      expect(opened).toMatchObject({ ok: true, source: { format: "dicomweb", width: 4, height: 3, metadata: { inspection: "loopback-dicomweb-mock" } } });
      expect(await service.execute("slide.query_dicomweb", { sessionId: opened.viewerSessionId, baseUrl, allowLocalMock: true, location }, ctx)).toMatchObject({ ok: true, total: 1, items: [{ sopInstanceUid: "1.2.3.4.5" }] });
      expect(await service.execute("slide.query_dicomweb", { sessionId: opened.viewerSessionId, baseUrl: "https://example.invalid", location }, ctx)).toMatchObject({ ok: false, error: { code: "DICOMWEB_TRANSPORT_UNAVAILABLE" } });
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });

  it("imports and exports actual bounded local DICOM semantic-object identities", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-semantic-"));
    try {
      const tiff = join(temp, "source.tiff"); const source = join(temp, "annotation.dcm"); const output = join(temp, "annotation-export.dcm"); writeFileSync(tiff, rgbTiff(3, 3)); writeFileSync(source, dicomSemanticPart10("1.2.3", "1.2.3.4", "1.2.3.4.5", "ANN"));
      const service = new SlideService(); const session = {}; const ctx = context(session); const opened = await service.execute("slide.open_from_chat", { path: tiff }, ctx) as Record<string, unknown>;
      const imported = await service.execute("slide.import_dicom_object", { sessionId: opened.viewerSessionId, path: source }, ctx) as Record<string, unknown>;
      expect(imported).toMatchObject({ ok: true, imported: true, layer: { kind: "dicom-annotation", featureCount: 0 }, dicomObject: { modality: "ANN", semanticContent: "metadata-only" } });
      const exported = await service.execute("slide.export_dicom_object", { sessionId: opened.viewerSessionId, path: source, outputPath: output }, ctx) as Record<string, unknown>;
      expect(exported).toMatchObject({ ok: true, exported: true, bytes: expect.any(Number), dicomObject: { modality: "ANN", studyInstanceUid: "1.2.3", semanticContent: "metadata-only" } });
      expect(readFileSync(output).toString("ascii", 128, 132)).toBe("DICM");
      expect((exported.dicomObject as Record<string, unknown>).seriesInstanceUid).not.toBe("1.2.3.4");
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("executes one-time DICOMweb loopback upload preparation and submission without remote transport", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-upload-")); let received = 0;
    const server = createServer((request, response) => { if (request.method !== "POST") { response.statusCode = 405; response.end(); return; } request.on("data", (chunk) => { received += Buffer.byteLength(chunk); }); request.on("end", () => { response.statusCode = 200; response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ accepted: 1 })); }); });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const port = (server.address() as { port: number }).port;
    try {
      const source = join(temp, "annotation.dcm"); writeFileSync(source, dicomSemanticPart10("1.2.3", "1.2.3.4", "1.2.3.4.5", "ANN"));
      const service = new SlideService(); const session = {}; const ctx = context(session); const open = await service.execute("slide.open_dicom_series", { paths: [source] }, ctx) as Record<string, unknown>;
      const prepared = await service.execute("slide.prepare_dicom_upload", { sessionId: open.viewerSessionId, endpoint: `http://127.0.0.1:${port}/studies`, paths: [source] }, ctx) as Record<string, unknown>;
      expect(prepared).toMatchObject({ ok: true, prepared: true, localMock: true, preparedOperation: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
      const submitted = await service.execute("slide.submit_dicom_upload", { sessionId: open.viewerSessionId, preparedOperation: prepared.preparedOperation }, ctx) as Record<string, unknown>;
      expect(submitted).toMatchObject({ ok: true, submitted: true, localMock: true, instanceCount: 1 }); expect(received).toBeGreaterThan(132);
      expect(await service.execute("slide.submit_dicom_upload", { sessionId: open.viewerSessionId, preparedOperation: prepared.preparedOperation }, ctx)).toMatchObject({ ok: false, error: { code: "DICOM_UPLOAD_GRANT_NOT_FOUND" } });
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); rmSync(temp, { recursive: true, force: true }); }
  });

  it("reuses completed pathology summaries and exposes both retained artifact endpoints", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-pathology-"));
    try {
      const tiff = join(temp, "source.tiff"); writeFileSync(tiff, rgbTiff(2, 2)); const service = new SlideService(); const session = {}; const ctx = context(session); const opened = await service.execute("slide.open_from_chat", { path: tiff }, ctx) as Record<string, unknown>; const sessionId = String(opened.viewerSessionId);
      const job = await service.execute("slide.run_pathology", { sessionId, request: { kind: "annotation-summary" } }, ctx) as Record<string, unknown>; const durableId = String((job.job as Record<string, unknown>).durableId);
      const artifactId = String((job.artifact as Record<string, unknown>).id);
      expect(job).toMatchObject({ ok: true, job: { state: "completed" }, artifact: { id: expect.stringMatching(/^[a-f0-9]{64}$/), fileName: "result.json" } });
      expect(await service.execute("slide.read_live_workflow_artifact", { sessionId, durableId, artifactId, sequence: 0 }, ctx)).toMatchObject({ ok: true, artifact: { id: artifactId, fileName: "result.json" } });
      expect(await service.execute("slide.read_workflow_artifact", { sessionId, durableId, artifactId, sequence: 0 }, ctx)).toMatchObject({ ok: true, artifact: { id: artifactId, fileName: "result.json" } });
      expect(await service.execute("slide.resume_pathology", { sessionId, durableId }, ctx)).toMatchObject({ ok: true, reused: true, resumed: false });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("retains a source-bound local workflow result as a readable artifact and can acknowledge a matching Canvas frame", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-workflow-"));
    try {
      const tiff = join(temp, "source.tiff"); writeFileSync(tiff, rgbTiff(4, 4)); const service = new SlideService(); const session = {}; const ctx = context(session);
      const opened = await service.execute("slide.open_from_chat", { path: tiff }, ctx) as Record<string, unknown>; const sessionId = String(opened.viewerSessionId);
      expect((opened.source as Record<string, unknown>).previewTile).toMatchObject({ mimeType: "image/png", sourceRevision: opened.sourceRevision });
      const started = await service.execute("slide.run_workflow", { sessionId, request: { kind: "annotation-summary" } }, ctx) as Record<string, unknown>; const job = started.job as { durableId: string };
      expect(await service.execute("slide.read_workflow_artifact", { sessionId, durableId: job.durableId, artifactId: (started.artifact as { id: string }).id, sequence: 0 }, ctx)).toMatchObject({ ok: true, artifact: { id: expect.stringMatching(/^[a-f0-9]{64}$/), fileName: "result.json", mimeType: "application/json" } });
      expect(await service.execute("slide.resume_workflow", { sessionId, durableId: job.durableId }, ctx)).toMatchObject({ ok: true, reused: true, resumed: false });
      expect(await service.execute("slide.control_viewer", { sessionId, action: "acknowledge_render", sourceRevision: "stale" }, ctx)).toMatchObject({ ok: false, error: { code: "RENDER_ACKNOWLEDGEMENT_STALE" } });
      const acknowledged = await service.execute("slide.control_viewer", { sessionId, action: "acknowledge_render", sourceRevision: opened.sourceRevision }, ctx) as Record<string, unknown>;
      expect(acknowledged).toMatchObject({ ok: true, viewerReady: true, renderState: "ready" });
      const state = await service.execute("slide.get_viewer_state", { sessionId }, ctx) as Record<string, unknown>;
      expect(state).toMatchObject({ viewerReady: true, renderer: { mounted: true, ready: true }, previewTile: { mimeType: "image/png" } });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("keeps project history and render diagnostics inside the strict Slide ToolRuntime schema", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-runtime-"));
    try {
      const tiff = join(temp, "source.tiff"); writeFileSync(tiff, rgbTiff(2, 2)); const registry = new CapabilityRegistry(); const runtime = new ScienceRuntime(); const session = {}; const runtimeContext = { session, packageRoot: registry.packageRoot, signal: new AbortController().signal };
      const opened = await runtime.execute("slide", "open_from_chat", { path: tiff }, runtimeContext); const sessionId = String(opened.viewerSessionId); const state = await runtime.execute("slide", "get_viewer_state", { sessionId }, runtimeContext); const wait = await runtime.execute("slide", "wait_for_render", { sessionId, stateRevision: state.stateRevision }, runtimeContext); const workflow = await runtime.execute("slide", "run_workflow", { sessionId, request: { kind: "annotation-summary" } }, runtimeContext); const artifact = await runtime.execute("slide", "read_workflow_artifact", { sessionId, durableId: (workflow.job as { durableId: string }).durableId, artifactId: (workflow.artifact as { id: string }).id, sequence: 0 }, runtimeContext);
      const tools = createScienceTools(runtime, registry); const stateTool = tools.find((tool) => tool.name === "slide_get_viewer_state")!; const waitTool = tools.find((tool) => tool.name === "slide_wait_for_render")!; const artifactTool = tools.find((tool) => tool.name === "slide_read_workflow_artifact")!;
      // ScienceRuntime receives the local operation suffix; ToolRuntime normalizes it
      // to the registered fixed-contract operation name before schema validation.
      expect(validateJsonSchemaValue(stateTool.output.schema, { ...state, operation: "slide.get_viewer_state" }, "state")).toEqual([]);
      expect(validateJsonSchemaValue(waitTool.output.schema, { ...wait, operation: "slide.wait_for_render" }, "wait")).toEqual([]);
      expect(validateJsonSchemaValue(artifactTool.output.schema, { ...artifact, operation: "slide.read_workflow_artifact" }, "artifact")).toEqual([]);
      expect(state).toMatchObject({ projectHistory: expect.any(Object), viewerReady: false, viewerState: "awaiting-viewer", renderer: { decoderAvailable: true, mounted: false } });
      expect(wait).toMatchObject({ pending: true, timedOut: false, renderState: "pending" });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });

  it("keeps local DICOM semantic and loopback-upload receipts inside their operation output schemas", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-toolruntime-dicom-")); const registry = new CapabilityRegistry(); const runtime = new ScienceRuntime(); const session = {}; const ctx = { session, packageRoot: registry.packageRoot, signal: new AbortController().signal };
    const server = createServer((request, response) => { request.resume(); request.on("end", () => response.end("ok")); }); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const port = (server.address() as { port: number }).port;
    try {
      const tiff = join(temp, "source.tiff"); const object = join(temp, "annotation.dcm"); const output = join(temp, "copy.dcm"); writeFileSync(tiff, rgbTiff(2, 2)); writeFileSync(object, dicomSemanticPart10("1.2.3", "1.2.3.4", "1.2.3.4.5", "ANN"));
      const opened = await runtime.execute("slide", "open_from_chat", { path: tiff }, ctx); const sessionId = String(opened.viewerSessionId);
      const imported = await runtime.execute("slide", "import_dicom_object", { sessionId, path: object }, ctx); const exported = await runtime.execute("slide", "export_dicom_object", { sessionId, path: object, outputPath: output }, ctx);
      const prepared = await runtime.execute("slide", "prepare_dicom_upload", { sessionId, endpoint: `http://127.0.0.1:${port}/studies`, paths: [object] }, ctx); const submitted = await runtime.execute("slide", "submit_dicom_upload", { sessionId, preparedOperation: prepared.preparedOperation }, ctx);
      const tools = createScienceTools(runtime, registry);
      for (const [operation, result] of [["slide.import_dicom_object", imported], ["slide.export_dicom_object", exported], ["slide.prepare_dicom_upload", prepared], ["slide.submit_dicom_upload", submitted]] as const) {
        const tool = tools.find((candidate) => candidate.name === operation.replace(".", "_"))!;
        expect(validateJsonSchemaValue(tool.output.schema, { ...result, operation }, operation)).toEqual([]);
      }
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); rmSync(temp, { recursive: true, force: true }); }
  });

  it("executes every formerly-unverified Slide operation by its registered ToolRuntime name", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-registered-")); const registry = new CapabilityRegistry(); const runtime = new ScienceRuntime(); const agent = {}; const signal = new AbortController().signal;
    const server = createServer((request, response) => {
      if (request.method === "POST") { request.resume(); request.on("end", () => response.end("accepted")); return; }
      response.setHeader("content-type", "application/dicom+json");
      if (request.url === "/instances") response.end(JSON.stringify([{ sopInstanceUid: "1.2.3.4.5", rows: 2, columns: 2 }]));
      else response.end(JSON.stringify({ sopInstanceUid: "1.2.3.4.5", rows: 2, columns: 2 }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`; const priorLocalMock = process.env.DSH_ROSALIND_LOCAL_DICOMWEB_MOCK; process.env.DSH_ROSALIND_LOCAL_DICOMWEB_MOCK = "1";
    try {
      const tiff = join(temp, "source.tiff"); const dicom = join(temp, "wsi.dcm"); const semantic = join(temp, "annotation.dcm"); const output = join(temp, "annotation-copy.dcm"); const zarr = join(temp, "tiny.zarr");
      writeFileSync(tiff, rgbTiff(2, 2)); writeFileSync(dicom, dicomPart10("1.2.3", "1.2.3.4", "1.2.3.4.5", 2, 2)); writeFileSync(semantic, dicomSemanticPart10("1.2.3", "1.2.3.4", "1.2.3.4.6", "ANN")); mkdirSync(join(zarr, "0"), { recursive: true }); writeFileSync(join(zarr, ".zattrs"), JSON.stringify({ multiscales: [{ version: "0.4", datasets: [{ path: "0" }] }] })); writeFileSync(join(zarr, "0", ".zarray"), JSON.stringify({ zarr_format: 2, shape: [1, 2], chunks: [1, 2], dtype: "|u1", compressor: null, filters: null, order: "C" })); writeFileSync(join(zarr, "0", "0.0"), Buffer.from([2, 3]));
      const tools = createScienceTools(runtime, registry);
      const call = async (registeredName: string, args: Record<string, unknown>) => {
        const tool = tools.find((candidate) => candidate.name === registeredName)!;
        const result = await tool.execute(args, { agent, signal } as never);
        expect(validateJsonSchemaValue(tool.output.schema, result, registeredName)).toEqual([]);
        return result as Record<string, unknown>;
      };
      const opened = await call("slide_open_from_chat", { path: tiff }); const sessionId = String(opened.viewerSessionId); const state = await call("slide_get_viewer_state", { sessionId });
      await call("slide_wait_for_render", { sessionId, stateRevision: state.stateRevision });
      await call("slide_open_ome_zarr", { path: zarr });
      await call("slide_open_dicom_series", { paths: [dicom] });
      const location = { studyInstanceUid: "1.2.3", seriesInstanceUid: "1.2.3.4", sopInstanceUid: "1.2.3.4.5" };
      await call("slide_open_dicomweb_wsi", { baseUrl, studyInstanceUid: location.studyInstanceUid, seriesInstanceUid: location.seriesInstanceUid, sopInstanceUids: [location.sopInstanceUid], encoding: "native" });
      await call("slide_query_dicomweb", { sessionId, baseUrl, studyInstanceUid: location.studyInstanceUid, seriesInstanceUid: location.seriesInstanceUid, scope: "instances", modality: "SM", limit: 10, offset: 0 }); await call("slide_inspect_dicomweb_instance", { sessionId, baseUrl, location }); await call("slide_read_dicomweb_object", { sessionId, baseUrl, location, page: { groupIndex: 0, offset: 0, limit: 16 } });
      const reopened = await call("slide_open_from_chat", { path: tiff }); const activeSessionId = String(reopened.viewerSessionId);
      const imported = await call("slide_import_dicom_object", { sessionId: activeSessionId, path: semantic }); expect(imported.imported).toBe(true);
      const exported = await call("slide_export_dicom_object", { sessionId: activeSessionId, path: semantic, outputPath: output }); expect(exported.exported).toBe(true);
      const workflow = await call("slide_run_workflow", { sessionId: activeSessionId, request: { kind: "annotation-summary" } }); const durableId = String((workflow.job as Record<string, unknown>).durableId); const artifactId = String((workflow.artifact as Record<string, unknown>).id);
      await call("slide_read_workflow_artifact", { sessionId: activeSessionId, durableId, artifactId, sequence: 0 }); await call("slide_read_live_workflow_artifact", { sessionId: activeSessionId, durableId, artifactId, sequence: 0 }); await call("slide_resume_workflow", { sessionId: activeSessionId, durableId });
      const pathology = await runtime.execute("slide", "run_pathology", { sessionId: activeSessionId, request: { kind: "annotation-summary" } }, { session: agent, packageRoot: registry.packageRoot, signal }); const pathologyId = String((pathology.job as Record<string, unknown>).durableId); await call("slide_resume_pathology", { sessionId: activeSessionId, durableId: pathologyId });
      const prepared = await call("slide_prepare_dicom_upload", { sessionId: activeSessionId, endpoint: `${baseUrl}/studies`, paths: [semantic] }); await call("slide_submit_dicom_upload", { sessionId: activeSessionId, preparedOperation: prepared.preparedOperation });
    } finally { if (priorLocalMock === undefined) delete process.env.DSH_ROSALIND_LOCAL_DICOMWEB_MOCK; else process.env.DSH_ROSALIND_LOCAL_DICOMWEB_MOCK = priorLocalMock; await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); rmSync(temp, { recursive: true, force: true }); }
  });

  it("runs the Slide Viewer Skill ToolRuntime flow: open, state, pixel query, wait, frame acknowledgement, ready", async () => {
    const temp = mkdtempSync(join(packageRoot, ".slide-skill-flow-")); const registry = new CapabilityRegistry(); const runtime = new ScienceRuntime(); const agent = {}; const signal = new AbortController().signal;
    try {
      const tiff = join(temp, "source.tiff"); writeFileSync(tiff, rgbTiff(3, 2)); const fixed = createScienceTools(runtime, registry); const gateway = createScienceGatewayTools(runtime, registry.packageRoot);
      const call = async (name: string, args: Record<string, unknown>, tools = fixed) => {
        const tool = tools.find((candidate) => candidate.name === name)!; const result = await tool.execute(args, { agent, signal } as never);
        expect(validateJsonSchemaValue(tool.output.schema, result, name)).toEqual([]); return result as Record<string, unknown>;
      };
      const opened = await call("slide_open_from_chat", { path: tiff }); const sessionId = String(opened.viewerSessionId);
      const initial = await call("slide_get_viewer_state", { sessionId }); expect(initial).toMatchObject({ viewerReady: false, renderState: "awaiting-viewer", previewTile: { mimeType: "image/png" } });
      const tile = await call("slide_query_viewer", { sessionId, query: "tile", x: 0, y: 0, width: 2, height: 2 }); expect(tile).toMatchObject({ mimeType: "image/png", width: 2, height: 2 });
      const pending = await call("slide_wait_for_render", { sessionId, stateRevision: initial.stateRevision }); expect(pending).toMatchObject({ pending: true, viewerReady: false, renderState: "pending" });
      const acknowledgement = await call("slide_control_viewer", { sessionId, action: "acknowledge_render", sourceRevision: opened.sourceRevision }, gateway); expect(acknowledgement).toMatchObject({ applied: true, viewerReady: true, renderState: "ready" });
      const readyState = await call("slide_get_viewer_state", { sessionId }); const ready = await call("slide_wait_for_render", { sessionId, stateRevision: readyState.stateRevision }); expect(ready).toMatchObject({ viewerReady: true, renderState: "ready", pending: false });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });
});
