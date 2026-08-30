import { Context, type Fiber } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { afterEach, describe, expect, it } from "vitest";

import { WorkflowModuleCoordinator } from "../src/host/workflow-modules.js";

function callId(value: string): ToolExecutionInput["callId"] {
  return value as ToolExecutionInput["callId"];
}

const WORKFLOW_AGENT = { id: "workflow-modules-agent" } as NonNullable<ToolExecutionInput["agent"]>;

async function execute(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({ callId: callId(`workflow-module-${name}`), name, arguments: args, signal: new AbortController().signal, agent: WORKFLOW_AGENT });
}

describe("independent NGS and Rosalind Cordis modules", () => {
  const fibers: Fiber[] = [];

  afterEach(async () => {
    for (const fiber of fibers.splice(0).reverse()) await fiber.dispose();
  });

  it("keeps Rosalind history readable while NGS is disabled and restores new NGS calls after re-enabling", async () => {
    const ctx = new Context();
    const system = ctx.plugin(SystemPrompt, {}); await system; fibers.push(system);
    const tools = ctx.plugin(ToolRuntime, { mode: "native" }); await tools; fibers.push(tools);
    const skills = ctx.plugin(SkillRegistry, {}); await skills; fibers.push(skills);
    const coordinator = new WorkflowModuleCoordinator();

    const rosalind = ctx.plugin(coordinator.rosalindModule()); await rosalind; fibers.push(rosalind);
    expect(ctx.tools.schemas()).toHaveLength(15);
    const withoutNgs = await execute(ctx, "rosalind_open", {});
    expect(withoutNgs.isError).toBe(false);
    if (!withoutNgs.isError) expect((withoutNgs.value as { availableServices: string[] }).availableServices).not.toContain("ngs");

    const planned = await execute(ctx, "rosalind_plan", { showcase_id: "sequence-ras-alignment", mode: "lesson" });
    expect(planned.isError).toBe(false);
    if (planned.isError) return;
    const runId = String((planned.value as Record<string, unknown>).id);

    const ngs = ctx.plugin(coordinator.ngsModule()); await ngs; fibers.push(ngs);
    expect(ctx.tools.schemas().filter((schema) => schema.name.startsWith("ngs_"))).toHaveLength(25);
    expect(await ctx.skills.list({ cwd: process.cwd() })).toHaveLength(5);
    const workflows = await execute(ctx, "ngs_list_workflows", {});
    expect(workflows).toMatchObject({ isError: false, value: { status: "completed" } });
    const withNgs = await execute(ctx, "rosalind_open", {});
    expect(withNgs.isError).toBe(false);
    if (!withNgs.isError) expect((withNgs.value as { availableServices: string[] }).availableServices).toContain("ngs");

    await ngs.dispose();
    fibers.splice(fibers.indexOf(ngs), 1);
    expect(ctx.tools.get("ngs_list_workflows")).toBeUndefined();
    expect(await ctx.skills.list({ cwd: process.cwd() })).toHaveLength(0);
    const historical = await execute(ctx, "rosalind_status", { run_id: runId });
    expect(historical).toMatchObject({ isError: false, value: { id: runId, showcaseId: "sequence-ras-alignment" } });
    const disabled = await coordinator.science.execute("ngs", "list_workflows", {}, {
      session: {}, signal: new AbortController().signal, packageRoot: process.cwd(),
    });
    expect(disabled).toMatchObject({ status: "unavailable", error: { code: "NGS_MODULE_DISABLED" } });

    const restoredNgs = ctx.plugin(coordinator.ngsModule()); await restoredNgs; fibers.push(restoredNgs);
    const restoredCall = await execute(ctx, "ngs_list_workflows", {});
    expect(restoredCall).toMatchObject({ isError: false, value: { status: "completed" } });
  });
});
