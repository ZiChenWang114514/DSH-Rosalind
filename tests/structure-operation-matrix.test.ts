import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { StructureService } from "../src/host/science/structure.js";

const packageRoot = process.cwd();
const primaryPath = "showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/inputs/4AKE.pdb";
const mobilePath = "showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/inputs/1AKE.pdb";

function context(session: object) { return { session, signal: new AbortController().signal, packageRoot }; }
function successful(value: Record<string, unknown> | { ok: false }): Record<string, unknown> { expect(value.ok).not.toBe(false); return value as Record<string, unknown>; }

const diagnostic: Record<string, string> = {
  "structure.assembly_symmetry": "ASSEMBLY_SYMMETRY_DATA_UNAVAILABLE",
  "structure.browse_related_data": "WORKSPACE_BROWSER_UNAVAILABLE",
  "structure.cancel_render": "RENDERER_UNAVAILABLE",
  "structure.discover_density": "SOURCE_CAPABILITY_UNAVAILABLE",
  "structure.get_render_status": "RENDERER_UNAVAILABLE",
  "structure.load_background": "SOURCE_CAPABILITY_UNAVAILABLE",
  "structure.load_data": "SOURCE_CAPABILITY_UNAVAILABLE",
  "structure.load_public_density": "SOURCE_CAPABILITY_UNAVAILABLE",
  "structure.quality_assessment": "QUALITY_DATA_UNAVAILABLE",
  "structure.render_image": "RENDERER_UNAVAILABLE",
  "structure.render_movie": "RENDERER_UNAVAILABLE",
  "structure.search_motif": "MOTIF_PROVIDER_UNAVAILABLE",
  "structure.set_assembly_symmetry": "ASSEMBLY_SYMMETRY_DATA_UNAVAILABLE",
  "structure.set_trajectory_state": "TRAJECTORY_DATA_UNAVAILABLE",
  "structure.validate_render": "RENDERER_UNAVAILABLE",
};

const supported = new Set([
  "structure.add_structure", "structure.align_structures", "structure.analyze", "structure.apply_scene", "structure.control_viewer",
  "structure.delete_scene", "structure.export", "structure.get_state", "structure.list_scenes", "structure.list_structures",
  "structure.load_scene", "structure.measure", "structure.open_from_chat", "structure.query", "structure.remove_structure",
  "structure.save_scene", "structure.set_object_visibility", "structure.set_selection", "structure.derive_object", "structure.manage_guides",
  "structure.pymol_action", "structure.pymol_actions", "structure.redo", "structure.set_quality_assessment", "structure.transform_object", "structure.undo",
]);

const manifest = JSON.parse(readFileSync("capabilities/capability-manifest.json", "utf8")) as { operations: Array<{ operation: string; serviceId: string }> };
const operations = manifest.operations.filter((item) => item.serviceId === "structure").map((item) => item.operation);

async function invoke(operation: string) {
  const service = new StructureService(), owner = {};
  if (operation === "structure.open_from_chat") return service.execute(operation, { path: primaryPath, openIntentId: crypto.randomUUID() }, context(owner));
  const opened = successful(await service.execute("structure.open_from_chat", { path: primaryPath, openIntentId: crypto.randomUUID() }, context(owner)));
  const sessionId = opened.viewerSessionId as string;
  const call = (name: string, args: Record<string, unknown>) => service.execute(name, { sessionId, ...args }, context(owner));
  if (["structure.align_structures", "structure.remove_structure", "structure.set_object_visibility"].includes(operation)) successful(await call("structure.add_structure", { objectId: "mobile", path: mobilePath }));
  if (["structure.load_scene", "structure.delete_scene"].includes(operation)) successful(await call("structure.save_scene", { name: "matrix-scene" }));
  if (operation === "structure.undo" || operation === "structure.redo") successful(await call("structure.control_viewer", { action: "set_view_options", background: "dark" }));
  if (operation === "structure.redo") successful(await call("structure.undo", {}));
  const current = successful(await call("structure.get_state", {})), expectedRevision = current.sceneRevision as number;
  const args: Record<string, Record<string, unknown>> = {
    "structure.add_structure": { objectId: "secondary", path: mobilePath },
    "structure.align_structures": { method: "structure", mobile: { kind: "chain", objectId: "mobile", chain: "A" }, reference: { kind: "chain", objectId: "primary", chain: "A" } },
    "structure.analyze": { kind: "centroid", selections: [{ kind: "residue", chain: "A", residue: 10 }] },
    "structure.apply_scene": { atomic: true, dryRun: true, background: "dark" },
    "structure.control_viewer": { action: "set_view_options", background: "dark" },
    "structure.delete_scene": { name: "matrix-scene" },
    "structure.derive_object": { expectedRevision, objectId: "derived", sourceObjectId: "primary", label: "Derived", operations: [{ kind: "translate", target: { kind: "residue", chain: "A", residue: 10, objectId: "derived" }, vector: [1, 0, 0] }] },
    "structure.export": { format: "scene-json", outputPath: "tests/.structure-matrix-export.json", overwrite: true },
    "structure.get_state": {}, "structure.list_scenes": {}, "structure.list_structures": {},
    "structure.load_scene": { name: "matrix-scene" },
    "structure.manage_guides": { expectedRevision, operation: { kind: "create", guideKind: "label", id: "matrix-guide", target: { kind: "residue", chain: "A", residue: 10 } } },
    "structure.measure": { kind: "distance", targets: [{ kind: "atom", chain: "A", residue: 10, atomName: "CA" }, { kind: "atom", chain: "A", residue: 11, atomName: "CA" }] },
    "structure.query": { expression: { kind: "anyOf", expressions: [{ kind: "residue", chain: "A", residue: 10 }, { kind: "residue", chain: "A", residue: 11 }] }, level: "residue" },
    "structure.pymol_action": { expectedRevision, action: { kind: "select", target: { kind: "residue", chain: "A", residue: 10 }, mode: "set" } },
    "structure.pymol_actions": {},
    "structure.quality_assessment": { objectId: "primary", source: { kind: "embedded" } },
    "structure.remove_structure": { objectId: "mobile" }, "structure.save_scene": { name: "matrix-scene" },
    "structure.set_object_visibility": { objectId: "mobile", visible: false },
    "structure.set_quality_assessment": { expectedRevision, objectId: "primary", metricId: null, displayClashes: false },
    "structure.set_selection": { expression: { kind: "anyOf", expressions: [{ kind: "residue", chain: "A", residue: 10 }, { kind: "residue", chain: "A", residue: 11 }] } },
    "structure.transform_object": { objectId: "primary", mode: "relative", transform: { kind: "components", translation: [1, 2, 3] } },
    "structure.undo": { expectedRevision },
    "structure.redo": { expectedRevision },
  };
  const result = await call(operation, args[operation] ?? {});
  if (operation === "structure.export") rmSync("tests/.structure-matrix-export.json", { force: true });
  return result;
}

describe("StructureService 41-operation implementation matrix", () => {
  it("covers exactly the registered structure operations without trusting implemented flags", () => {
    expect(operations).toHaveLength(41);
    expect(new Set([...supported, ...Object.keys(diagnostic)])).toEqual(new Set(operations));
  });

  it.each(operations)("%s has a real local result or its exact diagnostic", async (operation) => {
    const result = await invoke(operation);
    if (supported.has(operation)) expect(result.ok).not.toBe(false);
    else expect(result).toMatchObject({ ok: false, error: { code: diagnostic[operation] } });
  });
});

describe("StructureService contract semantics", () => {
  it("uses expression, level, kind, targets, selections, and anyOf literally", async () => {
    const service = new StructureService(), owner = {};
    const opened = successful(await service.execute("structure.open_from_chat", { path: "showcases/molecular-structure-viewer/cases/structure-mdm2-p53/inputs/1YCR.pdb", openIntentId: crypto.randomUUID() }, context(owner)));
    const sessionId = opened.viewerSessionId as string;
    const query = successful(await service.execute("structure.query", { sessionId, level: "residue", expression: { kind: "anyOf", expressions: [{ kind: "residue", chain: "B", residue: 19 }, { kind: "residue", chain: "B", residue: 23 }] } }, context(owner)));
    expect(query).toMatchObject({ level: "residue", total: 2 });
    const measure = successful(await service.execute("structure.measure", { sessionId, kind: "distance", targets: [{ kind: "atom", chain: "B", residue: 19, atomName: "CA" }, { kind: "atom", chain: "B", residue: 23, atomName: "CA" }] }, context(owner)));
    expect((measure.measurement as { targets: unknown[] }).targets).toHaveLength(2);
    const analysis = successful(await service.execute("structure.analyze", { sessionId, kind: "contacts", selections: [{ kind: "chain", chain: "A" }, { kind: "residue", chain: "B", residue: 19 }], options: { contactDistanceAngstrom: 4 } }, context(owner)));
    expect(analysis.residuePairCount).toBeGreaterThan(0);
    expect(await service.execute("structure.query", { sessionId, expression: { kind: "within", distanceAngstrom: 4, expression: { kind: "all" } } }, context(owner))).toMatchObject({ ok: false, error: { code: "SELECTION_EXPR_UNSUPPORTED" } });
  });

  it("enforces session, revision, atomic, dry-run, and overwrite controls", async () => {
    const service = new StructureService(), owner = {};
    const opened = successful(await service.execute("structure.open_from_chat", { path: primaryPath, openIntentId: crypto.randomUUID() }, context(owner)));
    const sessionId = opened.viewerSessionId as string, revision = opened.sceneRevision as number;
    expect(await service.execute("structure.get_state", {}, context(owner))).toMatchObject({ ok: false, error: { code: "SESSION_ID_REQUIRED" } });
    expect(await service.execute("structure.set_selection", { sessionId, expectedRevision: revision + 1, expression: { kind: "all" } }, context(owner))).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(await service.execute("structure.apply_scene", { sessionId, atomic: false }, context(owner))).toMatchObject({ ok: false, error: { code: "ATOMIC_SCENE_REQUIRED" } });
    const dryRun = successful(await service.execute("structure.apply_scene", { sessionId, expectedRevision: revision, atomic: true, dryRun: true, background: "dark" }, context(owner)));
    expect(dryRun).toMatchObject({ dryRun: true, sceneRevision: revision });
    const path = "tests/.structure-overwrite.json"; writeFileSync(path, "existing", "utf8");
    const blocked = await service.execute("structure.export", { sessionId, format: "scene-json", outputPath: path, overwrite: false }, context(owner));
    rmSync(path, { force: true });
    expect(blocked).toMatchObject({ ok: false, error: { code: "EXPORT_DESTINATION_EXISTS" } });
  });

  it("computes and applies a coordinate-derived CA Kabsch alignment", async () => {
    const service = new StructureService(), owner = {};
    const opened = successful(await service.execute("structure.open_from_chat", { path: primaryPath, openIntentId: crypto.randomUUID() }, context(owner))), sessionId = opened.viewerSessionId as string;
    successful(await service.execute("structure.add_structure", { sessionId, objectId: "mobile", path: mobilePath }, context(owner)));
    const result = successful(await service.execute("structure.align_structures", { sessionId, method: "structure", mobile: { kind: "chain", objectId: "mobile", chain: "A" }, reference: { kind: "chain", objectId: "primary", chain: "A" } }, context(owner)));
    expect(result.alignedResidueCount).toBe(214);
    expect(result.rmsdAngstrom).not.toBe(8.043719662);
    expect(result.matrix).toHaveLength(16);
    expect(result).toMatchObject({ implementation: { engine: "DSH-Rosalind CA Kabsch", version: "1.0.0" }, correspondence: { count: 214 } });
  });

  it("derives a new object without changing its source", async () => {
    const service = new StructureService(), owner = {};
    const opened = successful(await service.execute("structure.open_from_chat", { path: primaryPath, openIntentId: crypto.randomUUID() }, context(owner))), sessionId = opened.viewerSessionId as string;
    const before = successful(await service.execute("structure.get_state", { sessionId }, context(owner))), revision = before.sceneRevision as number, sourceAtoms = (before.structure as { atomCount: number }).atomCount;
    const derived = successful(await service.execute("structure.derive_object", { sessionId, expectedRevision: revision, objectId: "edited", sourceObjectId: "primary", label: "Edited copy", operations: [{ kind: "rename_chain", from: "A", to: "Z" }, { kind: "translate", target: { kind: "residue", objectId: "edited", chain: "Z", residue: 10 }, vector: [2, 0, 0] }, { kind: "delete_atoms", target: { kind: "atom", objectId: "edited", chain: "Z", residue: 10, atomName: "CA" } }] }, context(owner)));
    expect(derived).toMatchObject({ object: { id: "edited", atomCount: sourceAtoms - 1, dirty: true } });
    const source = successful(await service.execute("structure.query", { sessionId, expression: { kind: "all", objectId: "primary" }, level: "atom", limit: 500 }, context(owner)));
    const edited = successful(await service.execute("structure.query", { sessionId, expression: { kind: "all", objectId: "edited" }, level: "atom", limit: 500 }, context(owner)));
    expect(source.total).toBe(sourceAtoms);
    expect(edited.total).toBe(sourceAtoms - 1);
    expect(await service.execute("structure.derive_object", { sessionId, expectedRevision: revision, objectId: "stale", label: "stale", operations: [{ kind: "rename_chain", from: "A", to: "B" }] }, context(owner))).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
  });

  it("applies affine coordinates and restores them through undo and redo", async () => {
    const service = new StructureService(), owner = {};
    const opened = successful(await service.execute("structure.open_from_chat", { path: primaryPath, openIntentId: crypto.randomUUID() }, context(owner))), sessionId = opened.viewerSessionId as string;
    const expression = { kind: "atom", chain: "A", residue: 10, atomName: "CA" };
    const coordinate = async () => (((successful(await service.execute("structure.query", { sessionId, expression }, context(owner))).items as Array<{ coordinates: { x: number; y: number; z: number } }>)[0]!.coordinates));
    const original = await coordinate();
    const transformed = successful(await service.execute("structure.transform_object", { sessionId, objectId: "primary", mode: "relative", transform: { kind: "components", translation: [1, 2, 3] } }, context(owner)));
    expect(await coordinate()).toEqual({ x: original.x + 1, y: original.y + 2, z: original.z + 3 });
    const undone = successful(await service.execute("structure.undo", { sessionId, expectedRevision: transformed.appliedRevision }, context(owner)));
    expect(await coordinate()).toEqual(original);
    const redone = successful(await service.execute("structure.redo", { sessionId, expectedRevision: undone.appliedRevision }, context(owner)));
    expect(await coordinate()).toEqual({ x: original.x + 1, y: original.y + 2, z: original.z + 3 });
    expect(redone).toMatchObject({ operation: "redo", history: { redoCount: 0 } });
  });

  it("creates, updates, and removes coordinate-derived guides with revision checks", async () => {
    const service = new StructureService(), owner = {};
    const opened = successful(await service.execute("structure.open_from_chat", { path: primaryPath, openIntentId: crypto.randomUUID() }, context(owner))), sessionId = opened.viewerSessionId as string, revision = opened.sceneRevision as number;
    const created = successful(await service.execute("structure.manage_guides", { sessionId, expectedRevision: revision, operation: { kind: "create", guideKind: "plane", id: "active-site-plane", target: { kind: "residue", chain: "A", residue: 10 }, label: "Residue 10" } }, context(owner)));
    expect(created).toMatchObject({ guide: { id: "active-site-plane", kind: "plane", atomCount: 4 }, geometry: { computed: true, coordinatesExposed: false } });
    expect(await service.execute("structure.manage_guides", { sessionId, expectedRevision: revision, operation: { kind: "update", id: "active-site-plane", visible: false } }, context(owner))).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    const updated = successful(await service.execute("structure.manage_guides", { sessionId, expectedRevision: created.appliedRevision, operation: { kind: "update", id: "active-site-plane", visible: false, color: "#ff0000" } }, context(owner)));
    expect(updated).toMatchObject({ guide: { visible: false, color: "#ff0000" } });
    const deleted = successful(await service.execute("structure.manage_guides", { sessionId, expectedRevision: updated.appliedRevision, operation: { kind: "delete", id: "active-site-plane" } }, context(owner)));
    expect(deleted.guides).toEqual([]);
  });

  it("exposes only truthful local direct actions and never substitutes quality data", async () => {
    const service = new StructureService(), owner = {};
    const opened = successful(await service.execute("structure.open_from_chat", { path: primaryPath, openIntentId: crypto.randomUUID() }, context(owner))), sessionId = opened.viewerSessionId as string, revision = opened.sceneRevision as number;
    const vocabulary = successful(await service.execute("structure.pymol_actions", { sessionId }, context(owner)));
    expect(vocabulary).toMatchObject({ implementation: { pymolEngine: false } });
    const selection = successful(await service.execute("structure.pymol_action", { sessionId, expectedRevision: revision, action: { kind: "select", target: { kind: "residue", chain: "A", residue: 10 }, mode: "set" } }, context(owner)));
    expect(selection.selectedAtomCount).toBeGreaterThan(0);
    const cleared = successful(await service.execute("structure.set_quality_assessment", { sessionId, expectedRevision: selection.appliedRevision, objectId: "primary", metricId: null, displayClashes: false }, context(owner)));
    expect(cleared).toMatchObject({ metricId: null, displayClashes: false });
    expect(await service.execute("structure.set_quality_assessment", { sessionId, expectedRevision: cleared.appliedRevision, objectId: "primary", metricId: "plddt" }, context(owner))).toMatchObject({ ok: false, error: { code: "QUALITY_METRIC_NOT_LOADED" } });
    expect(await service.execute("structure.quality_assessment", { sessionId, objectId: "primary", source: { kind: "embedded" } }, context(owner))).toMatchObject({ ok: false, error: { code: "QUALITY_DATA_UNAVAILABLE" } });
  });
});
