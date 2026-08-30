import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NgsService } from "../src/host/science/ngs.js";

function context(session: object, packageRoot: string, sessionId: string) {
  return { session, sessionId, packageRoot, signal: new AbortController().signal };
}

function registryName(sessionId: string): string {
  const normalized = sessionId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "session";
  const checksum = createHash("sha256").update(sessionId).digest("hex").slice(0, 20);
  return `${normalized}--${checksum}.json`;
}

describe("NgsService durable registry", () => {
  it("consumes an execution plan once and restores the same receipt in a new service instance", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-registry-"));
    const registryRoot = join(root, "profile-state", "ngs-registry");
    const sessionId = "persistent-session";
    const firstSession = {};
    const first = new NgsService({ registryRoot });
    const planned = await first.execute("plan_snakemake", {
      workflow_id: "oai_fastq_qc",
      run_dir: root,
      display_name: "Persistent blocked plan",
    }, context(firstSession, root, sessionId));

    const identity = {
      plan_id: planned.plan_id,
      plan_name: planned.plan_name,
      plan_checksum: planned.plan_checksum,
    };
    const started = await first.execute("execute_plan", identity, context(firstSession, root, sessionId));
    const repeated = await first.execute("execute_plan", identity, context(firstSession, root, sessionId));

    expect(started).toMatchObject({ state: "blocked", reused: false });
    expect(repeated).toMatchObject({
      registry_run_id: started.registry_run_id,
      state: "blocked",
      reused: true,
      reason: "PLAN_ALREADY_CONSUMED",
    });
    expect(repeated.execution_receipt).toMatchObject({
      plan_id: planned.plan_id,
      registry_run_id: started.registry_run_id,
      consumed: true,
    });

    const registryPath = join(registryRoot, registryName(sessionId));
    expect(existsSync(registryPath)).toBe(true);
    expect(JSON.parse(readFileSync(registryPath, "utf8"))).toMatchObject({ schema: "dsh-rosalind-ngs-registry-v1" });
    await first.dispose();

    const second = new NgsService({ registryRoot });
    const restored = await second.execute("get_ngs_run", {
      registry_run_id: started.registry_run_id,
    }, context({}, root, sessionId));
    expect(restored).toMatchObject({
      registry_run_id: started.registry_run_id,
      plan_id: planned.plan_id,
      state: "blocked",
    });
    await second.dispose();
  });

  it("marks a saved active controller as orphaned instead of claiming it is still running", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-orphan-"));
    const sessionId = "orphan-session";
    const registryDirectory = join(root, "profile-state", "ngs-registry");
    const registryPath = join(registryDirectory, registryName(sessionId));
    mkdirSync(registryDirectory, { recursive: true });
    writeFileSync(registryPath, `${JSON.stringify({
      schema: "dsh-rosalind-ngs-registry-v1",
      workflows: [],
      targets: [],
      plans: [],
      runs: [{
        id: "run-orphaned",
        planId: "plan-orphaned",
        workflowId: "workflow-orphaned",
        state: "running",
        createdAt: "2026-08-30T00:00:00.000Z",
        updatedAt: "2026-08-30T00:00:01.000Z",
        events: [],
        processId: 999999,
      }],
    }, null, 2)}\n`, "utf8");

    const service = new NgsService({ registryRoot: registryDirectory });
    const restored = await service.execute("get_ngs_run", {
      registry_run_id: "run-orphaned",
    }, context({}, root, sessionId));
    expect(restored).toMatchObject({
      state: "orphaned",
      diagnostic: { code: "CONTROLLER_IDENTITY_LOST" },
    });
    expect((restored.events as Array<Record<string, unknown>>).at(-1)).toMatchObject({ state: "orphaned" });
    await service.dispose();
  });

  it("keeps colliding normalized session IDs in separate digest-named registry files", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-collision-"));
    const registryDirectory = join(root, "profile-state", "ngs-registry");
    const service = new NgsService({ registryRoot: registryDirectory });
    await service.execute("list_workflows", {}, context({}, root, "sample/a"));
    await service.execute("list_workflows", {}, context({}, root, "sample?a"));
    const files = readdirSync(registryDirectory).filter((name) => name.endsWith(".json"));
    expect(files).toContain(registryName("sample/a"));
    expect(files).toContain(registryName("sample?a"));
    expect(new Set(files).size).toBe(2);
    await service.dispose();
  });

  it.each([
    ["corrupt JSON", "corrupt-session", "{not-json\n", "REGISTRY_CORRUPT_JSON"],
    ["unknown schema", "schema-session", '{"schema":"future-registry-v9","sentinel":true}\n', "REGISTRY_UNKNOWN_SCHEMA"],
  ])("preserves original bytes and reports restoration diagnostics for %s", async (_label, sessionId, original, code) => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-preserve-"));
    const registryDirectory = join(root, "profile-state", "ngs-registry");
    const registryPath = join(registryDirectory, registryName(sessionId));
    mkdirSync(registryDirectory, { recursive: true });
    writeFileSync(registryPath, original, "utf8");
    const service = new NgsService({ registryRoot: registryDirectory });
    const result = await service.execute("list_workflows", {}, context({}, root, sessionId));
    expect(result.registry_restoration).toMatchObject({ code, original_preserved: true, path: registryPath });
    expect(readFileSync(registryPath, "utf8")).toBe(original);
    await service.dispose();
    expect(readFileSync(registryPath, "utf8")).toBe(original);
  });

  it("reports an unwritable registry location without modifying the blocking file", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-unwritable-"));
    const blocker = join(root, "registry-blocker");
    const original = "do-not-replace\n";
    writeFileSync(blocker, original, "utf8");
    const previous = process.env.NGS_ANALYSIS_WORKBENCH_STATE_DIR;
    process.env.NGS_ANALYSIS_WORKBENCH_STATE_DIR = blocker;
    try {
      const service = new NgsService();
      const result = await service.execute("list_workflows", {}, context({}, root, "write-error-session"));
      expect(result.registry_persistence).toMatchObject({ code: "REGISTRY_WRITE_FAILED", original_preserved: false });
      expect(readFileSync(blocker, "utf8")).toBe(original);
      await service.dispose();
    } finally {
      if (previous === undefined) delete process.env.NGS_ANALYSIS_WORKBENCH_STATE_DIR;
      else process.env.NGS_ANALYSIS_WORKBENCH_STATE_DIR = previous;
    }
  });
});
