import { defineTool, type JsonValue, type ToolDefinition, type ToolResult } from "@deepseek-ai/dsh-tools";

import { scienceOutputSpec, type ScienceExecutionContext, type ScienceExecutor } from "./science-tools.js";

const FALLBACK_SESSION = {};

function output(serviceId: "literature" | "databases" | "slide", operation: string) {
  return {
    schema: scienceOutputSpec(serviceId, operation),
    render: (_args: unknown, value: Record<string, JsonValue>) => [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    presentationMeta: (_args: unknown, value: Record<string, JsonValue>) => ({ status: value.status ?? "completed" }),
  };
}

function executeDeclared<T>(
  executor: ScienceExecutor,
  serviceId: string,
  operation: string,
  args: Record<string, unknown>,
  context: ScienceExecutionContext,
): Promise<T> {
  // defineTool validates this dynamic service-specific schema before exposing
  // the result; this assertion connects that runtime contract to its generic.
  return executor.execute(serviceId, operation, args, context) as Promise<T>;
}

function call(title: string, args: unknown) {
  return { card: "generic" as const, title, rawInput: JSON.stringify(args, null, 2) };
}

function result(title: string, value: ToolResult) {
  return { card: "generic" as const, title: value.isError ? `${title} failed` : title };
}

export function createScienceGatewayTools(
  executor: ScienceExecutor,
  packageRoot: string,
  serviceId?: "literature" | "databases" | "slide",
): ToolDefinition[] {
  const tools = [
    defineTool({
      name: "literature_request",
      description: "Query bioRxiv/medRxiv, NCBI Entrez, or PubMed Central with explicit pagination and provenance.",
      parameters: {
        provider: { type: "string", enum: ["biorxiv", "medrxiv", "entrez", "ncbi-entrez", "pmc", "ncbi-pmc"], required: true },
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
      },
      output: output("literature", "literature.request"),
      isConcurrencySafe: () => true,
      execute(args, exec) {
        return executeDeclared(executor, "literature", "literature.request", args, { session: exec.agent ?? FALLBACK_SESSION, signal: exec.signal, packageRoot, ...(args.allowNetwork === true ? { allowNetwork: true } : {}) });
      },
      presentCall: (args) => call("Query life-sciences literature", args),
      presentResult: (_args, value) => result("Literature result", value),
    }),
    defineTool({
      name: "database_request",
      description: "Query one of the 44 fixed-version life-sciences database providers with explicit provenance.",
      parameters: {
        provider: { type: "string", required: true },
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
      },
      output: output("databases", "database.request"),
      isConcurrencySafe: () => true,
      execute(args, exec) {
        return executeDeclared(executor, "databases", "database.request", args, { session: exec.agent ?? FALLBACK_SESSION, signal: exec.signal, packageRoot, ...(args.allowNetwork === true ? { allowNetwork: true } : {}) });
      },
      presentCall: (args) => call("Query a life-sciences database", args),
      presentResult: (_args, value) => result("Database result", value),
    }),
    defineTool({
      name: "slide_control_viewer",
      description: "Apply a fixed-version Slide Viewer display or navigation action to an existing slide session.",
      parameters: {
        sessionId: { type: "string", required: true },
        action: { type: "string", required: true },
        expectedRevision: { type: "integer" },
        visible: { type: "boolean" },
        displayMode: { type: "string", enum: ["inline", "fullscreen"] },
        mode: { type: "string" },
        layerId: { type: "string" },
        opacity: { type: "number" },
        zoom: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
      },
      output: output("slide", "slide.control_viewer"),
      isConcurrencySafe: () => false,
      execute(args, exec) {
        return executeDeclared(executor, "slide", "slide.control_viewer", args, { session: exec.agent ?? FALLBACK_SESSION, signal: exec.signal, packageRoot });
      },
      presentCall: (args) => call("Control Slide Viewer", args),
      presentResult: (_args, value) => result("Slide Viewer control", value),
    }),
    defineTool({
      name: "slide_run_analysis_from_chat",
      description: "Start the Slide Viewer analysis-from-chat workflow and return a truthful local job or compute diagnostic.",
      parameters: {
        sessionId: { type: "string", required: true },
        analysis: { type: "string" },
        query: { type: "string" },
        expectedRevision: { type: "integer" },
        parameters: { type: "object", additionalProperties: true },
      },
      output: output("slide", "slide.run_analysis_from_chat"),
      isConcurrencySafe: () => false,
      execute(args, exec) {
        return executeDeclared(executor, "slide", "slide.run_analysis_from_chat", args, { session: exec.agent ?? FALLBACK_SESSION, signal: exec.signal, packageRoot });
      },
      presentCall: (args) => call("Run slide analysis", args),
      presentResult: (_args, value) => result("Slide analysis", value),
    }),
    defineTool({
      name: "slide_run_pathology",
      description: "Start a fixed-version pathology workflow or report the exact missing local compute capability.",
      parameters: {
        sessionId: { type: "string", required: true },
        workflow: { type: "string" },
        sourceId: { type: "string" },
        expectedRevision: { type: "integer" },
        parameters: { type: "object", additionalProperties: true },
      },
      output: output("slide", "slide.run_pathology"),
      isConcurrencySafe: () => false,
      execute(args, exec) {
        return executeDeclared(executor, "slide", "slide.run_pathology", args, { session: exec.agent ?? FALLBACK_SESSION, signal: exec.signal, packageRoot });
      },
      presentCall: (args) => call("Run pathology workflow", args),
      presentResult: (_args, value) => result("Pathology workflow", value),
    }),
    defineTool({
      name: "slide_query_scientific_layer",
      description: "Query features or entities in an imported Slide Viewer scientific layer.",
      parameters: {
        sessionId: { type: "string", required: true },
        layerId: { type: "string", required: true },
        entityId: { type: "string" },
        query: { type: "string" },
        page: { type: "integer" },
        pageSize: { type: "integer" },
      },
      output: output("slide", "slide.query_scientific_layer"),
      isConcurrencySafe: () => true,
      execute(args, exec) {
        return executeDeclared(executor, "slide", "slide.query_scientific_layer", args, { session: exec.agent ?? FALLBACK_SESSION, signal: exec.signal, packageRoot });
      },
      presentCall: (args) => call("Query scientific slide layer", args),
      presentResult: (_args, value) => result("Scientific layer query", value),
    }),
  ];
  if (serviceId === undefined) return tools;
  const prefixes: Record<NonNullable<typeof serviceId>, readonly string[]> = {
    literature: ["literature_"],
    databases: ["database_"],
    slide: ["slide_"],
  };
  return tools.filter((tool) => prefixes[serviceId].some((prefix) => tool.name.startsWith(prefix)));
}
