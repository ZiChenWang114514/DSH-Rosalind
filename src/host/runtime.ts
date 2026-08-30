import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import type {
  ArtifactRef,
  ExecutionPlan,
  ImportBundle,
  NgsPlanIdentity,
  NgsReproductionInputs,
  ReviewReport,
  ShowcaseReproductionInputs,
  RunSnapshot,
  RunState,
  ShowcaseDefinition,
  ShowcaseMode,
} from "../shared/types.js";
import { MODULE_IDS, moduleIdForPlugin, type ModuleId } from "../modules/types.js";
import { resolveInside, ShowcaseCatalog } from "./catalog.js";
import { ProviderRegistry, providerRequiresConfirmation } from "./providers.js";
import { reproduceShowcase, type NgsReproductionRequest, type ReproductionResult } from "./reproduction.js";
import type { ScienceExecutor } from "./science-tools.js";
import { ScienceRuntime } from "./science/runtime.js";
import { canonicalArtifactBuffer, canonicalArtifactSha256, validateShowcase, type ValidationResult } from "./validators.js";

interface RunRecord {
  snapshot: RunSnapshot;
  controller: AbortController;
}

const TRANSITIONS: Record<RunState, readonly RunState[]> = {
  draft: ["awaiting_confirmation", "queued", "cancelled"],
  awaiting_confirmation: ["queued", "cancelled"],
  queued: ["awaiting_confirmation", "running", "cancelled", "failed"],
  running: ["awaiting_confirmation", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export interface RosalindPlanOptions {
  ngs?: NgsReproductionInputs;
  reproduction?: ShowcaseReproductionInputs;
}

export class RosalindModuleDisabledError extends Error {
  readonly code = "ROSALIND_MODULE_DISABLED";

  constructor(readonly moduleIds: readonly ModuleId[], action: string, showcaseId: string) {
    super(`Cannot ${action} Showcase ${showcaseId} while required module${moduleIds.length === 1 ? "" : "s"} ${moduleIds.join(", ")} ${moduleIds.length === 1 ? "is" : "are"} disabled.`);
    this.name = "RosalindModuleDisabledError";
  }
}

const SOURCE_INPUT_SHOWCASES = new Set([
  "slide-tissue-architecture",
  "slide-spatial-expression",
  "slide-segmentation-overlay",
  "slide-research-export",
]);

function needsSourceInputs(showcaseId: string, mode: ShowcaseMode): boolean {
  return mode === "reproduce" && SOURCE_INPUT_SHOWCASES.has(showcaseId);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
}

function sessionId(session: object): string | undefined {
  const value = (session as { id?: unknown }).id;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function event(record: RunRecord, state: RunState, message: string, stepId?: string): void {
  const previous = record.snapshot.state;
  if (!TRANSITIONS[previous].includes(state)) throw new Error(`Invalid run transition: ${previous} -> ${state}`);
  const at = now();
  record.snapshot.state = state;
  record.snapshot.updatedAt = at;
  record.snapshot.events.push({ at, state, message, ...(stepId ? { stepId } : {}) });
}

function confirmationReasons(providerKind: string): string[] {
  switch (providerKind) {
    case "public-api": return ["This execution will contact the selected public network service."];
    case "paid-api": return ["This provider may create billable API usage."];
    case "gpu": return ["This provider may start a GPU workload."];
    case "ssh": return ["This provider may submit work to a configured SSH or HPC target."];
    case "container": return ["This provider may start a local container workload."];
    default: return [];
  }
}

function isNgsReproduction(showcaseId: string, mode: ShowcaseMode): boolean {
  return mode === "reproduce" && ["ngs-fastq-qc", "ngs-bulk-rnaseq", "ngs-single-cell"].includes(showcaseId);
}

function exactNgsPlanReason(plan: NgsPlanIdentity): string {
  return `Run reviewed NGS plan ${plan.planName} (${plan.planId}, checksum ${plan.planChecksum}) with the declared scientific inputs.`;
}

function sameNgsPlan(left: NgsPlanIdentity | undefined, right: NgsPlanIdentity | undefined): boolean {
  return Boolean(left && right
    && left.planId === right.planId
    && left.planName === right.planName
    && left.planChecksum === right.planChecksum);
}

function validationArtifact(runId: string, showcaseId: string, validation: ValidationResult): ArtifactRef {
  return {
    id: `validation:${runId}`,
    role: "log",
    mediaType: "application/json",
    generatedAt: now(),
    source: validation.ok ? "deterministic local validation" : "failed deterministic local validation",
    resourceUri: `rosalind-run://${runId}/${showcaseId}/validation`,
  };
}

function readReplayArtifact(packageRoot: string, runId: string, showcase: { id: string; artifacts: ArtifactRef[] }): { artifact: ArtifactRef; ok: boolean } {
  const candidate = showcase.artifacts.find((item) => item.role === "output" && item.path)
    ?? showcase.artifacts.find((item) => item.role === "preview" && item.path)
    ?? showcase.artifacts.find((item) => item.path);
  if (!candidate?.path) {
    return {
      ok: false,
      artifact: {
        id: `replay:${runId}:content`,
        role: "log",
        mediaType: "application/json",
        generatedAt: now(),
        source: "replay-content: unavailable; the showcase has no file-backed artifact to open.",
        resourceUri: `rosalind-run://${runId}/${showcase.id}/artifact/unavailable`,
      },
    };
  }
  try {
    const bytes = readFileSync(resolveInside(packageRoot, candidate.path));
    const canonicalBytes = canonicalArtifactBuffer(candidate.mediaType, bytes);
    const sha256 = canonicalArtifactSha256(candidate.mediaType, bytes);
    const byteCountOk = candidate.bytes === undefined || candidate.bytes === canonicalBytes.length;
    const sha256Ok = candidate.sha256 === undefined || candidate.sha256 === sha256;
    return {
      ok: byteCountOk && sha256Ok,
      artifact: {
        id: `replay:${runId}:${candidate.id}`,
        role: "log",
        mediaType: candidate.mediaType,
        path: candidate.path,
        bytes: canonicalBytes.length,
        sha256,
        generatedAt: now(),
        source: `replay-content:${byteCountOk && sha256Ok ? "available" : "identity-mismatch"}; opened ${candidate.id}; physical-bytes=${bytes.length}; canonical-bytes=${canonicalBytes.length}; sha256=${sha256}`,
        resourceUri: `rosalind-run://${runId}/${showcase.id}/artifact/${encodeURIComponent(candidate.id)}`,
      },
    };
  } catch (cause) {
    return {
      ok: false,
      artifact: {
        id: `replay:${runId}:${candidate.id}`,
        role: "log",
        mediaType: candidate.mediaType,
        path: candidate.path,
        generatedAt: now(),
        source: `replay-content: unavailable; could not open ${candidate.id}: ${cause instanceof Error ? cause.message : String(cause)}`,
        resourceUri: `rosalind-run://${runId}/${showcase.id}/artifact/${encodeURIComponent(candidate.id)}`,
      },
    };
  }
}

function reproductionArtifact(runId: string, showcaseId: string, result: ReproductionResult): ArtifactRef {
  return {
    id: `reproduction:${runId}`,
    role: "log",
    mediaType: "application/json",
    generatedAt: now(),
    source: result.summary,
    resourceUri: `rosalind-run://${runId}/${showcaseId}/reproduction`,
  };
}

export class RosalindRuntime {
  readonly catalog: ShowcaseCatalog;
  readonly providers: ProviderRegistry;
  readonly science: ScienceExecutor;
  private readonly sessions = new WeakMap<object, Map<string, RunRecord>>();
  private readonly liveRecords = new Set<RunRecord>();
  private moduleEnabled: ((id: ModuleId) => boolean) | undefined;
  private disposed = false;

  constructor(options: { catalog?: ShowcaseCatalog; providers?: ProviderRegistry; science?: ScienceExecutor; moduleEnabled?: (id: ModuleId) => boolean } = {}) {
    this.catalog = options.catalog ?? new ShowcaseCatalog();
    this.providers = options.providers ?? new ProviderRegistry();
    this.science = options.science ?? new ScienceRuntime();
    this.moduleEnabled = options.moduleEnabled;
  }

  setModuleEnabled(resolve: (id: ModuleId) => boolean): void {
    this.moduleEnabled = resolve;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const record of this.liveRecords) {
      record.controller.abort(new Error("DSH-Rosalind runtime was disposed"));
      const state = record.snapshot.state;
      if (state === "draft" || state === "awaiting_confirmation" || state === "queued") {
        event(record, "cancelled", "Runtime disposal cancelled the run before execution.");
        this.liveRecords.delete(record);
      }
    }
  }

  createImport(showcaseId: string, suggestedMode: ShowcaseMode): ImportBundle {
    this.assertActive();
    const showcase = this.catalog.get(showcaseId);
    this.assertShowcaseAvailable(showcase, "import");
    if (!showcase.modes.includes(suggestedMode)) throw new Error(`${showcaseId} does not support ${suggestedMode}`);
    const prompt = readFileSync(resolveInside(this.catalog.packageRoot, showcase.promptPath), "utf8");
    return {
      showcaseId,
      title: showcase.title,
      prompt,
      caseIndex: [
        { role: "readme", path: showcase.readmePath, mediaType: "text/markdown" },
        { role: "prompt", path: showcase.promptPath, mediaType: "text/markdown" },
        ...showcase.artifacts.filter((item) => item.path).map((item) => ({
          role: item.role,
          path: item.path!,
          mediaType: item.mediaType,
        })),
      ],
      adapter: showcase.recipe.adapter,
      suggestedMode,
    };
  }

  plan(
    session: object,
    showcaseId: string,
    mode: ShowcaseMode,
    requestedProviderId?: string,
    options: RosalindPlanOptions = {},
  ): RunSnapshot {
    this.assertActive();
    const showcase = this.catalog.get(showcaseId);
    this.assertShowcaseAvailable(showcase, "plan");
    if (!showcase.modes.includes(mode)) throw new Error(`${showcaseId} does not support ${mode}`);
    if (options.ngs && !isNgsReproduction(showcaseId, mode)) {
      throw new Error("NGS scientific inputs can only be attached to an NGS reproduce plan.");
    }
    if (options.reproduction && (mode !== "reproduce" || isNgsReproduction(showcaseId, mode))) {
      throw new Error("Generic scientific inputs can only be attached to a non-NGS reproduce plan.");
    }
    if (options.ngs && options.reproduction) {
      throw new Error("Use the NGS input contract or the generic reproduction input contract, not both.");
    }
    if (options.reproduction && (!options.reproduction.runDirectory.trim() || options.reproduction.sourcePaths.length === 0 || options.reproduction.sourcePaths.some((path) => !path.trim()))) {
      throw new Error("A scientific reproduce plan needs a non-empty runDirectory and at least one non-empty source path.");
    }
    const providerId = mode === "reproduce"
      ? (requestedProviderId ?? showcase.recipe.providerIds[0])
      : "local-replay";
    if (!providerId) throw new Error(`${showcaseId} has no provider for ${mode}`);
    if (mode === "reproduce" && !showcase.recipe.providerIds.includes(providerId)) {
      throw new Error(`Provider ${providerId} is not declared for ${showcaseId}`);
    }
    const providerIds = mode === "reproduce" && (showcase.categoryId === "literature" || showcase.categoryId === "databases")
      ? [...showcase.recipe.providerIds]
      : [providerId];
    const providers = providerIds.map((id) => this.providers.get(id));
    const provider = providers[0]!;
    const reasons = [...new Set(providers.flatMap((item) => providerRequiresConfirmation(item) ? confirmationReasons(item.kind) : []))];
    const createdAt = now();
    const plan: ExecutionPlan = {
      id: randomUUID(),
      showcaseId,
      mode,
      createdAt,
      steps: [
        {
          id: "inspect",
          label: "Inspect the retained case and provider requirements",
          adapter: showcase.recipe.adapter,
          providerId,
          requiresNetwork: provider.kind === "public-api" || provider.kind === "paid-api",
          requiresConfirmation: reasons.length > 0,
          estimatedSeconds: 1,
        },
        {
          id: "execute",
          label: mode === "lesson" ? "Prepare the teaching view" : mode === "replay" ? "Validate retained artifacts" : "Run the declared reproduction adapter",
          adapter: showcase.recipe.adapter,
          providerId,
          requiresNetwork: provider.kind === "public-api" || provider.kind === "paid-api",
          requiresConfirmation: reasons.length > 0,
        },
      ],
      inputs: showcase.artifacts.filter((artifact) => artifact.role === "input"),
      providerIds,
      resources: providers.map((item) => item.label),
      estimatedCostUsd: providers.reduce((total, item) => ({
        min: total.min + (item.estimatedCostUsd?.min ?? 0),
        max: total.max + (item.estimatedCostUsd?.max ?? 0),
      }), { min: 0, max: 0 }),
      confirmationReasons: reasons,
    };
    const ngs = isNgsReproduction(showcaseId, mode) && options.ngs
      ? { inputs: { runDirectory: options.ngs.runDirectory, configFile: options.ngs.configFile, inputPaths: [...options.ngs.inputPaths] } }
      : undefined;
    const reproduction = options.reproduction
      ? { inputs: { runDirectory: options.reproduction.runDirectory, sourcePaths: [...options.reproduction.sourcePaths], ...(options.reproduction.config ? { config: clone(options.reproduction.config) } : {}) } }
      : undefined;
    const missingSourceInputs = needsSourceInputs(showcaseId, mode) && !reproduction;
    const snapshot: RunSnapshot = {
      id: randomUUID(),
      showcaseId,
      mode,
      state: "draft",
      plan,
      createdAt,
      updatedAt: createdAt,
      progress: 0,
      artifacts: [],
      events: [{ at: createdAt, state: "draft", message: "Execution plan created." }],
      ...(ngs ? { ngs } : {}),
      ...(reproduction ? { reproduction } : {}),
      ...(missingSourceInputs ? { error: { code: "REPRODUCTION_INPUT_REQUIRED", message: "Create a new reproduce plan with an authorized run directory and the required source files." } } : {}),
    };
    const record = { snapshot, controller: new AbortController() };
    this.sessionRuns(session).set(snapshot.id, record);
    this.liveRecords.add(record);
    event(record, reasons.length > 0 || missingSourceInputs ? "awaiting_confirmation" : "queued", missingSourceInputs
      ? "Scientific source input is required; create a new plan that retains the exact selected files."
      : reasons.length > 0
      ? "Explicit confirmation is required before execution."
      : "Plan is ready to run.");
    return clone(record.snapshot);
  }

  approve(session: object, runId: string, acknowledgements: readonly string[], approvedNgsPlan?: NgsPlanIdentity): RunSnapshot {
    this.assertActive();
    const record = this.ownedRun(session, runId);
    this.assertShowcaseAvailable(this.catalog.get(record.snapshot.showcaseId), "approve");
    if (record.snapshot.state !== "awaiting_confirmation") {
      throw new Error(`Run ${runId} is ${record.snapshot.state}; only awaiting_confirmation can be approved.`);
    }
    if (record.snapshot.error?.code === "REPRODUCTION_INPUT_REQUIRED") {
      throw new Error("This plan has no scientific source inputs. Create a new plan with the required run directory and source files.");
    }
    const missing = record.snapshot.plan.confirmationReasons.filter((reason) => !acknowledgements.includes(reason));
    if (missing.length > 0) throw new Error(`Approval is missing acknowledgement: ${missing.join("; ")}`);
    if (record.snapshot.ngs?.pendingPlan) {
      if (!sameNgsPlan(record.snapshot.ngs.pendingPlan, approvedNgsPlan)) {
        throw new Error("Approval must provide the exact NGS plan_id, plan_name, and plan_checksum shown for this run.");
      }
      record.snapshot.ngs.approvedPlan = clone(record.snapshot.ngs.pendingPlan);
    }
    event(record, "queued", "The required confirmations were recorded; the selected provider is unchanged.");
    return clone(record.snapshot);
  }

  async run(session: object, runId: string, signal: AbortSignal): Promise<RunSnapshot> {
    this.assertActive();
    const record = this.ownedRun(session, runId);
    this.assertShowcaseAvailable(this.catalog.get(record.snapshot.showcaseId), "run");
    const isNgs = isNgsReproduction(record.snapshot.showcaseId, record.snapshot.mode);
    const continuingNgs = isNgs && record.snapshot.state === "running";
    if (record.snapshot.state !== "queued" && !continuingNgs) throw new Error(`Run ${runId} is ${record.snapshot.state}; only queued runs can start, except an active NGS run may be observed again.`);
    const onAbort = () => record.controller.abort(signal.reason);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    const preparingNgsPlan = isNgs && !record.snapshot.ngs?.approvedPlan && !record.snapshot.ngs?.registryRunId;
    if (!preparingNgsPlan && !continuingNgs) event(record, "running", "Execution started with the selected provider.", "inspect");
    else if (continuingNgs) record.snapshot.events.push({ at: now(), state: "running", message: "NGS run observation continued from its retained registry identity.", stepId: "execute" });
    record.snapshot.currentStepId = "inspect";
    record.snapshot.progress = continuingNgs ? Math.max(record.snapshot.progress, 0.6) : 0.1;
    try {
      this.throwIfAborted(record);
      const showcase = this.catalog.get(record.snapshot.showcaseId);
      const providerId = record.snapshot.plan.providerIds[0]!;
      const providers = record.snapshot.plan.providerIds.map((id) => this.providers.get(id));
      const provider = providers[0]!;
      record.snapshot.currentStepId = "execute";
      record.snapshot.progress = 0.4;

      if (record.snapshot.mode === "lesson") {
        record.snapshot.artifacts = showcase.artifacts.filter((item) => item.role === "preview" || item.role === "output");
        record.snapshot.progress = 1;
        delete record.snapshot.currentStepId;
        event(record, "completed", "Teaching material is ready; observations, computed results, and interpretation remain separate.", "execute");
        this.liveRecords.delete(record);
        return clone(record.snapshot);
      }

      if (record.snapshot.mode === "replay") {
        const validation = validateShowcase(this.catalog.packageRoot, showcase);
        const replay = readReplayArtifact(this.catalog.packageRoot, runId, showcase);
        record.snapshot.artifacts = [...showcase.artifacts, replay.artifact, validationArtifact(runId, showcase.id, validation)];
        if (!validation.ok || !replay.ok) {
          const failures = validation.checks.filter((item) => !item.ok).map((item) => item.name);
          if (!replay.ok) failures.unshift(replay.artifact.source ?? "replay artifact could not be opened");
          record.snapshot.error = { code: replay.ok ? "REPLAY_VALIDATION_FAILED" : "REPLAY_ARTIFACT_UNAVAILABLE", message: failures.join(", ") };
          record.snapshot.progress = 1;
          delete record.snapshot.currentStepId;
          event(record, "failed", "Retained artifacts did not pass deterministic validation.", "execute");
        } else {
          record.snapshot.progress = 1;
          delete record.snapshot.currentStepId;
          event(record, "completed", "Retained artifacts and recorded scientific checks passed.", "execute");
        }
        this.liveRecords.delete(record);
        return clone(record.snapshot);
      }

      const unavailable = providers.filter((item) => !item.runnable);
      if (unavailable.length > 0) {
        record.snapshot.error = { code: "PROVIDER_UNAVAILABLE", message: unavailable.map((item) => `${item.label}: ${item.diagnostics.join(" ") || "unavailable"}`).join(" ") };
        record.snapshot.progress = 1;
        delete record.snapshot.currentStepId;
        event(record, "failed", "The selected provider is unavailable; no alternate provider was selected.", "execute");
        this.liveRecords.delete(record);
        return clone(record.snapshot);
      }

      const unsupported = providers.find((item) => ["paid-api", "gpu", "ssh", "container"].includes(item.kind));
      if (unsupported) {
        record.snapshot.error = {
          code: "PROVIDER_EXECUTION_NOT_IMPLEMENTED",
          message: `Provider ${unsupported.id} is configured, but DSH-Rosalind does not yet implement its declared execution protocol for ${showcase.recipe.adapter}.`,
        };
        record.snapshot.progress = 1;
        delete record.snapshot.currentStepId;
        event(record, "failed", "No external work was started and the selected provider was unchanged.", "execute");
        this.liveRecords.delete(record);
        return clone(record.snapshot);
      }

      this.throwIfAborted(record);
      const ngsReproduction: NgsReproductionRequest | undefined = record.snapshot.ngs
        ? {
          ...record.snapshot.ngs.inputs,
          ...(record.snapshot.ngs.pendingPlan ? { pendingPlan: record.snapshot.ngs.pendingPlan } : {}),
          ...(record.snapshot.ngs.approvedPlan ? { approvedPlan: record.snapshot.ngs.approvedPlan } : {}),
          ...(record.snapshot.ngs.registryRunId ? { registryRunId: record.snapshot.ngs.registryRunId } : {}),
        }
        : undefined;
      const stableSessionId = sessionId(session);
      const reproduction = await reproduceShowcase(showcase, providerId, this.science, {
        session,
        ...(stableSessionId ? { sessionId: stableSessionId } : {}),
        signal: record.controller.signal,
        packageRoot: this.catalog.packageRoot,
        allowNetwork: providers.some((item) => item.kind === "public-api") && unavailable.length === 0,
        ...(record.snapshot.reproduction ? {
          showcaseReproduction: clone(record.snapshot.reproduction.inputs),
          authorizedPaths: [record.snapshot.reproduction.inputs.runDirectory, ...record.snapshot.reproduction.inputs.sourcePaths],
        } : {}),
        ...(ngsReproduction ? { ngsReproduction } : {}),
      });
      this.throwIfAborted(record);
      record.snapshot.artifacts = [reproductionArtifact(runId, showcase.id, reproduction)];
      if (reproduction.pendingPlan && record.snapshot.ngs) {
        record.snapshot.ngs.pendingPlan = clone(reproduction.pendingPlan);
        const reason = exactNgsPlanReason(reproduction.pendingPlan);
        if (!record.snapshot.plan.confirmationReasons.includes(reason)) record.snapshot.plan.confirmationReasons.push(reason);
      }
      if (reproduction.registryRunId && record.snapshot.ngs) record.snapshot.ngs.registryRunId = reproduction.registryRunId;
      if (reproduction.status === "awaiting_confirmation") {
        record.snapshot.progress = 0.25;
        delete record.snapshot.currentStepId;
        if (reproduction.error) record.snapshot.error = reproduction.error;
        else delete record.snapshot.error;
        event(record, "awaiting_confirmation", reproduction.summary, "execute");
        return clone(record.snapshot);
      }
      if (reproduction.status === "running") {
        record.snapshot.progress = Math.max(record.snapshot.progress, 0.6);
        record.snapshot.currentStepId = "execute";
        delete record.snapshot.error;
        record.snapshot.updatedAt = now();
        record.snapshot.events.push({ at: record.snapshot.updatedAt, state: "running", message: reproduction.summary, stepId: "execute" });
        return clone(record.snapshot);
      }
      record.snapshot.progress = 1;
      delete record.snapshot.currentStepId;
      if (reproduction.status === "completed") event(record, "completed", reproduction.summary, "execute");
      else if (reproduction.status === "cancelled") {
        record.snapshot.error = reproduction.error ?? { code: "NGS_RUN_CANCELLED", message: reproduction.summary };
        event(record, "cancelled", reproduction.summary, "execute");
      } else {
        record.snapshot.error = reproduction.error ?? { code: "REPRODUCTION_FAILED", message: reproduction.summary };
        event(record, "failed", reproduction.summary, "execute");
      }
      this.liveRecords.delete(record);
      return clone(record.snapshot);
    } catch (cause) {
      const state = record.snapshot.state as RunState;
      if (record.controller.signal.aborted && state === "running") {
        record.snapshot.progress = Math.min(record.snapshot.progress, 0.99);
        delete record.snapshot.currentStepId;
        event(record, "cancelled", "Execution was cancelled and its cooperative work settled.");
        this.liveRecords.delete(record);
        return clone(record.snapshot);
      }
      if (state === "running") {
        record.snapshot.error = { code: "RUN_FAILED", message: cause instanceof Error ? cause.message : String(cause) };
        delete record.snapshot.currentStepId;
        event(record, "failed", "Execution failed.");
        this.liveRecords.delete(record);
        return clone(record.snapshot);
      }
      throw cause;
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }

  status(session: object, runId: string): RunSnapshot {
    this.assertActive();
    return clone(this.ownedRun(session, runId).snapshot);
  }

  async cancel(session: object, runId: string, reason: string): Promise<RunSnapshot> {
    this.assertActive();
    const record = this.ownedRun(session, runId);
    if (record.snapshot.state === "queued" || record.snapshot.state === "awaiting_confirmation" || record.snapshot.state === "draft") {
      record.controller.abort(reason);
      event(record, "cancelled", reason || "Run cancelled before execution.");
      this.liveRecords.delete(record);
    } else if (record.snapshot.state === "running") {
      const registryRunId = record.snapshot.ngs?.registryRunId;
      if (registryRunId) {
        const stableSessionId = sessionId(session);
        const cancellation = await this.science.execute("ngs", "cancel_ngs_run", { registry_run_id: registryRunId }, {
          session,
          ...(stableSessionId ? { sessionId: stableSessionId } : {}),
          signal: new AbortController().signal,
          packageRoot: this.catalog.packageRoot,
        });
        if (cancellation.state === "cancelled") {
          record.controller.abort(reason);
          record.snapshot.progress = Math.min(record.snapshot.progress, 0.99);
          delete record.snapshot.currentStepId;
          event(record, "cancelled", reason || "NGS execution was cancelled.");
          this.liveRecords.delete(record);
          return clone(record.snapshot);
        }
        // A registry process remains the source of truth for an NGS run.  In
        // particular, a termination failure must not abort the outer
        // observation controller: doing so would manufacture a cancelled
        // Rosalind result while the scientific process is still active.
        record.snapshot.events.push({
          at: now(),
          state: "running",
          message: cancellation.state === "termination_failed"
            ? "NGS termination did not settle; the retained registry run remains active for observation."
            : "NGS cancellation was not confirmed by the retained registry run; observation remains active.",
          stepId: "execute",
        });
        record.snapshot.updatedAt = now();
        return clone(record.snapshot);
      }
      record.controller.abort(reason);
      // The running call owns the terminal transition after cooperative work settles.
      record.snapshot.events.push({ at: now(), state: "running", message: reason || "Cancellation requested." });
      record.snapshot.updatedAt = now();
    } else {
      throw new Error(`Run ${runId} is already ${record.snapshot.state}.`);
    }
    return clone(record.snapshot);
  }

  review(showcaseId: string): ReviewReport {
    this.assertActive();
    const showcase = this.catalog.get(showcaseId);
    const validation = validateShowcase(this.catalog.packageRoot, showcase);
    return {
      showcaseId,
      generatedAt: now(),
      sourceObservations: [...showcase.observations],
      computedResults: [...showcase.computedResults],
      scientificInterpretation: [...showcase.interpretation],
      limitations: [...showcase.limitations],
      citationChecks: showcase.sources.map((source) => ({ source, valid: /^https?:\/\//.test(source), note: "Recorded source identifier; live content was not substituted during review." })),
      artifactChecks: showcase.artifacts.map((artifact) => {
        const result = validation.checks.find((item) => item.name === artifact.id);
        return { artifactId: artifact.id, present: result?.ok ?? true, note: result?.actual ?? "resource reference" };
      }),
    };
  }

  private requiredModules(showcase: ShowcaseDefinition): ModuleId[] {
    const required = new Set<ModuleId>(["rosalind"]);
    const owner = moduleIdForPlugin(showcase.pluginId);
    if (owner) required.add(owner);
    for (const server of showcase.requiredMcpServers) {
      const suffix = server.split(":").at(-1);
      if (suffix && MODULE_IDS.includes(suffix as ModuleId)) required.add(suffix as ModuleId);
    }
    return MODULE_IDS.filter((id) => required.has(id));
  }

  private assertShowcaseAvailable(showcase: ShowcaseDefinition, action: string): void {
    if (!this.moduleEnabled) return;
    const disabled = this.requiredModules(showcase).filter((id) => !this.moduleEnabled!(id));
    if (disabled.length > 0) throw new RosalindModuleDisabledError(disabled, action, showcase.id);
  }

  private sessionRuns(session: object): Map<string, RunRecord> {
    let runs = this.sessions.get(session);
    if (!runs) {
      runs = new Map();
      this.sessions.set(session, runs);
    }
    return runs;
  }

  private ownedRun(session: object, runId: string): RunRecord {
    const run = this.sessionRuns(session).get(runId);
    if (!run) throw new Error(`Run ${runId} does not belong to this session.`);
    return run;
  }

  private throwIfAborted(record: RunRecord): void {
    if (record.controller.signal.aborted) throw record.controller.signal.reason ?? new Error("run aborted");
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("DSH-Rosalind runtime has been disposed");
  }
}
