import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import type {
  ArtifactRef,
  ExecutionPlan,
  ImportBundle,
  ReviewReport,
  RunSnapshot,
  RunState,
  ShowcaseMode,
} from "../shared/types.js";
import { resolveInside, ShowcaseCatalog } from "./catalog.js";
import { ProviderRegistry, providerRequiresConfirmation } from "./providers.js";
import { validateShowcase, type ValidationResult } from "./validators.js";

interface RunRecord {
  snapshot: RunSnapshot;
  controller: AbortController;
}

const TRANSITIONS: Record<RunState, readonly RunState[]> = {
  draft: ["awaiting_confirmation", "queued", "cancelled"],
  awaiting_confirmation: ["queued", "cancelled"],
  queued: ["running", "cancelled", "failed"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
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
    case "paid-api": return ["This provider may create billable API usage."];
    case "gpu": return ["This provider may start a GPU workload."];
    case "ssh": return ["This provider may submit work to a configured SSH or HPC target."];
    default: return [];
  }
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

export class RosalindRuntime {
  readonly catalog: ShowcaseCatalog;
  readonly providers: ProviderRegistry;
  private readonly sessions = new WeakMap<object, Map<string, RunRecord>>();
  private readonly liveRecords = new Set<RunRecord>();
  private disposed = false;

  constructor(options: { catalog?: ShowcaseCatalog; providers?: ProviderRegistry } = {}) {
    this.catalog = options.catalog ?? new ShowcaseCatalog();
    this.providers = options.providers ?? new ProviderRegistry();
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
  ): RunSnapshot {
    this.assertActive();
    const showcase = this.catalog.get(showcaseId);
    if (!showcase.modes.includes(mode)) throw new Error(`${showcaseId} does not support ${mode}`);
    const providerId = mode === "reproduce"
      ? (requestedProviderId ?? showcase.recipe.providerIds[0])
      : "local-replay";
    if (!providerId) throw new Error(`${showcaseId} has no provider for ${mode}`);
    if (mode === "reproduce" && !showcase.recipe.providerIds.includes(providerId)) {
      throw new Error(`Provider ${providerId} is not declared for ${showcaseId}`);
    }
    const provider = this.providers.get(providerId);
    const reasons = providerRequiresConfirmation(provider) ? confirmationReasons(provider.kind) : [];
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
      providerIds: [providerId],
      resources: [provider.label],
      estimatedCostUsd: provider.estimatedCostUsd ?? { min: 0, max: 0 },
      confirmationReasons: reasons,
    };
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
    };
    const record = { snapshot, controller: new AbortController() };
    this.sessionRuns(session).set(snapshot.id, record);
    this.liveRecords.add(record);
    event(record, reasons.length > 0 ? "awaiting_confirmation" : "queued", reasons.length > 0
      ? "Explicit confirmation is required before execution."
      : "Plan is ready to run.");
    return clone(record.snapshot);
  }

  approve(session: object, runId: string, acknowledgements: readonly string[]): RunSnapshot {
    this.assertActive();
    const record = this.ownedRun(session, runId);
    if (record.snapshot.state !== "awaiting_confirmation") {
      throw new Error(`Run ${runId} is ${record.snapshot.state}; only awaiting_confirmation can be approved.`);
    }
    const missing = record.snapshot.plan.confirmationReasons.filter((reason) => !acknowledgements.includes(reason));
    if (missing.length > 0) throw new Error(`Approval is missing acknowledgement: ${missing.join("; ")}`);
    event(record, "queued", "The required confirmations were recorded; the selected provider is unchanged.");
    return clone(record.snapshot);
  }

  async run(session: object, runId: string, signal: AbortSignal): Promise<RunSnapshot> {
    this.assertActive();
    const record = this.ownedRun(session, runId);
    if (record.snapshot.state !== "queued") throw new Error(`Run ${runId} is ${record.snapshot.state}; only queued runs can start.`);
    const onAbort = () => record.controller.abort(signal.reason);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    event(record, "running", "Execution started with the selected provider.", "inspect");
    record.snapshot.currentStepId = "inspect";
    record.snapshot.progress = 0.1;
    try {
      this.throwIfAborted(record);
      const showcase = this.catalog.get(record.snapshot.showcaseId);
      const providerId = record.snapshot.plan.providerIds[0]!;
      const provider = this.providers.get(providerId);
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
        record.snapshot.artifacts = [...showcase.artifacts, validationArtifact(runId, showcase.id, validation)];
        if (!validation.ok) {
          record.snapshot.error = { code: "REPLAY_VALIDATION_FAILED", message: validation.checks.filter((item) => !item.ok).map((item) => item.name).join(", ") };
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

      if (!provider.runnable) {
        record.snapshot.error = { code: "PROVIDER_UNAVAILABLE", message: provider.diagnostics.join(" ") || `${provider.id} is unavailable.` };
        record.snapshot.progress = 1;
        delete record.snapshot.currentStepId;
        event(record, "failed", "The selected provider is unavailable; no alternate provider was selected.", "execute");
        this.liveRecords.delete(record);
        return clone(record.snapshot);
      }

      const localProvider = provider.kind === "local";
      if (!localProvider) {
        record.snapshot.error = {
          code: "ADAPTER_NOT_CONNECTED",
          message: `Provider prerequisites for ${provider.id} are available, but adapter ${showcase.recipe.adapter} has no configured execution transport.`,
        };
        record.snapshot.progress = 1;
        delete record.snapshot.currentStepId;
        event(record, "failed", "No external work was started and the selected provider was not replaced.", "execute");
        this.liveRecords.delete(record);
        return clone(record.snapshot);
      }

      await Promise.resolve();
      this.throwIfAborted(record);
      const validation = validateShowcase(this.catalog.packageRoot, showcase);
      this.throwIfAborted(record);
      record.snapshot.artifacts = [validationArtifact(runId, showcase.id, validation)];
      record.snapshot.progress = 1;
      delete record.snapshot.currentStepId;
      if (validation.ok) event(record, "completed", "Deterministic local reproduction checks passed.", "execute");
      else {
        record.snapshot.error = { code: "REPRODUCTION_CHECK_FAILED", message: validation.checks.filter((item) => !item.ok).map((item) => item.name).join(", ") };
        event(record, "failed", "Deterministic local reproduction checks failed.", "execute");
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

  cancel(session: object, runId: string, reason: string): RunSnapshot {
    this.assertActive();
    const record = this.ownedRun(session, runId);
    if (record.snapshot.state === "queued" || record.snapshot.state === "awaiting_confirmation" || record.snapshot.state === "draft") {
      record.controller.abort(reason);
      event(record, "cancelled", reason || "Run cancelled before execution.");
      this.liveRecords.delete(record);
    } else if (record.snapshot.state === "running") {
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
