import { describe, expect, it } from "vitest";

import { SlideService } from "../src/host/science/slide.js";
import { StructureService } from "../src/host/science/structure.js";

const packageRoot = process.cwd();

function context(session: object) {
  return { session, signal: new AbortController().signal, packageRoot };
}

function expectSuccess(value: Record<string, unknown> | { ok: false; error: { code: string } }): Record<string, unknown> {
  expect(value.ok).not.toBe(false);
  return value as Record<string, unknown>;
}

describe("StructureService retained scientific fixtures", () => {
  it("opens 1YCR and computes its 4 A cross-chain contact fixture from coordinates", async () => {
    const service = new StructureService();
    const session = {};
    const opened = expectSuccess(await service.execute("structure.open_from_chat", { path: "showcases/molecular-structure-viewer/cases/structure-mdm2-p53/inputs/1YCR.pdb" }, context(session)));
    const sessionId = opened.viewerSessionId;
    expect((opened.structure as { atomCount: number }).atomCount).toBe(818);
    expect(opened).toMatchObject({ viewerReady: false, coordinateLoad: { status: "ready" }, viewerOpen: { renderState: "pending", exportRenderer: "ready" } });
    const contacts = expectSuccess(await service.execute("structure.analyze", { sessionId, kind: "contacts", selections: [{ kind: "chain", chain: "A" }, { kind: "chain", chain: "B" }], options: { contactDistanceAngstrom: 4 } }, context(session)));
    expect(contacts.atomContactCount).toBe(105);
    expect(contacts.residuePairCount).toBe(34);
    expect(contacts.provenance).toContain("Euclidean distance");
  });

  it("keeps selection, visual state, and measurements in the session", async () => {
    const service = new StructureService();
    const session = {};
    const opened = expectSuccess(await service.execute("structure.open_from_chat", { path: "showcases/molecular-structure-viewer/cases/structure-mdm2-p53/inputs/1YCR.pdb" }, context(session)));
    const sessionId = opened.viewerSessionId;
    const selection = expectSuccess(await service.execute("structure.set_selection", { sessionId, expression: { kind: "residue", chain: "B", residue: 19 }, focus: true }, context(session)));
    expect(selection.selectedAtomCount).toBeGreaterThan(0);
    const style = expectSuccess(await service.execute("structure.control_viewer", { sessionId, action: "set_view_options", background: "dark", showHydrogens: true }, context(session)));
    expect((style.display as { background: string }).background).toBe("dark");
    const measured = expectSuccess(await service.execute("structure.measure", { sessionId, kind: "distance", targets: [{ kind: "residue", chain: "B", residue: 19 }, { kind: "residue", chain: "B", residue: 23 }] }, context(session)));
    expect((measured.measurement as { distanceAngstrom: number }).distanceAngstrom).toBeGreaterThan(0);
    const state = expectSuccess(await service.execute("structure.get_state", { sessionId }, context(session)));
    expect((state.selection as { atomCount: number }).atomCount).toBeGreaterThan(0);
  });

  it("requires an output destination instead of manufacturing an image", async () => {
    const service = new StructureService();
    const session = {};
    const opened = expectSuccess(await service.execute("structure.open_from_chat", { path: "showcases/molecular-structure-viewer/cases/structure-mdm2-p53/inputs/1YCR.pdb" }, context(session)));
    const value = await service.execute("structure.render_image", { sessionId: opened.viewerSessionId }, context(session));
    expect(value).toMatchObject({ ok: false, error: { code: "EXPORT_DESTINATION_REQUIRED" } });
  });
});

describe("SlideService retained microscopy and spatial fixtures", () => {
  it("opens retained CMU-1 metadata with its exact pyramid dimensions without claiming a live tile renderer", async () => {
    const service = new SlideService();
    const session = {};
    const opened = expectSuccess(await service.execute("slide.open_from_chat", { path: "showcases/slide-viewer/cases/slide-tissue-architecture/outputs/pyramid-metadata.json" }, context(session)));
    const source = opened.source as { width: number; height: number; format: string };
    expect(source).toMatchObject({ width: 46000, height: 32893, format: "svs" });
    const state = expectSuccess(await service.execute("slide.get_viewer_state", { sessionId: opened.viewerSessionId }, context(session)));
    expect((state.load as { status: string }).status).toBe("recorded-fixture");
  });

  it("uses retained spatial metadata and imports the real GeoJSON feature collection", async () => {
    const service = new SlideService();
    const session = {};
    const opened = expectSuccess(await service.execute("slide.open_from_chat", { path: "showcases/slide-viewer/cases/slide-spatial-expression/outputs/metadata-summary.json" }, context(session)));
    const metadata = expectSuccess(await service.execute("slide.spatial_indexed", { sessionId: opened.viewerSessionId, operation: "metadata" }, context(session)));
    expect(metadata).toMatchObject({ observations: 684, genes: 18078, matrix: "X", valueScale: "unknown" });
    const expression = expectSuccess(await service.execute("slide.spatial_indexed", { sessionId: opened.viewerSessionId, operation: "expression", gene: "Slc17a7" }, context(session)));
    expect(expression).toMatchObject({ column: 7717, observationCount: 684, nonzero: 671 });
    const layer = expectSuccess(await service.execute("slide.import_scientific_layer", { sessionId: opened.viewerSessionId, layerId: "spots", path: "showcases/slide-viewer/cases/slide-segmentation-overlay/outputs/source-aligned-annotations.geojson" }, context(session)));
    expect((layer.layer as { featureCount: number }).featureCount).toBe(3);
  });

  it("preserves local job failure and cancellation semantics without creating a pathology result", async () => {
    const service = new SlideService();
    const session = {};
    const opened = expectSuccess(await service.execute("slide.open_from_chat", { path: "showcases/slide-viewer/cases/slide-tissue-architecture/outputs/pyramid-metadata.json" }, context(session)));
    const started = await service.execute("slide.run_pathology", { sessionId: opened.viewerSessionId, workflow: "segmentation" }, context(session));
    expect(started).toMatchObject({ ok: false, error: { code: "COMPUTE_ENGINE_UNAVAILABLE" }, job: { state: "failed" } });
    const jobId = (started as { job: { id: string } }).job.id;
    const cancellation = expectSuccess(await service.execute("slide.cancel_pathology", { sessionId: opened.viewerSessionId, jobId }, context(session)));
    expect((cancellation.job as { state: string }).state).toBe("failed");
  });
});
