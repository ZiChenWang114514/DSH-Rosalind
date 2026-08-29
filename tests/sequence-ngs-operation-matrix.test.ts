import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NgsService } from "../src/host/science/ngs.js";
import { SequenceService } from "../src/host/science/sequence.js";

function context(session: object, packageRoot: string, signal = new AbortController().signal) {
  return { session, packageRoot, signal };
}

describe("Sequence operation matrix", () => {
  it("executes every one of the 13 registered operations through one scientific session", async () => {
    const service = new SequenceService();
    const session = {};
    const root = process.cwd();
    const called = new Set<string>();
    const execute = async (operation: string, args: Record<string, unknown>) => {
      called.add(operation);
      return service.execute(operation, args, context(session, root));
    };

    const opened = await execute("sequence.open_from_chat", {
      path: "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta",
    });
    const sessionId = String(opened.viewerSessionId);
    const example = await execute("sequence.acquire_public_example", { exampleId: "uniprot-human-ras-sv1" });
    expect(example.viewer).toBe("alignment");

    const rows = await execute("sequence.query_viewer", { sessionId, target: "rows" });
    expect((rows.records as unknown[])).toHaveLength(3);
    const controlled = await execute("sequence.control_viewer", {
      sessionId,
      action: "search_alignment",
      query: "GKS",
    });
    expect(controlled.applied).toBe(true);

    const analysis = await execute("sequence.run_analysis", { sessionId, analysis: "alignment_metrics" });
    expect((analysis.result as Record<string, unknown>).alignedLength).toBe(191);
    const aligned = await execute("sequence.align", { sessionId, algorithm: "builtin-center-star" });
    expect((aligned.artifact as Record<string, unknown>).rowCount).toBe(3);
    const cancelled = await execute("sequence.cancel_job", { sessionId, jobId: aligned.jobId });
    expect(cancelled.reason).toBe("ALREADY_COMPLETED");

    const edited = await execute("sequence.edit_copy", {
      sessionId,
      operation: "trim",
      record: "P01116",
      start: 1,
      end: 10,
    });
    expect((edited.editableCopy as Record<string, unknown>).length).toBe(10);
    const track = await execute("sequence.load_track", {
      sessionId,
      path: "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta",
      format: "fasta",
    });
    expect(track.track).toBeTruthy();
    const added = await execute("sequence.manage_annotations", {
      sessionId,
      action: "add",
      feature: { record: "P01116", type: "note", start: 1, end: 10 },
    });
    expect(added.annotation).toBeTruthy();

    const saved = await execute("sequence.save_session", { sessionId, name: "matrix fixture" });
    const restored = await execute("sequence.restore_session", {
      sessionId,
      savedSessionId: saved.savedSessionId,
    });
    expect(restored.restored).toBe(true);
    const exported = await execute("sequence.export_artifact", {
      sessionId,
      format: "json",
      name: "operation-matrix",
    });
    const exportedPath = String((exported.artifact as Record<string, unknown>).path);
    expect(existsSync(exportedPath)).toBe(true);

    expect([...called].sort()).toEqual([
      "sequence.acquire_public_example",
      "sequence.align",
      "sequence.cancel_job",
      "sequence.control_viewer",
      "sequence.edit_copy",
      "sequence.export_artifact",
      "sequence.load_track",
      "sequence.manage_annotations",
      "sequence.open_from_chat",
      "sequence.query_viewer",
      "sequence.restore_session",
      "sequence.run_analysis",
      "sequence.save_session",
    ]);
  });
});

describe("NGS operation matrix", () => {
  it("executes all 22 registered management, planning, run, and compute-target operations", async () => {
    const service = new NgsService();
    const session = {};
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-matrix-"));
    const summaryPath = join(root, "analysis-summary.md");
    const nextflowPath = join(root, "main.nf");
    const snakefilePath = join(root, "Snakefile");
    writeFileSync(summaryPath, "# Fixture analysis summary\n", "utf8");
    writeFileSync(nextflowPath, "workflow { Channel.value('fixture') }\n", "utf8");
    writeFileSync(snakefilePath, "rule all:\n  input: 'done.txt'\n", "utf8");
    const called = new Set<string>();
    const execute = async (operation: string, args: Record<string, unknown>) => {
      called.add(operation);
      return service.execute(operation, args, context(session, root));
    };

    const initial = await execute("list_workflows", {});
    expect((initial.workflows as unknown[]).length).toBeGreaterThanOrEqual(3);
    const saved = await execute("save_workflow", {
      workflow_id: "fixture_workflow",
      name: "Fixture workflow",
      engine: "snakemake",
      source: { kind: "local", root, entrypoint: "Snakefile" },
    });
    expect(saved.created).toBe(true);
    const updated = await execute("update_workflow", {
      workflow_id: "fixture_workflow",
      source: { kind: "local", root, entrypoint: "Snakefile" },
    });
    const versionId = String((updated.version as Record<string, unknown>).id);
    const versions = await execute("list_workflow_versions", { workflow_id: "fixture_workflow" });
    expect((versions.versions as unknown[])).toHaveLength(2);
    const activated = await execute("activate_workflow_version", {
      workflow_id: "fixture_workflow",
      version_id: versionId,
    });
    expect(activated.active_version_id).toBe(versionId);
    expect((await execute("archive_workflow", { workflow_id: "fixture_workflow" })).archived).toBe(true);
    expect((await execute("restore_workflow", { workflow_id: "fixture_workflow" })).archived).toBe(false);

    const runtime = await execute("get_runtime_environment", {});
    expect(runtime.runtime).toBeTruthy();
    await execute("save_workflow", {
      workflow_id: "fixture_nextflow",
      name: "Fixture Nextflow workflow",
      engine: "nextflow",
      source: { kind: "local", root, entrypoint: "main.nf" },
    });
    const nextflow = await execute("check_nextflow_readiness", {
      workflow_id: "fixture_nextflow",
      run_dir: root,
    });
    expect(["READY", "COMPUTE_UNAVAILABLE"]).toContain(nextflow.code);
    const snakemake = await execute("check_snakemake_readiness", {
      workflow_id: "fixture_workflow",
      run_dir: root,
    });
    expect(["READY", "COMPUTE_UNAVAILABLE"]).toContain(snakemake.code);
    const nextflowPlan = await execute("plan_nextflow", {
      workflow_id: "fixture_nextflow",
      run_dir: root,
      display_name: "Nextflow matrix plan",
    });
    expect(nextflowPlan).toMatchObject({
      plan_name: "Nextflow matrix plan",
      workflow_id: "fixture_nextflow",
      engine: "nextflow",
      executable: expect.any(Boolean),
      readiness: {
        workflow_id: "fixture_nextflow",
        engine: "nextflow",
        target_id: "local",
        run_dir: root,
        ready: expect.any(Boolean),
      },
    });
    expect(nextflowPlan.plan_id).toMatch(/^plan-/);
    expect(nextflowPlan.plan_checksum).toMatch(/^[a-f0-9]{64}$/);
    if (nextflowPlan.executable === false) {
      expect(nextflowPlan).toMatchObject({
        command: null,
        readiness: { ok: false, status: "blocked", code: "COMPUTE_UNAVAILABLE", executable: null },
      });
    } else {
      expect(nextflowPlan).toMatchObject({
        command: { executable: expect.any(String), arguments: expect.arrayContaining(["run"]), cwd: root },
        readiness: { ok: true, status: "completed", code: "READY" },
      });
    }
    const plan = await execute("plan_snakemake", {
      workflow_id: "fixture_workflow",
      run_dir: root,
      display_name: "Snakemake matrix plan",
    });
    const run = await execute("execute_plan", {
      plan_id: plan.plan_id,
      plan_name: plan.plan_name,
      plan_checksum: plan.plan_checksum,
    });
    const registryRunId = String(run.registry_run_id);

    expect((await execute("list_ngs_runs", {})).runs).toBeTruthy();
    expect((await execute("list_ngs_run_lineages", {})).lineages).toBeTruthy();
    expect((await execute("get_ngs_run", { registry_run_id: registryRunId })).registry_run_id).toBe(registryRunId);
    expect((await execute("observe_ngs_run", { registry_run_id: registryRunId })).observation).toBeTruthy();
    const linked = await execute("update_ngs_run_analysis_summary", {
      registry_run_id: registryRunId,
      summary_path: summaryPath,
    });
    expect(linked.updated).toBe(true);
    expect((await execute("cancel_ngs_run", { registry_run_id: registryRunId })).state).toBe("cancelled");

    expect((await execute("list_compute_targets", {})).targets).toBeTruthy();
    const configured = await execute("configure_ssh_target", {
      target_id: "fixture-cluster",
      title: "Fixture cluster",
      ssh_alias: "fixture",
      workspace_root: "/work/fixture",
    });
    expect(configured.status).toBe("configured");
    const inspected = await execute("inspect_compute_target", { target_id: "fixture-cluster" });
    expect(inspected.code).toBe("REMOTE_EXECUTION_NOT_AUTHORIZED");

    expect([...called].sort()).toEqual([
      "activate_workflow_version",
      "archive_workflow",
      "cancel_ngs_run",
      "check_nextflow_readiness",
      "check_snakemake_readiness",
      "configure_ssh_target",
      "execute_plan",
      "get_ngs_run",
      "get_runtime_environment",
      "inspect_compute_target",
      "list_compute_targets",
      "list_ngs_run_lineages",
      "list_ngs_runs",
      "list_workflow_versions",
      "list_workflows",
      "observe_ngs_run",
      "plan_nextflow",
      "plan_snakemake",
      "restore_workflow",
      "save_workflow",
      "update_ngs_run_analysis_summary",
      "update_workflow",
    ]);
  });
});
