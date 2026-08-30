import { ScienceRuntime } from "../src/host/science/runtime.js";

/** Collects real bundled-catalogue NGS evidence with the production service. */
export async function collectEvidence(): Promise<Record<string, unknown>> {
  const science = new ScienceRuntime();
  const context = { session: {}, signal: new AbortController().signal, packageRoot: process.cwd() };
  try {
    const workflows = await science.execute("ngs", "list_workflows", {}, context);
    const targets = await science.execute("ngs", "list_compute_targets", {}, context);
    const runs = await science.execute("ngs", "list_ngs_runs", {}, context);
    const lineages = await science.execute("ngs", "list_ngs_run_lineages", {}, context);
    return {
      ngs: {
        workflows: { callId: "preview-workflows", toolName: "ngs_list_workflows", ...workflows },
        targets: { callId: "preview-targets", toolName: "ngs_list_compute_targets", ...targets },
        runs: { callId: "preview-runs", toolName: "ngs_list_ngs_runs", ...runs },
        lineages: { callId: "preview-lineages", toolName: "ngs_list_ngs_run_lineages", ...lineages },
      },
    };
  } finally {
    await science.dispose();
  }
}
