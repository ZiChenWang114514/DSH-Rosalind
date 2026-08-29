import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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

const FALLBACK_SESSION = {};

function sessionFor(exec: { agent?: object }): object {
  return exec.agent ?? FALLBACK_SESSION;
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

const jsonOutput = {
  schema: { type: "object", additionalProperties: true } as const,
  render: (_args: unknown, value: Record<string, JsonValue>) => [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  presentationMeta: (_args: unknown, value: Record<string, JsonValue>) => ({ summary: summaryOf(value) }),
};

function callCard(title: string, args: unknown) {
  return { card: "generic" as const, title, rawInput: JSON.stringify(args, null, 2) };
}

function resultCard(title: string, result: ToolResult) {
  const meta = result.meta && typeof result.meta === "object" && !Array.isArray(result.meta) ? result.meta as Record<string, JsonValue> : undefined;
  const summary = typeof meta?.summary === "string" ? meta.summary : undefined;
  return {
    card: "generic" as const,
    title: result.isError ? `${title} failed` : title,
    ...(summary ? { content: [{ type: "text" as const, text: summary }] } : {}),
  };
}

export function createRosalindTools(runtime: RosalindRuntime): ToolDefinition[] {
  return [
    defineTool({
      name: "rosalind_catalog_list",
      description: "List the 23 ready DSH-Rosalind scientific showcases, optionally filtered by query, category, or reproduce availability.",
      parameters: {
        query: { type: "string", description: "Free-text search" },
        category_id: { type: "string", description: "One of the seven scientific category IDs" },
        runnable_only: { type: "boolean", description: "Return only cases with a reproduce path" },
      },
      output: jsonOutput,
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
      output: jsonOutput,
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
      output: jsonOutput,
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
      output: jsonOutput,
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
      },
      output: jsonOutput,
      async execute(args, exec) { return jsonValue(runtime.plan(sessionFor(exec), args.showcase_id, args.mode as ShowcaseMode, args.provider_id)); },
      presentCall: (args) => callCard("Prepare execution plan", args),
      presentResult: (_args, result) => resultCard("Execution plan", result),
    }),
    defineTool({
      name: "rosalind_approve",
      description: "Approve exactly one awaiting DSH-Rosalind plan by acknowledging every recorded confirmation reason.",
      parameters: {
        run_id: { type: "string", required: true },
        acknowledgements: { type: "array", items: { type: "string" }, required: true },
      },
      output: jsonOutput,
      async execute(args, exec) { return jsonValue(runtime.approve(sessionFor(exec), args.run_id, args.acknowledgements)); },
      presentCall: (args) => callCard("Record plan approval", args),
      presentResult: (_args, result) => resultCard("Plan approval", result),
    }),
    defineTool({
      name: "rosalind_run",
      description: "Run a queued lesson, replay, or reproduction plan using only its selected provider. The operation follows DSH cancellation.",
      parameters: { run_id: { type: "string", required: true } },
      output: jsonOutput,
      timeoutMs: 30 * 60 * 1000,
      async execute(args, exec) { return jsonValue(await runtime.run(sessionFor(exec), args.run_id, exec.signal)); },
      presentCall: (args) => callCard("Run scientific workflow", args),
      presentResult: (_args, result) => resultCard("Scientific workflow", result),
    }),
    defineTool({
      name: "rosalind_status",
      description: "Read the current state, progress, events, artifacts, and error for a run owned by this DSH session.",
      parameters: { run_id: { type: "string", required: true } },
      output: jsonOutput,
      isConcurrencySafe: () => true,
      async execute(args, exec) { return jsonValue(runtime.status(sessionFor(exec), args.run_id)); },
      presentCall: (args) => callCard("Read run status", args),
      presentResult: (_args, result) => resultCard("Run status", result),
    }),
    defineTool({
      name: "rosalind_cancel",
      description: "Request cancellation for a queued, awaiting-confirmation, or running DSH-Rosalind run in this session.",
      parameters: { run_id: { type: "string", required: true }, reason: { type: "string", required: true } },
      output: jsonOutput,
      async execute(args, exec) { return jsonValue(runtime.cancel(sessionFor(exec), args.run_id, args.reason)); },
      presentCall: (args) => callCard("Cancel scientific run", args),
      presentResult: (_args, result) => resultCard("Cancellation status", result),
    }),
    defineTool({
      name: "rosalind_artifact_list",
      description: "List versioned inputs, outputs, previews, provenance, and export artifacts for one showcase.",
      parameters: { showcase_id: { type: "string", required: true }, role: { type: "string", description: "Optional artifact role" } },
      output: jsonOutput,
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
      output: jsonOutput,
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
      description: "Export a showcase review or import bundle to an explicit relative path under the active workspace after confirmation.",
      parameters: {
        showcase_id: { type: "string", required: true },
        format: { type: "string", enum: ["review-json", "import-json"], required: true },
        output_path: { type: "string", required: true, description: "Relative path beneath the active workspace" },
        approved: { type: "boolean", required: true, description: "True only after the user approved this write" },
      },
      output: jsonOutput,
      async execute(args) {
        if (!args.approved) return jsonValue({ status: "awaiting_confirmation", showcaseId: args.showcase_id, outputPath: args.output_path, summary: "Export requires explicit approval for this path." });
        const workspaceRoot = process.cwd();
        const path = resolveInside(workspaceRoot, args.output_path);
        const payload = args.format === "review-json" ? runtime.review(args.showcase_id) : runtime.createImport(args.showcase_id, "lesson");
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
        return jsonValue({ status: "completed", showcaseId: args.showcase_id, outputPath: relative(workspaceRoot, path), bytes: statSync(path).size, summary: `Exported ${basename(path)}` });
      },
      presentCall: (args) => callCard("Export showcase material", args),
      presentResult: (_args, result) => resultCard("Showcase export", result),
    }),
    defineTool({
      name: "rosalind_review",
      description: "Create a scientific review that keeps source observations, computed results, interpretation, limitations, citations, and artifact checks distinct.",
      parameters: { showcase_id: { type: "string", required: true } },
      output: jsonOutput,
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
