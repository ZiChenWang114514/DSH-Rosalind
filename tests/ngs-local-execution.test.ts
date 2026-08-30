import { chmodSync, copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { NgsService } from "../src/host/science/ngs.js";

function context(session: object, packageRoot: string) {
  return { session, packageRoot, signal: new AbortController().signal };
}

function installFakeEngine(bin: string, name: "nextflow" | "snakemake"): void {
  if (process.platform === "win32") {
    if (name === "nextflow") {
      copyFileSync(process.execPath, join(bin, "nextflow.exe"));
      writeFileSync(join(bin, "..", "run"), "console.log('fake stdout run ' + JSON.stringify(process.argv.slice(2))); console.error('fake stderr run ' + JSON.stringify(process.argv.slice(2))); if (process.env.FAKE_NGS_MODE === 'slow') setTimeout(() => {}, 5000); if (process.env.FAKE_NGS_MODE === 'fail') process.exitCode = 7;\n", "utf8");
      return;
    }
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
    expect(plan.command).toMatchObject({ executable: join(bin, process.platform === "win32" ? "nextflow.exe" : "nextflow"), cwd: root });
    expect((plan.command as { arguments: string[] }).arguments).toEqual(expect.arrayContaining(["run", workflow, "-params-file", params, "-profile", "fixture"]));

    const started = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    const completed = await waitForState(service, session, root, String(started.registry_run_id), "completed");
    expect(completed).toMatchObject({ state: "completed", exit_code: 0 });
    expect(completed.stdout_summary).toContain("fake stdout run");
    expect(completed.stderr_summary).toContain("fake stderr run");
    expect((completed.events as Array<Record<string, unknown>>).map((event) => event.state)).toEqual(expect.arrayContaining(["queued", "running", "completed"]));
  });

  it("records a non-zero local Nextflow exit and its stderr", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-fail-"));
    const bin = join(root, "bin");
    const workflow = join(root, "workflow.nf");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "nextflow");
    writeFileSync(workflow, "workflow { println 'fixture' }\n", "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`; process.env.FAKE_NGS_MODE = "fail";

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "failing-nextflow", name: "Failing Nextflow", engine: "nextflow", source: { kind: "local", root, entrypoint: "workflow.nf" } }, context(session, root));
    const plan = await service.execute("plan_nextflow", { workflow_id: "failing-nextflow", run_dir: root }, context(session, root));
    const started = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    const failed = await waitForState(service, session, root, String(started.registry_run_id), "failed");
    expect(failed).toMatchObject({ state: "failed", exit_code: 7 });
    expect(failed.stderr_summary).toContain("fake stderr run");
  });

  it("terminates a running local command on cancellation and retains its cancellation record", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-cancel-"));
    const bin = join(root, "bin");
    const workflow = join(root, "workflow.nf");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "nextflow"); writeFileSync(workflow, "workflow { println 'fixture' }\n", "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`; process.env.FAKE_NGS_MODE = "slow";

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "slow-nextflow", name: "Slow Nextflow", engine: "nextflow", source: { kind: "local", root, entrypoint: "workflow.nf" } }, context(session, root));
    const plan = await service.execute("plan_nextflow", { workflow_id: "slow-nextflow", run_dir: root }, context(session, root));
    const started = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    expect(started.state).toBe("running");
    const cancelled = await service.execute("cancel_ngs_run", { registry_run_id: started.registry_run_id }, context(session, root));
    expect(cancelled).toMatchObject({ cancelled: true, cancellation_accepted: true, execution_settled: true, state: "cancelled" });
    const observed = await waitForState(service, session, root, String(started.registry_run_id), "cancelled");
    expect(observed.cancellation_requested).toBe(true);
    expect((observed.events as Array<Record<string, unknown>>).some((event) => String(event.message).includes("Termination requested"))).toBe(true);
    expect(processIsAlive(Number(started.process_id))).toBe(false);
  });

  it("terminates active local commands when the NGS service is disposed", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-dispose-"));
    const bin = join(root, "bin");
    const workflow = join(root, "workflow.nf");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "nextflow");
    writeFileSync(workflow, "workflow { println 'fixture' }\n", "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`;
    process.env.FAKE_NGS_MODE = "slow";

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "dispose-nextflow", name: "Dispose Nextflow", engine: "nextflow", source: { kind: "local", root, entrypoint: "workflow.nf" } }, context(session, root));
    const plan = await service.execute("plan_nextflow", { workflow_id: "dispose-nextflow", run_dir: root }, context(session, root));
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

  it("reports termination_failed while a failed kill leaves the PID alive", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-kill-failure-"));
    const bin = join(root, "bin");
    const workflow = join(root, "workflow.nf");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "nextflow");
    writeFileSync(workflow, "workflow { println 'fixture' }\n", "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`;
    process.env.FAKE_NGS_MODE = "slow";

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "kill-failure-nextflow", name: "Kill failure Nextflow", engine: "nextflow", source: { kind: "local", root, entrypoint: "workflow.nf" } }, context(session, root));
    const plan = await service.execute("plan_nextflow", { workflow_id: "kill-failure-nextflow", run_dir: root }, context(session, root));
    const started = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    const pid = Number(started.process_id);
    const mutableService = service as unknown as { terminateLocalProcess: (child: unknown) => Promise<boolean> };
    const terminate = mutableService.terminateLocalProcess.bind(service);
    mutableService.terminateLocalProcess = async () => false;
    const result = await service.execute("cancel_ngs_run", { registry_run_id: started.registry_run_id }, context(session, root));
    expect(result).toMatchObject({ cancelled: false, cancellation_accepted: true, execution_settled: true, state: "termination_failed", diagnostic: { code: "TERMINATION_FAILED" } });
    expect(processIsAlive(pid)).toBe(true);
    mutableService.terminateLocalProcess = terminate;
    await service.dispose();
    expect(processIsAlive(pid)).toBe(false);
  });

  it("rejects changed workflow and parameter bytes before creating a process", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-mutated-"));
    const bin = join(root, "bin");
    const workflow = join(root, "workflow.nf");
    const params = join(root, "params.json");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "nextflow");
    writeFileSync(workflow, "workflow { println 'original' }\n", "utf8");
    writeFileSync(params, "{\"value\":1}\n", "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`;

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "mutation-nextflow", name: "Mutation Nextflow", engine: "nextflow", source: { kind: "local", root, entrypoint: "workflow.nf" } }, context(session, root));
    const plan = await service.execute("plan_nextflow", { workflow_id: "mutation-nextflow", run_dir: root, params_file: params }, context(session, root));
    writeFileSync(params, "{\"value\":2}\n", "utf8");
    writeFileSync(workflow, "workflow { println 'changed' }\n", "utf8");
    const rejected = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    expect(rejected).toMatchObject({ ok: false, status: "blocked", code: "PLAN_INPUT_CHANGED", process_started: false });
    expect(rejected.diagnostics).toEqual(expect.arrayContaining([
      "workflow source changed after the plan was created.",
      "parameter/configuration files changed after the plan was created.",
    ]));
    expect(await service.execute("list_ngs_runs", {}, context(session, root))).toMatchObject({ runs: [] });
    await service.dispose();
  });

  it("captures every configuration-referenced scientific input and rejects changed input bytes before execution", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-scientific-input-"));
    const bin = join(root, "bin");
    const workflow = join(root, "workflow.nf");
    const params = join(root, "params.json");
    const input = join(root, "sample_R1.fastq.gz");
    const secondInput = join(root, "sample_R2.fastq.gz");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "nextflow");
    writeFileSync(workflow, "workflow { println 'fixture' }\n", "utf8");
    writeFileSync(input, "original-fastq-fixture\n", "utf8");
    writeFileSync(secondInput, "original-mate-fixture\n", "utf8");
    writeFileSync(params, JSON.stringify({ samples: [{ r1: "sample_R1.fastq.gz", r2: "sample_R2.fastq.gz" }] }), "utf8");
    process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`;

    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "scientific-input-nextflow", name: "Scientific input Nextflow", engine: "nextflow", source: { kind: "local", root, entrypoint: "workflow.nf" } }, context(session, root));
    const plan = await service.execute("plan_nextflow", {
      workflow_id: "scientific-input-nextflow",
      run_dir: root,
      params_file: params,
      input_paths: [input],
    }, context(session, root));
    expect(plan).toMatchObject({
      executable: true,
      readiness: {
        ready: true,
        declared_input_paths: [input],
        scientific_input_paths: expect.arrayContaining([input, secondInput]),
      },
    });

    writeFileSync(secondInput, "changed-undeclared-mate-fixture\n", "utf8");
    const rejected = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    expect(rejected).toMatchObject({ ok: false, status: "blocked", code: "PLAN_INPUT_CHANGED", process_started: false });
    expect(rejected.diagnostics).toContain("declared scientific inputs changed after the plan was created.");
    expect(await service.execute("list_ngs_runs", {}, context(session, root))).toMatchObject({ runs: [] });
    await service.dispose();
  });

  it.runIf(process.platform === "win32")("passes Windows metacharacters, quotes, spaces, and Unicode as literal native argv", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh rosalind ngs unicode-测试-"));
    const bin = join(root, "bin");
    const workflow = join(root, "workflow unicode.nf");
    const params = join(root, "params unicode.json");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "nextflow");
    writeFileSync(workflow, "workflow { println 'fixture' }\n", "utf8");
    writeFileSync(params, "{}\n", "utf8");
    process.env.PATH = `${bin};${originalPath ?? ""}`;
    const literal = "alpha & beta | gamma > out %PATH% ^caret \"quoted value\" 中文";
    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "literal-nextflow", name: "Literal Nextflow", engine: "nextflow", source: { kind: "local", root, entrypoint: "workflow unicode.nf" } }, context(session, root));
    const plan = await service.execute("plan_nextflow", { workflow_id: "literal-nextflow", run_dir: root, params_file: params, profile: literal }, context(session, root));
    expect(plan.executable).toBe(true);
    const started = await service.execute("execute_plan", { plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum }, context(session, root));
    const completed = await waitForState(service, session, root, String(started.registry_run_id), "completed");
    const marker = JSON.stringify(literal);
    expect(completed.stdout_summary).toContain(marker.slice(1, -1));
    await service.dispose();
  });

  it.runIf(process.platform === "win32")("returns a structured refusal for command-script runtimes", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-script-runtime-"));
    const bin = join(root, "bin");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(bin));
    installFakeEngine(bin, "snakemake");
    writeFileSync(join(root, "Snakefile"), "rule all:\n  input: []\n", "utf8");
    process.env.PATH = `${bin};${originalPath ?? ""}`;
    const service = new NgsService(); const session = {};
    await service.execute("save_workflow", { workflow_id: "script-snakemake", name: "Script Snakemake", engine: "snakemake", source: { kind: "local", root, entrypoint: "Snakefile" } }, context(session, root));
    const plan = await service.execute("plan_snakemake", { workflow_id: "script-snakemake", run_dir: root, config_file: "danger & | > % ^ \"quoted\" 中文" }, context(session, root));
    expect(plan).toMatchObject({ executable: false, readiness: { ready: false, code: "WINDOWS_SCRIPT_RUNTIME_UNSAFE" } });
    await service.dispose();
  });
});
