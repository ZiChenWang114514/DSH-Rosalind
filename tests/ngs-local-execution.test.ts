import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { NgsService } from "../src/host/science/ngs.js";

function context(session: object, packageRoot: string) {
  return { session, packageRoot, signal: new AbortController().signal };
}

function installFakeEngine(bin: string, name: "nextflow" | "snakemake"): void {
  if (process.platform === "win32") {
    writeFileSync(join(bin, `${name}.cmd`), "@echo off\r\necho fake stdout %*\r\necho fake stderr %* 1>&2\r\nif \"%FAKE_NGS_MODE%\"==\"slow\" timeout /t 5 /nobreak >nul\r\nif \"%FAKE_NGS_MODE%\"==\"fail\" exit /b 7\r\nexit /b 0\r\n", "utf8");
    return;
  }
  const executable = join(bin, name);
  writeFileSync(executable, "#!/bin/sh\necho \"fake stdout $*\"\necho \"fake stderr $*\" >&2\nif [ \"$FAKE_NGS_MODE\" = slow ]; then sleep 5; fi\nif [ \"$FAKE_NGS_MODE\" = fail ]; then exit 7; fi\n", "utf8");
  chmodSync(executable, 0o755);
}

async function waitForState(service: NgsService, session: object, root: string, registryRunId: string, expected: string): Promise<Record<string, unknown>> {
  const expires = Date.now() + 5_000;
  while (Date.now() < expires) {
    const run = await service.execute("get_ngs_run", { registry_run_id: registryRunId }, context(session, root));
    if (run.state === expected) return run;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error(`Run ${registryRunId} did not reach ${expected}.`);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    return (cause as NodeJS.ErrnoException).code === "EPERM";
  }
}

describe("NgsService local engine execution", () => {
  const originalPath = process.env.PATH;
  const originalMode = process.env.FAKE_NGS_MODE;

  afterEach(() => {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalMode === undefined) delete process.env.FAKE_NGS_MODE;
    else process.env.FAKE_NGS_MODE = originalMode;
  });

  it("starts the reviewed local Nextflow command and records its successful lifecycle and summaries", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-execute-"));
    const bin = join(root, "bin");
    const workflow = join(root, "workflow.nf");
    const params = join(root, "params.json");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "nextflow");
    writeFileSync(workflow, "workflow { println 'fixture' }\n", "utf8");
    writeFileSync(params, "{}\n", "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`;

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "local-nextflow", name: "Local Nextflow", engine: "nextflow", source: { kind: "local", root, entrypoint: "workflow.nf" } }, context(session, root));
    const plan = await service.execute("plan_nextflow", { workflow_id: "local-nextflow", run_dir: root, params_file: params, profile: "fixture" }, context(session, root));
    expect(plan.executable).toBe(true);
    expect(plan.command).toMatchObject({ executable: join(bin, process.platform === "win32" ? "nextflow.cmd" : "nextflow"), cwd: root });
    expect((plan.command as { arguments: string[] }).arguments).toEqual(expect.arrayContaining(["run", workflow, "-params-file", params, "-profile", "fixture"]));

    const started = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    const completed = await waitForState(service, session, root, String(started.registry_run_id), "completed");
    expect(completed).toMatchObject({ state: "completed", exit_code: 0 });
    expect(completed.stdout_summary).toContain("fake stdout run");
    expect(completed.stderr_summary).toContain("fake stderr run");
    expect((completed.events as Array<Record<string, unknown>>).map((event) => event.state)).toEqual(expect.arrayContaining(["queued", "running", "completed"]));
  });

  it("records a non-zero local Snakemake exit and its stderr", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-fail-"));
    const bin = join(root, "bin");
    const workflow = join(root, "Snakefile");
    const config = join(root, "config.json");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "snakemake");
    writeFileSync(workflow, "rule all:\n  input: []\n", "utf8"); writeFileSync(config, "{}\n", "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`; process.env.FAKE_NGS_MODE = "fail";

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "local-snakemake", name: "Local Snakemake", engine: "snakemake", source: { kind: "local", root, entrypoint: "Snakefile" } }, context(session, root));
    const plan = await service.execute("plan_snakemake", { workflow_id: "local-snakemake", run_dir: root, config_file: config, cores: 2 }, context(session, root));
    const started = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    const failed = await waitForState(service, session, root, String(started.registry_run_id), "failed");
    expect(failed).toMatchObject({ state: "failed", exit_code: 7 });
    expect(failed.stderr_summary).toContain("fake stderr --snakefile");
  });

  it("terminates a running local command on cancellation and retains its cancellation record", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-cancel-"));
    const bin = join(root, "bin");
    const workflow = join(root, "Snakefile");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "snakemake"); writeFileSync(workflow, "rule all:\n  input: []\n", "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`; process.env.FAKE_NGS_MODE = "slow";

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "slow-snakemake", name: "Slow Snakemake", engine: "snakemake", source: { kind: "local", root, entrypoint: "Snakefile" } }, context(session, root));
    const plan = await service.execute("plan_snakemake", { workflow_id: "slow-snakemake", run_dir: root }, context(session, root));
    const started = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    expect(started.state).toBe("running");
    const cancelled = await service.execute("cancel_ngs_run", { registry_run_id: started.registry_run_id }, context(session, root));
    expect(cancelled).toMatchObject({ cancelled: true, state: "cancelled" });
    const observed = await waitForState(service, session, root, String(started.registry_run_id), "cancelled");
    expect(observed.cancellation_requested).toBe(true);
    expect((observed.events as Array<Record<string, unknown>>).some((event) => String(event.message).includes("Cancellation requested"))).toBe(true);
  });

  it("terminates active local commands when the NGS service is disposed", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-dispose-"));
    const bin = join(root, "bin");
    const workflow = join(root, "Snakefile");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "snakemake");
    writeFileSync(workflow, "rule all:\n  input: []\n", "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`;
    process.env.FAKE_NGS_MODE = "slow";

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "dispose-snakemake", name: "Dispose Snakemake", engine: "snakemake", source: { kind: "local", root, entrypoint: "Snakefile" } }, context(session, root));
    const plan = await service.execute("plan_snakemake", { workflow_id: "dispose-snakemake", run_dir: root }, context(session, root));
    const started = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    expect(started.state).toBe("running");
    const pid = Number((started as Record<string, unknown>).process_id);
    expect(pid).toBeGreaterThan(0);
    expect(processIsAlive(pid)).toBe(true);

    const disposedRuns = await service.dispose();
    expect(disposedRuns).toHaveLength(1);
    const disposed = disposedRuns[0]!;
    expect(disposed).toMatchObject({ state: "cancelled", process_id: pid, cancellation_requested: true });
    expect((disposed.events as Array<Record<string, unknown>>).some((event) => String(event.message).includes("Plugin disposal"))).toBe(true);
    expect(processIsAlive(pid)).toBe(false);
    await expect(service.execute("list_ngs_runs", {}, context(session, root))).rejects.toThrow(/disposed/i);
  });
});
