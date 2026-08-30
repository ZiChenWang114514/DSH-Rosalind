import { readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { StructureService } from "../src/host/science/structure.js";

const packageRoot = process.cwd();
const gfpPath = "showcases/molecular-structure-viewer/cases/structure-gfp-figure/inputs/1EMA.pdb";
const mdm2Path = "showcases/molecular-structure-viewer/cases/structure-mdm2-p53/inputs/1YCR.pdb";

function context(owner: object) { return { session: owner, signal: new AbortController().signal, packageRoot }; }
function success(value: Record<string, unknown> | { ok: false; error: { code: string } }): Record<string, unknown> { expect(value.ok).not.toBe(false); return value as Record<string, unknown>; }

describe("StructureService local raster and scientific analyses", () => {
  it("renders GFP coordinates to a real PNG and retains a reproducible rendering record", async () => {
    const service = new StructureService(), owner = {}, outputPath = "tests/.structure-gfp-runtime.png";
    const opened = success(await service.execute("structure.open_from_chat", { path: gfpPath }, context(owner)));
    expect((opened.structure as { atomCount: number }).atomCount).toBe(1866);
    const sessionId = opened.viewerSessionId as string;
    const validation = success(await service.execute("structure.validate_render", { sessionId, request: { kind: "image", width: 320, height: 240, format: "png" } }, context(owner)));
    expect(validation).toMatchObject({ valid: true, dimensions: { width: 320, height: 240 }, supportedFormats: ["png"] });
    const rendered = success(await service.execute("structure.render_image", { sessionId, outputPath, width: 320, height: 240, format: "png", overwrite: true }, context(owner)));
    const target = resolve(packageRoot, outputPath), sidecar = `${target}.render.json`;
    try {
      expect(readFileSync(target).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(statSync(target).size).toBeGreaterThan(500);
      expect(JSON.parse(readFileSync(sidecar, "utf8"))).toMatchObject({ format: "png", dimensions: { width: 320, height: 240 }, renderedAtomCount: 1866 });
      const status = success(await service.execute("structure.get_render_status", { sessionId, jobId: (rendered.job as { id: string }).id }, context(owner)));
      expect(status).toMatchObject({ job: { state: "completed" } });
      const cancelled = success(await service.execute("structure.cancel_render", { sessionId, jobId: (rendered.job as { id: string }).id }, context(owner)));
      expect(cancelled).toMatchObject({ cancellationAccepted: false, job: { state: "completed" } });
      expect(String((status.job as { outputPath: string }).outputPath).replace(/\\/g, "/")).toBe(outputPath);
    } finally { rmSync(target, { force: true }); rmSync(sidecar, { force: true }); }
  });

  it("rejects unsupported asynchronous image rendering without writing an artifact", async () => {
    const service = new StructureService(), owner = {}, outputPath = "tests/.structure-gfp-cancelled.png";
    const opened = success(await service.execute("structure.open_from_chat", { path: gfpPath }, context(owner))), sessionId = opened.viewerSessionId as string;
    const rejected = await service.execute("structure.render_image", { sessionId, outputPath, width: 128, height: 128, format: "png", overwrite: true, waitForCompletion: false }, context(owner));
    expect(rejected).toMatchObject({ ok: false, error: { code: "ASYNC_IMAGE_UNAVAILABLE" } });
    try { expect(() => statSync(resolve(packageRoot, outputPath))).toThrow(); }
    finally { rmSync(resolve(packageRoot, outputPath), { force: true }); rmSync(resolve(packageRoot, `${outputPath}.render.json`), { force: true }); }
  });

  it("calculates retained MDM2-p53 contacts plus local clashes and hydrogen-bond candidates", async () => {
    const service = new StructureService(), owner = {};
    const opened = success(await service.execute("structure.open_from_chat", { path: mdm2Path }, context(owner))), sessionId = opened.viewerSessionId as string;
    const selections = [{ kind: "chain", chain: "A" }, { kind: "chain", chain: "B" }];
    const contacts = success(await service.execute("structure.analyze", { sessionId, kind: "contacts", selections, options: { contactDistanceAngstrom: 4 } }, context(owner)));
    expect(contacts).toMatchObject({ atomContactCount: 105, residuePairCount: 34 });
    const clashes = success(await service.execute("structure.analyze", { sessionId, kind: "clashes", selections, options: { clashScale: 0.75 } }, context(owner)));
    expect(clashes).toMatchObject({ kind: "clashes" }); expect(clashes.clashCount).toEqual(expect.any(Number));
    const hydrogenBonds = success(await service.execute("structure.analyze", { sessionId, kind: "hydrogen_bonds", selections, options: { hydrogenBondDistanceAngstrom: 3.5 } }, context(owner)));
    expect(hydrogenBonds).toMatchObject({ kind: "hydrogen_bonds" }); expect(hydrogenBonds.provenance).toContain("candidate");
  });

  it("exports a selection as parseable PDB and reports unavailable binary geometry precisely", async () => {
    const service = new StructureService(), owner = {}, outputPath = "tests/.structure-selection-runtime.pdb";
    const opened = success(await service.execute("structure.open_from_chat", { path: gfpPath }, context(owner))), sessionId = opened.viewerSessionId as string;
    const selected = { kind: "residue", chain: "A", residue: 64 };
    const exported = success(await service.execute("structure.export", { sessionId, format: "selection-pdb", selection: selected, outputPath, overwrite: true }, context(owner)));
    try {
      expect(exported.selectionAtomCount).toBeGreaterThan(0);
      expect(readFileSync(resolve(packageRoot, outputPath), "utf8").slice(0, 6).trim()).toBe("ATOM");
      expect(await service.execute("structure.export", { sessionId, format: "geometry-stl", outputPath: "tests/.structure-runtime.stl", overwrite: true }, context(owner))).toMatchObject({ ok: false, error: { code: "GEOMETRY_ENCODER_UNAVAILABLE" } });
    } finally { rmSync(resolve(packageRoot, outputPath), { force: true }); }
  });
});
