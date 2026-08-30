import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NGS_MCP_SERVER_OPERATIONS, NgsService } from "../src/host/science/ngs.js";

function context(session: object, packageRoot: string) {
  return { session, sessionId: "ngs-facade-test", packageRoot, signal: new AbortController().signal };
}

describe("NGS fixed-version MCP facades", () => {
  it("retains the three original service surfaces", () => {
    expect(Object.keys(NGS_MCP_SERVER_OPERATIONS).sort()).toEqual([
      "ngs-analysis-workbench",
      "ngs-app",
      "ngs-compute",
    ]);
    expect(NGS_MCP_SERVER_OPERATIONS["ngs-analysis-workbench"]).toHaveLength(19);
    expect(NGS_MCP_SERVER_OPERATIONS["ngs-compute"]).toHaveLength(3);
    expect(NGS_MCP_SERVER_OPERATIONS["ngs-app"]).toHaveLength(8);
  });

  it("shares one session registry across app, workbench, and compute facades", async () => {
    const service = new NgsService();
    const session = {};
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-facades-"));
    const ctx = context(session, root);

    const opened = await service.executeOnServer("ngs-app", "open_ngs_workbench", {}, ctx);
    expect(opened).toMatchObject({ mcp_server: "ngs-app", viewer: "ngs-workbench", viewerReady: true });

    const workflows = await service.executeOnServer("ngs-analysis-workbench", "list_workflows", {}, ctx);
    expect(workflows.mcp_server).toBe("ngs-analysis-workbench");
    expect(workflows.workflows).toEqual(expect.arrayContaining([expect.objectContaining({ workflow_id: "oai_fastq_qc" })]));

    const targets = await service.executeOnServer("ngs-compute", "list_compute_targets", {}, ctx);
    expect(targets).toMatchObject({ mcp_server: "ngs-compute" });
    expect(targets.targets).toEqual(expect.arrayContaining([expect.objectContaining({ id: "local" })]));

    const appTargets = await service.executeOnServer("ngs-app", "list_compute_target_summaries", {}, ctx);
    expect(appTargets.targets).toEqual(targets.targets);
    await service.dispose();
  });

  it("rejects tools invoked through the wrong fixed-version server", async () => {
    const service = new NgsService();
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-facade-error-"));
    await expect(service.executeOnServer("ngs-compute", "execute_plan", {}, context({}, root)))
      .rejects.toThrow("not exposed by ngs-compute");
    await service.dispose();
  });

  it("exposes unique app tools through generic routing and returns fixed missing-run responses", async () => {
    const service = new NgsService();
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-app-routing-"));
    const ctx = context({}, root);
    expect(await service.execute("open_ngs_workbench", {}, ctx)).toMatchObject({
      mcp_server: "ngs-app",
      viewerReady: true,
    });
    expect(await service.executeOnServer("ngs-app", "get_ngs_run_report", { registry_run_id: "missing" }, ctx)).toMatchObject({
      ok: false,
      registry_run_id: "missing",
      errors: ["registry run does not exist: missing"],
    });
    expect(await service.execute("get_ngs_run", { registry_run_id: "missing" }, ctx)).toMatchObject({
      ok: false,
      registry_run_id: "missing",
      errors: ["registry run does not exist: missing"],
    });
    await service.dispose();
  });
});
