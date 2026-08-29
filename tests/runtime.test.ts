import { describe, expect, it } from "vitest";

import { resolveInside, ShowcaseCatalog } from "../src/host/catalog.js";
import { ProviderRegistry, providerRequiresConfirmation } from "../src/host/providers.js";
import { RosalindRuntime } from "../src/host/runtime.js";
import { createRosalindTools } from "../src/host/tools.js";

const EXPECTED_TOOLS = [
  "rosalind_catalog_list",
  "rosalind_showcase_get",
  "rosalind_provider_status",
  "rosalind_showcase_import",
  "rosalind_plan",
  "rosalind_approve",
  "rosalind_run",
  "rosalind_status",
  "rosalind_cancel",
  "rosalind_artifact_list",
  "rosalind_artifact_open",
  "rosalind_export",
  "rosalind_review",
] as const;

describe("DSH host contract", () => {
  it("registers the complete public tool surface with explicit output and presentation contracts", () => {
    const runtime = new RosalindRuntime();
    const tools = createRosalindTools(runtime);
    expect(tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOLS);
    for (const tool of tools) {
      expect(tool.output?.schema).toEqual({ type: "object", additionalProperties: true });
      expect(tool.output?.render).toBeTypeOf("function");
      expect(tool.presentCall).toBeTypeOf("function");
      expect(tool.presentResult).toBeTypeOf("function");
    }
    runtime.dispose();
  });

  it("keeps catalogue copies immutable and filters all seven scientific areas", () => {
    const catalog = new ShowcaseCatalog();
    const first = catalog.get("sequence-ras-alignment");
    first.title = "mutated by caller";
    expect(catalog.get("sequence-ras-alignment").title).not.toBe("mutated by caller");
    expect(catalog.list()).toHaveLength(23);
    expect(catalog.list({ categoryId: "structure" })).toHaveLength(3);
    expect(catalog.list({ query: "nanobody" }).map((item) => item.id)).toEqual(["rosalind-molecular-design"]);
  });

  it("rejects workspace path traversal", () => {
    expect(() => resolveInside(process.cwd(), "../outside.json")).toThrow(/leaves the selected directory/);
    expect(() => resolveInside(process.cwd(), "   ")).toThrow(/must not be empty/);
  });
});

describe("provider diagnostics", () => {
  const providers = new ProviderRegistry({
    env: {},
    platform: "linux",
    path: "",
    checkedAt: () => "2026-08-30T00:00:00.000Z",
  });

  it("reports public network authorization, credentials, commands, and confirmation requirements precisely", () => {
    expect(providers.get("local-sequence")).toMatchObject({ runnable: true, kind: "local" });
    expect(providers.get("ncbi-entrez")).toMatchObject({ runnable: false, installed: false, kind: "public-api" });
    expect(providers.get("biohub-esm")).toMatchObject({ runnable: false, credentialConfigured: false, kind: "paid-api" });
    expect(providers.get("boltz").diagnostics.join(" ")).toContain("Required command is unavailable");
    expect(providerRequiresConfirmation(providers.get("boltz"))).toBe(true);
    expect(providerRequiresConfirmation(providers.get("ncbi-entrez"))).toBe(false);
  });
});

describe("run lifecycle", () => {
  it("completes lesson, replay, and local reproduce runs", async () => {
    const runtime = new RosalindRuntime();
    const session = {};
    for (const [mode, id] of [
      ["lesson", "literature-trem2-landscape"],
      ["replay", "sequence-ras-alignment"],
      ["reproduce", "sequence-lambda-annotation"],
    ] as const) {
      const planned = runtime.plan(session, id, mode);
      expect(planned.state).toBe("queued");
      const finished = await runtime.run(session, planned.id, new AbortController().signal);
      expect(finished.state).toBe("completed");
      expect(finished.progress).toBe(1);
      expect(finished.artifacts.length).toBeGreaterThan(0);
    }
    runtime.dispose();
  });

  it("requires full acknowledgement for GPU work and never changes the selected provider", () => {
    const runtime = new RosalindRuntime({ providers: new ProviderRegistry({ env: {}, platform: "linux", path: "" }) });
    const session = {};
    const planned = runtime.plan(session, "rosalind-molecular-design", "reproduce", "boltz");
    expect(planned.state).toBe("awaiting_confirmation");
    expect(planned.plan.providerIds).toEqual(["boltz"]);
    expect(() => runtime.approve(session, planned.id, [])).toThrow(/missing acknowledgement/);
    const approved = runtime.approve(session, planned.id, [...planned.plan.confirmationReasons]);
    expect(approved.state).toBe("queued");
    expect(approved.plan.providerIds).toEqual(["boltz"]);
    runtime.dispose();
  });

  it("isolates runs by DSH session and supports cancellation before execution", () => {
    const runtime = new RosalindRuntime();
    const owner = {};
    const stranger = {};
    const planned = runtime.plan(owner, "structure-gfp-figure", "replay");
    expect(() => runtime.status(stranger, planned.id)).toThrow(/does not belong to this session/);
    const cancelled = runtime.cancel(owner, planned.id, "Cancelled by test user.");
    expect(cancelled.state).toBe("cancelled");
    expect(() => runtime.cancel(owner, planned.id, "again")).toThrow(/already cancelled/);
    runtime.dispose();
  });

  it("reports unavailable live providers without selecting another service", async () => {
    const runtime = new RosalindRuntime({ providers: new ProviderRegistry({ env: {}, platform: "linux", path: "" }) });
    const session = {};
    const planned = runtime.plan(session, "literature-trem2-landscape", "reproduce", "ncbi-entrez");
    const finished = await runtime.run(session, planned.id, new AbortController().signal);
    expect(finished.state).toBe("failed");
    expect(finished.error?.code).toBe("PROVIDER_UNAVAILABLE");
    expect(finished.plan.providerIds).toEqual(["ncbi-entrez"]);
    runtime.dispose();
  });
});
