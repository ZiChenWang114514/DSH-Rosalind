import { assertObjectJsonSchema, validateJsonSchemaValue, type JsonSchemaNode } from "@deepseek-ai/dsh-tools";
import { describe, expect, it } from "vitest";

import { CapabilityRegistry } from "../src/host/capabilities.js";
import { createScienceGatewayTools } from "../src/host/science-gateway-tools.js";
import { createScienceTools } from "../src/host/science-tools.js";
import { ScienceRuntime } from "../src/host/science/runtime.js";
import type { NgsService } from "../src/host/science/ngs.js";

const signal = new AbortController().signal;

function violations(schema: JsonSchemaNode, value: unknown): string[] {
  return validateJsonSchemaValue(schema, value, "value");
}

describe("science tool output schemas", () => {
  it("keeps normalized identity and lifecycle fields authoritative", async () => {
    const ngs = {
      execute: async () => ({ serviceId: "raw-service", operation: "raw-operation", status: "failed", ok: true }),
    } as unknown as NgsService;
    const runtime = new ScienceRuntime({ ngs });
    await expect(runtime.execute("ngs", "list_workflows", {}, { session: {}, signal, packageRoot: process.cwd() })).resolves.toMatchObject({
      serviceId: "ngs",
      operation: "list_workflows",
      status: "completed",
      ok: true,
    });
  });

  it("validates module-disabled, missing-run, and consumed-plan NGS results", async () => {
    const registry = new CapabilityRegistry();
    const disabled = new ScienceRuntime({ ngs: null });
    const disabledResult = await disabled.execute("ngs", "list_workflows", {}, { session: {}, signal, packageRoot: registry.packageRoot });
    const disabledTool = createScienceTools(disabled, registry).find((candidate) => candidate.name === "ngs_list_workflows")!;
    expect(disabledResult).toMatchObject({ status: "unavailable", module: "ngs-analysis-workbench", moduleStatus: { enabled: false }, error: { code: "NGS_MODULE_DISABLED" } });
    expect(violations(disabledTool.output.schema, disabledResult)).toEqual([]);

    const runtime = new ScienceRuntime();
    const session = {};
    const context = { session, signal, packageRoot: registry.packageRoot };
    const missing = await runtime.execute("ngs", "get_ngs_run", { registry_run_id: "run-missing" }, context);
    const tools = createScienceTools(runtime, registry);
    const getRunTool = tools.find((candidate) => candidate.name === "ngs_get_ngs_run")!;
    expect(missing).toMatchObject({ status: "failed", error: { code: "NGS_RUN_NOT_FOUND" } });
    expect(violations(getRunTool.output.schema, missing)).toEqual([]);

    const plan = await runtime.execute("ngs", "plan_snakemake", { workflow_id: "oai_fastq_qc", run_dir: registry.packageRoot }, context);
    const identity = { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum };
    await runtime.execute("ngs", "execute_plan", identity, context);
    const repeated = await runtime.execute("ngs", "execute_plan", identity, context);
    const executeTool = tools.find((candidate) => candidate.name === "ngs_execute_plan")!;
    expect(repeated).toMatchObject({ reason: "PLAN_ALREADY_CONSUMED", reused: true });
    expect(violations(executeTool.output.schema, repeated)).toEqual([]);
  });

  it("describes sequence search hits and slide diagnostic notes exactly", () => {
    const tools = createScienceTools(new ScienceRuntime(), new CapabilityRegistry());
    const sequenceQuery = tools.find((candidate) => candidate.name === "sequence_query_viewer")!;
    expect(violations(sequenceQuery.output.schema, {
      serviceId: "sequence", operation: "sequence.query_viewer", status: "completed", target: "search",
      query: "GKS", hits: [{ record: "P01116", start: 10, end: 12 }], selectedHit: 0,
    })).toEqual([]);
    expect(violations(sequenceQuery.output.schema, {
      serviceId: "sequence", operation: "sequence.query_viewer", status: "completed", target: "search",
      query: { value: "GKS" }, hits: [{ record: "P01116", start: "10", end: 12 }], selectedHit: "0",
    }).length).toBeGreaterThan(0);

    const slideOpen = tools.find((candidate) => candidate.name === "slide_open_from_chat")!;
    expect(violations(slideOpen.output.schema, {
      serviceId: "slide", operation: "slide.open_from_chat", status: "completed", ok: true,
      note: { code: "PIXEL_CODEC_UNAVAILABLE", message: "Codec is unavailable.", diagnostic: { code: "TIFF_PIXEL_CODEC_UNAVAILABLE", message: "Compressed source." } },
    })).toEqual([]);
  });

  it("declares a strict normalized result contract for all 121 fixed operations", () => {
    const runtime = new ScienceRuntime();
    const registry = new CapabilityRegistry();
    const tools = createScienceTools(runtime, registry);

    expect(tools).toHaveLength(121);
    for (const [index, tool] of tools.entries()) {
      const contract = registry.operations[index]!;
      const schema = tool.output.schema;
      expect(() => assertObjectJsonSchema(schema), tool.name).not.toThrow();
      expect(schema, tool.name).toMatchObject({
        type: "object",
        required: ["serviceId", "operation", "status"],
        additionalProperties: false,
        properties: {
          serviceId: { type: "string", const: contract.record.serviceId },
          operation: { type: "string", const: contract.record.operation },
          status: { type: "string" },
          error: {
            type: "object",
            required: ["code", "message"],
            additionalProperties: false,
          },
        },
      });
    }
  });

  it("declares the same strict contract for all six gateway tools", () => {
    const tools = createScienceGatewayTools(new ScienceRuntime(), process.cwd());
    const identities = [
      ["literature", "literature.request"],
      ["databases", "database.request"],
      ["slide", "slide.control_viewer"],
      ["slide", "slide.run_analysis_from_chat"],
      ["slide", "slide.run_pathology"],
      ["slide", "slide.query_scientific_layer"],
    ] as const;

    expect(tools).toHaveLength(identities.length);
    for (const [index, tool] of tools.entries()) {
      const [serviceId, operation] = identities[index]!;
      const schema = tool.output.schema;
      expect(() => assertObjectJsonSchema(schema), tool.name).not.toThrow();
      expect(schema).toMatchObject({
        required: ["serviceId", "operation", "status"],
        additionalProperties: false,
        properties: {
          serviceId: { const: serviceId },
          operation: { const: operation },
        },
      });
    }
  });

  it("rejects missing identity, unknown top-level fields, and malformed diagnostics", () => {
    const registry = new CapabilityRegistry();
    const tool = createScienceTools(new ScienceRuntime(), registry).find((candidate) => candidate.name === "ngs_list_workflows")!;
    const schema = tool.output.schema;

    expect(violations(schema, { serviceId: "ngs", operation: "list_workflows" })).toContain('missing required property "value.status"');
    expect(violations(schema, {
      serviceId: "ngs", operation: "list_workflows", status: "completed", statuz: "completed",
    })).toContain('"value.statuz" is not a declared property (additionalProperties: false)');
    expect(violations(schema, {
      serviceId: "ngs",
      operation: "list_workflows",
      status: "failed",
      error: { code: "EXAMPLE_FAILURE", detail: "message was misspelled" },
    })).toEqual(expect.arrayContaining([
      'missing required property "value.error.message"',
      '"value.error.detail" is not a declared property (additionalProperties: false)',
    ]));
    expect(violations(schema, {
      serviceId: "slide", operation: "list_workflows", status: "completed", workflows: [],
    }).length).toBeGreaterThan(0);
  });

  it("keeps structure contracts operation-specific and type-safe", () => {
    const tools = createScienceTools(new ScienceRuntime(), new CapabilityRegistry());
    const getState = tools.find((candidate) => candidate.name === "structure_get_state")!;
    const renderStatus = tools.find((candidate) => candidate.name === "structure_get_render_status")!;

    // These fields occur in the real state result.  A different operation must
    // never be able to smuggle them through with a plausible but wrong type.
    expect(violations(getState.output.schema, {
      serviceId: "structure", operation: "get_state", status: "completed",
      sceneRevision: "1", viewerReady: "true",
    })).toEqual(expect.arrayContaining([
      '"value.sceneRevision" must be a number',
      '"value.viewerReady" must be a boolean',
    ]));
    expect(violations(getState.output.schema, {
      serviceId: "structure", operation: "get_state", status: "completed", job: { id: "render-1", state: "completed" },
    })).toContain('"value.job" is not a declared property (additionalProperties: false)');
    expect(violations(renderStatus.output.schema, {
      serviceId: "structure", operation: "get_render_status", status: "completed", job: { id: "render-1", state: 7 },
    })).toContain('"value.job.state" must be a string');
    expect(violations(renderStatus.output.schema, {
      serviceId: "structure", operation: "get_render_status", status: "running",
    })).toEqual(expect.arrayContaining([expect.stringContaining("value.status")]));
  });

  it("accepts nullable viewer payloads only where the fixed contract permits them", () => {
    const tools = createScienceTools(new ScienceRuntime(), new CapabilityRegistry());
    const slideOpen = tools.find((candidate) => candidate.name === "slide_open_from_chat")!;
    expect(violations(slideOpen.output.schema, {
      serviceId: "slide", operation: "slide.open_from_chat", status: "completed", ok: true,
      previewTile: null,
    })).toEqual([]);
    const structureState = tools.find((candidate) => candidate.name === "structure_get_state")!;
    expect(violations(structureState.output.schema, {
      serviceId: "structure", operation: "get_state", status: "completed", previewTile: null,
    })).toContain('"value.previewTile" is not a declared property (additionalProperties: false)');
    const structureQuery = tools.find((candidate) => candidate.name === "structure_query")!;
    expect(violations(structureQuery.output.schema, {
      serviceId: "structure", operation: "structure.query", status: "completed",
      ok: true, level: "atom", items: [], total: 0, nextCursor: null, sceneRevision: 1,
    })).toEqual([]);
    expect(violations(structureQuery.output.schema, {
      serviceId: "structure", operation: "structure.query", status: "completed", nextCursor: 7,
    }).length).toBeGreaterThan(0);
  });

  it("accepts the actual diagnostic-shaped result from every fixed operation", async () => {
    const runtime = new ScienceRuntime();
    const registry = new CapabilityRegistry();
    const tools = createScienceTools(runtime, registry);
    const context = { session: {}, signal, packageRoot: registry.packageRoot };

    for (const [index, contract] of registry.operations.entries()) {
      const value = await runtime.execute(contract.record.serviceId, contract.record.operation, {}, context);
      expect(violations(tools[index]!.output.schema, value), contract.registeredName).toEqual([]);
    }
  });

  it("accepts representative successful and diagnostic runtime values without affecting presentation", async () => {
    const runtime = new ScienceRuntime();
    const registry = new CapabilityRegistry();
    const fixed = createScienceTools(runtime, registry);
    const gateways = createScienceGatewayTools(runtime, registry.packageRoot);
    const context = { session: {}, signal, packageRoot: registry.packageRoot, allowNetwork: false };

    const successful = await runtime.execute("ngs", "list_workflows", {}, context);
    const successTool = fixed.find((candidate) => candidate.name === "ngs_list_workflows")!;
    expect(successful).toMatchObject({ serviceId: "ngs", operation: "list_workflows", status: "completed", workflows: expect.any(Array) });
    expect(violations(successTool.output.schema, successful)).toEqual([]);
    expect(successTool.output.render({}, successful)).toHaveLength(1);
    expect(successTool.output.presentationMeta?.({}, successful)).toMatchObject({ serviceId: "ngs", operation: "list_workflows", status: "completed" });

    const diagnostic = await runtime.execute("literature", "literature.request", {
      provider: "biorxiv", action: "details",
    }, context);
    const literatureTool = gateways.find((candidate) => candidate.name === "literature_request")!;
    expect(diagnostic).toMatchObject({
      serviceId: "literature",
      operation: "literature.request",
      status: "failed",
      error: { code: "NETWORK_NOT_AUTHORIZED" },
    });
    expect(violations(literatureTool.output.schema, diagnostic)).toEqual([]);
    const content = literatureTool.output.render({}, diagnostic);
    const meta = literatureTool.output.presentationMeta?.({}, diagnostic);
    expect(content).toHaveLength(1);
    expect(meta).toMatchObject({ status: "failed" });
    const presented = { isError: false as const, content, ...(meta === undefined ? {} : { meta }) };
    expect(literatureTool.presentResult?.({}, presented)).toMatchObject({
      title: "Literature request failed",
      content: [{ type: "text", text: expect.stringContaining("NETWORK_NOT_AUTHORIZED") }],
    });
    expect(literatureTool.presentResult?.({}, presented)).toMatchObject({
      content: [{ text: expect.stringContaining(String((diagnostic.error as { message: string }).message)) }],
    });
  });
});
