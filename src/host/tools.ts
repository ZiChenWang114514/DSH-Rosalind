import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, relative } from "node:path";

import { defineTool, type JsonValue, type ToolDefinition, type ToolResult } from "@deepseek-ai/dsh-tools";

import { SHOWCASE_FILE_COUNT, SHOWCASE_SOURCE_COMMIT } from "../generated/catalog.js";
import type { ShowcaseMode } from "../shared/types.js";
import { resolveArtifactFile, resolveInside } from "./catalog.js";
import { RosalindRuntime } from "./runtime.js";
import { validateShowcase } from "./validators.js";

const TEXT_MEDIA = new Set([
  "application/json",
  "application/geo+json",
  "chemical/x-mmcif",
  "chemical/x-pdb",
  "image/svg+xml",
  "text/csv",
  "text/markdown",
  "text/plain",
  "text/x-fasta",
  "text/x-genbank",
  "text/x-newick",
]);

function sessionRequired(action: string): Record<string, JsonValue> {
  return {
    status: "failed",
    error: {
      code: "DSH_SESSION_REQUIRED",
      message: `A DSH agent session is required to ${action}; anonymous calls cannot access stateful Rosalind runs.`,
    },
  };
}

function jsonValue(value: unknown): Record<string, JsonValue> {
  return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>;
}

function summaryOf(value: JsonValue): string {
  if (Array.isArray(value)) return `${value.length} records`;
  if (value && typeof value === "object") {
    const record = value as Record<string, JsonValue>;
    if (typeof record.summary === "string") return record.summary;
    if (typeof record.state === "string") return `Run state: ${record.state}`;
    if (typeof record.total === "number") return `${record.total} records`;
    if (typeof record.showcaseId === "string") return `Showcase: ${record.showcaseId}`;
    if (typeof record.showcase_id === "string") return `Showcase: ${record.showcase_id}`;
    if (typeof record.status === "string") return `Status: ${record.status}`;
  }
  return "Scientific workbench result";
}

function scientificError(value: unknown): { code: string; message: string } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object" || Array.isArray(error)) return undefined;
  const code = (error as Record<string, unknown>).code;
  const message = (error as Record<string, unknown>).message;
  return typeof code === "string" && typeof message === "string" ? { code, message } : undefined;
}

function presentedFailure(result: ToolResult): string | undefined {
  const meta = result.meta && typeof result.meta === "object" && !Array.isArray(result.meta) ? result.meta as Record<string, JsonValue> : undefined;
  if (typeof meta?.errorCode === "string" && typeof meta.errorMessage === "string") return `${meta.errorCode}: ${meta.errorMessage}`;
  for (const block of result.content) {
    if (block.type !== "text") continue;
    try {
      const error = scientificError(JSON.parse(block.text));
      if (error) return `${error.code}: ${error.message}`;
    } catch { /* Native failures may already be plain text. */ }
  }
  return undefined;
}

const errorOutput = {
  type: "object",
  properties: {
    code: { type: "string", required: true },
    message: { type: "string", required: true },
  },
  additionalProperties: true,
} as const;

const openObject = { type: "object", additionalProperties: true } as const;
const errorFields = { error: errorOutput } as const;

const catalogListSchema = {
  type: "object",
  properties: {
    items: { type: "array", items: openObject },
    total: { type: "integer" },
    sourceCommit: { type: "string" },
    referencedFiles: { type: "integer" },
    ...errorFields,
  },
  additionalProperties: true,
} as const;

const showcaseSchema = {
  type: "object",
  properties: {
    id: { type: "string" }, pluginId: { type: "string" }, pluginVersion: { type: "string" },
    categoryId: { type: "string" }, domain: { type: "string" }, caseType: { type: "string" },
    difficulty: { type: "string" }, evidenceLevel: { type: "string" }, title: { type: "string" },
    summary: { type: "string" }, question: { type: "string" }, status: { type: "string" }, runDate: { type: "string" },
    capabilities: { type: "array", items: { type: "string" } }, rosalindTasks: { type: "array", items: { type: "string" } },
    execution: openObject, preview: { oneOf: [openObject, { type: "null" }] }, artifacts: { type: "array", items: openObject },
    sources: { type: "array", items: { type: "string" } }, observations: { type: "array", items: { type: "string" } },
    computedResults: { type: "array", items: { type: "string" } }, interpretation: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } }, claims: { type: "array", items: openObject },
    requiredMcpServers: { type: "array", items: { type: "string" } }, requiredOperations: { type: "array", items: { type: "string" } },
    requiredSkills: { type: "array", items: { type: "string" } }, fixtures: { type: "array", items: { type: "string" } },
    expectedArtifacts: { type: "array", items: { type: "string" } }, scientificAssertions: { type: "array", items: openObject },
    visualAssertions: { type: "array", items: openObject }, provenance: openObject, reproductionSteps: { type: "array", items: { type: "string" } },
    recipe: openObject, modes: { type: "array", items: { type: "string" } }, searchText: { type: "string" },
    ...errorFields,
  },
  additionalProperties: true,
} as const;

const providerStatusSchema = {
  type: "object",
  properties: {
    providers: { type: "array", items: openObject }, total: { type: "integer" }, checkedAt: { type: "string" }, ...errorFields,
  },
  additionalProperties: true,
} as const;

const importSchema = {
  type: "object",
  properties: {
    showcaseId: { type: "string" }, title: { type: "string" }, prompt: { type: "string" },
    caseIndex: { type: "array", items: openObject }, adapter: { type: "string" }, suggestedMode: { type: "string" }, ...errorFields,
  },
  additionalProperties: true,
} as const;

const runSchema = {
  type: "object",
  properties: {
    id: { type: "string" }, showcaseId: { type: "string" }, mode: { type: "string" }, state: { type: "string" },
    progress: { type: "number" }, plan: openObject, createdAt: { type: "string" }, updatedAt: { type: "string" },
    currentStepId: { type: "string" }, events: { type: "array", items: openObject }, artifacts: { type: "array", items: openObject },
    ngs: openObject, reproduction: openObject, ...errorFields,
  },
  additionalProperties: true,
} as const;

const artifactListSchema = {
  type: "object",
  properties: { showcaseId: { type: "string" }, artifacts: { type: "array", items: openObject }, total: { type: "integer" }, ...errorFields },
  additionalProperties: true,
} as const;

const artifactOpenSchema = {
  type: "object",
  properties: {
    artifact: openObject, bytes: { type: "integer" }, content: { oneOf: [{ type: "string" }, { type: "null" }] },
    truncated: { type: "boolean" }, note: { type: "string" }, ...errorFields,
  },
  additionalProperties: true,
} as const;

const exportSchema = {
  type: "object",
  properties: {
    status: { type: "string" }, showcaseId: { type: "string" }, outputPath: { type: "string" }, bytes: { type: "integer" }, summary: { type: "string" }, ...errorFields,
  },
  additionalProperties: true,
} as const;

const reviewSchema = {
  type: "object",
  properties: {
    showcaseId: { type: "string" }, generatedAt: { type: "string" }, sourceObservations: { type: "array", items: { type: "string" } },
    computedResults: { type: "array", items: { type: "string" } }, scientificInterpretation: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } }, citationChecks: { type: "array", items: openObject }, artifactChecks: { type: "array", items: openObject },
    validation: openObject, ...errorFields,
  },
  additionalProperties: true,
} as const;

const jsonOutput = {
  schema: {
    type: "object",
    properties: {
      status: { type: "string" },
      error: errorOutput,
    },
    additionalProperties: true,
  } as const,
  render: (_args: unknown, value: Record<string, JsonValue>) => [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  presentationMeta: (_args: unknown, value: Record<string, JsonValue>) => {
    const error = scientificError(value);
    return { summary: summaryOf(value), ...(error ? { errorCode: error.code, errorMessage: error.message } : {}) };
  },
};

const catalogListOutput = { ...jsonOutput, schema: catalogListSchema };
const showcaseOutput = { ...jsonOutput, schema: showcaseSchema };
const providerStatusOutput = { ...jsonOutput, schema: providerStatusSchema };
const importOutput = { ...jsonOutput, schema: importSchema };
const runOutput = { ...jsonOutput, schema: runSchema };
const artifactListOutput = { ...jsonOutput, schema: artifactListSchema };
const artifactOpenOutput = { ...jsonOutput, schema: artifactOpenSchema };
const exportOutput = { ...jsonOutput, schema: exportSchema };
const reviewOutput = { ...jsonOutput, schema: reviewSchema };

function callCard(title: string, args: unknown) {
  return { card: "generic" as const, title, rawInput: JSON.stringify(args, null, 2) };
}

function resultCard(title: string, result: ToolResult) {
  const meta = result.meta && typeof result.meta === "object" && !Array.isArray(result.meta) ? result.meta as Record<string, JsonValue> : undefined;
  const summary = typeof meta?.summary === "string" ? meta.summary : undefined;
  const failure = presentedFailure(result);
  return {
    card: "generic" as const,
    title: result.isError || failure ? `${title} failed` : title,
    ...(failure || summary ? { content: [{ type: "text" as const, text: failure ?? summary! }] } : {}),
  };
}

export function createRosalindTools(runtime: RosalindRuntime): ToolDefinition[] {
  const workspaceRoot = runtime.catalog.packageRoot;
  return [
    defineTool({
      name: "rosalind_catalog_list",
      description: "List the 100 ready DSH-Rosalind scientific showcases, optionally filtered by query, category, or reproduce availability.",
      parameters: {
        query: { type: "string", description: "Free-text search" },
        category_id: { type: "string", description: "One of the seven scientific category IDs" },
        runnable_only: { type: "boolean", description: "Return only cases with a reproduce path" },
      },
      output: catalogListOutput,
      isConcurrencySafe: () => true,
      async execute(args) {
        const items = runtime.catalog.list({
          ...(args.query ? { query: args.query } : {}),
          ...(args.category_id ? { categoryId: args.category_id } : {}),
          ...(args.runnable_only !== undefined ? { runnableOnly: args.runnable_only } : {}),
        }).map((entry) => ({ id: entry.id, title: entry.title, summary: entry.summary, categoryId: entry.categoryId, status: entry.status, modes: entry.modes }));
        return jsonValue({ items, total: items.length, sourceCommit: SHOWCASE_SOURCE_COMMIT, referencedFiles: SHOWCASE_FILE_COUNT });
      },
      presentCall: (args) => callCard("Browse DSH-Rosalind showcases", args),
      presentResult: (_args, result) => resultCard("Showcase catalogue", result),
    }),
    defineTool({
      name: "rosalind_showcase_get",
      description: "Get one complete showcase definition with its scientific question, evidence, results, limitations, artifacts, and reproduction recipe.",
      parameters: { showcase_id: { type: "string", required: true } },
      output: showcaseOutput,
      isConcurrencySafe: () => true,
      async execute(args) { return jsonValue(runtime.catalog.get(args.showcase_id)); },
      presentCall: (args) => callCard("Open showcase record", args),
      presentResult: (_args, result) => resultCard("Showcase record", result),
    }),
    defineTool({
      name: "rosalind_provider_status",
      description: "Report installation, credentials, current run readiness, diagnostic messages, and estimated cost for scientific providers.",
      parameters: {
        showcase_id: { type: "string", description: "Limit the provider report to a showcase's declared providers" },
        provider_ids: { type: "array", items: { type: "string" }, description: "Specific provider IDs" },
      },
      output: providerStatusOutput,
      isConcurrencySafe: () => true,
      async execute(args) {
        const declared = args.showcase_id ? runtime.catalog.get(args.showcase_id).recipe.providerIds : undefined;
        const ids = args.provider_ids?.length ? args.provider_ids : declared;
        const providers = runtime.providers.list(ids);
        return jsonValue({ providers, total: providers.length, checkedAt: new Date().toISOString() });
      },
      presentCall: (args) => callCard("Check scientific providers", args),
      presentResult: (_args, result) => resultCard("Provider status", result),
    }),
    defineTool({
      name: "rosalind_showcase_import",
      description: "Create a conversation-ready import bundle for one showcase in lesson, replay, or reproduce mode.",
      parameters: {
        showcase_id: { type: "string", required: true },
        mode: { type: "string", enum: ["lesson", "replay", "reproduce"], required: true },
      },
      output: importOutput,
      isConcurrencySafe: () => true,
      async execute(args) { return jsonValue(runtime.createImport(args.showcase_id, args.mode as ShowcaseMode)); },
      presentCall: (args) => callCard("Prepare showcase import", args),
      presentResult: (_args, result) => resultCard("Conversation import", result),
    }),
    defineTool({
      name: "rosalind_plan",
      description: "Create a session-owned execution plan. The plan records provider, resources, steps, cost estimate, and actions requiring confirmation.",
      parameters: {
        showcase_id: { type: "string", required: true },
        mode: { type: "string", enum: ["lesson", "replay", "reproduce"], required: true },
        provider_id: { type: "string", description: "Use one provider declared by the showcase" },
        ngs_run_directory: { type: "string", description: "User-owned NGS working directory. Required with the other NGS input fields for an NGS reproduce plan." },
        ngs_config_file: { type: "string", description: "Scientific NGS configuration file used by the reviewed plan." },
        ngs_input_paths: { type: "array", items: { type: "string" }, description: "Scientific input files that the selected NGS configuration must reference." },
        reproduction_run_directory: { type: "string", description: "User-owned output directory retained with a non-NGS scientific reproduce plan." },
        reproduction_source_paths: { type: "array", items: { type: "string" }, description: "Exact authorized source files retained with a non-NGS scientific reproduce plan." },
        reproduction_config: { type: "object", additionalProperties: true, description: "Provider- or showcase-specific JSON settings retained with the scientific inputs." },
      },
      output: runOutput,
      async execute(args, exec) {
        const suppliedNgsFields = [args.ngs_run_directory, args.ngs_config_file, args.ngs_input_paths].some((value) => value !== undefined);
        if (suppliedNgsFields && (typeof args.ngs_run_directory !== "string" || typeof args.ngs_config_file !== "string" || !Array.isArray(args.ngs_input_paths))) {
          throw new Error("An NGS reproduce plan needs ngs_run_directory, ngs_config_file, and ngs_input_paths together.");
        }
        const suppliedReproductionFields = [args.reproduction_run_directory, args.reproduction_source_paths, args.reproduction_config].some((value) => value !== undefined);
        if (suppliedReproductionFields && (typeof args.reproduction_run_directory !== "string" || !Array.isArray(args.reproduction_source_paths))) {
          throw new Error("A non-NGS reproduce plan needs reproduction_run_directory and reproduction_source_paths together.");
        }
        if (suppliedNgsFields && suppliedReproductionFields) throw new Error("Supply either NGS inputs or generic scientific reproduction inputs, not both.");
        const options = suppliedNgsFields
          ? { ngs: { runDirectory: args.ngs_run_directory as string, configFile: args.ngs_config_file as string, inputPaths: args.ngs_input_paths as string[] } }
          : suppliedReproductionFields
            ? { reproduction: {
              runDirectory: args.reproduction_run_directory as string,
              sourcePaths: args.reproduction_source_paths as string[],
              ...(args.reproduction_config && typeof args.reproduction_config === "object" && !Array.isArray(args.reproduction_config) ? { config: args.reproduction_config as Record<string, never> } : {}),
            } }
            : undefined;
        if (!exec.agent) return sessionRequired("create a Rosalind execution plan");
        return jsonValue(runtime.plan(exec.agent, args.showcase_id, args.mode as ShowcaseMode, args.provider_id, options));
      },
      presentCall: (args) => callCard("Prepare execution plan", args),
      presentResult: (_args, result) => resultCard("Execution plan", result),
    }),
    defineTool({
      name: "rosalind_approve",
      description: "Request host approval for exactly one awaiting DSH-Rosalind plan, while acknowledging every recorded confirmation reason.",
      parameters: {
        run_id: { type: "string", required: true },
        acknowledgements: { type: "array", items: { type: "string" }, required: true },
        ngs_plan_id: { type: "string", description: "Exact reviewed NGS plan ID when this run contains an NGS plan." },
        ngs_plan_name: { type: "string", description: "Exact reviewed NGS plan name when this run contains an NGS plan." },
        ngs_plan_checksum: { type: "string", description: "Exact reviewed NGS plan checksum when this run contains an NGS plan." },
      },
      output: runOutput,
      async execute(args, exec) {
        const suppliedIdentity = [args.ngs_plan_id, args.ngs_plan_name, args.ngs_plan_checksum].some((value) => value !== undefined);
        if (suppliedIdentity && (typeof args.ngs_plan_id !== "string" || typeof args.ngs_plan_name !== "string" || typeof args.ngs_plan_checksum !== "string")) {
          throw new Error("NGS approval requires ngs_plan_id, ngs_plan_name, and ngs_plan_checksum together.");
        }
        if (!exec.agent) return sessionRequired("approve a Rosalind execution plan");
        return jsonValue(runtime.approve(exec.agent, args.run_id, args.acknowledgements, suppliedIdentity
          ? { planId: args.ngs_plan_id as string, planName: args.ngs_plan_name as string, planChecksum: args.ngs_plan_checksum as string }
          : undefined));
      },
      presentCall: (args) => callCard("Record plan approval", args),
      presentResult: (_args, result) => resultCard("Plan approval", result),
    }),
    defineTool({
      name: "rosalind_run",
      description: "Run a queued lesson, replay, or reproduction plan using only its selected provider. The operation follows DSH cancellation.",
      parameters: { run_id: { type: "string", required: true } },
      output: runOutput,
      timeoutMs: 30 * 60 * 1000,
      async execute(args, exec) {
        if (!exec.agent) return sessionRequired("run a Rosalind execution plan");
        return jsonValue(await runtime.run(exec.agent, args.run_id, exec.signal));
      },
      presentCall: (args) => callCard("Run scientific workflow", args),
      presentResult: (_args, result) => resultCard("Scientific workflow", result),
    }),
    defineTool({
      name: "rosalind_status",
      description: "Read the current state, progress, events, artifacts, and error for a run owned by this DSH session.",
      parameters: { run_id: { type: "string", required: true } },
      output: runOutput,
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        if (!exec.agent) return sessionRequired("read a Rosalind run");
        return jsonValue(runtime.status(exec.agent, args.run_id));
      },
      presentCall: (args) => callCard("Read run status", args),
      presentResult: (_args, result) => resultCard("Run status", result),
    }),
    defineTool({
      name: "rosalind_cancel",
      description: "Request cancellation for a queued, awaiting-confirmation, or running DSH-Rosalind run in this session.",
      parameters: { run_id: { type: "string", required: true }, reason: { type: "string", required: true } },
      output: runOutput,
      async execute(args, exec) {
        if (!exec.agent) return sessionRequired("cancel a Rosalind run");
        return jsonValue(await runtime.cancel(exec.agent, args.run_id, args.reason));
      },
      presentCall: (args) => callCard("Cancel scientific run", args),
      presentResult: (_args, result) => resultCard("Cancellation status", result),
    }),
    defineTool({
      name: "rosalind_artifact_list",
      description: "List versioned inputs, outputs, previews, provenance, and export artifacts for one showcase.",
      parameters: { showcase_id: { type: "string", required: true }, role: { type: "string", description: "Optional artifact role" } },
      output: artifactListOutput,
      isConcurrencySafe: () => true,
      async execute(args) {
        const showcase = runtime.catalog.get(args.showcase_id);
        const artifacts = args.role ? showcase.artifacts.filter((artifact) => artifact.role === args.role) : showcase.artifacts;
        return jsonValue({ showcaseId: showcase.id, artifacts, total: artifacts.length });
      },
      presentCall: (args) => callCard("List scientific artifacts", args),
      presentResult: (_args, result) => resultCard("Scientific artifacts", result),
    }),
    defineTool({
      name: "rosalind_artifact_open",
      description: "Open one manifest-indexed showcase artifact. Text files return bounded content; binary files return metadata and their packaged resource reference.",
      parameters: { showcase_id: { type: "string", required: true }, artifact_id: { type: "string", required: true }, max_bytes: { type: "integer", description: "Maximum text bytes, up to 524288" } },
      output: artifactOpenOutput,
      isConcurrencySafe: () => true,
      async execute(args) {
        const showcase = runtime.catalog.get(args.showcase_id);
        const artifact = showcase.artifacts.find((candidate) => candidate.id === args.artifact_id);
        if (!artifact) throw new Error(`Unknown artifact ${args.artifact_id} for ${args.showcase_id}`);
        if (!artifact.path) return jsonValue({ artifact, content: null, note: "This artifact is represented by a resource reference." });
        const path = resolveArtifactFile(runtime.catalog.packageRoot, artifact.path);
        const size = statSync(path).size;
        const limit = Math.max(1, Math.min(args.max_bytes ?? 131072, 524288));
        const textLike = TEXT_MEDIA.has(artifact.mediaType) || [".md", ".json", ".csv", ".svg", ".pdb", ".cif", ".fasta", ".gb", ".nwk"].includes(extname(path).toLowerCase());
        if (!textLike || size > limit) return jsonValue({ artifact, bytes: size, content: null, truncated: size > limit, note: textLike ? `Text exceeds the ${limit}-byte display limit.` : "Binary artifact; use the scientific viewer or package file." });
        return jsonValue({ artifact, bytes: size, content: readFileSync(path, "utf8"), truncated: false });
      },
      presentCall: (args) => callCard("Open scientific artifact", args),
      presentResult: (_args, result) => resultCard("Scientific artifact", result),
    }),
    defineTool({
      name: "rosalind_export",
      description: "Export a showcase review or import bundle to an explicit relative path under the active workspace. A true write request still requires independent DSH host approval.",
      parameters: {
        showcase_id: { type: "string", required: true },
        format: { type: "string", enum: ["review-json", "import-json"], required: true },
        output_path: { type: "string", required: true, description: "Relative path beneath the active workspace" },
        approved: { type: "boolean", required: true, description: "Request the write; the DSH host independently asks the user before execution" },
        overwrite: { type: "boolean", description: "Allow replacement only after the DSH host confirms this exact write request" },
      },
      output: exportOutput,
      async execute(args) {
        const showcaseId = String(args.showcase_id);
        const outputPath = String(args.output_path);
        if (!args.approved) return jsonValue({ status: "awaiting_confirmation", showcaseId, outputPath, summary: "Export requires explicit approval for this path." });
        const path = resolveInside(workspaceRoot, outputPath);
        if (existsSync(path) && args.overwrite !== true) return jsonValue({ status: "failed", showcaseId, outputPath, error: { code: "DESTINATION_EXISTS", message: "The export destination already exists; choose a new path or explicitly request overwrite." } });
        const payload = args.format === "review-json" ? runtime.review(showcaseId) : runtime.createImport(showcaseId, "lesson");
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
        return jsonValue({ status: "completed", showcaseId, outputPath: relative(workspaceRoot, path), bytes: statSync(path).size, summary: `Exported ${basename(path)}` });
      },
      presentCall: (args) => callCard("Export showcase material", args),
      presentResult: (_args, result) => resultCard("Showcase export", result),
    }),
    defineTool({
      name: "rosalind_review",
      description: "Create a scientific review that keeps source observations, computed results, interpretation, limitations, citations, and artifact checks distinct.",
      parameters: { showcase_id: { type: "string", required: true } },
      output: reviewOutput,
      isConcurrencySafe: () => true,
      async execute(args) {
        const showcase = runtime.catalog.get(args.showcase_id);
        const validation = validateShowcase(runtime.catalog.packageRoot, showcase);
        return jsonValue({ ...runtime.review(args.showcase_id), validation });
      },
      presentCall: (args) => callCard("Review scientific record", args),
      presentResult: (_args, result) => resultCard("Scientific review", result),
    }),
  ];
}
