import { resolve } from "node:path";

import { Context, type Fiber } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { afterEach, describe, expect, it } from "vitest";

import * as bundle from "../src/index.js";

interface HarnessFixture {
  ctx: Context;
  bundleFiber: Fiber;
  serviceFibers: Fiber[];
}

const fixtures: HarnessFixture[] = [];
const repositoryRoot = resolve(import.meta.dirname, "..");

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
  fixtures.push(fixture);
  return fixture;
}

async function execute(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({
    callId: callId(`skills-trace-${name}`),
    name,
    arguments: args,
    signal: new AbortController().signal,
  });
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0).reverse()) {
    await fixture.bundleFiber.dispose();
    for (const fiber of fixture.serviceFibers) await fiber.dispose();
  }
});

describe("representative Skill registry and DSH tool-call traces", () => {
  it("reads one Skill per service from the active DSH registry", async () => {
    const { ctx } = await mountHarness();
    const expected = [
      ["rosalind-literature-biorxiv", "literature_request"],
      ["rosalind-databases-uniprot", "database_request"],
      ["rosalind-sequence-biological-sequence-viewer", "sequence_open_from_chat"],
      ["rosalind-ngs-run-ngs-analysis", "ngs_execute_plan"],
      ["rosalind-structure-structure-viewer", "structure_get_state"],
      ["rosalind-slide-slide-viewer", "slide_get_viewer_state"],
    ] as const;

    for (const [skillName, primaryTool] of expected) {
      const skill = await ctx.skills.get(skillName, { cwd: repositoryRoot });
      expect(skill?.content, skillName).toContain(primaryTool);
      expect(ctx.tools.get(primaryTool), `${skillName}: registered tool`).toBeDefined();
    }
  });

  it("records deterministic no-network calls and live sequence viewer state", async () => {
    const priorLiveNetwork = process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;
    delete process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;
    const { ctx } = await mountHarness();
    try {
      const literature = await execute(ctx, "literature_request", {
        provider: "biorxiv", action: "details", allowNetwork: false,
      });
      expect(literature).toMatchObject({
        isError: false,
        value: { status: "failed", error: { code: "NETWORK_NOT_AUTHORIZED" } },
      });

      const database = await execute(ctx, "database_request", {
        provider: "uniprot", query: "P01116", allowNetwork: false,
      });
      expect(database).toMatchObject({
        isError: false,
        value: { status: "failed", error: { code: "NETWORK_NOT_AUTHORIZED" } },
      });

      const opened = await execute(ctx, "sequence_open_from_chat", {
        path: "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta",
      });
      expect(opened.isError).toBe(false);
      if (opened.isError) return;
      const openedValue = opened.value as { viewerSessionId?: string; status?: string };
      expect(openedValue.status).toBe("completed");
      expect(openedValue.viewerSessionId).toEqual(expect.any(String));

      const state = await execute(ctx, "sequence_query_viewer", {
        sessionId: openedValue.viewerSessionId,
        target: "alignment-metrics",
      });
      expect(state).toMatchObject({ isError: false, value: { alignedLength: 191, rowCount: 3 } });

      const workflows = await execute(ctx, "ngs_list_workflows", {});
      expect(workflows).toMatchObject({ isError: false, value: { status: "completed" } });

      for (const [name, args] of [
        ["structure_get_state", { sessionId: "unknown" }],
        ["slide_get_viewer_state", { sessionId: "unknown" }],
      ] as const) {
        const result = await execute(ctx, name, args);
        expect(result.isError, name).toBe(false);
        if (!result.isError) expect(result.value).toMatchObject({ status: "failed", error: { code: "SESSION_NOT_FOUND" } });
      }
    } finally {
      if (priorLiveNetwork === undefined) delete process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;
      else process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK = priorLiveNetwork;
    }
  });
});
