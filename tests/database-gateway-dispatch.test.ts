import { Context } from "@deepseek-ai/cordis";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { describe, expect, it } from "vitest";

import { createScienceGatewayTools } from "../src/host/science-gateway-tools.js";
import type { ScienceExecutor } from "../src/host/science-tools.js";

function callId(value: string): ToolExecutionInput["callId"] {
  return value as ToolExecutionInput["callId"];
}

describe("database_request gateway", () => {
  it("exposes and dispatches every accepted BioBank Japan identifier through ToolRuntime", async () => {
    const calls: Array<{ args: Record<string, unknown>; operation: string; serviceId: string }> = [];
    const executor: ScienceExecutor = {
      async execute(serviceId, operation, args) {
        calls.push({ serviceId, operation, args });
        return { serviceId, operation, status: "completed" };
      },
    };
    const ctx = new Context();
    const systemPromptFiber = ctx.plugin(SystemPrompt, {});
    await systemPromptFiber;
    const toolsFiber = ctx.plugin(ToolRuntime, { mode: "native" });
    await toolsFiber;
    const unregister = createScienceGatewayTools(executor, process.cwd()).map((tool) => ctx.tools.register(tool));
    try {
      const databaseSchema = ctx.tools.schemas().find((schema) => schema.name === "database_request");
      expect(databaseSchema?.parameters).toMatchObject({
        properties: {
          rsid: { type: "string" }, grch37: { type: "string" }, grch38: { type: "string" }, variant: { type: "string" },
        },
      });

      const inputs = [
        { rsid: "rs7903146" },
        { grch37: "10:114758349-C-T" },
        { grch38: "10:112998590-C-T" },
        { variant: "10:114758349:C:T" },
      ];
      for (const [index, input] of inputs.entries()) {
        const result = await ctx.tools.execute({
          callId: callId(`bbj-gateway-${index}`),
          name: "database_request",
          arguments: { provider: "biobankjapan-phewas", ...input },
          signal: new AbortController().signal,
        });
        expect(result.isError, JSON.stringify(input)).toBe(false);
      }
      expect(calls).toEqual(inputs.map((input) => ({
        serviceId: "databases", operation: "database.request", args: { provider: "biobankjapan-phewas", ...input },
      })));
    } finally {
      for (const dispose of unregister.reverse()) dispose();
      await toolsFiber.dispose();
      await systemPromptFiber.dispose();
    }
  });
});
