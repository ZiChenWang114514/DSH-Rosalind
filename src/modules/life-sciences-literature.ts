import type { Context } from "@deepseek-ai/cordis";
import { defineTool, type JsonValue, type ToolDefinition, type ToolResult } from "@deepseek-ai/dsh-tools";

import { findPackageRoot } from "../host/catalog.js";
import { type SkillSpec, createSkillRegistrations } from "../host/skill-registration.js";
import { LiteratureService, type FetchLike } from "../host/science/literature.js";
import { scienceOutputSpec, type ScienceExecutionContext, type ScienceExecutor } from "../host/science-tools.js";
import {
  type ModuleDefinition,
  type SourceProviderAdapter,
  SourceAdapterError,
  normalizeSourceResult,
  sourceFailure,
} from "./module-definition.js";

export const name = "dsh-rosalind-life-sciences-literature";
export const inject = ["tools", "skills"] as const;

export const LITERATURE_SHOWCASES = {
  pluginId: "life-sciences-literature",
  showcaseIds: [
    "literature-trem2-landscape",
    "literature-pmc-availability",
    "literature-preprint-publication-link",
    "literature-kras-g12c",
    "literature-visium-methods",
    "literature-nanobody-assays",
  ],
} as const;

export const LITERATURE_PROVIDER_IDS = ["biorxiv", "medrxiv", "entrez", "ncbi-entrez", "pmc", "ncbi-pmc"] as const;

export const LITERATURE_SKILL_SPECS: readonly SkillSpec[] = [
  { serviceId: "literature", sourceName: "biorxiv-skill", title: "bioRxiv and medRxiv", description: "Search versioned preprints and follow publication links without conflating preprint versions with journal articles.", tool: "literature_request" },
  { serviceId: "literature", sourceName: "ncbi-entrez-skill", title: "NCBI Entrez literature", description: "Search and retrieve PubMed records with explicit pagination, identifiers, dates, and query provenance.", tool: "literature_request" },
  { serviceId: "literature", sourceName: "ncbi-pmc-skill", title: "NCBI PubMed Central", description: "Resolve PMID, PMCID, and DOI identifiers and inspect open-access, license, and article-file availability.", tool: "literature_request" },
];

export const LITERATURE_REQUEST_PARAMETERS = {
  provider: { type: "string", enum: LITERATURE_PROVIDER_IDS, required: true },
  action: { type: "string" },
  query: { type: "string" },
  term: { type: "string" },
  id: { type: "string" },
  identifier: { type: "string" },
  pmcid: { type: "string" },
  pmid: { type: "string" },
  doi: { type: "string" },
  db: { type: "string" },
  ids: { type: "string" },
  retmode: { type: "string" },
  retmax: { type: "integer" },
  cursor: { type: "integer" },
  start: { type: "string" },
  end: { type: "string" },
  server: { type: "string", enum: ["biorxiv", "medrxiv"] },
  params: { type: "object", additionalProperties: true },
  path: { type: "string" },
  base_url: { type: "string" },
  headers: { type: "object", additionalProperties: true },
  method: { type: "string", enum: ["GET", "POST"] },
  json_body: { type: "object", additionalProperties: true },
  form_body: { type: "object", additionalProperties: true },
  record_path: { type: "string" },
  response_format: { type: "string", enum: ["json", "xml", "text", "tsv", "fasta", "auto"] },
  max_items: { type: "integer" },
  max_depth: { type: "integer" },
  timeout_sec: { type: "integer" },
  save_raw: { type: "boolean" },
  raw_output_path: { type: "string" },
  maxItems: { type: "integer" },
  page: { type: "integer" },
  pageSize: { type: "integer" },
  allowNetwork: { type: "boolean", description: "Request live public-network access; the DSH host still asks the user for one-time approval" },
} as const;

const FALLBACK_SESSION = {};

function executeDeclared<T>(
  executor: ScienceExecutor,
  args: Record<string, unknown>,
  context: ScienceExecutionContext,
): Promise<T> {
  return executor.execute("literature", "literature.request", args, context) as Promise<T>;
}

function output() {
  return {
    schema: scienceOutputSpec("literature", "literature.request"),
    render: (_args: unknown, value: Record<string, JsonValue>) => [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    presentationMeta: (_args: unknown, value: Record<string, JsonValue>) => ({ status: value.status ?? "completed" }),
  };
}

function result(value: ToolResult) {
  return { card: "generic" as const, title: value.isError ? "Literature request failed" : "Literature result" };
}

export function createLiteratureRequestTool(executor: ScienceExecutor, packageRoot: string): ToolDefinition {
  return defineTool({
    name: "literature_request",
    description: "Query bioRxiv/medRxiv, NCBI Entrez, or PubMed Central with explicit pagination and provenance.",
    parameters: LITERATURE_REQUEST_PARAMETERS,
    output: output(),
    isConcurrencySafe: () => true,
    execute(args, exec) {
      return executeDeclared(executor, args, {
        session: exec.agent ?? FALLBACK_SESSION,
        signal: exec.signal,
        packageRoot,
        ...(args.allowNetwork === true ? { allowNetwork: true } : {}),
      });
    },
    presentCall: (args) => ({ card: "generic", title: "Query life-sciences literature", rawInput: JSON.stringify(args, null, 2) }),
    presentResult: (_args, value) => result(value),
  });
}

export function createLiteratureSkills(packageRoot = findPackageRoot()) {
  return createSkillRegistrations(LITERATURE_SKILL_SPECS, packageRoot);
}

export class LiteratureProviderAdapter implements SourceProviderAdapter, ScienceExecutor {
  readonly serviceId = "literature" as const;
  readonly service: LiteratureService;
  private active = true;

  constructor(options: { fetch?: FetchLike; allowNetwork?: boolean } = {}) {
    this.service = new LiteratureService(options);
  }

  async execute(serviceId: string, operation: string, args: Record<string, unknown>, context: ScienceExecutionContext) {
    if (!this.active) return sourceFailure(this.serviceId, operation, new SourceAdapterError("SOURCE_ADAPTER_DISPOSED", "The literature provider adapter has been disposed."));
    if (serviceId !== this.serviceId) return sourceFailure(this.serviceId, operation, new SourceAdapterError("SOURCE_SERVICE_MISMATCH", `The literature adapter cannot execute service ${serviceId}.`));
    try {
      return normalizeSourceResult(this.serviceId, operation, await this.service.execute(operation, args, context));
    } catch (cause) {
      return sourceFailure(this.serviceId, operation, cause);
    }
  }

  dispose(): void {
    this.active = false;
  }
}

export interface LiteratureModuleOptions {
  adapter?: LiteratureProviderAdapter;
  packageRoot?: string;
}

export function createLiteratureModule(options: LiteratureModuleOptions = {}): ModuleDefinition<LiteratureProviderAdapter> {
  const adapter = options.adapter ?? new LiteratureProviderAdapter();
  const packageRoot = options.packageRoot ?? findPackageRoot();
  return {
    name,
    inject,
    adapter,
    showcases: LITERATURE_SHOWCASES,
    apply(ctx) {
      ctx.effect(() => {
        const approval = ctx.on("tools/pre-execute", async (exec, next) => {
          const decision = await next();
          if (decision.kind !== "allow" || exec.name !== "literature_request") return decision;
          const args = exec.arguments && typeof exec.arguments === "object" && !Array.isArray(exec.arguments)
            ? exec.arguments as Record<string, unknown>
            : {};
          return args.allowNetwork === true
            ? { kind: "ask" as const, reason: "Approval is required to send this literature request to the selected public service." }
            : decision;
        });
        const disposers = [
          approval,
          ctx.tools.register(createLiteratureRequestTool(adapter, packageRoot)),
          ...createLiteratureSkills(packageRoot).map((skill) => ctx.skills.register(skill)),
        ];
        return async () => {
          for (const dispose of disposers.reverse()) dispose();
          await adapter.dispose();
        };
      }, `${name}: registrations`);
    },
  };
}

export function apply(ctx: Context): void {
  createLiteratureModule().apply(ctx);
}
