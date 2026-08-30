import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, relative, resolve } from "node:path";

import type { ScienceExecutionContext } from "./sequence.js";

type Json = Record<string, unknown>;
type Engine = "nextflow" | "snakemake";
type RunState = "planned" | "blocked" | "queued" | "running" | "stopping" | "termination_failed" | "orphaned" | "completed" | "failed" | "cancelled";

interface WorkflowVersion { id: string; createdAt: string; source: string; checksum: string; catalogChecksum?: string; }
interface Workflow { id: string; name: string; engine: Engine; description: string; archived: boolean; versions: WorkflowVersion[]; activeVersionId: string; }
interface Target { id: string; title: string; kind: "local" | "ssh"; sshAlias?: string; workspaceRoot?: string; executor?: string; partition?: string; account?: string; configuredAt: string; }
interface LocalCommand { executable: string; arguments: string[]; cwd: string; }
interface PathIdentity { path: string; realPath: string; kind: "file" | "directory"; device: string; inode: string; size: number; modifiedMs: number; checksum: string; }
interface PlanValidation {
  workflow: Json;
  workflowVersion: Json;
  source: PathIdentity;
  parameterFiles: Array<{ flag: string; identity: PathIdentity }>;
  declaredInputs: PathIdentity[];
  executable: PathIdentity;
  workingDirectory: PathIdentity;
  target: Json;
  commandChecksum: string;
}
interface Plan { id: string; name: string; checksum: string; workflowId: string; engine: Engine; runDir: string; targetId: string; readiness: Json; declaredInputPaths: string[]; scientificInputPaths: string[]; createdAt: string; command?: LocalCommand; validation?: PlanValidation; consumedByRunId?: string; }
interface Run { id: string; planId: string; workflowId: string; state: RunState; createdAt: string; updatedAt: string; events: Json[]; summaryPath?: string; diagnostic?: Json; command?: LocalCommand; process?: ChildProcess; processId?: number; stdoutSummary?: string; stderrSummary?: string; exitCode?: number | null; cancelRequested?: boolean; }
interface NgsState { workflows: Map<string, Workflow>; targets: Map<string, Target>; plans: Map<string, Plan>; runs: Map<string, Run>; persistPath?: string; persistenceBlocked?: boolean; restorationDiagnostic?: Json; persistenceDiagnostic?: Json; }

interface PersistedNgsState {
  schema: "dsh-rosalind-ngs-registry-v1";
  workflows: Workflow[];
  targets: Target[];
  plans: Plan[];
  runs: Array<Omit<Run, "process">>;
}

export type NgsMcpServerId = "ngs-app" | "ngs-analysis-workbench" | "ngs-compute";

export const NGS_MCP_SERVER_OPERATIONS: Readonly<Record<NgsMcpServerId, readonly string[]>> = {
  "ngs-app": [
    "open_ngs_workbench", "list_workflows", "list_compute_target_summaries", "list_ngs_runs",
    "list_ngs_run_lineages", "get_ngs_run", "observe_ngs_run", "get_ngs_run_report",
  ],
  "ngs-analysis-workbench": [
    "list_workflows", "save_workflow", "update_workflow", "list_workflow_versions",
    "activate_workflow_version", "archive_workflow", "restore_workflow", "get_runtime_environment",
    "check_nextflow_readiness", "check_snakemake_readiness", "list_ngs_runs", "list_ngs_run_lineages",
    "get_ngs_run", "observe_ngs_run", "update_ngs_run_analysis_summary", "cancel_ngs_run",
    "plan_nextflow", "plan_snakemake", "execute_plan",
  ],
  "ngs-compute": ["list_compute_targets", "configure_ssh_target", "inspect_compute_target"],
};

const NGS_OPERATION_SERVER = new Map<string, NgsMcpServerId>([
  ...NGS_MCP_SERVER_OPERATIONS["ngs-analysis-workbench"].map((operation) => [operation, "ngs-analysis-workbench"] as const),
  ...NGS_MCP_SERVER_OPERATIONS["ngs-compute"].map((operation) => [operation, "ngs-compute"] as const),
  ...NGS_MCP_SERVER_OPERATIONS["ngs-app"]
    .filter((operation) => !NGS_MCP_SERVER_OPERATIONS["ngs-analysis-workbench"].includes(operation))
    .map((operation) => [operation, "ngs-app"] as const),
]);

function record(value: unknown): Json { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {}; }
function required(value: unknown, name: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`); return value.trim(); }
function clone<T>(value: T): T { return structuredClone(value); }
function now(): string { return new Date().toISOString(); }
function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function workflowSourceChecksum(source: string): string {
  try { if (statSync(source).isFile()) return digest(readFileSync(source).toString("base64")); } catch { /* remote and unavailable sources use their declaration */ }
  return digest(source);
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function assertNotAborted(signal: AbortSignal): void { if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("NGS operation cancelled."); }
function appendSummary(previous: string | undefined, chunk: Buffer, limit = 12_000): string {
  const joined = `${previous ?? ""}${chunk.toString("utf8")}`;
  return joined.length <= limit ? joined : `…${joined.slice(-limit)}`;
}

function safeSessionFileName(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "session";
  return `${normalized}--${digest(value).slice(0, 20)}`;
}

function persistedView(state: NgsState): PersistedNgsState {
  return {
    schema: "dsh-rosalind-ngs-registry-v1",
    workflows: [...state.workflows.values()].map(clone),
    targets: [...state.targets.values()].map(clone),
    plans: [...state.plans.values()].map(clone),
    runs: [...state.runs.values()].map((run) => {
      const { process: _process, ...persisted } = run;
      return clone(persisted);
    }),
  };
}

function saveState(state: NgsState): void {
  if (!state.persistPath || state.persistenceBlocked) return;
  const temporary = `${state.persistPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    mkdirSync(dirname(state.persistPath), { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(persistedView(state), null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, state.persistPath);
    delete state.persistenceDiagnostic;
  } catch (cause) {
    try { rmSync(temporary, { force: true }); } catch { /* preserve the primary persistence diagnostic */ }
    state.persistenceDiagnostic = {
      code: "REGISTRY_WRITE_FAILED",
      path: state.persistPath,
      original_preserved: existsSync(state.persistPath),
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

function registryDirectory(packageRoot: string, configuredRoot?: string): string {
  if (configuredRoot) return isAbsolute(configuredRoot) ? configuredRoot : resolve(configuredRoot);
  const ngsStateDirectory = process.env.NGS_ANALYSIS_WORKBENCH_STATE_DIR?.trim();
  if (ngsStateDirectory) return isAbsolute(ngsStateDirectory) ? ngsStateDirectory : resolve(packageRoot, ngsStateDirectory);
  const rosalindStateDirectory = process.env.DSH_ROSALIND_STATE_DIR?.trim();
  if (rosalindStateDirectory) {
    const root = isAbsolute(rosalindStateDirectory) ? rosalindStateDirectory : resolve(packageRoot, rosalindStateDirectory);
    return resolve(root, "ngs-registry");
  }
  const dshHome = process.env.DSH_HOME?.trim();
  if (dshHome) return resolve(dshHome, "state", "dsh-rosalind", "ngs-registry");
  const platformState = process.platform === "win32"
    ? process.env.LOCALAPPDATA?.trim()
    : process.env.XDG_STATE_HOME?.trim();
  return resolve(platformState || homedir(), ".dsh", "state", "dsh-rosalind", "ngs-registry");
}

function recordArray(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter((item): item is Json => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function restoreState(path: string, packageRoot: string): NgsState | undefined {
  if (!existsSync(path)) return undefined;
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch (cause) {
    return emptyState(packageRoot, path, {
      code: "REGISTRY_READ_FAILED",
      path,
      original_preserved: true,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
  let persisted: Partial<PersistedNgsState>;
  try {
    persisted = JSON.parse(contents) as Partial<PersistedNgsState>;
  } catch (cause) {
    return emptyState(packageRoot, path, {
      code: "REGISTRY_CORRUPT_JSON",
      path,
      original_preserved: true,
      byte_length: Buffer.byteLength(contents),
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
  if (persisted.schema !== "dsh-rosalind-ngs-registry-v1") {
    return emptyState(packageRoot, path, {
      code: "REGISTRY_UNKNOWN_SCHEMA",
      path,
      original_preserved: true,
      observed_schema: typeof persisted.schema === "string" ? persisted.schema : null,
    });
  }
  try {
    const workflows = recordArray(persisted.workflows).filter((item) => typeof item.id === "string") as unknown as Workflow[];
    const targets = recordArray(persisted.targets).filter((item) => typeof item.id === "string") as unknown as Target[];
    const plans = recordArray(persisted.plans).filter((item) => typeof item.id === "string") as unknown as Plan[];
    const runs = recordArray(persisted.runs).filter((item) => typeof item.id === "string") as unknown as Array<Omit<Run, "process">>;
    const restored: NgsState = {
      workflows: new Map(workflows.map((workflow) => [workflow.id, workflow])),
      targets: new Map(targets.map((target) => [target.id, target])),
      plans: new Map(plans.map((plan) => [plan.id, plan])),
      runs: new Map(),
      persistPath: path,
    };
    for (const previous of runs) {
      const run: Run = { ...previous };
      if (run.state === "queued" || run.state === "running") {
        run.state = "orphaned";
        run.updatedAt = now();
        run.events = [...run.events, { at: run.updatedAt, state: "orphaned", message: "The DSH host restarted while this workflow controller was active; the saved run requires explicit recovery or review." }];
        run.diagnostic = { code: "CONTROLLER_IDENTITY_LOST", diagnostics: ["No live local process identity can be trusted after host restart."] };
      }
      restored.runs.set(run.id, run);
    }
    for (const bundled of bundledWorkflows(packageRoot)) if (!restored.workflows.has(bundled.id)) restored.workflows.set(bundled.id, bundled);
    if (!restored.targets.has("local")) restored.targets.set("local", { id: "local", title: "Local DSH host", kind: "local", configuredAt: now() });
    saveState(restored);
    return restored;
  } catch (cause) {
    return emptyState(packageRoot, path, {
      code: "REGISTRY_RESTORE_FAILED",
      path,
      original_preserved: true,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

function emptyState(packageRoot: string, persistPath: string, diagnostic: Json): NgsState {
  return {
    workflows: new Map(bundledWorkflows(packageRoot).map((workflow) => [workflow.id, workflow])),
    targets: new Map([["local", { id: "local", title: "Local DSH host", kind: "local", configuredAt: now() }]]),
    plans: new Map(),
    runs: new Map(),
    persistPath,
    persistenceBlocked: true,
    restorationDiagnostic: diagnostic,
  };
}

function waitForProcessExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolveWait) => {
    let settled = false;
    const finish = (exited: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("close", onClose);
      resolveWait(exited);
    };
    const onExit = () => finish(true);
    const onClose = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    timer.unref?.();
    child.once("exit", onExit);
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
  private readonly contextSessionIds = new WeakMap<object, string>();
  private readonly activeRuns = new Set<Run>();
  private readonly runOwners = new WeakMap<Run, NgsState>();
  private disposed = false;
  private readonly registryRoot: string | undefined;

  constructor(options: { registryRoot?: string } = {}) {
    this.registryRoot = options.registryRoot;
  }

  async execute(operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<Json> {
    const serverId = NGS_OPERATION_SERVER.get(operation);
    if (!serverId) throw new Error(`Unsupported registered NGS operation: ${operation}`);
    return this.executeOnServer(serverId, operation, args, context);
  }

  async executeOnServer(serverId: NgsMcpServerId, operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<Json> {
    if (this.disposed) throw new Error("NGS service has been disposed.");
    assertNotAborted(context.signal);
    if (!NGS_MCP_SERVER_OPERATIONS[serverId].includes(operation)) {
      throw new Error(`NGS operation ${operation} is not exposed by ${serverId}.`);
    }
    if (context.sessionId) this.contextSessionIds.set(context.session, context.sessionId);
    const state = this.state(context.session, context.packageRoot);
    try {
      const result = await this.dispatch(state, serverId, operation, args, context);
      return {
        mcp_server: serverId,
        ...result,
        ...(state.restorationDiagnostic ? { registry_restoration: clone(state.restorationDiagnostic) } : {}),
        ...(state.persistenceDiagnostic ? { registry_persistence: clone(state.persistenceDiagnostic) } : {}),
      };
    } finally {
      saveState(state);
    }
  }

  private dispatch(state: NgsState, serverId: NgsMcpServerId, operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Json | Promise<Json> {
      if (serverId === "ngs-app") {
        switch (operation) {
          case "open_ngs_workbench": return { viewer: "ngs-workbench", viewerReady: true, workspaceSection: "ngs" };
          case "list_compute_target_summaries": return this.listTargets(state);
          case "get_ngs_run_report": {
            const run = this.optionalRun(state, args);
            if (!run) return this.missingRun(args);
            const available = run.state === "completed" && Boolean(run.summaryPath);
            return {
              ok: true,
              registry_run_id: run.id,
              availability: available ? "available" : run.state === "completed" ? "missing" : "not_completed",
              report: available ? this.runView(run) : null,
              summary_path: run.summaryPath ?? null,
            };
          }
          default: break;
        }
      }
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
        default: throw new Error(`Unsupported NGS operation for ${serverId}: ${operation}`);
      }
  }

  async dispose(): Promise<Json[]> {
    if (this.disposed) return [];
    this.disposed = true;
    const active = [...this.activeRuns];
    for (const run of active) {
      run.cancelRequested = true;
      run.state = "stopping";
      run.updatedAt = now();
      run.events.push({ at: run.updatedAt, state: run.state, message: "Plugin disposal requested termination of the running local workflow command." });
      const owner = this.runOwners.get(run);
      if (owner) saveState(owner);
    }
    await Promise.all(active.map(async (run) => {
      if (!run.process) return;
      const stopped = await this.terminateLocalProcess(run.process);
      if (!stopped && run.state === "stopping") {
        run.state = "termination_failed";
        run.updatedAt = now();
        run.diagnostic = { code: "TERMINATION_FAILED", diagnostics: ["The local workflow process remained alive after termination attempts."] };
        run.events.push({ at: run.updatedAt, state: run.state, message: "The local workflow process remained alive after termination attempts." });
        const owner = this.runOwners.get(run);
        if (owner) saveState(owner);
      }
    }));
    this.activeRuns.clear();
    return active.map((run) => this.runView(run));
  }

  private state(session: object, packageRoot: string): NgsState {
    let state = this.sessions.get(session);
    if (!state) {
      const sessionId = this.contextSessionIds.get(session);
      const persistPath = sessionId ? resolve(registryDirectory(packageRoot, this.registryRoot), `${safeSessionFileName(sessionId)}.json`) : undefined;
      state = persistPath ? restoreState(persistPath, packageRoot) : undefined;
      state ??= { workflows: new Map(bundledWorkflows(packageRoot).map((workflow) => [workflow.id, workflow])), targets: new Map([["local", { id: "local", title: "Local DSH host", kind: "local", configuredAt: now() }]]), plans: new Map(), runs: new Map(), ...(persistPath ? { persistPath } : {}) };
      saveState(state);
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
    const source = this.workflowSource(args.source, context.packageRoot); const version: WorkflowVersion = { id: `version-${randomUUID()}`, createdAt: now(), source, checksum: workflowSourceChecksum(source) };
    const workflow: Workflow = { id, name: required(args.name, "name"), engine, description: typeof args.description === "string" ? args.description : "", archived: false, versions: [version], activeVersionId: version.id };
    state.workflows.set(id, workflow); return { workflow: this.workflowView(workflow), created: true };
  }

  private updateWorkflow(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const workflow = this.workflow(state, args); const source = this.workflowSource(args.source, context.packageRoot); const version: WorkflowVersion = { id: `version-${randomUUID()}`, createdAt: now(), source, checksum: workflowSourceChecksum(source) };
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
    const inputFile = engine === "nextflow" ? args.params_file : args.config_file;
    let configurationPath: string | undefined;
    if (typeof inputFile === "string" && inputFile.trim()) {
      configurationPath = isAbsolute(inputFile) ? inputFile : resolve(runPath, inputFile);
      if (!existsSync(configurationPath)) diagnostics.push(`${engine === "nextflow" ? "Parameter" : "Configuration"} file is unavailable: ${inputFile}.`);
    }
    const declaredInputPaths = Array.isArray(args.input_paths) ? args.input_paths.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()) : [];
    if (args.input_paths !== undefined && (!Array.isArray(args.input_paths) || declaredInputPaths.length !== args.input_paths.length)) {
      diagnostics.push("Declared input_paths must contain only non-empty file paths.");
    }
    let configurationText: string | undefined;
    if (configurationPath && existsSync(configurationPath)) {
      try { configurationText = readFileSync(configurationPath, "utf8"); } catch { diagnostics.push(`Configuration file could not be read: ${inputFile}.`); }
    }
    const scientificInputPaths = configurationText === undefined
      ? []
      : this.configurationInputPaths(configurationText, configurationPath!, runPath);
    for (const input of declaredInputPaths) {
      const inputPath = isAbsolute(input) ? input : resolve(runPath, input);
      if (!existsSync(inputPath)) {
        diagnostics.push(`Declared input is unavailable: ${input}.`);
        continue;
      }
      if (!statSync(inputPath).isFile()) {
        diagnostics.push(`Declared input is not a file: ${input}.`);
        continue;
      }
      if (configurationText !== undefined && !this.configurationReferencesInput(configurationText, configurationPath!, inputPath, runPath)) {
        diagnostics.push(`Declared input is absent from the selected configuration: ${input}.`);
      }
    }
    if (target.kind === "ssh") diagnostics.push("SSH execution is configured but has not been authorized or inspected in this DSH session.");
    if (!executable) diagnostics.push(`${engine} executable is unavailable on the local DSH host PATH.`);
    const scriptRuntime = process.platform === "win32" && executable !== undefined && /\.(?:cmd|bat)$/i.test(executable);
    if (scriptRuntime) diagnostics.push(`The resolved ${engine} runtime is a Windows command script and cannot preserve literal workflow arguments without command-shell interpretation.`);
    const ready = diagnostics.length === 0;
    return {
      ok: ready,
      status: ready ? "completed" : "blocked",
      ready,
      code: ready ? "READY" : target.kind === "ssh" ? "REMOTE_EXECUTION_NOT_AUTHORIZED" : scriptRuntime ? "WINDOWS_SCRIPT_RUNTIME_UNSAFE" : "COMPUTE_UNAVAILABLE",
      workflow_id: workflow.id,
      workflow_version_id: workflow.activeVersionId,
      engine,
      target_id: targetId,
      run_dir: runPath,
      declared_input_paths: declaredInputPaths,
      scientific_input_paths: scientificInputPaths,
      executable: executable ?? null,
      diagnostics,
      checkedAt: now(),
    };
  }

  private plan(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext, engine: Engine): Json {
    const readiness = this.readiness(state, args, context, engine); const workflow = this.workflow(state, args); const runDir = required(args.run_dir, "run_dir");
    const planId = `plan-${randomUUID()}`; const name = typeof args.display_name === "string" && args.display_name.trim() ? args.display_name.trim() : `${workflow.name} plan`;
    const command = readiness.ready === true ? this.localCommand(workflow, readiness, args) : undefined;
    const targetId = typeof args.target_id === "string" ? args.target_id : "local";
    const declaredInputPaths = Array.isArray(args.input_paths) ? args.input_paths.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()) : [];
    const scientificInputPaths = Array.isArray(readiness.scientific_input_paths)
      ? readiness.scientific_input_paths.filter((value): value is string => typeof value === "string")
      : [];
    const validation = command ? this.capturePlanValidation(state, workflow, targetId, command, [...new Set([...declaredInputPaths, ...scientificInputPaths])]) : undefined;
    const plan: Plan = { id: planId, name, checksum: digest(canonicalJson({ workflow: workflow.id, version: workflow.activeVersionId, engine, runDir, readiness, declaredInputPaths, scientificInputPaths, command, validation })), workflowId: workflow.id, engine, runDir, targetId, readiness, declaredInputPaths, scientificInputPaths, createdAt: now(), ...(command ? { command } : {}), ...(validation ? { validation } : {}) };
    state.plans.set(planId, plan); return { plan_id: plan.id, plan_name: plan.name, plan_checksum: plan.checksum, workflow_id: plan.workflowId, engine, readiness, command: command ? clone(command) : null, executable: readiness.ready === true, explanation: readiness.ready === true ? "The plan is ready for explicit execution." : "The plan was created for review, but no workflow command can start until the reported runtime issue is resolved." };
  }

  private executePlan(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    assertNotAborted(context.signal); const planId = required(args.plan_id, "plan_id"); const plan = state.plans.get(planId); if (!plan) throw new Error(`Plan ${planId} is unavailable.`);
    if (required(args.plan_name, "plan_name") !== plan.name || required(args.plan_checksum, "plan_checksum") !== plan.checksum) throw new Error("Execution plan identity does not match the reviewed plan.");
    if (plan.consumedByRunId) {
      const existing = state.runs.get(plan.consumedByRunId);
      if (!existing) throw new Error(`Execution receipt ${plan.consumedByRunId} is missing from the durable registry.`);
      return {
        ...this.runView(existing),
        reused: true,
        reason: "PLAN_ALREADY_CONSUMED",
        execution_receipt: { plan_id: plan.id, plan_checksum: plan.checksum, registry_run_id: existing.id, consumed: true },
      };
    }
    const target = state.targets.get(plan.targetId);
    const runnable = plan.readiness.ready === true && target?.kind === "local" && plan.command !== undefined;
    if (runnable) {
      const diagnostics = this.revalidatePlan(state, plan);
      if (diagnostics.length > 0) {
        return {
          ok: false,
          status: "blocked",
          code: "PLAN_INPUT_CHANGED",
          plan_id: plan.id,
          plan_checksum: plan.checksum,
          process_started: false,
          diagnostics,
        };
      }
    }
    const run: Run = { id: `run-${randomUUID()}`, planId: plan.id, workflowId: plan.workflowId, state: runnable ? "queued" : "blocked", createdAt: now(), updatedAt: now(), events: [], ...(plan.command ? { command: clone(plan.command) } : {}) };
    run.events.push({ at: now(), state: run.state, message: runnable ? "Run registered for the reviewed local workflow command." : "No execution started because the selected runtime is unavailable or requires remote authorization." });
    plan.consumedByRunId = run.id;
    if (!runnable) {
      run.diagnostic = { code: target?.kind === "ssh" ? "REMOTE_EXECUTION_NOT_AUTHORIZED" : plan.readiness.code, diagnostics: plan.readiness.diagnostics };
      state.runs.set(run.id, run);
      return { registry_run_id: run.id, state: run.state, plan_id: plan.id, workflow_id: plan.workflowId, diagnostic: run.diagnostic, events: clone(run.events), reused: false, execution_receipt: { plan_id: plan.id, plan_checksum: plan.checksum, registry_run_id: run.id, consumed: true } };
    }
    state.runs.set(run.id, run);
    this.startLocalRun(state, run, plan.command!);
    return { registry_run_id: run.id, state: run.state, plan_id: plan.id, workflow_id: plan.workflowId, command: clone(plan.command!), process_id: run.processId ?? null, diagnostic: null, events: clone(run.events), reused: false, execution_receipt: { plan_id: plan.id, plan_checksum: plan.checksum, registry_run_id: run.id, consumed: true } };
  }

  private listRuns(state: NgsState, args: Record<string, unknown>): Json {
    const status = Array.isArray(args.statuses) ? args.statuses.map(String) : undefined; const limit = Number.isInteger(args.limit) ? Number(args.limit) : 50;
    return { runs: [...state.runs.values()].filter((run) => !status || status.includes(run.state)).slice(0, limit).map((run) => this.runView(run)) };
  }
  private listLineages(state: NgsState, args: Record<string, unknown>): Json { const limit = Number.isInteger(args.limit) ? Number(args.limit) : 50; return { lineages: [...state.runs.values()].slice(0, limit).map((run) => ({ registry_run_id: run.id, workflow_id: run.workflowId, plan_id: run.planId, state: run.state })) }; }
  private getRun(state: NgsState, args: Record<string, unknown>): Json { const run = this.optionalRun(state, args); return run ? { ok: true, ...this.runView(run) } : this.missingRun(args); }
  private observeRun(state: NgsState, args: Record<string, unknown>): Json { const run = this.optionalRun(state, args); return run ? { ok: true, ...this.runView(run), observation: { observedAt: now(), terminal: ["completed", "failed", "cancelled", "blocked", "orphaned", "termination_failed"].includes(run.state) } } : this.missingRun(args); }
  private async cancelRun(state: NgsState, args: Record<string, unknown>): Promise<Json> {
    const run = this.optionalRun(state, args);
    if (!run) return this.missingRun(args);
    if (["completed", "failed", "cancelled", "termination_failed", "orphaned"].includes(run.state)) return { registry_run_id: run.id, cancelled: false, state: run.state, reason: "TERMINAL_RUN" };
    run.cancelRequested = true;
    run.updatedAt = now();
    if (!run.process) {
      run.state = "cancelled";
      run.events.push({ at: run.updatedAt, state: run.state, message: "Cancellation confirmed before a local workflow command was launched." });
      saveState(state);
      return { registry_run_id: run.id, cancelled: true, cancellation_accepted: true, execution_settled: true, state: run.state, process_id: run.processId ?? null };
    }
    run.state = "stopping";
    run.events.push({ at: run.updatedAt, state: run.state, message: "Termination requested for the running local workflow command." });
    saveState(state);
    const stopped = await this.terminateLocalProcess(run.process);
    if (!stopped && run.state === "stopping") {
      run.state = "termination_failed";
      run.updatedAt = now();
      run.diagnostic = { code: "TERMINATION_FAILED", diagnostics: ["The local workflow process remained alive after termination attempts."] };
      run.events.push({ at: run.updatedAt, state: run.state, message: "The local workflow process remained alive after termination attempts." });
      saveState(state);
    }
    const finalState = (run as Run).state;
    return {
      registry_run_id: run.id,
      cancelled: finalState === "cancelled",
      cancellation_accepted: true,
      execution_settled: finalState !== "stopping",
      state: finalState,
      process_id: run.processId ?? null,
      diagnostic: clone(run.diagnostic ?? {}),
    };
  }
  private updateSummary(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext): Json { const run = this.run(state, args); const supplied = required(args.summary_path, "summary_path"); const path = isAbsolute(supplied) ? supplied : resolve(context.packageRoot, supplied); if (!existsSync(path)) throw new Error(`Analysis summary is unavailable: ${supplied}`); run.summaryPath = path; run.updatedAt = now(); run.events.push({ at: run.updatedAt, state: run.state, message: "Analysis summary linked to the registered run." }); return { registry_run_id: run.id, summary_path: path, updated: true }; }

  private listTargets(state: NgsState): Json { return { targets: [...state.targets.values()].map((target) => clone(target)) }; }
  private configureTarget(state: NgsState, args: Record<string, unknown>): Json { const id = required(args.target_id, "target_id"); const target: Target = { id, title: required(args.title, "title"), kind: "ssh", sshAlias: required(args.ssh_alias, "ssh_alias"), workspaceRoot: required(args.workspace_root, "workspace_root"), ...(typeof args.executor === "string" ? { executor: args.executor } : {}), ...(typeof args.partition === "string" ? { partition: args.partition } : {}), ...(typeof args.account === "string" ? { account: args.account } : {}), configuredAt: now() }; state.targets.set(id, target); return { target: clone(target), status: "configured", diagnostics: ["No SSH connection was attempted. Remote inspection and submission require a separate approved execution request."] }; }
  private inspectTarget(state: NgsState, args: Record<string, unknown>, context: ScienceExecutionContext): Json { assertNotAborted(context.signal); const id = required(args.target_id, "target_id"); const target = state.targets.get(id); if (!target) throw new Error(`Compute target ${id} is unavailable.`); if (target.kind === "ssh") return { target: clone(target), reachable: false, code: "REMOTE_EXECUTION_NOT_AUTHORIZED", diagnostics: ["SSH inspection is a remote operation and needs explicit execution authority; no connection was opened."], requestedExecutables: Array.isArray(args.executable_paths) ? args.executable_paths : [] }; return { target: clone(target), reachable: true, code: "LOCAL_TARGET", runtime: this.runtimeEnvironment(state, { target_id: id }) }; }

  private configurationReferencesInput(configuration: string, configurationPath: string, inputPath: string, runPath: string): boolean {
    const normalize = (value: string) => value.replace(/\\/g, "/");
    const candidates = new Set([
      normalize(inputPath),
      normalize(relative(dirname(configurationPath), inputPath)),
      normalize(relative(runPath, inputPath)),
    ]);
    return [...candidates].some((candidate) => candidate.length > 0 && configuration.includes(candidate));
  }

  private configurationInputPaths(configuration: string, configurationPath: string, runPath: string): string[] {
    const values: string[] = [];
    const visit = (value: unknown): void => {
      if (typeof value === "string") values.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach(visit);
    };
    try {
      visit(JSON.parse(configuration));
    } catch {
      for (const match of configuration.matchAll(/(?:^|[\s:[{,-])(?:["']([^"']+)["']|([^\s,\]}#]+))/gm)) {
        const value = (match[1] ?? match[2] ?? "").trim();
        if (value) values.push(value);
      }
    }
    const discovered = new Set<string>();
    for (const value of values) {
      if (!value || /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /[*?${}]/.test(value)) continue;
      const candidates = isAbsolute(value)
        ? [resolve(value)]
        : [resolve(dirname(configurationPath), value), resolve(runPath, value)];
      for (const candidate of candidates) {
        try {
          if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
          const real = realpathSync(candidate);
          if (real !== realpathSync(configurationPath)) discovered.add(real);
          break;
        } catch { /* An unreadable value is handled by normal readiness checks when explicitly declared. */ }
      }
    }
    return [...discovered].sort((left, right) => left.localeCompare(right));
  }

  private localCommand(workflow: Workflow, readiness: Json, args: Record<string, unknown>): LocalCommand {
    const executable = required(readiness.executable, "readiness executable"); const cwd = required(readiness.run_dir, "readiness run_dir");
    const source = workflow.versions.find((version) => version.id === workflow.activeVersionId)?.source;
    if (!source) throw new Error(`Workflow ${workflow.id} has no active source.`);
    if (workflow.engine === "nextflow") {
      const commandArgs = ["run", source, "-work-dir", resolve(cwd, ".nextflow-work")];
      if (typeof args.params_file === "string" && args.params_file.trim()) commandArgs.push("-params-file", isAbsolute(args.params_file) ? args.params_file : resolve(cwd, args.params_file));
      if (typeof args.profile === "string" && args.profile.trim()) commandArgs.push("-profile", args.profile);
      return { executable, arguments: commandArgs, cwd };
    }
    const commandArgs = ["--snakefile", source, "--directory", cwd];
    if (typeof args.config_file === "string" && args.config_file.trim()) commandArgs.push("--configfile", isAbsolute(args.config_file) ? args.config_file : resolve(cwd, args.config_file));
    if (Number.isInteger(args.cores) && Number(args.cores) > 0) commandArgs.push("--cores", String(args.cores));
    return { executable, arguments: commandArgs, cwd };
  }

  private startLocalRun(state: NgsState, run: Run, command: LocalCommand): void {
    let child: ChildProcess;
    try {
      child = spawn(command.executable, command.arguments, { cwd: command.cwd, windowsHide: true, shell: false });
    } catch (cause) {
      run.state = "failed"; run.updatedAt = now(); run.exitCode = null;
      run.stderrSummary = cause instanceof Error ? cause.message : String(cause);
      run.events.push({ at: run.updatedAt, state: run.state, message: "The local workflow command could not be started." });
      return;
    }
    run.process = child; if (child.pid !== undefined) run.processId = child.pid; run.state = "running"; run.updatedAt = now();
    this.activeRuns.add(run);
    this.runOwners.set(run, state);
    run.events.push({ at: run.updatedAt, state: run.state, message: "Reviewed local workflow command started.", process_id: child.pid ?? null });
    saveState(state);
    child.stdout?.on("data", (chunk: Buffer) => { run.stdoutSummary = appendSummary(run.stdoutSummary, chunk); saveState(state); });
    child.stderr?.on("data", (chunk: Buffer) => { run.stderrSummary = appendSummary(run.stderrSummary, chunk); saveState(state); });
    child.once("error", (cause) => {
      if (run.cancelRequested) return;
      run.state = "failed"; run.updatedAt = now(); run.exitCode = null;
      run.stderrSummary = appendSummary(run.stderrSummary, Buffer.from(cause.message));
      run.events.push({ at: run.updatedAt, state: run.state, message: "The local workflow command emitted a process error." });
      saveState(state);
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
      saveState(state);
    });
  }

  private async terminateLocalProcess(child: ChildProcess): Promise<boolean> {
    if (child.exitCode !== null || child.signalCode !== null) return true;
    try {
      if (process.platform === "win32" && child.pid) {
        const terminator = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore", shell: false });
        await waitForProcessExit(terminator, 5_000);
        if (await waitForProcessExit(child, 5_000)) return true;
        child.kill();
        return waitForProcessExit(child, 5_000);
      }
      child.kill("SIGTERM");
      if (await waitForProcessExit(child, 5_000)) return true;
      child.kill("SIGKILL");
      return waitForProcessExit(child, 5_000);
    } catch {
      return child.exitCode !== null || child.signalCode !== null;
    }
  }

  private pathIdentity(path: string, expected: "file" | "directory"): PathIdentity {
    const resolvedPath = resolve(path);
    const stats = statSync(resolvedPath);
    const kind = stats.isDirectory() ? "directory" : stats.isFile() ? "file" : undefined;
    if (kind !== expected) throw new Error(`${resolvedPath} is not a ${expected}.`);
    const checksum = kind === "file"
      ? digest(readFileSync(resolvedPath).toString("base64"))
      : digest(readdirSync(resolvedPath).sort((left, right) => left.localeCompare(right)).join("\0"));
    return {
      path: resolvedPath,
      realPath: realpathSync(resolvedPath),
      kind,
      device: String(stats.dev),
      inode: String(stats.ino),
      size: stats.size,
      modifiedMs: stats.mtimeMs,
      checksum,
    };
  }

  private capturePlanValidation(state: NgsState, workflow: Workflow, targetId: string, command: LocalCommand, declaredInputPaths: readonly string[] = []): PlanValidation {
    const version = workflow.versions.find((item) => item.id === workflow.activeVersionId);
    if (!version) throw new Error(`Workflow ${workflow.id} has no active version.`);
    const target = state.targets.get(targetId);
    if (!target) throw new Error(`Compute target ${targetId} is unavailable.`);
    const parameterFiles: Array<{ flag: string; identity: PathIdentity }> = [];
    for (const flag of ["-params-file", "--configfile"]) {
      const index = command.arguments.indexOf(flag);
      if (index >= 0) parameterFiles.push({ flag, identity: this.pathIdentity(command.arguments[index + 1]!, "file") });
    }
    const declaredInputs = declaredInputPaths.map((input) => this.pathIdentity(isAbsolute(input) ? input : resolve(command.cwd, input), "file"));
    return {
      workflow: { id: workflow.id, engine: workflow.engine, archived: workflow.archived, activeVersionId: workflow.activeVersionId, checksum: digest(canonicalJson(workflow)) },
      workflowVersion: { id: version.id, checksum: digest(canonicalJson(version)) },
      source: this.pathIdentity(version.source, "file"),
      parameterFiles,
      declaredInputs,
      executable: this.pathIdentity(command.executable, "file"),
      workingDirectory: this.pathIdentity(command.cwd, "directory"),
      target: { id: target.id, checksum: digest(canonicalJson(target)) },
      commandChecksum: digest(canonicalJson(command)),
    };
  }

  private revalidatePlan(state: NgsState, plan: Plan): string[] {
    if (!plan.validation || !plan.command) return ["The plan predates execution-input validation and must be recreated before execution."];
    const workflow = state.workflows.get(plan.workflowId);
    const target = state.targets.get(plan.targetId);
    if (!workflow) return [`Workflow ${plan.workflowId} is no longer available.`];
    if (!target) return [`Compute target ${plan.targetId} is no longer available.`];
    let current: PlanValidation;
    try {
      current = this.capturePlanValidation(state, workflow, plan.targetId, plan.command, [...new Set([...(plan.declaredInputPaths ?? []), ...(plan.scientificInputPaths ?? [])])]);
    } catch (cause) {
      return [cause instanceof Error ? cause.message : String(cause)];
    }
    const checks: Array<[string, unknown, unknown]> = [
      ["workflow", plan.validation.workflow, current.workflow],
      ["workflow version", plan.validation.workflowVersion, current.workflowVersion],
      ["workflow source", plan.validation.source, current.source],
      ["parameter/configuration files", plan.validation.parameterFiles, current.parameterFiles],
      ["declared scientific inputs", plan.validation.declaredInputs, current.declaredInputs],
      ["resolved executable", plan.validation.executable, current.executable],
      ["working directory", plan.validation.workingDirectory, current.workingDirectory],
      ["compute target", plan.validation.target, current.target],
      ["literal command", plan.validation.commandChecksum, current.commandChecksum],
    ];
    return checks.filter(([, expected, observed]) => canonicalJson(expected) !== canonicalJson(observed)).map(([label]) => `${label} changed after the plan was created.`);
  }

  private optionalRun(state: NgsState, args: Record<string, unknown>): Run | undefined { return state.runs.get(required(args.registry_run_id, "registry_run_id")); }
  private missingRun(args: Record<string, unknown>): Json { const id = required(args.registry_run_id, "registry_run_id"); return { ok: false, registry_run_id: id, errors: [`registry run does not exist: ${id}`] }; }
  private run(state: NgsState, args: Record<string, unknown>): Run { const id = required(args.registry_run_id, "registry_run_id"); const run = state.runs.get(id); if (!run) throw new Error(`NGS run ${id} is unavailable.`); return run; }
  private workflowView(workflow: Workflow): Json { const active = workflow.versions.find((version) => version.id === workflow.activeVersionId); return { workflow_id: workflow.id, name: workflow.name, engine: workflow.engine, description: workflow.description, archived: workflow.archived, active_version_id: workflow.activeVersionId, active_version_checksum: active?.checksum ?? null, catalog_source_checksum: active?.catalogChecksum ?? null, source_entrypoint: active?.source ?? null, source_available: active ? existsSync(active.source) : false, version_count: workflow.versions.length }; }
  private runView(run: Run): Json { return { registry_run_id: run.id, plan_id: run.planId, workflow_id: run.workflowId, state: run.state, created_at: run.createdAt, updated_at: run.updatedAt, command: run.command ? clone(run.command) : null, process_id: run.processId ?? null, exit_code: run.exitCode ?? null, stdout_summary: run.stdoutSummary ?? "", stderr_summary: run.stderrSummary ?? "", cancellation_requested: run.cancelRequested === true, execution_settled: !["queued", "running", "stopping"].includes(run.state), events: clone(run.events), summary_path: run.summaryPath ?? null, diagnostic: clone(run.diagnostic ?? {}) }; }
  private findExecutable(name: string, entries: readonly string[]): string | undefined { const extensions = process.platform === "win32" ? [".exe", "", ".cmd", ".bat"] : [""]; for (const folder of entries) for (const extension of extensions) { const candidate = resolve(folder || ".", `${name}${extension}`); if (existsSync(candidate)) return candidate; } return undefined; }
}

export function asNgsServiceError(cause: unknown): { code: string; message: string } {
  const message = cause instanceof Error ? cause.message : String(cause);
  return { code: /cancel/i.test(message) ? "CANCELLED" : "NGS_OPERATION_FAILED", message };
}
