import type { JsonValue, ToolDefinition } from "@deepseek-ai/dsh-tools";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { NgsPlanIdentity, RunSnapshot } from "../src/shared/types.js";
import { RosalindRuntime } from "../src/host/runtime.js";
import { NgsService } from "../src/host/science/ngs.js";
import { ScienceRuntime } from "../src/host/science/runtime.js";
import type { ScienceExecutionContext, ScienceExecutor } from "../src/host/science-tools.js";
import { createRosalindTools } from "../src/host/tools.js";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function scientificInputs() {
  const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-production-ngs-"));
  temporaryRoots.push(root);
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  const input = join(workspace, "sample_R1.fastq.gz");
  const config = join(workspace, "scientific-config.yaml");
  writeFileSync(input, "fixture-fastq", "utf8");
  writeFileSync(config, ["smoke_mode: false", "results_dir: results", "samples:", "  sample:", "    r1: sample_R1.fastq.gz", ""].join("\n"), "utf8");
  return { root, workspace, config, input };
}

async function toolCall(tools: ToolDefinition[], name: string, args: Record<string, unknown>, session: object): Promise<Record<string, JsonValue>> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool.execute(args, { agent: session, signal: new AbortController().signal } as never) as Promise<Record<string, JsonValue>>;
}

function snapshot(value: Record<string, JsonValue>): RunSnapshot {
  return value as unknown as RunSnapshot;
}

function registryName(sessionId: string): string {
  const normalized = sessionId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "session";
  const checksum = createHash("sha256").update(sessionId).digest("hex").slice(0, 20);
  return `${normalized}--${checksum}.json`;
}

class ScriptedNgsExecutor implements ScienceExecutor {
  readonly calls: Array<{ operation: string; args: Record<string, unknown> }> = [];
  private readonly observations: Array<"running" | "completed" | "failed" | "cancelled">;
  private readonly cancellation: "cancelled" | "termination_failed";

  constructor(
    observations: Array<"running" | "completed" | "failed" | "cancelled"> = ["running", "completed"],
    cancellation: "cancelled" | "termination_failed" = "cancelled",
  ) {
    this.observations = [...observations];
    this.cancellation = cancellation;
  }

  async execute(serviceId: string, operation: string, args: Record<string, unknown>, _context: ScienceExecutionContext): Promise<Record<string, JsonValue>> {
    expect(serviceId).toBe("ngs");
    this.calls.push({ operation, args: structuredClone(args) });
    if (operation === "list_workflows") return { status: "completed", workflows: [] };
    if (operation === "get_runtime_environment") return { status: "completed", runtime: { availableEngines: ["snakemake"] } };
    if (operation === "check_snakemake_readiness") return { status: "completed", ok: true, ready: true };
    if (operation === "plan_snakemake") return { status: "completed", executable: true, plan_id: "plan-retained", plan_name: "Retained scientific plan", plan_checksum: "checksum-retained" };
    if (operation === "execute_plan") return { status: "completed", state: "running", registry_run_id: "run-retained" };
    if (operation === "observe_ngs_run") {
      const state = this.observations.shift() ?? "completed";
      return { status: "completed", state, registry_run_id: "run-retained", observation: { terminal: state !== "running" } };
    }
    if (operation === "get_ngs_run_report") return { status: "completed", state: "completed", registry_run_id: "run-retained", availability: "available", report: { provenance: "fixture" } };
    if (operation === "cancel_ngs_run") return this.cancellation === "cancelled"
      ? { status: "completed", state: "cancelled", registry_run_id: String(args.registry_run_id), cancelled: true }
      : {
        status: "completed",
        state: "termination_failed",
        registry_run_id: String(args.registry_run_id),
        cancelled: false,
        cancellation_accepted: true,
        execution_settled: true,
        diagnostic: { code: "TERMINATION_FAILED" },
      };
    throw new Error(`Unexpected operation ${operation}`);
  }
}

async function createPendingNgsRun(runtime: RosalindRuntime, tools: ToolDefinition[], session: object, input: ReturnType<typeof scientificInputs>) {
  const planned = snapshot(await toolCall(tools, "rosalind_plan", {
    showcase_id: "ngs-fastq-qc",
    mode: "reproduce",
    ngs_run_directory: input.workspace,
    ngs_config_file: input.config,
    ngs_input_paths: [input.input],
  }, session));
  expect(planned.state).toBe("queued");
  expect(planned.ngs?.inputs).toEqual({ runDirectory: input.workspace, configFile: input.config, inputPaths: [input.input] });
  const pending = snapshot(await toolCall(tools, "rosalind_run", { run_id: planned.id }, session));
  expect(pending.state).toBe("awaiting_confirmation");
  expect(pending.error).toEqual({
    code: "NGS_PLAN_APPROVAL_REQUIRED",
    message: "The exact NGS plan was created for review. Approve this plan_id, plan_name, and plan_checksum through the DSH host before execution.",
  });
  expect(pending.ngs?.pendingPlan).toBeDefined();
  expect(runtime.status(session, planned.id).ngs?.pendingPlan).toEqual(pending.ngs?.pendingPlan);
  return pending;
}

function approvalArguments(run: RunSnapshot, overrides: Partial<NgsPlanIdentity> = {}) {
  const plan = run.ngs?.pendingPlan;
  if (!plan) throw new Error("Pending NGS plan was not retained.");
  return {
    run_id: run.id,
    acknowledgements: [...run.plan.confirmationReasons],
    ngs_plan_id: overrides.planId ?? plan.planId,
    ngs_plan_name: overrides.planName ?? plan.planName,
    ngs_plan_checksum: overrides.planChecksum ?? plan.planChecksum,
  };
}

describe("Rosalind NGS production plan lifecycle", () => {
  it("records declared scientific inputs in the real planner and rejects configurations that do not reference them", async () => {
    const input = scientificInputs();
    const previousStateDir = process.env.DSH_ROSALIND_STATE_DIR;
    process.env.DSH_ROSALIND_STATE_DIR = join(input.root, "state");
    const service = new NgsService();
    const context = { session: {}, signal: new AbortController().signal, packageRoot: process.cwd() };
    try {
      const planned = await service.execute("plan_snakemake", {
        workflow_id: "oai_fastq_qc",
        run_dir: input.workspace,
        config_file: input.config,
        input_paths: [input.input],
      }, context);
      expect(planned).toMatchObject({ plan_id: expect.stringMatching(/^plan-/), plan_checksum: expect.any(String) });

      const unrelatedConfig = join(input.workspace, "unrelated.yaml");
      writeFileSync(unrelatedConfig, "smoke_mode: false\nresults_dir: results\n", "utf8");
      const rejected = await service.execute("plan_snakemake", {
        workflow_id: "oai_fastq_qc",
        run_dir: input.workspace,
        config_file: unrelatedConfig,
        input_paths: [input.input],
      }, context);
      const readiness = rejected.readiness as { diagnostics?: string[] };
      expect(readiness.diagnostics?.join(" ")).toContain("absent from the selected configuration");
    } finally {
      await service.dispose();
      if (previousStateDir === undefined) delete process.env.DSH_ROSALIND_STATE_DIR;
      else process.env.DSH_ROSALIND_STATE_DIR = previousStateDir;
    }
  });

  it("uses the real NgsService planner once, saves its exact identity, and rejects mismatched approval before execution", async () => {
    const input = scientificInputs();
    const previousStateDir = process.env.DSH_ROSALIND_STATE_DIR;
    process.env.DSH_ROSALIND_STATE_DIR = join(input.root, "state");
    const runtime = new RosalindRuntime({ science: new ScienceRuntime() });
    const tools = createRosalindTools(runtime);
    const session = {};
    try {
      const pending = await createPendingNgsRun(runtime, tools, session, input);
      const plan = pending.ngs!.pendingPlan!;
      await expect(toolCall(tools, "rosalind_approve", approvalArguments(pending, { planChecksum: "wrong-checksum" }), session)).rejects.toThrow(/exact NGS plan/i);
      expect(runtime.status(session, pending.id).state).toBe("awaiting_confirmation");

      const approved = snapshot(await toolCall(tools, "rosalind_approve", approvalArguments(pending), session));
      expect(approved.state).toBe("queued");
      expect(approved.ngs?.approvedPlan).toEqual(plan);
      const failed = snapshot(await toolCall(tools, "rosalind_run", { run_id: approved.id }, session));
      expect(failed.state).toBe("failed");
      expect(failed.ngs?.pendingPlan).toEqual(plan);
      expect(failed.ngs?.approvedPlan).toEqual(plan);
      expect(failed.error?.code).toBe("BLOCKED");
    } finally {
      runtime.dispose();
      if (previousStateDir === undefined) delete process.env.DSH_ROSALIND_STATE_DIR;
      else process.env.DSH_ROSALIND_STATE_DIR = previousStateDir;
    }
  });

  it("retains the NGS registry under the stable DSH agent identity used by the Rosalind lifecycle", async () => {
    const input = scientificInputs();
    const stateRoot = join(input.root, "state");
    const previousStateDir = process.env.DSH_ROSALIND_STATE_DIR;
    process.env.DSH_ROSALIND_STATE_DIR = stateRoot;
    const science = new ScienceRuntime();
    const runtime = new RosalindRuntime({ science });
    const tools = createRosalindTools(runtime);
    const sessionId = "stable-dsh-agent";
    const session = { id: sessionId };
    const restoredService = new NgsService({ registryRoot: join(stateRoot, "ngs-registry") });
    try {
      const pending = await createPendingNgsRun(runtime, tools, session, input);
      const registryRoot = join(stateRoot, "ngs-registry");
      expect(existsSync(join(registryRoot, registryName(sessionId)))).toBe(true);
      const plan = pending.ngs!.pendingPlan!;
      const restored = await restoredService.execute("execute_plan", {
        plan_id: plan.planId,
        plan_name: plan.planName,
        plan_checksum: plan.planChecksum,
      }, {
        session: {},
        sessionId,
        signal: new AbortController().signal,
        packageRoot: process.cwd(),
      });
      expect(restored).toMatchObject({
        registry_run_id: expect.stringMatching(/^run-/),
        plan_id: plan.planId,
        state: "blocked",
      });
    } finally {
      runtime.dispose();
      await science.dispose();
      await restoredService.dispose();
      if (previousStateDir === undefined) delete process.env.DSH_ROSALIND_STATE_DIR;
      else process.env.DSH_ROSALIND_STATE_DIR = previousStateDir;
    }
  });

  it("keeps an active NGS registry run active, resumes observation without replanning, then records completion", async () => {
    const input = scientificInputs();
    const executor = new ScriptedNgsExecutor(["running", "running", "running", "completed"]);
    const runtime = new RosalindRuntime({ science: executor });
    const tools = createRosalindTools(runtime);
    const session = {};
    try {
      const pending = await createPendingNgsRun(runtime, tools, session, input);
      const approved = snapshot(await toolCall(tools, "rosalind_approve", approvalArguments(pending), session));
      const active = snapshot(await toolCall(tools, "rosalind_run", { run_id: approved.id }, session));
      expect(active.state).toBe("running");
      expect(active.progress).toBeLessThan(1);
      expect(active.ngs).toMatchObject({ pendingPlan: pending.ngs?.pendingPlan, approvedPlan: pending.ngs?.pendingPlan, registryRunId: "run-retained" });
      expect(snapshot(await toolCall(tools, "rosalind_status", { run_id: active.id }, session)).state).toBe("running");

      const completed = snapshot(await toolCall(tools, "rosalind_run", { run_id: active.id }, session));
      expect(completed.state).toBe("completed");
      expect(executor.calls.filter((call) => call.operation === "plan_snakemake")).toHaveLength(1);
      expect(executor.calls.filter((call) => call.operation === "execute_plan")).toHaveLength(1);
      expect(executor.calls.filter((call) => call.operation === "observe_ngs_run")).toHaveLength(4);
    } finally {
      runtime.dispose();
    }
  });

  it("records cancellation from the NGS registry rather than converting it to a failed run", async () => {
    const input = scientificInputs();
    const executor = new ScriptedNgsExecutor(["running", "running", "running"]);
    const runtime = new RosalindRuntime({ science: executor });
    const tools = createRosalindTools(runtime);
    const session = {};
    try {
      const pending = await createPendingNgsRun(runtime, tools, session, input);
      const approved = snapshot(await toolCall(tools, "rosalind_approve", approvalArguments(pending), session));
      const active = snapshot(await toolCall(tools, "rosalind_run", { run_id: approved.id }, session));
      expect(active.state).toBe("running");
      const cancelled = snapshot(await toolCall(tools, "rosalind_cancel", { run_id: active.id, reason: "Test cancellation." }, session));
      expect(cancelled.state).toBe("cancelled");
      expect(executor.calls.at(-1)).toMatchObject({ operation: "cancel_ngs_run", args: { registry_run_id: "run-retained" } });
    } finally {
      runtime.dispose();
    }
  });

  it("keeps Rosalind observation active when the retained NGS process reports termination_failed", async () => {
    const input = scientificInputs();
    const executor = new ScriptedNgsExecutor(["running", "running", "running", "completed"], "termination_failed");
    const runtime = new RosalindRuntime({ science: executor });
    const tools = createRosalindTools(runtime);
    const session = {};
    try {
      const pending = await createPendingNgsRun(runtime, tools, session, input);
      const approved = snapshot(await toolCall(tools, "rosalind_approve", approvalArguments(pending), session));
      const active = snapshot(await toolCall(tools, "rosalind_run", { run_id: approved.id }, session));
      expect(active.state).toBe("running");

      const unresolved = snapshot(await toolCall(tools, "rosalind_cancel", { run_id: active.id, reason: "Cancellation cannot settle." }, session));
      expect(unresolved.state).toBe("running");
      expect(unresolved.events.at(-1)?.message).toContain("termination did not settle");
      expect(snapshot(await toolCall(tools, "rosalind_status", { run_id: active.id }, session)).state).toBe("running");

      const completed = snapshot(await toolCall(tools, "rosalind_run", { run_id: active.id }, session));
      expect(completed.state).toBe("completed");
      expect(executor.calls.filter((call) => call.operation === "execute_plan")).toHaveLength(1);
      expect(executor.calls.filter((call) => call.operation === "plan_snakemake")).toHaveLength(1);
    } finally {
      runtime.dispose();
    }
  });
});
