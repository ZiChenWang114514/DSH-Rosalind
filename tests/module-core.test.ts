import { Context, type Fiber, type Plugin } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import { SettingsProvider, type SettingsNamespace } from "@deepseek-ai/dsh-settings";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as bundle from "../src/index.js";
import { ModuleRegistry } from "../src/modules/registry.js";
import { MODULE_IDS, type ModuleDefinition, type ModuleId } from "../src/modules/types.js";

class MemorySettingsProvider extends SettingsProvider {
  readonly writable = true;
  private storedDocument: Record<string, unknown>;

  constructor(ctx: Context, initial: Record<string, unknown>) {
    super(ctx);
    this.storedDocument = structuredClone(initial);
  }

  snapshot(): Record<string, unknown> {
    return structuredClone(this.storedDocument);
  }

  protected async load(): Promise<Record<string, unknown>> {
    return this.snapshot();
  }

  protected async persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.storedDocument[String(ns)] = structuredClone(section);
  }
}

interface HarnessFixture {
  ctx: Context;
  fibers: Fiber[];
  settings?: MemorySettingsProvider;
}

const fixtures: HarnessFixture[] = [];

function callId(value: string): ToolExecutionInput["callId"] {
  return value as ToolExecutionInput["callId"];
}

const MODULE_AGENT = { id: "module-core-agent" } as NonNullable<ToolExecutionInput["agent"]>;

async function mount(initialSettings?: Record<string, unknown>): Promise<HarnessFixture> {
  const ctx = new Context();
  const fibers: Fiber[] = [];
  let settings: MemorySettingsProvider | undefined;
  if (initialSettings) {
    const settingsFiber = ctx.plugin(MemorySettingsProvider, initialSettings);
    await settingsFiber;
    fibers.push(settingsFiber);
    settings = ctx.settings as MemorySettingsProvider;
  }
  const systemPrompt = ctx.plugin(SystemPrompt, {});
  await systemPrompt;
  const tools = ctx.plugin(ToolRuntime, { mode: "native" });
  await tools;
  const skills = ctx.plugin(SkillRegistry, {});
  await skills;
  const root = ctx.plugin(bundle);
  await root;
  fibers.unshift(root, skills, tools, systemPrompt);
  const fixture = { ctx, fibers, ...(settings ? { settings } : {}) };
  fixtures.push(fixture);
  return fixture;
}

async function execute(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({ callId: callId(`module-core-${name}`), name, arguments: args, signal: new AbortController().signal, agent: MODULE_AGENT });
}

const MODULE_LIFECYCLE_CASES = [
  { id: "literature", showcaseId: "literature-trem2-landscape", tool: "literature_request", toolCount: 1, skillCount: 3, operationCount: 0 },
  { id: "databases", showcaseId: "databases-il6r-asthma", tool: "database_request", toolCount: 1, skillCount: 44, operationCount: 0 },
  { id: "sequence", showcaseId: "sequence-ras-alignment", tool: "sequence_open_from_chat", toolCount: 13, skillCount: 1, operationCount: 13 },
  { id: "ngs", showcaseId: "ngs-fastq-qc", tool: "ngs_list_workflows", toolCount: 25, skillCount: 5, operationCount: 25 },
  { id: "structure", showcaseId: "structure-mdm2-p53", tool: "structure_get_state", toolCount: 41, skillCount: 1, operationCount: 41 },
  { id: "slide", showcaseId: "slide-tissue-architecture", tool: "slide_get_viewer_state", toolCount: 44, skillCount: 1, operationCount: 40 },
  { id: "rosalind", showcaseId: "rosalind-molecular-design", tool: "rosalind_plan", toolCount: 15, skillCount: 0, operationCount: 2 },
] as const;

afterEach(async () => {
  for (const fixture of fixtures.splice(0).reverse()) {
    for (const fiber of fixture.fibers) await fiber.dispose();
  }
});

describe("Cordis module core", () => {
  it("exposes seven independently managed modules with catalogue-derived metadata", async () => {
    const { ctx } = await mount();
    const statuses = ctx.rosalindModules.list();
    expect(statuses.map((status) => status.id)).toEqual(MODULE_IDS);
    expect(statuses.map(({ id, version, toolCount, skillCount, showcaseCount }) => ({ id, version, toolCount, skillCount, showcaseCount }))).toEqual([
      { id: "literature", version: "0.1.5", toolCount: 1, skillCount: 3, showcaseCount: 6 },
      { id: "databases", version: "0.1.5", toolCount: 1, skillCount: 44, showcaseCount: 7 },
      { id: "sequence", version: "0.1.43", toolCount: 13, skillCount: 1, showcaseCount: 12 },
      { id: "ngs", version: "0.2.16", toolCount: 25, skillCount: 5, showcaseCount: 15 },
      { id: "structure", version: "0.1.80", toolCount: 41, skillCount: 1, showcaseCount: 15 },
      { id: "slide", version: "0.1.56", toolCount: 44, skillCount: 1, showcaseCount: 15 },
      { id: "rosalind", version: "0.2.2-research-preview", toolCount: 15, skillCount: 0, showcaseCount: 30 },
    ]);
    expect(statuses.every((status) => status.enabled)).toBe(true);
    expect(ctx.rosalindModules.status("sequence")).toMatchObject({ status: "active", providers: [{ id: "local-sequence", runnable: true }] });
  });

  it("disables and re-enables one Fiber without affecting the other modules", async () => {
    const { ctx } = await mount();
    expect(ctx.tools.schemas()).toHaveLength(140);
    expect(await ctx.skills.list({ cwd: process.cwd() })).toHaveLength(55);

    await ctx.rosalindModules.disable("sequence");
    expect(ctx.rosalindModules.status("sequence")).toMatchObject({ status: "disabled", enabled: false });
    expect(ctx.tools.schemas()).toHaveLength(127);
    expect(await ctx.skills.list({ cwd: process.cwd() })).toHaveLength(54);
    expect(ctx.tools.get("ngs_list_workflows")).toBeDefined();

    await ctx.rosalindModules.enable("sequence");
    expect(ctx.rosalindModules.status("sequence")).toMatchObject({ status: "active", enabled: true });
    expect(ctx.tools.schemas()).toHaveLength(140);
    expect(await ctx.skills.list({ cwd: process.cwd() })).toHaveLength(55);
  });

  it("retains a Rosalind run while its registrations are temporarily disabled", async () => {
    const { ctx } = await mount();
    const planned = await execute(ctx, "rosalind_plan", { showcase_id: "sequence-ras-alignment", mode: "lesson" });
    expect(planned.isError).toBe(false);
    if (planned.isError) return;
    const runId = String((planned.value as Record<string, unknown>).id);

    await ctx.rosalindModules.disable("rosalind");
    expect(ctx.tools.get("rosalind_status")).toBeUndefined();
    await ctx.rosalindModules.enable("rosalind");
    const status = await execute(ctx, "rosalind_status", { run_id: runId });
    expect(status).toMatchObject({ isError: false, value: { id: runId, showcaseId: "sequence-ras-alignment" } });
  });

  it("removes each module surface, blocks dependent Rosalind work, and restores the retained plan", async () => {
    const { ctx } = await mount();

    for (const item of MODULE_LIFECYCLE_CASES) {
      const planned = await execute(ctx, "rosalind_plan", { showcase_id: item.showcaseId, mode: "lesson" });
      expect(planned.isError, `plan before disabling ${item.id}`).toBe(false);
      if (planned.isError) continue;
      const runId = String((planned.value as Record<string, unknown>).id);

      await ctx.rosalindModules.disable(item.id);
      expect(ctx.rosalindModules.status(item.id)).toMatchObject({ status: "disabled", enabled: false });
      expect(ctx.tools.get(item.tool), `${item.id} public tool`).toBeUndefined();
      expect(ctx.tools.schemas(), `${item.id} tool count`).toHaveLength(140 - item.toolCount);
      expect(await ctx.skills.list({ cwd: process.cwd() }), `${item.id} Skill count`).toHaveLength(55 - item.skillCount);

      if (item.id === "rosalind") {
        const unavailable = await execute(ctx, "rosalind_plan", { showcase_id: item.showcaseId, mode: "lesson" });
        expect(unavailable.isError).toBe(true);
        if (unavailable.isError) expect(unavailable.error.message).toMatch(/rosalind_plan|not found|unknown|registered/i);
      } else {
        const opened = await execute(ctx, "rosalind_open", {});
        expect(opened.isError).toBe(false);
        if (!opened.isError) {
          const value = opened.value as { availableServices: string[]; operationCount: number; skillCount: number };
          expect(value.availableServices).not.toContain(item.id);
          expect(value.operationCount).toBe(121 - item.operationCount);
          expect(value.skillCount).toBe(55 - item.skillCount);
        }

        for (const [name, args] of [
          ["rosalind_plan", { showcase_id: item.showcaseId, mode: "lesson" }],
          ["rosalind_run", { run_id: runId }],
        ] as const) {
          const rejected = await execute(ctx, name, args);
          expect(rejected.isError, `${name} while ${item.id} is disabled`).toBe(true);
          if (rejected.isError) expect(rejected.error.message).toMatch(new RegExp(`${item.id}.*disabled`, "i"));
        }
        const retained = await execute(ctx, "rosalind_status", { run_id: runId });
        expect(retained).toMatchObject({ isError: false, value: { id: runId, state: "queued" } });
      }

      await ctx.rosalindModules.enable(item.id);
      const restoredStatus = ctx.rosalindModules.status(item.id);
      expect(restoredStatus.enabled).toBe(true);
      expect(["active", "needs_setup"]).toContain(restoredStatus.status);
      expect(ctx.tools.get(item.tool), `${item.id} restored tool`).toBeDefined();
      expect(ctx.tools.schemas()).toHaveLength(140);
      expect(await ctx.skills.list({ cwd: process.cwd() })).toHaveLength(55);

      const opened = await execute(ctx, "rosalind_open", {});
      expect(opened.isError).toBe(false);
      if (!opened.isError) {
        const value = opened.value as { availableServices: string[]; operationCount: number; skillCount: number };
        expect(value.availableServices).toContain(item.id);
        expect(value.operationCount).toBe(121);
        expect(value.skillCount).toBe(55);
      }
      const completed = await execute(ctx, "rosalind_run", { run_id: runId });
      expect(completed).toMatchObject({ isError: false, value: { id: runId, state: "completed" } });
    }
  });

  it("blocks Rosalind cross-module Showcases when their required service is disabled", async () => {
    const { ctx } = await mount();
    for (const [id, showcaseId] of [
      ["sequence", "rosalind-genomics"],
      ["ngs", "rosalind-scientific-compute"],
      ["structure", "rosalind-structure-analysis"],
    ] as const) {
      await ctx.rosalindModules.disable(id);
      const rejected = await execute(ctx, "rosalind_plan", { showcase_id: showcaseId, mode: "lesson" });
      expect(rejected.isError).toBe(true);
      if (rejected.isError) expect(rejected.error.message).toMatch(new RegExp(`${id}.*disabled`, "i"));
      await ctx.rosalindModules.enable(id);
      const restored = await execute(ctx, "rosalind_plan", { showcase_id: showcaseId, mode: "lesson" });
      expect(restored.isError).toBe(false);
    }
  });

  it("reports every missing module when multiple Rosalind dependencies are disabled", async () => {
    const { ctx } = await mount();
    await ctx.rosalindModules.disable("sequence");
    await ctx.rosalindModules.disable("ngs");

    const rejected = await execute(ctx, "rosalind_plan", { showcase_id: "rosalind-fastq-qc", mode: "lesson" });
    expect(rejected.isError).toBe(true);
    if (rejected.isError) {
      expect(rejected.error.message).toMatch(/sequence.*ngs.*disabled/i);
    }

    const opened = await execute(ctx, "rosalind_open", {});
    expect(opened).toMatchObject({
      isError: false,
      value: {
        operationCount: 83,
        skillCount: 49,
      },
    });
    if (!opened.isError) {
      expect((opened.value as { availableServices: string[] }).availableServices).not.toEqual(expect.arrayContaining(["sequence", "ngs"]));
    }

    await ctx.rosalindModules.enable("sequence");
    await ctx.rosalindModules.enable("ngs");
    const restored = await execute(ctx, "rosalind_plan", { showcase_id: "rosalind-fastq-qc", mode: "lesson" });
    expect(restored.isError).toBe(false);
  });

  it("keeps one NGS session registry across module suspension and reactivation", async () => {
    const { ctx } = await mount();
    const workflowId = "module_core_retained_workflow";
    const saved = await execute(ctx, "ngs_save_workflow", {
      workflow_id: workflowId,
      name: "Module core retained workflow",
      engine: "snakemake",
      source: { kind: "local", root: process.cwd(), entrypoint: "workflows/oai_fastq_qc/workflow/Snakefile" },
    });
    expect(saved.isError).toBe(false);

    await ctx.rosalindModules.disable("ngs");
    expect(ctx.tools.get("ngs_list_workflows")).toBeUndefined();
    await ctx.rosalindModules.enable("ngs");
    const listed = await execute(ctx, "ngs_list_workflows", {});
    expect(listed.isError).toBe(false);
    if (!listed.isError) {
      const workflows = (listed.value as { workflows: Array<{ workflow_id: string }> }).workflows;
      expect(workflows.some((workflow) => workflow.workflow_id === workflowId)).toBe(true);
    }
  });

  it("restores and persists the seven-module selection through DSH settings", async () => {
    const initial = {
      "dsh-rosalind-modules": {
        modules: { sequence: false },
      },
    };
    const { ctx, settings } = await mount(initial);
    await vi.waitFor(() => expect(ctx.rosalindModules.status("sequence").status).toBe("disabled"));
    expect(ctx.rosalindModules.status("ngs").status).toBe("active");
    await vi.waitFor(() => expect(settings?.snapshot()).toMatchObject({
      "dsh-rosalind-modules": {
        runtime: {
          sequence: { status: "disabled", enabled: false, version: "0.1.43", toolCount: 13 },
          literature: {
            status: "needs_setup",
            enabled: true,
            providers: expect.arrayContaining([expect.objectContaining({ id: "ncbi-entrez", runnable: false })]),
          },
        },
      },
    }));

    await ctx.rosalindModules.enable("sequence");
    await ctx.rosalindModules.enable("sequence");
    expect(settings?.snapshot()).toMatchObject({
      "dsh-rosalind-modules": {
        modules: { sequence: true, ngs: true, rosalind: true },
      },
    });
    expect(ctx.tools.get("sequence_open_from_chat")).toBeDefined();

    await ctx.rosalindModules.disable("sequence");
    await ctx.rosalindModules.disable("sequence");
    expect(settings?.snapshot()).toMatchObject({
      "dsh-rosalind-modules": {
        modules: { sequence: false, ngs: true, rosalind: true },
      },
    });
    expect(ctx.tools.get("sequence_open_from_chat")).toBeUndefined();

    await ctx.rosalindModules.enable("sequence");
    expect(ctx.rosalindModules.status("sequence")).toMatchObject({ status: "active", enabled: true });
    await vi.waitFor(() => expect(settings?.snapshot()).toMatchObject({
      "dsh-rosalind-modules": { runtime: { sequence: { status: "active", enabled: true } } },
    }));
  });

  it("retains module state after a settings write error and clears the diagnostic on retry", async () => {
    const ctx = new Context();
    const definitions: ModuleDefinition[] = MODULE_IDS.map((id) => ({
      id,
      name: id,
      version: "1.0.0",
      pluginId: id,
      plugin: { name: id, apply() {} },
      toolCount: 0,
      skillCount: 0,
      showcaseCount: 0,
      checkProviders: () => [],
    }));
    let rejectWrite = true;
    const persist = vi.fn(async () => {
      if (rejectWrite) {
        rejectWrite = false;
        throw new Error("fixture settings write failed");
      }
    });
    const registry = new ModuleRegistry(ctx, definitions, { persist });
    try {
      await registry.start();
      await expect(registry.disable("literature")).rejects.toThrow(/fixture settings write failed/);
      expect(registry.status("literature")).toMatchObject({ status: "disabled", enabled: false });
      expect(registry.status("databases").issues).toContainEqual(expect.stringContaining("settings could not be saved"));

      await registry.disable("literature");
      expect(registry.status("databases").issues).toEqual([]);
      expect(persist).toHaveBeenCalledTimes(2);
    } finally {
      await registry.destroy();
    }
  });

  it("reports provider setup and startup failures, then disposes every active Fiber", async () => {
    const ctx = new Context();
    const disposed: ModuleId[] = [];
    let sequenceStarts = 0;
    let failedSequenceFiberDisposals = 0;
    let databaseProviderFails = true;
    const definitions: ModuleDefinition[] = MODULE_IDS.map((id) => {
      const plugin: Plugin<void> = id === "sequence"
        ? {
            name: id,
            apply(moduleContext) {
              sequenceStarts += 1;
              if (sequenceStarts === 1) {
                moduleContext.effect(() => () => { failedSequenceFiberDisposals += 1; }, "fixture failed startup cleanup");
                throw new Error("fixture startup failure");
              }
              return () => { disposed.push(id); };
            },
          }
        : { name: id, apply() { return () => { disposed.push(id); }; } };
      return {
        id,
        name: id,
        version: "1.0.0",
        pluginId: id,
        plugin,
        toolCount: 0,
        skillCount: 0,
        showcaseCount: 0,
        checkProviders: () => {
          if (id === "databases" && databaseProviderFails) throw new Error("fixture provider status failure");
          return id === "literature" ? [{
            id: "fixture-provider",
            label: "Fixture provider",
            kind: "public-api",
            installed: false,
            credentialRequired: false,
            credentialConfigured: true,
            runnable: false,
            diagnostics: ["Provider setup is incomplete."],
            checkedAt: "2026-08-30T00:00:00.000Z",
          }] : [];
        },
      };
    });
    const sharedDispose = vi.fn();
    const registry = new ModuleRegistry(ctx, definitions, { disposeShared: sharedDispose });
    await registry.start();
    expect(registry.status("literature")).toMatchObject({ status: "needs_setup", issues: [expect.stringContaining("Provider setup is incomplete")] });
    expect(registry.status("databases")).toMatchObject({ status: "error", issues: [expect.stringContaining("fixture provider status failure")] });
    expect(registry.isActive("databases")).toBe(false);
    expect(registry.status("sequence")).toMatchObject({ status: "error", issues: [expect.stringContaining("fixture startup failure")] });
    expect(registry.isActive("sequence")).toBe(false);
    expect(failedSequenceFiberDisposals).toBe(1);

    databaseProviderFails = false;
    expect(registry.status("databases")).toMatchObject({ status: "active", issues: [] });
    expect(registry.isActive("databases")).toBe(true);

    await registry.enable("sequence");
    await registry.enable("sequence");
    expect(registry.status("sequence")).toMatchObject({ status: "active", enabled: true, issues: [] });
    expect(registry.isActive("sequence")).toBe(true);

    await registry.destroy();
    expect(sharedDispose).toHaveBeenCalledOnce();
    expect(registry.list().every((status) => status.status === "disabled")).toBe(true);
    expect(disposed.sort()).toEqual(MODULE_IDS.slice().sort());
  });
});
