import { defineTool, type JsonValue, type ToolDefinition, type ToolResult } from "@deepseek-ai/dsh-tools";

import { createDatabaseRequestTool } from "../modules/life-sciences-databases.js";
import { createLiteratureRequestTool } from "../modules/life-sciences-literature.js";
import { scienceOutputSpec, type ScienceExecutionContext, type ScienceExecutor } from "./science-tools.js";

const FALLBACK_SESSION = {};

function output(serviceId: "slide", operation: string) {
  return {
    schema: scienceOutputSpec(serviceId, operation),
    render: (_args: unknown, value: Record<string, JsonValue>) => [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    presentationMeta: (_args: unknown, value: Record<string, JsonValue>) => {
      const error = scientificError(value);
      return { status: value.status ?? "completed", ...(error ? { errorCode: error.code, errorMessage: error.message } : {}) };
    },
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

function scientificError(value: unknown): { code: string; message: string } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object" || Array.isArray(error)) return undefined;
  const code = (error as Record<string, unknown>).code;
  const message = (error as Record<string, unknown>).message;
  return typeof code === "string" && typeof message === "string" ? { code, message } : undefined;
}

function presentedFailure(value: ToolResult): string | undefined {
  const meta = value.meta && typeof value.meta === "object" && !Array.isArray(value.meta) ? value.meta as Record<string, JsonValue> : undefined;
  if (typeof meta?.errorCode === "string" && typeof meta.errorMessage === "string") return `${meta.errorCode}: ${meta.errorMessage}`;
  for (const block of value.content) {
    if (block.type !== "text") continue;
    try {
      const error = scientificError(JSON.parse(block.text));
      if (error) return `${error.code}: ${error.message}`;
    } catch { /* Native failures may already be plain text. */ }
  }
  return undefined;
}

function result(title: string, value: ToolResult) {
  const failure = presentedFailure(value);
  return {
    card: "generic" as const,
    title: value.isError || failure ? `${title} failed` : title,
    ...(failure ? { content: [{ type: "text" as const, text: failure }] } : {}),
  };
}

function withFailurePresentation(tool: ToolDefinition, title: string): ToolDefinition {
  return { ...tool, presentResult: (_args, value) => result(title, value) };
}

export function createScienceGatewayTools(
  executor: ScienceExecutor,
  packageRoot: string,
  serviceId?: "literature" | "databases" | "slide",
): ToolDefinition[] {
  const literature = withFailurePresentation(createLiteratureRequestTool(executor, packageRoot), "Literature request");
  const databases = withFailurePresentation(createDatabaseRequestTool(executor, packageRoot), "Database request");
  if (serviceId === "literature") return [literature];
  if (serviceId === "databases") return [databases];
  if (serviceId === "slide") return createCoreScienceGatewayTools(executor, packageRoot);
  return [
    literature,
    databases,
    ...createCoreScienceGatewayTools(executor, packageRoot),
  ];
}

export function createCoreScienceGatewayTools(executor: ScienceExecutor, packageRoot: string): ToolDefinition[] {
  return [
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
}
