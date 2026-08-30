import { Context, type Fiber } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { afterEach, describe, expect, it } from "vitest";

import * as bundle from "../src/index.js";
import { CapabilityRegistry } from "../src/host/capabilities.js";

const GATEWAY_NAMES = [
  "literature_request", "database_request", "slide_control_viewer",
  "slide_run_analysis_from_chat", "slide_run_pathology", "slide_query_scientific_layer",
] as const;
const ROSALIND_TOOL_NAMES = [
  "rosalind_catalog_list",
  "rosalind_showcase_get",
  "rosalind_provider_status",
  "rosalind_showcase_import",
  "rosalind_plan",
  "rosalind_approve",
  "rosalind_run",
  "rosalind_status",
  "rosalind_cancel",
  "rosalind_artifact_list",
  "rosalind_artifact_open",
  "rosalind_export",
  "rosalind_review",
] as const;
const APPROVAL_PROTECTED_TOOL_NAMES = new Set([
  "ngs_execute_plan",
  "rosalind_approve",
  "sequence_export_artifact",
  "structure_render_image",
  "structure_render_movie",
  "structure_export",
  "slide_export_dicom_object",
  "slide_prepare_dicom_upload",
  "slide_submit_dicom_upload",
]);

interface HarnessFixture {
  ctx: Context;
  bundleFiber: Fiber;
  serviceFibers: Fiber[];
}

const liveFixtures: HarnessFixture[] = [];

function callId(value: string): ToolExecutionInput["callId"] {
  return value as ToolExecutionInput["callId"];
}

async function mountHarness(): Promise<HarnessFixture> {
  const ctx = new Context();
  const systemPromptFiber = ctx.plugin(SystemPrompt, {});
  await systemPromptFiber;
  const toolsFiber = ctx.plugin(ToolRuntime, { mode: "native" });
  await toolsFiber;
  const skillsFiber = ctx.plugin(SkillRegistry, {});
  await skillsFiber;
  const bundleFiber = ctx.plugin(bundle);
  await bundleFiber;
  const fixture = { ctx, bundleFiber, serviceFibers: [skillsFiber, toolsFiber, systemPromptFiber] };
  liveFixtures.push(fixture);
  return fixture;
}

async function disposeHarness(fixture: HarnessFixture): Promise<void> {
  const index = liveFixtures.indexOf(fixture);
  if (index >= 0) liveFixtures.splice(index, 1);
  await fixture.bundleFiber.dispose();
  for (const fiber of fixture.serviceFibers) await fiber.dispose();
}

async function execute(ctx: Context, name: string, args: unknown, signal = new AbortController().signal) {
  return ctx.tools.execute({ callId: callId(`registration-test-${name}`), name, arguments: args, signal });
}

afterEach(async () => {
  for (const fixture of liveFixtures.splice(0).reverse()) await disposeHarness(fixture);
});

describe("DSH bundle registration through Cordis services", () => {
  it("registers 121 fixed operations, six Skill adapters, 13 Rosalind tools, and 55 Skills", async () => {
    const fixture = await mountHarness();
    const registry = new CapabilityRegistry();
    const schemas = fixture.ctx.tools.schemas();
    const registeredNames = new Set(schemas.map((schema) => schema.name));
    const operationNames = registry.operations.map((operation) => operation.registeredName);

    expect(schemas).toHaveLength(140);
    expect(new Set(operationNames).size).toBe(121);
    expect(operationNames.every((name) => registeredNames.has(name))).toBe(true);
    expect(GATEWAY_NAMES.every((name) => registeredNames.has(name))).toBe(true);
    expect(ROSALIND_TOOL_NAMES.every((name) => registeredNames.has(name))).toBe(true);

    const skills = await fixture.ctx.skills.list({ cwd: process.cwd() });
    expect(skills).toHaveLength(55);
    expect(new Set(skills.map((skill) => skill.name)).size).toBe(55);
    for (const summary of skills) {
      expect(summary.provider).toBe("dsh-rosalind");
      const definition = await fixture.ctx.skills.get(summary.name, { cwd: process.cwd() });
      expect(definition?.name).toBe(summary.name);
      expect(definition?.content.length).toBeGreaterThan(100);
      expect(definition?.invocation).toEqual({ modelInvocable: true, userInvocable: true });
    }

    await fixture.bundleFiber.dispose();
    expect(fixture.ctx.tools.schemas()).toHaveLength(0);
    expect(await fixture.ctx.skills.list({ cwd: process.cwd() })).toHaveLength(0);
    liveFixtures.splice(liveFixtures.indexOf(fixture), 1);
    for (const fiber of fixture.serviceFibers) await fiber.dispose();
  });

  it("checks every registered schema and presentation contract, then dispatches all 140 names through ToolRuntime", async () => {
    const { ctx } = await mountHarness();
    const schemas = ctx.tools.schemas();

    for (const schema of schemas) {
      const definition = ctx.tools.get(schema.name);
      expect(definition, schema.name).toBeDefined();
      expect(schema.parameters, schema.name).toMatchObject({ type: "object" });
      expect(definition?.output.schema, schema.name).toMatchObject({ type: "object" });

      const blocks = definition!.output.render({}, {});
      expect(blocks.length, schema.name).toBeGreaterThan(0);
      expect(definition!.output.presentationMeta?.({}, {}), schema.name).toBeTypeOf("object");
      expect(definition!.presentCall, schema.name).toBeTypeOf("function");
      expect(definition!.presentResult, schema.name).toBeTypeOf("function");
      const callView = definition!.presentCall!({});
      const resultView = definition!.presentResult!({}, { content: blocks, isError: false });
      if (callView) expect(callView, schema.name).toMatchObject({ card: "generic" });
      if (resultView) expect(resultView, schema.name).toMatchObject({ card: "generic" });

      const result = await execute(ctx, schema.name, null);
      if (result.isError) {
        if (APPROVAL_PROTECTED_TOOL_NAMES.has(schema.name)) expect(result.error.message, schema.name).toMatch(/approval/i);
        else expect(result.error.info?.code, schema.name).toBe("INVALID_ARGS");
      } else {
        expect(result.value, schema.name).toBeTypeOf("object");
        expect(result.content.length, schema.name).toBeGreaterThan(0);
      }
    }
  });

  it("executes representative valid calls without network access and reports cancellation before dispatch", async () => {
    const priorLiveNetwork = process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;
    delete process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;
    const { ctx } = await mountHarness();
    try {
      const catalogue = await execute(ctx, "rosalind_catalog_list", {});
      expect(catalogue).toMatchObject({ isError: false, value: { total: 23 } });

      const workbench = await execute(ctx, "rosalind_open", {});
      expect(workbench).toMatchObject({ isError: false, value: { status: "completed", operationCount: 121, skillCount: 55 } });

      const sequenceOpen = await execute(ctx, "sequence_open_from_chat", {
        path: "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta",
      });
      expect(sequenceOpen).toMatchObject({ isError: false, value: { status: "completed", viewer: "alignment" } });
      if (!sequenceOpen.isError) expect(sequenceOpen.value).toMatchObject({ state: { viewer: "alignment", records: expect.any(Array) } });

      const workflows = await execute(ctx, "ngs_list_workflows", {});
      expect(workflows.isError).toBe(false);
      if (!workflows.isError) expect(workflows.value).toMatchObject({ status: "completed" });

      for (const [name, args] of [
        ["sequence_query_viewer", { sessionId: "missing-session", target: "records" }],
        ["structure_get_state", { sessionId: "missing-session" }],
        ["slide_get_viewer_state", { sessionId: "missing-session" }],
      ] as const) {
        const result = await execute(ctx, name, args);
        expect(result.isError, name).toBe(false);
        if (!result.isError) {
          const value = result.value as Record<string, unknown>;
          expect(["completed", "failed"], name).toContain(value.status);
          if (name === "slide_get_viewer_state") expect(value).toMatchObject({ status: "failed", error: { code: "SESSION_NOT_FOUND" } });
        }
      }

      const literature = await execute(ctx, "literature_request", {
        provider: "biorxiv", action: "details", allowNetwork: false,
      });
      expect(literature).toMatchObject({ isError: false, value: { status: "failed", error: { code: "NETWORK_NOT_AUTHORIZED" } } });

      const database = await execute(ctx, "database_request", {
        provider: "uniprot", query: "P01116", allowNetwork: false,
      });
      expect(database).toMatchObject({ isError: false, value: { status: "failed", error: { code: "NETWORK_NOT_AUTHORIZED" } } });

      const controller = new AbortController();
      controller.abort(new Error("cancelled by registration test"));
      const cancelled = await execute(ctx, "ngs_list_workflows", {}, controller.signal);
      expect(cancelled.isError).toBe(true);
      if (cancelled.isError) expect(cancelled.error.info?.code).toBe("ABORTED_BEFORE_DISPATCH");
    } finally {
      if (priorLiveNetwork === undefined) delete process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;
      else process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK = priorLiveNetwork;
    }
  });

  it("requires the DSH approval service for NGS execution and live public-network requests", async () => {
    const { ctx } = await mountHarness();
    const plan = await execute(ctx, "ngs_plan_snakemake", {
      workflow_id: "oai_fastq_qc",
      run_dir: process.cwd(),
      display_name: "Approval fixture",
    });
    expect(plan.isError).toBe(false);
    if (plan.isError) return;
    const identity = plan.value as Record<string, unknown>;
    const attempted = await execute(ctx, "ngs_execute_plan", {
      plan_id: identity.plan_id,
      plan_name: identity.plan_name,
      plan_checksum: identity.plan_checksum,
    });
    expect(attempted.isError).toBe(true);
    if (attempted.isError) expect(attempted.error.message).toMatch(/approval|unavailable|denied/i);

    for (const [name, args] of [
      ["literature_request", { provider: "biorxiv", action: "details", allowNetwork: true }],
      ["database_request", { provider: "uniprot", query: "P01116", allowNetwork: true }],
    ] as const) {
      const request = await execute(ctx, name, args);
      expect(request.isError, name).toBe(true);
      if (request.isError) expect(request.error.message, name).toMatch(/approval|unavailable|denied/i);
    }
  });
});
