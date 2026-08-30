import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { JsonValue } from "@deepseek-ai/dsh-tools";

import { MODULE_IDS, type ModuleId } from "../../modules/types.js";
import type { ScienceExecutionContext, ScienceExecutor } from "../science-tools.js";
import { DatabaseService } from "./databases.js";
import { LiteratureService } from "./literature.js";
import { NgsService } from "./ngs.js";
import { asNgsServiceError } from "./ngs.js";
import { SequenceService, asSequenceServiceError } from "./sequence.js";
import { SlideService } from "./slide.js";
import { StructureService } from "./structure.js";

type JsonRecord = Record<string, JsonValue>;

const MODULE_OPERATION_COUNTS: Record<ModuleId, number> = {
  literature: 0,
  databases: 0,
  sequence: 13,
  ngs: 25,
  structure: 41,
  slide: 40,
  rosalind: 2,
};

const MODULE_SKILL_COUNTS: Record<ModuleId, number> = {
  literature: 3,
  databases: 44,
  sequence: 1,
  ngs: 5,
  structure: 1,
  slide: 1,
  rosalind: 0,
};

function jsonRecord(value: unknown): JsonRecord {
  const normalized = JSON.parse(JSON.stringify(value ?? {})) as unknown;
  return normalized && typeof normalized === "object" && !Array.isArray(normalized)
    ? normalized as JsonRecord
    : { value: normalized as JsonValue };
}

function errorRecord(serviceId: string, operation: string, cause: unknown): JsonRecord {
  const explicit = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
    ? { code: cause.code, message: cause instanceof Error ? cause.message : String(cause) }
    : serviceId === "sequence"
      ? asSequenceServiceError(cause)
      : serviceId === "ngs"
        ? asNgsServiceError(cause)
        : { code: "SCIENCE_OPERATION_FAILED", message: cause instanceof Error ? cause.message : String(cause) };
  const { code, message } = explicit;
  return { serviceId, operation, status: code === "CANCELLED" ? "cancelled" : "failed", error: { code, message } };
}

function normalize(serviceId: string, operation: string, value: unknown): JsonRecord {
  const record = jsonRecord(value);
  const ok = typeof record.ok === "boolean" ? record.ok : undefined;
  const existingStatus = typeof record.status === "string" ? record.status : undefined;
  return {
    serviceId,
    operation,
    ...record,
    status: existingStatus ?? (ok === false ? "failed" : "completed"),
  };
}

function csvRows(path: string): Record<string, string>[] {
  const [headerLine, ...lines] = readFileSync(path, "utf8").replace(/\r/g, "").trim().split("\n");
  const headers = headerLine?.split(",") ?? [];
  return lines.filter(Boolean).map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split(",")[index] ?? ""])));
}

function openRosalind(args: Record<string, unknown>, context: ScienceExecutionContext, availableServices: readonly ModuleId[]): Record<string, unknown> {
  const area = typeof args.area === "string" ? args.area : "catalogue";
  const providerId = typeof args.providerId === "string" ? args.providerId : null;
  const base = {
    viewer: "rosalind-workbench",
    area,
    providerId,
    availableServices: [...availableServices],
    skillCount: availableServices.reduce((total, id) => total + MODULE_SKILL_COUNTS[id], 0),
    operationCount: availableServices.reduce((total, id) => total + MODULE_OPERATION_COUNTS[id], 0),
  };
  if (area !== "molecular-design" || (providerId && providerId !== "local-replay")) return base;
  const caseRoot = resolve(context.packageRoot, "showcases/rosalind-workbench/cases/rosalind-molecular-design");
  const candidates = csvRows(resolve(caseRoot, "outputs/candidates.csv"));
  const ranking = csvRows(resolve(caseRoot, "outputs/top5_ensemble_ranking.csv"));
  const candidateIds = new Set(candidates.map((row) => row.candidate));
  const ranks = ranking.map((row) => Number(row.rank));
  return {
    ...base,
    retainedDesign: {
      candidateCount: candidates.length,
      topFiveCount: ranking.length,
      firstCandidate: ranking[0]?.candidate ?? null,
      rankingIsOrdered: ranks.every((rank, index) => rank === index + 1),
      rankedCandidatesExist: ranking.every((row) => candidateIds.has(row.candidate)),
      sequencesHaveExpectedLength: candidates.every((row) => typeof row.sequence === "string" && row.sequence.length === Number(row.length)),
      severeClashFreeLeader: ranking[0]?.severe_clash_models === "0",
      bestModelPath: "showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/NB13_E104Q_best_model.cif",
      provenance: "Candidate and Top-5 records were parsed from the retained CSV artifacts. Scores remain computational predictions, not experimental measurements.",
    },
  };
}

export class ScienceRuntime implements ScienceExecutor {
  readonly literature: LiteratureService;
  readonly databases: DatabaseService;
  readonly sequence: SequenceService;
  private ngsService: NgsService | null;
  readonly structure: StructureService;
  readonly slide: SlideService;
  private moduleEnabled: ((id: ModuleId) => boolean) | undefined;

  constructor(options: { literature?: LiteratureService; databases?: DatabaseService; ngs?: NgsService | null } = {}) {
    this.literature = options.literature ?? new LiteratureService();
    this.databases = options.databases ?? new DatabaseService();
    this.sequence = new SequenceService();
    this.ngsService = options.ngs === undefined ? new NgsService() : options.ngs;
    this.structure = new StructureService();
    this.slide = new SlideService();
  }

  get ngs(): NgsService | null {
    return this.ngsService;
  }

  setModuleEnabled(resolve: (id: ModuleId) => boolean): void {
    this.moduleEnabled = resolve;
  }

  attachNgs(service: NgsService): void {
    if (this.ngsService && this.ngsService !== service) throw new Error("An NGS Analysis Workbench module is already attached.");
    this.ngsService = service;
  }

  detachNgs(service: NgsService): void {
    if (this.ngsService === service) this.ngsService = null;
  }

  moduleStatus(): { ngs: { enabled: boolean; status: "available" | "disabled"; diagnostic: string | null }; rosalind: { enabled: true; status: "available"; diagnostic: null } } {
    return {
      ngs: this.ngsService
        ? { enabled: true, status: "available", diagnostic: null }
        : { enabled: false, status: "disabled", diagnostic: "The NGS Analysis Workbench Cordis module is not active. Historical conversation and registry records remain readable, but a new NGS call requires the module to be enabled." },
      rosalind: { enabled: true, status: "available", diagnostic: null },
    };
  }

  async dispose(): Promise<void> {
    if (this.ngsService) await this.ngsService.dispose();
    this.ngsService = null;
  }

  async execute(serviceId: string, operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<JsonRecord> {
    try {
      if (context.signal.aborted) throw context.signal.reason ?? new Error("Scientific operation was cancelled.");
      let result: unknown;
      switch (serviceId) {
        case "literature": result = await this.literature.execute(operation, args, context); break;
        case "databases": result = await this.databases.execute(operation, args, context); break;
        case "sequence": result = await this.sequence.execute(operation, args, context); break;
        case "ngs":
          if (!this.ngsService) {
            return {
              serviceId,
              operation,
              status: "unavailable",
              module: "ngs-analysis-workbench",
              moduleStatus: this.moduleStatus().ngs,
              error: {
                code: "NGS_MODULE_DISABLED",
                message: "The NGS Analysis Workbench Cordis module is disabled. Enable it before making a new NGS call; retained project and run evidence is unchanged.",
              },
            };
          }
          result = await this.ngsService.execute(operation, args, context);
          break;
        case "structure": result = await this.structure.execute(operation, args, context); break;
        case "slide": result = await this.slide.execute(operation, args, context); break;
        case "rosalind":
          if (operation === "rosalind.settings") {
            // Mirrors the fixed rosalind 0.2.2-research-preview response, which
            // reports a ready settings surface instead of a workbench area.
            result = { schemaVersion: "life-sciences.settings/v1", ready: true, view: "settings" };
            break;
          }
          if (operation === "rosalind.open") {
            result = openRosalind(args, context, MODULE_IDS.filter((id) => this.isModuleActive(id)));
            break;
          }
          throw new Error(`Unknown Rosalind operation: ${operation}`);
        default: throw new Error(`Unknown science service: ${serviceId}`);
      }
      return normalize(serviceId, operation, result);
    } catch (cause) {
      return errorRecord(serviceId, operation, cause);
    }
  }

  private isModuleActive(id: ModuleId): boolean {
    if (this.moduleEnabled && !this.moduleEnabled(id)) return false;
    return id !== "ngs" || this.ngsService !== null;
  }
}
