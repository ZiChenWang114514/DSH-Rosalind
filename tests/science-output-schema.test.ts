import { assertObjectJsonSchema, validateJsonSchemaValue, type JsonSchemaNode } from "@deepseek-ai/dsh-tools";
import { describe, expect, it } from "vitest";

import { CapabilityRegistry } from "../src/host/capabilities.js";
import { createScienceGatewayTools } from "../src/host/science-gateway-tools.js";
import { createScienceTools } from "../src/host/science-tools.js";
import { ScienceRuntime } from "../src/host/science/runtime.js";

const signal = new AbortController().signal;

function violations(schema: JsonSchemaNode, value: unknown): string[] {
  return validateJsonSchemaValue(schema, value, "value");
}

describe("science tool output schemas", () => {
  it("declares a strict normalized result contract for all 117 fixed operations", () => {
    const runtime = new ScienceRuntime();
    const registry = new CapabilityRegistry();
    const tools = createScienceTools(runtime, registry);

    expect(tools).toHaveLength(117);
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
    expect(literatureTool.output.render({}, diagnostic)).toHaveLength(1);
    expect(literatureTool.output.presentationMeta?.({}, diagnostic)).toMatchObject({ status: "failed" });
  });
});
