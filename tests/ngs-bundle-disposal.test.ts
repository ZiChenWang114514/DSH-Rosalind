import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Context, type Fiber } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { afterEach, describe, expect, it } from "vitest";

import * as bundle from "../src/index.js";

function callId(value: string): ToolExecutionInput["callId"] {
  return value as ToolExecutionInput["callId"];
}

function installSlowSnakemake(bin: string): void {
  if (process.platform === "win32") {
    writeFileSync(join(bin, "snakemake.cmd"), "@echo off\r\necho bundle lifecycle fixture\r\ntimeout /t 30 /nobreak >nul\r\n", "utf8");
    return;
  }
  const executable = join(bin, "snakemake");
  writeFileSync(executable, "#!/bin/sh\necho 'bundle lifecycle fixture'\nsleep 30\n", "utf8");
  chmodSync(executable, 0o755);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    return (cause as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function execute(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({
    callId: callId(`ngs-bundle-disposal-${name}`),
    name,
    arguments: args,
    signal: new AbortController().signal,
  });
}

describe("DSH bundle NGS process lifecycle", () => {
  const originalPath = process.env.PATH;
  const fibers: Fiber[] = [];

  afterEach(async () => {
    for (const fiber of fibers.splice(0).reverse()) await fiber.dispose();
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
  });

  it("stops a running workflow before bundle disposal completes", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-bundle-dispose-"));
    const bin = join(root, "bin");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installSlowSnakemake(bin);
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`;

    const ctx = new Context();
    const system = ctx.plugin(SystemPrompt, {}); await system; fibers.push(system);
    const tools = ctx.plugin(ToolRuntime, { mode: "native" }); await tools; fibers.push(tools);
    const skills = ctx.plugin(SkillRegistry, {}); await skills; fibers.push(skills);

    // This listener is registered before the bundle and is limited to this
    // lifecycle test, allowing the already-reviewed fixture command to run.
    const allowFixture = ctx.on("tools/pre-execute", async () => ({ kind: "allow" as const }));
    const plugin = ctx.plugin(bundle); await plugin; fibers.push(plugin);

    const planned = await execute(ctx, "ngs_plan_snakemake", {
      workflow_id: "oai_fastq_qc",
      run_dir: root,
      display_name: "Bundle disposal fixture",
    });
    expect(planned.isError).toBe(false);
    if (planned.isError) return;
    const plan = planned.value as Record<string, unknown>;

    const started = await execute(ctx, "ngs_execute_plan", {
      plan_id: plan.plan_id,
      plan_name: plan.plan_name,
      plan_checksum: plan.plan_checksum,
    });
    expect(started.isError).toBe(false);
    if (started.isError) return;
    const pid = Number((started.value as Record<string, unknown>).process_id);
    expect(pid).toBeGreaterThan(0);
    expect(processIsAlive(pid)).toBe(true);

    await plugin.dispose();
    fibers.splice(fibers.indexOf(plugin), 1);
    allowFixture();

    expect(processIsAlive(pid)).toBe(false);
    expect(ctx.tools.schemas()).toHaveLength(0);
  });
});
