import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NgsService } from "../src/host/science/ngs.js";
import { SequenceService } from "../src/host/science/sequence.js";

function context(session: object, packageRoot: string, signal = new AbortController().signal) {
  return { session, packageRoot, signal, authorizedWritePaths: [join(packageRoot, "artifacts", "sequence-exports")] };
}

describe("Sequence operation matrix", () => {
  it("requires explicit destination authorization before creating an export", async () => {
    const service = new SequenceService();
    const session = {};
    const root = process.cwd();
    const executionContext = { session, packageRoot: root, signal: new AbortController().signal };
    const opened = await service.execute("sequence.open_from_chat", {
      path: "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta",
    }, executionContext);
    await expect(service.execute("sequence.export_artifact", {
      sessionId: opened.viewerSessionId,
      format: "json",
      name: "unauthorized-export",
    }, executionContext)).rejects.toThrow(/WRITE_NOT_AUTHORIZED/);
    expect(existsSync(join(root, "artifacts", "sequence-exports", "unauthorized-export.json"))).toBe(false);
  });

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
    expect(await execute("sequence.query_viewer", { sessionId, target: "search" })).toMatchObject({
      target: "search",
      query: "GKS",
      hits: expect.arrayContaining([expect.objectContaining({ record: "P01116", start: expect.any(Number), end: expect.any(Number) })]),
      selectedHit: 0,
    });

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
    const expectedExportPath = join(root, "artifacts", "sequence-exports", "operation-matrix.json");
    rmSync(expectedExportPath, { force: true });
    const exported = await execute("sequence.export_artifact", {
      sessionId,
      format: "json",
      name: "operation-matrix",
    });
    const exportedPath = String((exported.artifact as Record<string, unknown>).path);
    expect(existsSync(exportedPath)).toBe(true);
    await expect(execute("sequence.export_artifact", { sessionId, format: "json", name: "operation-matrix" })).rejects.toThrow(/DESTINATION_EXISTS/);
    rmSync(exportedPath, { force: true });

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

type NgsEvidenceResult = Record<string, unknown>;

interface NgsEvidenceRun {
  root: string;
  results: Map<string, NgsEvidenceResult>;
  versionId: string;
  registryRunId: string;
}

async function collectNgsOperationEvidence(): Promise<NgsEvidenceRun> {
  const service = new NgsService();
  const session = {};
  const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-operation-evidence-"));
  const summaryPath = join(root, "analysis-summary.md");
  writeFileSync(summaryPath, "# Fixture analysis summary\n", "utf8");
  writeFileSync(join(root, "main.nf"), "workflow { Channel.value('fixture') }\n", "utf8");
  writeFileSync(join(root, "Snakefile"), "rule all:\n  input: 'done.txt'\n", "utf8");
  const results = new Map<string, NgsEvidenceResult>();
  const execute = async (operation: string, args: Record<string, unknown>) => {
    const result = await service.execute(operation, args, context(session, root)) as NgsEvidenceResult;
    results.set(operation, result);
    return result;
  };

  await execute("list_workflows", {});
  await execute("save_workflow", {
    workflow_id: "fixture_workflow", name: "Fixture workflow", engine: "snakemake",
    source: { kind: "local", root, entrypoint: "Snakefile" },
  });
  const updated = await execute("update_workflow", {
    workflow_id: "fixture_workflow", source: { kind: "local", root, entrypoint: "Snakefile" },
  });
  const versionId = String((updated.version as Record<string, unknown>).id);
  await execute("list_workflow_versions", { workflow_id: "fixture_workflow" });
  await execute("activate_workflow_version", { workflow_id: "fixture_workflow", version_id: versionId });
  await execute("archive_workflow", { workflow_id: "fixture_workflow" });
  await execute("restore_workflow", { workflow_id: "fixture_workflow" });
  await execute("get_runtime_environment", {});
  await execute("save_workflow", {
    workflow_id: "fixture_nextflow", name: "Fixture Nextflow workflow", engine: "nextflow",
    source: { kind: "local", root, entrypoint: "main.nf" },
  });
  await execute("check_nextflow_readiness", { workflow_id: "fixture_nextflow", run_dir: root });
  await execute("check_snakemake_readiness", { workflow_id: "fixture_workflow", run_dir: root });
  await execute("plan_nextflow", { workflow_id: "fixture_nextflow", run_dir: root, display_name: "Nextflow evidence plan" });
  const plan = await execute("plan_snakemake", { workflow_id: "fixture_workflow", run_dir: root, display_name: "Snakemake evidence plan" });
  const run = await execute("execute_plan", {
    plan_id: plan.plan_id, plan_name: plan.plan_name, plan_checksum: plan.plan_checksum,
  });
  const registryRunId = String(run.registry_run_id);
  await execute("list_ngs_runs", {});
  await execute("list_ngs_run_lineages", {});
  await execute("get_ngs_run", { registry_run_id: registryRunId });
  await execute("observe_ngs_run", { registry_run_id: registryRunId });
  await execute("update_ngs_run_analysis_summary", { registry_run_id: registryRunId, summary_path: summaryPath });
  await execute("cancel_ngs_run", { registry_run_id: registryRunId });
  await execute("list_compute_targets", {});
  await execute("configure_ssh_target", {
    target_id: "fixture-cluster", title: "Fixture cluster", ssh_alias: "fixture", workspace_root: "/work/fixture",
  });
  await execute("inspect_compute_target", { target_id: "fixture-cluster" });
  return { root, results, versionId, registryRunId };
}

const NGS_OPERATION_EVIDENCE = [
  { operation: "list_workflows", expectation: "returns the local workflow inventory", verify: (value: NgsEvidenceResult) => expect((value.workflows as unknown[]).length).toBeGreaterThanOrEqual(3) },
  { operation: "save_workflow", expectation: "creates a local versioned workflow", verify: (value: NgsEvidenceResult) => expect(value.created).toBe(true) },
  { operation: "update_workflow", expectation: "creates a new workflow version", verify: (value: NgsEvidenceResult) => expect((value.version as Record<string, unknown>).id).toEqual(expect.any(String)) },
  { operation: "list_workflow_versions", expectation: "lists both local workflow versions", verify: (value: NgsEvidenceResult) => expect((value.versions as unknown[])).toHaveLength(2) },
  { operation: "activate_workflow_version", expectation: "activates the requested workflow version", verify: (value: NgsEvidenceResult, run: NgsEvidenceRun) => expect(value.active_version_id).toBe(run.versionId) },
  { operation: "archive_workflow", expectation: "archives the selected workflow", verify: (value: NgsEvidenceResult) => expect(value.archived).toBe(true) },
  { operation: "restore_workflow", expectation: "restores the archived workflow", verify: (value: NgsEvidenceResult) => expect(value.archived).toBe(false) },
  { operation: "get_runtime_environment", expectation: "reports the local runtime environment", verify: (value: NgsEvidenceResult) => expect(value.runtime).toBeTruthy() },
  { operation: "check_nextflow_readiness", expectation: "reports ready or compute-unavailable readiness", verify: (value: NgsEvidenceResult) => expect(["READY", "COMPUTE_UNAVAILABLE"]).toContain(value.code) },
  { operation: "check_snakemake_readiness", expectation: "reports ready or compute-unavailable readiness", verify: (value: NgsEvidenceResult) => expect(["READY", "COMPUTE_UNAVAILABLE"]).toContain(value.code) },
  { operation: "plan_nextflow", expectation: "returns a checksum-bound Nextflow plan", verify: (value: NgsEvidenceResult) => expect(value).toMatchObject({ plan_name: "Nextflow evidence plan", plan_checksum: expect.stringMatching(/^[a-f0-9]{64}$/) }) },
  { operation: "plan_snakemake", expectation: "returns a checksum-bound Snakemake plan", verify: (value: NgsEvidenceResult) => expect(value).toMatchObject({ plan_name: "Snakemake evidence plan", plan_checksum: expect.stringMatching(/^[a-f0-9]{64}$/) }) },
  { operation: "execute_plan", expectation: "creates a durable local run record", verify: (value: NgsEvidenceResult, run: NgsEvidenceRun) => expect(value.registry_run_id).toBe(run.registryRunId) },
  { operation: "list_ngs_runs", expectation: "lists the durable run record", verify: (value: NgsEvidenceResult) => expect(value.runs).toEqual(expect.any(Array)) },
  { operation: "list_ngs_run_lineages", expectation: "lists local workflow lineage", verify: (value: NgsEvidenceResult) => expect(value.lineages).toEqual(expect.any(Array)) },
  { operation: "get_ngs_run", expectation: "retrieves the exact durable run identity", verify: (value: NgsEvidenceResult, run: NgsEvidenceRun) => expect(value.registry_run_id).toBe(run.registryRunId) },
  { operation: "observe_ngs_run", expectation: "returns an observation for the durable run", verify: (value: NgsEvidenceResult) => expect(value.observation).toBeTruthy() },
  { operation: "update_ngs_run_analysis_summary", expectation: "links the local analysis summary", verify: (value: NgsEvidenceResult) => expect(value.updated).toBe(true) },
  { operation: "cancel_ngs_run", expectation: "records terminal cancellation", verify: (value: NgsEvidenceResult) => expect(value.state).toBe("cancelled") },
  { operation: "list_compute_targets", expectation: "lists configured compute targets", verify: (value: NgsEvidenceResult) => expect(value.targets).toEqual(expect.any(Array)) },
  { operation: "configure_ssh_target", expectation: "stores an SSH target without connecting", verify: (value: NgsEvidenceResult) => expect(value.status).toBe("configured") },
  { operation: "inspect_compute_target", expectation: "returns the exact offline authorization diagnosis", verify: (value: NgsEvidenceResult) => expect(value.code).toBe("REMOTE_EXECUTION_NOT_AUTHORIZED") },
] as const;

describe("NGS operation-specific local evidence", () => {
  let evidenceRun: NgsEvidenceRun;

  beforeAll(async () => { evidenceRun = await collectNgsOperationEvidence(); });
  afterAll(() => { if (evidenceRun) rmSync(evidenceRun.root, { recursive: true, force: true }); });

  it("covers exactly the 22 NGS operations registered by the fixed contract", () => {
    expect(NGS_OPERATION_EVIDENCE.map((item) => item.operation).sort()).toEqual([
      "activate_workflow_version", "archive_workflow", "cancel_ngs_run", "check_nextflow_readiness", "check_snakemake_readiness",
      "configure_ssh_target", "execute_plan", "get_ngs_run", "get_runtime_environment", "inspect_compute_target",
      "list_compute_targets", "list_ngs_run_lineages", "list_ngs_runs", "list_workflow_versions", "list_workflows",
      "observe_ngs_run", "plan_nextflow", "plan_snakemake", "restore_workflow", "save_workflow",
      "update_ngs_run_analysis_summary", "update_workflow",
    ]);
  });

  it.each(NGS_OPERATION_EVIDENCE)("$operation $expectation", ({ operation, verify }) => {
    const value = evidenceRun.results.get(operation);
    expect(value, `${operation} result`).toBeDefined();
    verify(value!, evidenceRun);
  });
});
