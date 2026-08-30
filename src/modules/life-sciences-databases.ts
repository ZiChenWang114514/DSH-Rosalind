import type { Context } from "@deepseek-ai/cordis";
import { defineTool, type JsonValue, type ToolDefinition, type ToolResult } from "@deepseek-ai/dsh-tools";

import { findPackageRoot } from "../host/catalog.js";
import { type SkillSpec, createSkillRegistrations } from "../host/skill-registration.js";
import { DatabaseService, DATABASE_PROVIDERS } from "../host/science/databases.js";
import type { FetchLike } from "../host/science/literature.js";
import { scienceOutputSpec, type ScienceExecutionContext, type ScienceExecutor } from "../host/science-tools.js";
import {
  type ModuleDefinition,
  type SourceProviderAdapter,
  SourceAdapterError,
  normalizeSourceResult,
  sourceFailure,
} from "./module-definition.js";

export const name = "dsh-rosalind-life-sciences-databases";
export const inject = ["tools", "skills"] as const;

export const DATABASE_SHOWCASES = {
  pluginId: "life-sciences-databases",
  showcaseIds: [
    "databases-il6r-asthma",
    "databases-variant-interpretation",
    "databases-egfr-landscape",
  ],
} as const;

export { DATABASE_PROVIDERS };
export const DATABASE_PROVIDER_IDS = DATABASE_PROVIDERS.map((provider) => provider.id);

const databaseNames = [
  ["alphafold-skill", "AlphaFold DB"], ["bgee-skill", "Bgee"], ["bindingdb-skill", "BindingDB"],
  ["biobankjapan-phewas-skill", "BioBank Japan PheWAS"], ["biostudies-arrayexpress-skill", "BioStudies and ArrayExpress"],
  ["cbioportal-skill", "cBioPortal"], ["cellxgene-skill", "CELLxGENE"], ["chebi-skill", "ChEBI"],
  ["chembl-skill", "ChEMBL"], ["civic-skill", "CIViC"], ["clinicaltrials-skill", "ClinicalTrials.gov"],
  ["clinvar-variation-skill", "ClinVar and NCBI Variation"], ["efo-ontology-skill", "Experimental Factor Ontology"],
  ["encode-skill", "ENCODE"], ["ensembl-skill", "Ensembl"], ["epigraphdb-skill", "EpiGraphDB"],
  ["eqtl-catalogue-skill", "eQTL Catalogue"], ["eva-skill", "European Variation Archive"],
  ["finngen-phewas-skill", "FinnGen PheWAS"], ["genebass-gene-burden-skill", "Genebass gene burden"],
  ["gnomad-graphql-skill", "gnomAD"], ["gtex-eqtl-skill", "GTEx eQTL"], ["gwas-catalog-skill", "GWAS Catalog"],
  ["human-protein-atlas-skill", "Human Protein Atlas"], ["ipd-skill", "IPD"], ["metabolights-skill", "MetaboLights"],
  ["mgnify-skill", "MGnify"], ["ncbi-clinicaltables-skill", "NCBI Clinical Tables"],
  ["ncbi-datasets-skill", "NCBI Datasets"], ["ncbi-entrez-skill", "NCBI Entrez biological records"],
  ["opentargets-skill", "Open Targets"], ["pharmgkb-skill", "PharmGKB"], ["pride-skill", "PRIDE"],
  ["proteomexchange-skill", "ProteomeXchange"], ["pubchem-pug-skill", "PubChem PUG REST"],
  ["quickgo-skill", "QuickGO"], ["rcsb-pdb-skill", "RCSB PDB"], ["reactome-skill", "Reactome"],
  ["rhea-skill", "Rhea"], ["rnacentral-skill", "RNAcentral"], ["string-skill", "STRING"],
  ["tpmi-phewas-skill", "TPMI PheWAS"], ["ukb-topmed-phewas-skill", "UKB-TOPMed PheWAS"],
  ["uniprot-skill", "UniProt"],
] as const;

export const DATABASE_SKILL_SPECS: readonly SkillSpec[] = databaseNames.map(([sourceName, title]) => ({
  serviceId: "databases",
  sourceName,
  title,
  description: `Query ${title} through its public scientific interface, retain source identifiers and response metadata, and separate returned records from interpretation.`,
  tool: "database_request",
}));

export const DATABASE_REQUEST_PARAMETERS = {
  provider: { type: "string", enum: DATABASE_PROVIDER_IDS, required: true },
  action: { type: "string" },
  operation: { type: "string" },
  path: { type: "string" },
  query: { oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }] },
  id: { type: "string" },
  identifier: { type: "string" },
  accession: { type: "string" },
  ids: { type: "string" },
  rsid: { type: "string", description: "BioBank Japan input: an rsID such as rs7903146; provide exactly one of rsid, grch37, grch38, or variant" },
  grch37: { type: "string", description: "BioBank Japan input: a GRCh37 chr:pos-ref-alt identifier; provide exactly one of rsid, grch37, grch38, or variant" },
  grch38: { type: "string", description: "BioBank Japan input: a GRCh38 chr:pos-ref-alt identifier; provide exactly one of rsid, grch37, grch38, or variant" },
  variant: { type: "string", description: "Variant identifier; for BioBank Japan provide exactly one of rsid, grch37, grch38, or variant" },
  target: { type: "string" },
  gene: { type: "string" },
  disease: { type: "string" },
  diseaseId: { type: "string" },
  dataset: { type: "string" },
  db: { type: "string" },
  dbfrom: { type: "string" },
  term: { type: "string" },
  terms: { type: "string" },
  retmode: { type: "string" },
  rettype: { type: "string" },
  method: { type: "string", enum: ["GET", "POST"] },
  params: { type: "object", additionalProperties: true },
  variables: { type: "object", additionalProperties: true },
  body: { type: "object", additionalProperties: true },
  json_body: { type: "object", additionalProperties: true },
  form_body: { type: "object", additionalProperties: true },
  headers: { type: "object", additionalProperties: true },
  query_path: { type: "string" },
  record_path: { type: "string" },
  response_format: { type: "string", enum: ["json", "xml", "text", "tsv", "fasta", "auto"] },
  max_items: { type: "integer" },
  max_depth: { type: "integer" },
  timeout_sec: { type: "integer" },
  save_raw: { type: "boolean" },
  raw_output_path: { type: "string" },
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
  return executor.execute("databases", "database.request", args, context) as Promise<T>;
}

function output() {
  return {
    schema: scienceOutputSpec("databases", "database.request"),
    render: (_args: unknown, value: Record<string, JsonValue>) => [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    presentationMeta: (_args: unknown, value: Record<string, JsonValue>) => ({ status: value.status ?? "completed" }),
  };
}

function result(value: ToolResult) {
  return { card: "generic" as const, title: value.isError ? "Database request failed" : "Database result" };
}

export function createDatabaseRequestTool(executor: ScienceExecutor, packageRoot: string): ToolDefinition {
  return defineTool({
    name: "database_request",
    description: "Query one of the 44 fixed-version life-sciences database providers with explicit provenance.",
    parameters: DATABASE_REQUEST_PARAMETERS,
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
    presentCall: (args) => ({ card: "generic", title: "Query a life-sciences database", rawInput: JSON.stringify(args, null, 2) }),
    presentResult: (_args, value) => result(value),
  });
}

export function createDatabaseSkills(packageRoot = findPackageRoot()) {
  return createSkillRegistrations(DATABASE_SKILL_SPECS, packageRoot);
}

export class DatabaseProviderAdapter implements SourceProviderAdapter, ScienceExecutor {
  readonly serviceId = "databases" as const;
  readonly service: DatabaseService;
  private active = true;

  constructor(options: { fetch?: FetchLike; allowNetwork?: boolean } = {}) {
    this.service = new DatabaseService(options);
  }

  async execute(serviceId: string, operation: string, args: Record<string, unknown>, context: ScienceExecutionContext) {
    if (!this.active) return sourceFailure(this.serviceId, operation, new SourceAdapterError("SOURCE_ADAPTER_DISPOSED", "The database provider adapter has been disposed."));
    if (serviceId !== this.serviceId) return sourceFailure(this.serviceId, operation, new SourceAdapterError("SOURCE_SERVICE_MISMATCH", `The database adapter cannot execute service ${serviceId}.`));
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

export interface DatabaseModuleOptions {
  adapter?: DatabaseProviderAdapter;
  packageRoot?: string;
}

export function createDatabaseModule(options: DatabaseModuleOptions = {}): ModuleDefinition<DatabaseProviderAdapter> {
  const adapter = options.adapter ?? new DatabaseProviderAdapter();
  const packageRoot = options.packageRoot ?? findPackageRoot();
  return {
    name,
    inject,
    adapter,
    showcases: DATABASE_SHOWCASES,
    apply(ctx) {
      ctx.effect(() => {
        const approval = ctx.on("tools/pre-execute", async (exec, next) => {
          const decision = await next();
          if (decision.kind !== "allow" || exec.name !== "database_request") return decision;
          const args = exec.arguments && typeof exec.arguments === "object" && !Array.isArray(exec.arguments)
            ? exec.arguments as Record<string, unknown>
            : {};
          return args.allowNetwork === true
            ? { kind: "ask" as const, reason: "Approval is required to send this database request to the selected public service." }
            : decision;
        });
        const disposers = [
          approval,
          ctx.tools.register(createDatabaseRequestTool(adapter, packageRoot)),
          ...createDatabaseSkills(packageRoot).map((skill) => ctx.skills.register(skill)),
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
  createDatabaseModule().apply(ctx);
}
