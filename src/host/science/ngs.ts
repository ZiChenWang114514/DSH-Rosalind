import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, isAbsolute, resolve } from "node:path";

import type { ScienceExecutionContext } from "./sequence.js";

type Json = Record<string, unknown>;
type Engine = "nextflow" | "snakemake";
type RunState = "planned" | "blocked" | "queued" | "running" | "completed" | "failed" | "cancelled";

interface WorkflowVersion { id: string; createdAt: string; source: string; checksum: string; catalogChecksum?: string; }
interface Workflow { id: string; name: string; engine: Engine; description: string; archived: boolean; versions: WorkflowVersion[]; activeVersionId: string; }
interface Target { id: string; title: string; kind: "local" | "ssh"; sshAlias?: string; workspaceRoot?: string; executor?: string; partition?: string; account?: string; configuredAt: string; }
interface LocalCommand { executable: string; arguments: string[]; cwd: string; }
interface Plan { id: string; name: string; checksum: string; workflowId: string; engine: Engine; runDir: string; targetId: string; readiness: Json; createdAt: string; command?: LocalCommand; }
interface Run { id: string; planId: string; workflowId: string; state: RunState; createdAt: string; updatedAt: string; events: Json[]; summaryPath?: string; diagnostic?: Json; command?: LocalCommand; process?: ChildProcess; processId?: number; stdoutSummary?: string; stderrSummary?: string; exitCode?: number | null; cancelRequested?: boolean; }
interface NgsState { workflows: Map<string, Workflow>; targets: Map<string, Target>; plans: Map<string, Plan>; runs: Map<string, Run>; }

function record(value: unknown): Json { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {}; }
function required(value: unknown, name: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`); return value.trim(); }
function clone<T>(value: T): T { return structuredClone(value); }
function now(): string { return new Date().toISOString(); }
function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function assertNotAborted(signal: AbortSignal): void { if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("NGS operation cancelled."); }
function appendSummary(previous: string | undefined, chunk: Buffer, limit = 12_000): string {
  const joined = `${previous ?? ""}${chunk.toString("utf8")}`;
  return joined.length <= limit ? joined : `…${joined.slice(-limit)}`;
}

function waitForProcessExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolveWait) => {
    let settled = false;
    const finish = (exited: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("close", onClose);
      resolveWait(exited);
    };
    const onClose = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    timer.unref?.();
    child.once("close", onClose);
  });
}

function bundledWorkflows(packageRoot: string): Workflow[] {
  const createdAt = "2026-08-30T00:00:00.000Z";
  const items: Array<[string, string, string, string, string]> = [
    ["oai_fastq_qc", "Bundled FASTQ QC", "Quality, adapter, and read-integrity workflow for paired FASTQ input.", "version-8e0c15a605d394be27a4e68246a061ef", "705bf609376de4193dafbb50a8967b75bc30ffeb5c17e1849a56cafe949db201"],
    ["oai_bulk_rnaseq_counts_qc", "Bundled bulk RNA-seq", "FastQC, Salmon quantification, matrix aggregation, and MultiQC workflow.", "version-a99d0908ddacd176e3b77e9ec2e482f3", "eddf2cd523b62c20b3fa4496c4d441b9dfb48a303de9c5b922bad30d7e30f9cc"],
    ["oai_scrnaseq_fastq_to_count", "Bundled single-cell RNA-seq", "Chemistry-aware STARsolo FASTQ-to-count workflow.", "version-f3c773924a7ebc534c3adc131d4356ec", "6f7aa0dcf4ed6fdb6e187ff0f8d1128b6ffa93504bc688aee341fe250a893510"],
  ];
  return items.map(([id, name, description, versionId, catalogChecksum]) => {
    const source = resolve(packageRoot, "workflows", id, "workflow", "Snakefile");
    const checksum = existsSync(source) ? digest(readFileSync(source, "utf8")) : digest(`missing:${source}`);
    const version: WorkflowVersion = { id: versionId, createdAt, source, checksum, catalogChecksum };
    return { id, name, engine: "snakemake", description, archived: false, versions: [version], activeVersionId: version.id };
  });
}

export class NgsService {
  private readonly sessions = new WeakMap<object, NgsState>();
  private readonly activeRuns = new Set<Run>();
  private disposed = false;

  async execute(operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<Json> {
    if (this.disposed) throw new Error("NGS service has been disposed.");
    assertNotAborted(context.signal);
    const state = this.state(context.session, context.packageRoot);
    switch (operation) {
      case "list_workflows": return this.listWorkflows(state, args);
      case "save_workflow": return this.saveWorkflow(state, args, context);
      case "update_workflow": return this.updateWorkflow(state, args, context);
      case "list_workflow_versions": return this.versions(state, args);
      case "activate_workflow_version": return this.activateVersion(state, args);
      case "archive_workflow": return this.setArchived(state, args, true);
      case "restore_workflow": return this.setArchived(state, args, false);
      case "get_runtime_environment": return this.runtimeEnvironment(state, args);
      case "check_nextflow_readiness": return this.readiness(state, args, context, "nextflow");
      case "check_snakemake_readiness": return this.readiness(state, args, context, "snakemake");
      case "plan_nextflow": return this.plan(state, args, context, "nextflow");
      case "plan_snakemake": return this.plan(state, args, context, "snakemake");
      case "execute_plan": return this.executePlan(state, args, context);
      case "list_ngs_runs": return this.listRuns(state, args);
      case "list_ngs_run_lineages": return this.listLineages(state, args);
      case "get_ngs_run": return this.getRun(state, args);
      case "observe_ngs_run": return this.observeRun(state, args);
      case "cancel_ngs_run": return this.cancelRun(state, args);
      case "update_ngs_run_analysis_summary": return this.updateSummary(state, args, context);
      case "list_compute_targets": return this.listTargets(state);
      case "configure_ssh_target": return this.configureTarget(state, args);
      case "inspect_compute_target": return this.inspectTarget(state, args, context);
      default: throw new Error(`Unsupported NGS operation: ${operation}`);
    }
  }

  async dispose(): Promise<Json[]> {
    if (this.disposed) return [];
    this.disposed = true;
    const active = [...this.activeRuns];
    for (const run of active) {
      run.cancelRequested = true;
      run.state = "cancelled";
      run.updatedAt = now();
      run.events.push({ at: run.updatedAt, state: run.state, message: "Plugin disposal requested cancellation of the running local workflow command." });
    }
    await Promise.all(active.map(async (run) => {
      if (run.process) await this.terminateLocalProcess(run.process);
    }));
    this.activeRuns.clear();
    return active.map((run) => this.runView(run));
  }

  private state(session: object, packageRoot: string): NgsState {
    let state = this.sessions.get(session);
    if (!state) {
      state = { workflows: new Map(bundledWorkflows(packageRoot).map((workflow) => [workflow.id, workflow])), targets: new Map([["local", { id: "local", title: "Local DSH host", kind: "local", configuredAt: now() }]]), plans: new Map(), runs: new Map() };
      this.sessions.set(session, state);
    }
    return state;
  }

  private workflow(state: NgsState, args: Record<string, unknown>): Workflow {
    const id = required(args.workflow_id, "workflow_id");
    const workflow = state.workflows.get(id);
    if (!workflow) throw new Error(`Workflow ${id} is unavailable.`); return workflow;
  }

  private listWorkflows(state: NgsState, args: Record<string, unknown>): Json {
    const engine = args.engine; const includeArchived = args.include_archived === true;
    const workflows = [...state.workflows.values()].filter((workflow) => (includeArchived || !workflow.archived) && (!engine || workflow.engine === engine)).map((workflow) => this.workflowView(workflow));
    return { workflows };
  }

  private workflowSource(value: unknown, packageRoot: string): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    const source = record(value);
    if (source.kind === "local") {
      const root = required(source.root, "source.root");
      const entrypoint = required(source.entrypoint, "source.entrypoint");
      return resolve(isAbsolute(root) ? root : resolve(packageRoot, root), entrypoint);
    }
    if (source.kind === "remote") {
      return `${required(source.workflow, "source.workflow")}@${required(source.revision, "source.revision")}`;
    }
    throw new Error("source must be a local or remote workflow source.");
  }

  private saveWorkflow(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const id = required(args.workflow_id, "workflow_id"); if (state.workflows.has(id)) throw new Error(`Workflow ${id} already exists.`);
    const engine = required(args.engine, "engine"); if (engine !== "nextflow" && engine !== "snakemake") throw new Error("engine must be nextflow or snakemake.");
    const source = this.workflowSource(args.source, context.packageRoot); const version: WorkflowVersion = { id: `version-${randomUUID()}`, createdAt: now(), source, checksum: digest(source) };
    const workflow: Workflow = { id, name: required(args.name, "name"), engine, description: typeof args.description === "string" ? args.description : "", archived: false, versions: [version], activeVersionId: version.id };
    state.workflows.set(id, workflow); return { workflow: this.workflowView(workflow), created: true };
  }

  private updateWorkflow(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const workflow = this.workflow(state, args); const source = this.workflowSource(args.source, context.packageRoot); const version: WorkflowVersion = { id: `version-${randomUUID()}`, createdAt: now(), source, checksum: digest(source) };
    workflow.versions.push(version); workflow.activeVersionId = version.id; return { workflow: this.workflowView(workflow), version: clone(version) };
  }

  private versions(state: NgsState, args: Record<string, unknown>): Json { const workflow = this.workflow(state, args); return { workflow_id: workflow.id, active_version_id: workflow.activeVersionId, versions: clone(workflow.versions) }; }
  private activateVersion(state: NgsState, args: Record<string, unknown>): Json { const workflow = this.workflow(state, args); const version = required(args.version_id, "version_id"); if (!workflow.versions.some((item) => item.id === version)) throw new Error(`Version ${version} is unavailable for ${workflow.id}.`); workflow.activeVersionId = version; return { workflow: this.workflowView(workflow), active_version_id: version }; }
  private setArchived(state: NgsState, args: Record<string, unknown>, archived: boolean): Json { const workflow = this.workflow(state, args); workflow.archived = archived; return { workflow: this.workflowView(workflow), archived }; }

  private runtimeEnvironment(state: NgsState, args: Record<string, unknown>): Json {
    const targetId = typeof args.target_id === "string" ? args.target_id : "local"; const target = state.targets.get(targetId);
    if (!target) throw new Error(`Compute target ${targetId} is unavailable.`);
    const pathEntries = (process.env.PATH ?? "").split(delimiter);
    const nextflow = this.findExecutable("nextflow", pathEntries); const snakemake = this.findExecutable("snakemake", pathEntries);
    return { target: clone(target), runtime: { platform: process.platform, node: process.version, nextflow: nextflow ?? null, snakemake: snakemake ?? null, availableEngines: [nextflow ? "nextflow" : null, snakemake ? "snakemake" : null].filter(Boolean) }, diagnostics: target.kind === "ssh" ? ["SSH target is configured; a network inspection requires an explicit remote execution request."] : [] };
  }

  private readiness(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext, engine: Engine): Json {
    assertNotAborted(context.signal); const workflow = this.workflow(state, args); const runDir = required(args.run_dir, "run_dir");
    if (workflow.engine !== engine) return { ok: false, status: "blocked", ready: false, code: "WORKFLOW_ENGINE_MISMATCH", workflow_id: workflow.id, expectedEngine: workflow.engine, requestedEngine: engine, diagnostics: [`${workflow.id} uses ${workflow.engine}, so ${engine} readiness cannot execute it.`] };
    const targetId = typeof args.target_id === "string" ? args.target_id : "local"; const target = state.targets.get(targetId);
    if (!target) return { ok: false, status: "blocked", ready: false, code: "COMPUTE_TARGET_UNAVAILABLE", workflow_id: workflow.id, target_id: targetId, diagnostics: [`Compute target ${targetId} is not configured.`] };
    const executable = this.findExecutable(engine, (process.env.PATH ?? "").split(delimiter));
    const runPath = isAbsolute(runDir) ? runDir : resolve(context.packageRoot, runDir);
    const diagnostics: string[] = [];
    if (!existsSync(runPath)) diagnostics.push(`Run directory is unavailable: ${runDir}.`);
    const activeSource = workflow.versions.find((version) => version.id === workflow.activeVersionId)?.source;
    if (!activeSource || !existsSync(activeSource)) diagnostics.push(`Workflow source is unavailable: ${activeSource ?? workflow.id}.`);
    if (target.kind === "ssh") diagnostics.push("SSH execution is configured but has not been authorized or inspected in this DSH session.");
    if (!executable) diagnostics.push(`${engine} executable is unavailable on the local DSH host PATH.`);
    const ready = diagnostics.length === 0;
    return {
      ok: ready,
      status: ready ? "completed" : "blocked",
      ready,
      code: ready ? "READY" : target.kind === "ssh" ? "REMOTE_EXECUTION_NOT_AUTHORIZED" : "COMPUTE_UNAVAILABLE",
      workflow_id: workflow.id,
      workflow_version_id: workflow.activeVersionId,
      engine,
      target_id: targetId,
      run_dir: runPath,
      executable: executable ?? null,
      diagnostics,
      checkedAt: now(),
    };
  }

  private plan(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext, engine: Engine): Json {
    const readiness = this.readiness(state, args, context, engine); const workflow = this.workflow(state, args); const runDir = required(args.run_dir, "run_dir");
    const planId = `plan-${randomUUID()}`; const name = typeof args.display_name === "string" && args.display_name.trim() ? args.display_name.trim() : `${workflow.name} plan`;
    const command = readiness.ready === true ? this.localCommand(workflow, readiness, args) : undefined;
    const plan: Plan = { id: planId, name, checksum: digest(JSON.stringify({ workflow: workflow.id, version: workflow.activeVersionId, engine, runDir, readiness, command })), workflowId: workflow.id, engine, runDir, targetId: typeof args.target_id === "string" ? args.target_id : "local", readiness, createdAt: now(), ...(command ? { command } : {}) };
    state.plans.set(planId, plan); return { plan_id: plan.id, plan_name: plan.name, plan_checksum: plan.checksum, workflow_id: plan.workflowId, engine, readiness, command: command ? clone(command) : null, executable: readiness.ready === true, explanation: readiness.ready === true ? "The plan is ready for explicit execution." : "The plan was created for review, but no workflow command can start until the reported runtime issue is resolved." };
  }

  private executePlan(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    assertNotAborted(context.signal); const planId = required(args.plan_id, "plan_id"); const plan = state.plans.get(planId); if (!plan) throw new Error(`Plan ${planId} is unavailable.`);
    if (required(args.plan_name, "plan_name") !== plan.name || required(args.plan_checksum, "plan_checksum") !== plan.checksum) throw new Error("Execution plan identity does not match the reviewed plan.");
    const target = state.targets.get(plan.targetId);
    const runnable = plan.readiness.ready === true && target?.kind === "local" && plan.command !== undefined;
    const run: Run = { id: `run-${randomUUID()}`, planId: plan.id, workflowId: plan.workflowId, state: runnable ? "queued" : "blocked", createdAt: now(), updatedAt: now(), events: [], ...(plan.command ? { command: clone(plan.command) } : {}) };
    run.events.push({ at: now(), state: run.state, message: runnable ? "Run registered for the reviewed local workflow command." : "No execution started because the selected runtime is unavailable or requires remote authorization." });
    if (!runnable) {
      run.diagnostic = { code: target?.kind === "ssh" ? "REMOTE_EXECUTION_NOT_AUTHORIZED" : plan.readiness.code, diagnostics: plan.readiness.diagnostics };
      state.runs.set(run.id, run);
      return { registry_run_id: run.id, state: run.state, plan_id: plan.id, workflow_id: plan.workflowId, diagnostic: run.diagnostic, events: clone(run.events) };
    }
    state.runs.set(run.id, run);
    this.startLocalRun(run, plan.command!);
    return { registry_run_id: run.id, state: run.state, plan_id: plan.id, workflow_id: plan.workflowId, command: clone(plan.command!), process_id: run.processId ?? null, diagnostic: null, events: clone(run.events) };
  }

  private listRuns(state: NgsState, args: Record<string, unknown>): Json {
    const status = Array.isArray(args.statuses) ? args.statuses.map(String) : undefined; const limit = Number.isInteger(args.limit) ? Number(args.limit) : 50;
    return { runs: [...state.runs.values()].filter((run) => !status || status.includes(run.state)).slice(0, limit).map((run) => this.runView(run)) };
  }
  private listLineages(state: NgsState, args: Record<string, unknown>): Json { const limit = Number.isInteger(args.limit) ? Number(args.limit) : 50; return { lineages: [...state.runs.values()].slice(0, limit).map((run) => ({ registry_run_id: run.id, workflow_id: run.workflowId, plan_id: run.planId, state: run.state })) }; }
  private getRun(state: NgsState, args: Record<string, unknown>): Json { const run = this.run(state, args); return this.runView(run); }
  private observeRun(state: NgsState, args: Record<string, unknown>): Json { const run = this.run(state, args); return { ...this.runView(run), observation: { observedAt: now(), terminal: ["completed", "failed", "cancelled", "blocked"].includes(run.state) } }; }
  private cancelRun(state: NgsState, args: Record<string, unknown>): Json {
    const run = this.run(state, args);
    if (["completed", "failed", "cancelled"].includes(run.state)) return { registry_run_id: run.id, cancelled: false, state: run.state, reason: "TERMINAL_RUN" };
    run.cancelRequested = true; run.state = "cancelled"; run.updatedAt = now();
    run.events.push({ at: run.updatedAt, state: run.state, message: run.process ? "Cancellation requested for the running local workflow command." : "Cancellation requested before a local workflow command was launched." });
    if (run.process) void this.terminateLocalProcess(run.process);
    return { registry_run_id: run.id, cancelled: true, state: run.state, process_id: run.processId ?? null };
  }
  private updateSummary(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext): Json { const run = this.run(state, args); const supplied = required(args.summary_path, "summary_path"); const path = isAbsolute(supplied) ? supplied : resolve(context.packageRoot, supplied); if (!existsSync(path)) throw new Error(`Analysis summary is unavailable: ${supplied}`); run.summaryPath = path; run.updatedAt = now(); run.events.push({ at: run.updatedAt, state: run.state, message: "Analysis summary linked to the registered run." }); return { registry_run_id: run.id, summary_path: path, updated: true }; }

  private listTargets(state: NgsState): Json { return { targets: [...state.targets.values()].map((target) => clone(target)) }; }
  private configureTarget(state: NgsState, args: Record<string, unknown>): Json { const id = required(args.target_id, "target_id"); const target: Target = { id, title: required(args.title, "title"), kind: "ssh", sshAlias: required(args.ssh_alias, "ssh_alias"), workspaceRoot: required(args.workspace_root, "workspace_root"), ...(typeof args.executor === "string" ? { executor: args.executor } : {}), ...(typeof args.partition === "string" ? { partition: args.partition } : {}), ...(typeof args.account === "string" ? { account: args.account } : {}), configuredAt: now() }; state.targets.set(id, target); return { target: clone(target), status: "configured", diagnostics: ["No SSH connection was attempted. Remote inspection and submission require a separate approved execution request."] }; }
  private inspectTarget(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext): Json { assertNotAborted(context.signal); const id = required(args.target_id, "target_id"); const target = state.targets.get(id); if (!target) throw new Error(`Compute target ${id} is unavailable.`); if (target.kind === "ssh") return { target: clone(target), reachable: false, code: "REMOTE_EXECUTION_NOT_AUTHORIZED", diagnostics: ["SSH inspection is a remote operation and needs explicit execution authority; no connection was opened."], requestedExecutables: Array.isArray(args.executable_paths) ? args.executable_paths : [] }; return { target: clone(target), reachable: true, code: "LOCAL_TARGET", runtime: this.runtimeEnvironment(state, { target_id: id }) }; }

  private localCommand(workflow: Workflow, readiness: Json, args: Record<string, unknown>): LocalCommand {
    const executable = required(readiness.executable, "readiness executable"); const cwd = required(readiness.run_dir, "readiness run_dir");
    const source = workflow.versions.find((version) => version.id === workflow.activeVersionId)?.source;
    if (!source) throw new Error(`Workflow ${workflow.id} has no active source.`);
    if (workflow.engine === "nextflow") {
      const commandArgs = ["run", source, "-work-dir", resolve(cwd, ".nextflow-work")];
      if (typeof args.params_file === "string" && args.params_file.trim()) commandArgs.push("-params-file", args.params_file);
      if (typeof args.profile === "string" && args.profile.trim()) commandArgs.push("-profile", args.profile);
      return { executable, arguments: commandArgs, cwd };
    }
    const commandArgs = ["--snakefile", source, "--directory", cwd];
    if (typeof args.config_file === "string" && args.config_file.trim()) commandArgs.push("--configfile", args.config_file);
    if (Number.isInteger(args.cores) && Number(args.cores) > 0) commandArgs.push("--cores", String(args.cores));
    return { executable, arguments: commandArgs, cwd };
  }

  private startLocalRun(run: Run, command: LocalCommand): void {
    let child: ChildProcess;
    try {
      const launcher = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command.executable;
      const launcherArgs = process.platform === "win32" ? ["/d", "/s", "/c", command.executable, ...command.arguments] : command.arguments;
      child = spawn(launcher, launcherArgs, { cwd: command.cwd, windowsHide: true });
    } catch (cause) {
      run.state = "failed"; run.updatedAt = now(); run.exitCode = null;
      run.stderrSummary = cause instanceof Error ? cause.message : String(cause);
      run.events.push({ at: run.updatedAt, state: run.state, message: "The local workflow command could not be started." });
      return;
    }
    run.process = child; if (child.pid !== undefined) run.processId = child.pid; run.state = "running"; run.updatedAt = now();
    this.activeRuns.add(run);
    run.events.push({ at: run.updatedAt, state: run.state, message: "Reviewed local workflow command started.", process_id: child.pid ?? null });
    child.stdout?.on("data", (chunk: Buffer) => { run.stdoutSummary = appendSummary(run.stdoutSummary, chunk); });
    child.stderr?.on("data", (chunk: Buffer) => { run.stderrSummary = appendSummary(run.stderrSummary, chunk); });
    child.once("error", (cause) => {
      if (run.cancelRequested) return;
      run.state = "failed"; run.updatedAt = now(); run.exitCode = null;
      run.stderrSummary = appendSummary(run.stderrSummary, Buffer.from(cause.message));
      run.events.push({ at: run.updatedAt, state: run.state, message: "The local workflow command emitted a process error." });
    });
    child.once("close", (code, signal) => {
      this.activeRuns.delete(run);
      delete run.process; run.exitCode = code; run.updatedAt = now();
      if (run.cancelRequested) {
        run.state = "cancelled";
        run.events.push({ at: run.updatedAt, state: run.state, message: "Local workflow command stopped after cancellation.", exit_code: code, signal: signal ?? null });
      } else {
        run.state = code === 0 ? "completed" : "failed";
        run.events.push({ at: run.updatedAt, state: run.state, message: code === 0 ? "Local workflow command completed." : "Local workflow command exited unsuccessfully.", exit_code: code, signal: signal ?? null });
      }
    });
  }

  private async terminateLocalProcess(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === "win32" && child.pid) {
      const terminator = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
      await waitForProcessExit(terminator, 5_000);
      if (!await waitForProcessExit(child, 5_000)) child.kill();
      return;
    }
    child.kill("SIGTERM");
    if (!await waitForProcessExit(child, 5_000)) {
      child.kill("SIGKILL");
      await waitForProcessExit(child, 5_000);
    }
  }

  private run(state: NgsState, args: Record<string, unknown>): Run { const id = required(args.registry_run_id, "registry_run_id"); const run = state.runs.get(id); if (!run) throw new Error(`NGS run ${id} is unavailable.`); return run; }
  private workflowView(workflow: Workflow): Json { const active = workflow.versions.find((version) => version.id === workflow.activeVersionId); return { workflow_id: workflow.id, name: workflow.name, engine: workflow.engine, description: workflow.description, archived: workflow.archived, active_version_id: workflow.activeVersionId, active_version_checksum: active?.checksum ?? null, catalog_source_checksum: active?.catalogChecksum ?? null, source_entrypoint: active?.source ?? null, source_available: active ? existsSync(active.source) : false, version_count: workflow.versions.length }; }
  private runView(run: Run): Json { return { registry_run_id: run.id, plan_id: run.planId, workflow_id: run.workflowId, state: run.state, created_at: run.createdAt, updated_at: run.updatedAt, command: run.command ? clone(run.command) : null, process_id: run.processId ?? null, exit_code: run.exitCode ?? null, stdout_summary: run.stdoutSummary ?? "", stderr_summary: run.stderrSummary ?? "", cancellation_requested: run.cancelRequested === true, events: clone(run.events), summary_path: run.summaryPath ?? null, diagnostic: clone(run.diagnostic ?? {}) }; }
  private findExecutable(name: string, entries: readonly string[]): string | undefined { const extensions = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""]; for (const folder of entries) for (const extension of extensions) { const candidate = resolve(folder || ".", `${name}${extension}`); if (existsSync(candidate)) return candidate; } return undefined; }
}

export function asNgsServiceError(cause: unknown): { code: string; message: string } {
  const message = cause instanceof Error ? cause.message : String(cause);
  return { code: /cancel/i.test(message) ? "CANCELLED" : "NGS_OPERATION_FAILED", message };
}
