import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Context } from "@deepseek-ai/cordis";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { afterEach, describe, expect, it } from "vitest";

import { ScienceRuntime } from "../src/host/science/runtime.js";
import { createScienceTools } from "../src/host/science-tools.js";

const gfpPath = "showcases/molecular-structure-viewer/cases/structure-gfp-figure/inputs/1EMA.pdb";
const outputPath = "tests/.structure-toolruntime.png";
const adenylatePath = "showcases/molecular-structure-viewer/cases/structure-adenylate-kinase/inputs/4AKE.pdb";
const densityPath = "tests/.structure-toolruntime-density.dx";
const trajectoryPath = "tests/.structure-toolruntime-trajectory.json";
const moviePath = "tests/.structure-toolruntime.mp4";
const backgroundPath = resolve(dirname(resolve(process.cwd(), adenylatePath)), ".structure-toolruntime-background.png");

function callId(value: string): ToolExecutionInput["callId"] { return value as ToolExecutionInput["callId"]; }

describe("Structure tools through the strict DSH ToolRuntime contract", () => {
  let context: Context | undefined;
  let runtimeFiber: { dispose(): Promise<void> } | undefined;
  let promptFiber: { dispose(): Promise<void> } | undefined;
  let unregister: Array<() => void> = [];

  afterEach(async () => {
    for (const dispose of unregister.reverse()) dispose(); unregister = [];
    await runtimeFiber?.dispose(); await promptFiber?.dispose();
    context = undefined; runtimeFiber = undefined; promptFiber = undefined;
    rmSync(outputPath, { force: true }); rmSync(`${outputPath}.render.json`, { force: true });
    for (const path of [densityPath, trajectoryPath, moviePath, `${moviePath}.render.json`, backgroundPath]) rmSync(path, { force: true });
  });

  it("opens, queries, and renders GFP without INVALID_TOOL_OUTPUT", async () => {
    context = new Context(); promptFiber = context.plugin(SystemPrompt, {}); await promptFiber;
    runtimeFiber = context.plugin(ToolRuntime, { mode: "native" }); await runtimeFiber;
    unregister = createScienceTools(new ScienceRuntime()).map((tool) => context!.tools.register(tool));
    const call = (name: string, arguments_: Record<string, unknown>) => context!.tools.execute({ callId: callId(`structure-runtime-${name}`), name, arguments: arguments_, signal: new AbortController().signal });
    const opened = await call("structure_open_from_chat", { path: gfpPath });
    expect(opened.isError, JSON.stringify(opened)).toBe(false);
    if (opened.isError) return;
    const sessionId = (opened.value as Record<string, unknown>).viewerSessionId as string;
    expect(opened.value).toMatchObject({ serviceId: "structure", operation: "structure.open_from_chat", status: "completed", viewerOpen: { renderState: "pending", exportRenderer: "ready" }, viewerReady: false, atoms: expect.any(Array), coordinatePreview: { atomCount: 1866, totalAtomCount: 1866, truncated: false } });
    expect((opened.value as Record<string, unknown>).atoms).toHaveLength(1866);
    const queried = await call("structure_query", { sessionId, expression: { kind: "residue", chain: "A", residue: 64 }, level: "atom", limit: 20 });
    expect(queried.isError, JSON.stringify(queried)).toBe(false);
    if (!queried.isError) expect(queried.value).toMatchObject({ serviceId: "structure", operation: "structure.query", status: "completed", total: expect.any(Number), items: expect.any(Array) });
    const axes = await call("structure_analyze", { sessionId, kind: "principal_axes", selections: [{ kind: "residue", chain: "A", residue: 64 }] });
    expect(axes.isError, JSON.stringify(axes)).toBe(false);
    if (!axes.isError) expect(axes.value).toMatchObject({ serviceId: "structure", operation: "structure.analyze", status: "completed", kind: "principal_axes", axes: expect.any(Array), eigenvalues: expect.any(Array) });
    const display = await call("structure_control_viewer", { sessionId, action: "set_display_mode", displayMode: "fullscreen" });
    expect(display.isError, JSON.stringify(display)).toBe(false);
    if (!display.isError) expect(display.value).toMatchObject({ serviceId: "structure", operation: "structure.control_viewer", status: "completed", displayMode: "fullscreen" });
    const rendered = await call("structure_render_image", { sessionId, outputPath, width: 128, height: 128, format: "png", overwrite: true });
    expect(rendered.isError, JSON.stringify(rendered)).toBe(false);
    if (!rendered.isError) expect(rendered.value).toMatchObject({ serviceId: "structure", operation: "structure.render_image", status: "completed", artifact: { format: "png" }, job: { state: "completed" } });
  });

  it("executes the eight formerly diagnostic structure operations through ToolRuntime", async () => {
    context = new Context(); promptFiber = context.plugin(SystemPrompt, {}); await promptFiber;
    runtimeFiber = context.plugin(ToolRuntime, { mode: "native" }); await runtimeFiber;
    unregister = createScienceTools(new ScienceRuntime()).map((tool) => context!.tools.register(tool));
    const call = (name: string, arguments_: Record<string, unknown>) => context!.tools.execute({ callId: callId(`structure-eight-${name}-${crypto.randomUUID()}`), name, arguments: arguments_, signal: new AbortController().signal });
    const opened = await call("structure_open_from_chat", { path: adenylatePath });
    expect(opened.isError, JSON.stringify(opened)).toBe(false); if (opened.isError) return;
    const sessionId = (opened.value as Record<string, unknown>).viewerSessionId as string;
    writeFileSync(densityPath, "object 1 class gridpositions counts 2 2 2\nobject 2 class gridconnections counts 2 2 2\nobject 3 class array type double rank 0 items 8 data follows\n0 1 2 3 4 5 6 7\n", "utf8");
    const discovered = await call("structure_discover_density", { sessionId, source: { kind: "local-fixture", path: densityPath } });
    expect(discovered.isError, JSON.stringify(discovered)).toBe(false); if (discovered.isError) return;
    expect(discovered.value).toMatchObject({ status: "completed", items: [{ densityId: "density-structure-toolruntime-density-dx", voxelCount: 8 }] });
    const density = await call("structure_load_public_density", { sessionId, densityId: "density-structure-toolruntime-density-dx", objectId: "local-density" });
    expect(density.isError, JSON.stringify(density)).toBe(false); if (!density.isError) expect(density.value).toMatchObject({ status: "completed", density: { id: "local-density", voxelCount: 8 } });
    const quality = await call("structure_quality_assessment", { sessionId, objectId: "primary", source: { kind: "embedded" } });
    expect(quality.isError, JSON.stringify(quality)).toBe(false); if (!quality.isError) expect(quality.value).toMatchObject({ status: "completed", metricId: "bfactor", metrics: [{ units: "Å²" }] });
    const assembly = await call("structure_assembly_symmetry", { sessionId, objectId: "primary", operation: "load", source: { kind: "rcsb", entryId: "4AKE", assemblyId: "1" } });
    expect(assembly.isError, JSON.stringify(assembly)).toBe(false);
    const assemblyState = await call("structure_get_state", { sessionId });
    expect(assemblyState.isError, JSON.stringify(assemblyState)).toBe(false); if (assemblyState.isError) return;
    const symmetry = await call("structure_set_assembly_symmetry", { sessionId, expectedRevision: (assemblyState.value as Record<string, unknown>).sceneRevision, objectId: "primary", selectedIndex: 0, axes: true, cage: true, clusterColors: false });
    expect(symmetry.isError, JSON.stringify(symmetry)).toBe(false); if (!symmetry.isError) expect(symmetry.value).toMatchObject({ status: "completed", display: { selectedIndex: 0, axes: true } });
    const motif = await call("structure_search_motif", { sessionId, referenceObjectId: "primary", source: { kind: "local-fixture", path: adenylatePath }, residues: [{ chain: "A", residue: 10 }, { chain: "A", residue: 11 }], toleranceAngstrom: 0.001 });
    expect(motif.isError, JSON.stringify(motif)).toBe(false); if (!motif.isError) expect(motif.value).toMatchObject({ status: "completed", total: 1, hits: expect.any(Array) });
    const coordinates = readFileSync(adenylatePath, "utf8").split(/\r?\n/).filter((line) => /^(ATOM  |HETATM)/.test(line)).map((line) => [Number(line.slice(30, 38)), Number(line.slice(38, 46)), Number(line.slice(46, 54))]);
    writeFileSync(trajectoryPath, JSON.stringify({ frames: [coordinates, coordinates.map(([x = 0, y = 0, z = 0]) => [x + 1, y, z])] }), "utf8");
    const trajectory = await call("structure_load_data", { sessionId, kind: "trajectory", topologyPath: adenylatePath, coordinatesPath: trajectoryPath });
    expect(trajectory.isError, JSON.stringify(trajectory)).toBe(false);
    const trajectoryState = await call("structure_get_state", { sessionId });
    expect(trajectoryState.isError, JSON.stringify(trajectoryState)).toBe(false); if (trajectoryState.isError) return;
    const advanced = await call("structure_set_trajectory_state", { sessionId, expectedRevision: (trajectoryState.value as Record<string, unknown>).sceneRevision, state: { objectId: "primary", currentFrame: 1, playing: false, loop: true, speed: 1, stride: 1 } });
    expect(advanced.isError, JSON.stringify(advanced)).toBe(false); if (!advanced.isError) expect(advanced.value).toMatchObject({ status: "completed", state: { currentFrame: 1, frameCount: 2 } });
    writeFileSync(backgroundPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9rQAAAABJRU5ErkJggg==", "base64"));
    const related = await call("structure_browse_related_data", { sessionId, callerId: crypto.randomUUID(), commandId: crypto.randomUUID() });
    expect(related.isError, JSON.stringify(related)).toBe(false); if (related.isError) return;
    const fileToken = ((related.value as Record<string, unknown>).items as Array<{ name: string; token: string }>).find((item) => item.name === ".structure-toolruntime-background.png")?.token;
    expect(fileToken).toBeTruthy();
    const background = await call("structure_load_background", { sessionId, callerId: crypto.randomUUID(), commandId: crypto.randomUUID(), fileToken });
    expect(background.isError, JSON.stringify(background)).toBe(false); if (!background.isError) expect(background.value).toMatchObject({ status: "completed", background: { format: "png" } });
    const movie = await call("structure_render_movie", { sessionId, outputPath: moviePath, width: 128, height: 128, fps: 2, timeline: [{ kind: "camera_spin", durationSeconds: 1, degrees: 90 }], overwrite: true });
    expect(movie.isError, JSON.stringify(movie)).toBe(false); if (!movie.isError) expect(movie.value).toMatchObject({ status: "completed", artifact: { format: "mp4" }, job: { state: "completed" }, frameCount: 2 });
  });
});
