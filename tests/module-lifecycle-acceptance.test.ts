import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RosalindModuleDisabledError, RosalindRuntime } from "../src/host/runtime.js";
import { NgsService } from "../src/host/science/ngs.js";
import { ROSALIND_SHOWCASE_MODULE_DEPENDENCIES } from "../src/modules/dependencies.js";
import type { ModuleId } from "../src/modules/types.js";

function disabledError(operation: () => unknown): RosalindModuleDisabledError {
  try {
    operation();
  } catch (cause) {
    expect(cause).toBeInstanceOf(RosalindModuleDisabledError);
    return cause as RosalindModuleDisabledError;
  }
  throw new Error("Expected the Rosalind operation to reject disabled modules.");
}

describe("module lifecycle acceptance", () => {
  it("keeps an explicit dependency record for every Rosalind Workbench Showcase", () => {
    const runtime = new RosalindRuntime();
    try {
      const showcaseIds = runtime.catalog.entries
        .filter((entry) => entry.pluginId === "rosalind-workbench")
        .map((entry) => entry.id)
        .sort();
      expect(Object.keys(ROSALIND_SHOWCASE_MODULE_DEPENDENCIES).sort()).toEqual(showcaseIds);
      expect(Object.values(ROSALIND_SHOWCASE_MODULE_DEPENDENCIES).every((ids) => ids.length > 0)).toBe(true);
    } finally {
      runtime.dispose();
    }
  });

  it("rejects import, plan, approval, and run with every unavailable dependency", async () => {
    const disabled = new Set<ModuleId>();
    const runtime = new RosalindRuntime({ moduleEnabled: (id) => !disabled.has(id) });
    const session = {};
    try {
      disabled.add("literature");
      disabled.add("databases");
      expect(disabledError(() => runtime.createImport("rosalind-pdl1-assay-plan", "lesson")).moduleIds).toEqual(["literature", "databases"]);

      disabled.clear();
      disabled.add("sequence");
      disabled.add("ngs");
      expect(disabledError(() => runtime.plan(session, "rosalind-fastq-qc", "lesson")).moduleIds).toEqual(["sequence", "ngs"]);

      disabled.clear();
      const pending = runtime.plan(session, "rosalind-molecular-design", "reproduce", "boltz");
      expect(pending.state).toBe("awaiting_confirmation");
      disabled.add("sequence");
      disabled.add("structure");
      expect(disabledError(() => runtime.approve(session, pending.id, pending.plan.confirmationReasons)).moduleIds).toEqual(["sequence", "structure"]);

      disabled.clear();
      const approved = runtime.approve(session, pending.id, pending.plan.confirmationReasons);
      expect(approved.state).toBe("queued");

      const runnable = runtime.plan(session, "rosalind-cross-tool-export", "lesson");
      disabled.add("sequence");
      disabled.add("structure");
      disabled.add("slide");
      await expect(runtime.run(session, runnable.id, new AbortController().signal)).rejects.toMatchObject({
        code: "ROSALIND_MODULE_DISABLED",
        moduleIds: ["sequence", "structure", "slide"],
      });
      expect(runtime.status(session, runnable.id).state).toBe("queued");

      disabled.clear();
      expect(await runtime.run(session, runnable.id, new AbortController().signal)).toMatchObject({ state: "completed" });
    } finally {
      runtime.dispose();
    }
  });

  it("retains NGS plans, run receipts, events, and linked evidence across suspension", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-module-lifecycle-"));
    const summaryPath = join(root, "scientific-summary.json");
    writeFileSync(summaryPath, `${JSON.stringify({ conclusion: "fixture scientific evidence" })}\n`, "utf8");
    const service = new NgsService();
    const session = {};
    const context = { session, packageRoot: process.cwd(), signal: new AbortController().signal };
    const originalPath = process.env.PATH;
    try {
      process.env.PATH = "";
      const planned = await service.execute("plan_snakemake", {
        workflow_id: "oai_fastq_qc",
        run_dir: root,
        display_name: "Retained module lifecycle plan",
      }, context);
      const started = await service.execute("execute_plan", {
        plan_id: planned.plan_id,
        plan_name: planned.plan_name,
        plan_checksum: planned.plan_checksum,
      }, context);
      expect(started).toMatchObject({ state: "blocked", reused: false });

      await service.execute("update_ngs_run_analysis_summary", {
        registry_run_id: started.registry_run_id,
        summary_path: summaryPath,
      }, context);
      await service.suspend();
      await expect(service.execute("get_ngs_run", { registry_run_id: started.registry_run_id }, context)).rejects.toThrow(/module is disabled/i);

      service.activate();
      const restored = await service.execute("get_ngs_run", { registry_run_id: started.registry_run_id }, context);
      expect(restored).toMatchObject({
        registry_run_id: started.registry_run_id,
        plan_id: planned.plan_id,
        state: "blocked",
        summary_path: summaryPath,
      });
      expect(restored.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ message: "Analysis summary linked to the registered run." }),
      ]));
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      await service.dispose();
    }
  });
});
