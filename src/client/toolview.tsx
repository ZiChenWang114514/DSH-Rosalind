import type { ToolCallOwnerProps } from "@deepseek-ai/dsh-client-ui-tool/client";

import { RosalindMark } from "./icons.js";

const LABELS: Record<string, string> = {
  rosalind_catalog_list: "Browse showcase catalogue",
  rosalind_showcase_get: "Open showcase record",
  rosalind_provider_status: "Check scientific providers",
  rosalind_showcase_import: "Prepare conversation import",
  rosalind_plan: "Prepare execution plan",
  rosalind_approve: "Record plan approval",
  rosalind_run: "Run showcase workflow",
  rosalind_status: "Read run status",
  rosalind_cancel: "Cancel run",
  rosalind_artifact_list: "List scientific artifacts",
  rosalind_artifact_open: "Open scientific artifact",
  rosalind_export: "Export showcase material",
  rosalind_review: "Review scientific record",
};

function resultSummary(block: ToolCallOwnerProps["block"]): { state: string; summary: string } {
  const settled = "kind" in block;
  if (!settled) return { state: "running", summary: "DSH-Rosalind is processing this request." };
  const candidate = block as unknown as Record<string, unknown>;
  const failed = candidate.kind === "error" || candidate.isError === true;
  const meta = candidate.meta as Record<string, unknown> | undefined;
  const summary = typeof meta?.summary === "string"
    ? meta.summary
    : failed ? "The request finished with a recorded error." : "The request completed; open details for the canonical result.";
  return { state: failed ? "failed" : "complete", summary };
}

export function RosalindToolCard(props: ToolCallOwnerProps): JSX.Element {
  const result = resultSummary(props.block);
  return (
    <article className="rr-tool-card" data-tool-name={props.toolName}>
      <header className="rr-tool-head"><span className="rr-tool-mark"><RosalindMark size={18} /></span><span className="rr-tool-name">{LABELS[props.toolName] ?? props.toolName}</span><span className="rr-tool-state">{result.state}</span></header>
      <p className="rr-tool-summary">{result.summary}</p>
    </article>
  );
}

export const ROSALIND_TOOL_NAMES = Object.freeze(Object.keys(LABELS));
