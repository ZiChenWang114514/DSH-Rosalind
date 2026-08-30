import type { Context } from "@deepseek-ai/cordis";
import type { JsonValue } from "@deepseek-ai/dsh-tools";

import type { ScienceExecutionContext } from "../host/science-tools.js";

export interface SourceProviderAdapter {
  readonly serviceId: "literature" | "databases";
  execute(
    serviceId: string,
    operation: string,
    args: Record<string, unknown>,
    context: ScienceExecutionContext,
  ): Promise<Record<string, JsonValue>>;
  dispose(): void | Promise<void>;
}

export interface ShowcaseOwnership {
  readonly pluginId: string;
  readonly showcaseIds: readonly string[];
}

/** Small contract used by the host to mount an independently disposable Cordis module. */
export interface ModuleDefinition<TAdapter extends SourceProviderAdapter = SourceProviderAdapter> {
  readonly name: string;
  readonly inject: readonly ["tools", "skills"];
  readonly adapter: TAdapter;
  readonly showcases: ShowcaseOwnership;
  apply(ctx: Context): void;
}

export class SourceAdapterError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SourceAdapterError";
  }
}

export function normalizeSourceResult(
  serviceId: SourceProviderAdapter["serviceId"],
  operation: string,
  value: unknown,
): Record<string, JsonValue> {
  const normalized = JSON.parse(JSON.stringify(value ?? {})) as unknown;
  const record = normalized && typeof normalized === "object" && !Array.isArray(normalized)
    ? normalized as Record<string, JsonValue>
    : { value: normalized as JsonValue };
  const ok = typeof record.ok === "boolean" ? record.ok : undefined;
  const status = typeof record.status === "string" ? record.status : ok === false ? "failed" : "completed";
  return { serviceId, operation, ...record, status };
}

export function sourceFailure(
  serviceId: SourceProviderAdapter["serviceId"],
  operation: string,
  cause: unknown,
): Record<string, JsonValue> {
  const code = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
    ? cause.code
    : "SCIENCE_OPERATION_FAILED";
  const message = cause instanceof Error ? cause.message : String(cause);
  const status = cause && typeof cause === "object" && "status" in cause && typeof cause.status === "number"
    ? cause.status
    : undefined;
  return {
    serviceId,
    operation,
    status: code === "CANCELLED" ? "cancelled" : "failed",
    error: { code, message, ...(status === undefined ? {} : { status }) },
  };
}
