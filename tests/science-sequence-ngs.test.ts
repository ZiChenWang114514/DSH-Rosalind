import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NgsService } from "../src/host/science/ngs.js";
import { SequenceService } from "../src/host/science/sequence.js";

function context(session: object, packageRoot: string, signal = new AbortController().signal) {
  return { session, packageRoot, signal };
}

describe("SequenceService", () => {
  it("opens the retained RAS alignment and computes identity, distances, and a three-taxon tree", async () => {
    const service = new SequenceService();
    const session = {};
    const root = process.cwd();
    const opened = await service.execute("sequence.open_from_chat", {
      path: "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta",
    }, context(session, root));
    expect(opened.viewer).toBe("alignment");
    const viewerSessionId = String(opened.viewerSessionId);
    // Showcase reproduction opens exactly one viewer, then invokes analysis without repeating its session ID.
    const metrics = await service.execute("sequence.run_analysis", { analysis: "alignment_metrics" }, context(session, root));
    const result = metrics.result as Record<string, unknown>;
    expect(result.alignedLength).toBe(191);
    expect(result.meanIdentity).toBeCloseTo(0.9284467713787081, 12);
    const tree = await service.execute("sequence.run_analysis", { sessionId: viewerSessionId, analysis: "build-tree" }, context(session, root));
    expect(String((tree.result as Record<string, unknown>).newick)).toContain("P01116");
  });

  it("parses FASTQ quality values and reports Q30 from actual records", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-sequence-"));
    const fastq = join(root, "reads.fastq");
    writeFileSync(fastq, "@r1\nACGT\n+\nIIII\n@r2\nACGT\n+\n!!!!\n", "utf8");
    const service = new SequenceService(); const session = {};
    const opened = await service.execute("sequence.open_from_chat", { path: fastq }, context(session, root));
    const qc = await service.execute("sequence.run_analysis", { sessionId: opened.viewerSessionId, analysis: "fastq_qc" }, context(session, root));
    expect((qc.result as Record<string, unknown>).readCount).toBe(2);
    expect((qc.result as Record<string, unknown>).q30Fraction).toBeCloseTo(0.5, 8);
  });

  it("keeps viewer state in the calling session and reports a cooperative cancellation", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-sequence-"));
    const fasta = join(root, "small.fasta"); writeFileSync(fasta, ">A\nACGT\n>B\nACGA\n", "utf8");
    const service = new SequenceService(); const session = {};
    const opened = await service.execute("sequence.open_from_chat", { path: fasta }, context(session, root));
    const state = await service.execute("sequence.control_viewer", { sessionId: opened.viewerSessionId, action: "select_alignment_rows", rows: ["A"] }, context(session, root));
    expect((state.selection as Record<string, unknown>).rows).toEqual(["A"]);
    const aborted = new AbortController(); aborted.abort(new Error("Cancelled by test"));
    await expect(service.execute("sequence.query_viewer", { sessionId: opened.viewerSessionId, target: "viewer-state" }, context(session, root, aborted.signal))).rejects.toThrow(/Cancelled by test/);
  });
});

describe("NgsService", () => {
  it("provides bundled workflows and returns a precise local readiness diagnostic without executing a workflow", async () => {
    const service = new NgsService(); const session = {}; const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-"));
    const workflows = await service.execute("list_workflows", {}, context(session, root));
    expect((workflows.workflows as unknown[]).length).toBeGreaterThanOrEqual(3);
    const readiness = await service.execute("check_snakemake_readiness", { workflow_id: "oai_fastq_qc", run_dir: join(root, "missing") }, context(session, root));
    expect(readiness.ready).toBe(false);
    expect(readiness.code).toBe("COMPUTE_UNAVAILABLE");
  });

  it("creates a reviewable plan, records a blocked run, then supports cancellation without validating retained artifacts", async () => {
    const service = new NgsService(); const session = {}; const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-"));
    const planned = await service.execute("plan_snakemake", { workflow_id: "oai_fastq_qc", run_dir: root, display_name: "QC fixture" }, context(session, root));
    expect(planned.executable).toBe(false);
    const run = await service.execute("execute_plan", { plan_id: planned.plan_id, plan_name: planned.plan_name, plan_checksum: planned.plan_checksum }, context(session, root));
    expect(run.state).toBe("blocked");
    const cancelled = await service.execute("cancel_ngs_run", { registry_run_id: run.registry_run_id }, context(session, root));
    expect(cancelled).toMatchObject({ cancelled: true, state: "cancelled" });
  });

  it("keeps SSH targets configured until explicit remote authority is supplied", async () => {
    const service = new NgsService(); const session = {}; const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-"));
    const configured = await service.execute("configure_ssh_target", { target_id: "cluster", title: "Research cluster", ssh_alias: "lab", workspace_root: "/work/project" }, context(session, root));
    expect(configured.status).toBe("configured");
    const inspected = await service.execute("inspect_compute_target", { target_id: "cluster" }, context(session, root));
    expect(inspected.code).toBe("REMOTE_EXECUTION_NOT_AUTHORIZED");
  });
});
