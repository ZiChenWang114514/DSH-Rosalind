import type { JsonValue } from "@deepseek-ai/dsh-tools";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SHOWCASES } from "../src/generated/catalog.js";
import { REPRODUCIBLE_SHOWCASE_IDS, reproduceShowcase, type NgsReproductionRequest } from "../src/host/reproduction.js";
import type { ScienceExecutionContext, ScienceExecutor } from "../src/host/science-tools.js";
import { NgsService } from "../src/host/science/ngs.js";
import { SequenceService } from "../src/host/science/sequence.js";
import { SlideService } from "../src/host/science/slide.js";
import { ScienceRuntime } from "../src/host/science/runtime.js";

type JsonRecord = Record<string, JsonValue>;

function metadataTiff(width: number, height: number): Buffer {
  const value = Buffer.alloc(38);
  value.write("II", 0, "ascii"); value.writeUInt16LE(42, 2); value.writeUInt32LE(8, 4); value.writeUInt16LE(2, 8);
  value.writeUInt16LE(256, 10); value.writeUInt16LE(4, 12); value.writeUInt32LE(1, 14); value.writeUInt32LE(width, 18);
  value.writeUInt16LE(257, 22); value.writeUInt16LE(4, 24); value.writeUInt32LE(1, 26); value.writeUInt32LE(height, 30);
  value.writeUInt32LE(0, 34);
  return value;
}

function asJsonRecord(value: unknown): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

class LocalScienceExecutor implements ScienceExecutor {
  readonly sequence = new SequenceService();
  readonly ngs = new NgsService();
  readonly slide = new SlideService();

  async execute(serviceId: string, operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<JsonRecord> {
    const service = serviceId === "sequence" ? this.sequence : serviceId === "ngs" ? this.ngs : serviceId === "slide" ? this.slide : undefined;
    if (!service) throw new Error(`Unexpected local service ${serviceId}.`);
    const value = await service.execute(operation, args, context);
    const result = asJsonRecord(value);
    return {
      serviceId,
      operation,
      ...result,
      status: typeof result.status === "string" ? result.status : result.ok === false ? "failed" : "completed",
    };
  }
}

class RunnableNgsExecutor implements ScienceExecutor {
  readonly calls: Array<{ operation: string; args: Record<string, unknown> }> = [];
  private readonly observations: JsonRecord[];
  private readonly report: JsonRecord;

  constructor(options: { observations?: JsonRecord[]; report?: JsonRecord } = {}) {
    this.observations = options.observations ?? [{ status: "completed", ok: true, state: "completed", registry_run_id: "run-showcase", observation: { terminal: true } }];
    this.report = options.report ?? { status: "completed", state: "completed", registry_run_id: "run-showcase", availability: "available", report: { reproducible: true } };
  }

  async execute(serviceId: string, operation: string, args: Record<string, unknown>): Promise<JsonRecord> {
    expect(serviceId).toBe("ngs");
    this.calls.push({ operation, args: structuredClone(args) });
    if (operation === "list_workflows") return { status: "completed", workflows: [] };
    if (operation === "get_runtime_environment") return { status: "completed", runtime: { availableEngines: ["snakemake"] } };
    if (operation === "check_snakemake_readiness") return { status: "completed", ok: true, ready: true, code: "READY", workflow_id: String(args.workflow_id) };
    if (operation === "plan_snakemake") return { status: "completed", executable: true, plan_id: "plan-showcase", plan_name: "Showcase plan", plan_checksum: "checksum-showcase", workflow_id: String(args.workflow_id) };
    if (operation === "execute_plan") return { status: "completed", state: "running", registry_run_id: "run-showcase", plan_id: String(args.plan_id) };
    if (operation === "observe_ngs_run") return structuredClone(this.observations.shift() ?? this.observations.at(-1) ?? { status: "completed", state: "running", registry_run_id: String(args.registry_run_id), observation: { terminal: false } });
    if (operation === "get_ngs_run_report") return structuredClone(this.report);
    throw new Error(`Unexpected runnable NGS operation ${operation}.`);
  }
}

class PermissiveRouteExecutor implements ScienceExecutor {
  async execute(): Promise<JsonRecord> {
    return { status: "completed", ok: true };
  }
}

function showcase(id: string) {
  const value = SHOWCASES.find((item) => item.id === id);
  if (!value) throw new Error(`Missing showcase ${id}.`);
  return value;
}

async function run(id: string) {
  const item = showcase(id);
  return reproduceShowcase(item, item.recipe.providerIds[0]!, new LocalScienceExecutor(), {
    session: {},
    signal: new AbortController().signal,
    packageRoot: process.cwd(),
  });
}

function ngsRequest(options: Partial<NgsReproductionRequest> = {}): { root: string; request: NgsReproductionRequest } {
  const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-ngs-showcase-"));
  const config = join(root, "scientific-config.yaml");
  const input = join(root, "sample_R1.fastq.gz");
  writeFileSync(config, "smoke_mode: false\nresults_dir: results\nsamples:\n  sample:\n    r1: sample_R1.fastq.gz\n", "utf8");
  writeFileSync(input, "fixture-input", "utf8");
  return {
    root,
    request: {
      runDirectory: root,
      configFile: config,
      inputPaths: [input],
      ...options,
    },
  };
}

function ngsContext(request: NgsReproductionRequest, packageRoot = process.cwd()) {
  return {
    session: {},
    signal: new AbortController().signal,
    packageRoot,
    ngsReproduction: request,
  };
}

describe("local showcase reproduction", () => {
  it("keeps every declared reproduction ID connected to a host route", async () => {
    for (const id of REPRODUCIBLE_SHOWCASE_IDS) {
      const item = showcase(id);
      const result = await reproduceShowcase(item, item.recipe.providerIds[0]!, new PermissiveRouteExecutor(), {
        session: {}, signal: new AbortController().signal, packageRoot: process.cwd(),
      });
      expect(result.error?.code, id).not.toBe("REPRODUCTION_ROUTE_UNAVAILABLE");
    }
  });

  it("rejects a showcase without a registered fresh-run route before calling a science service", async () => {
    const executor = new RunnableNgsExecutor();
    const result = await reproduceShowcase(showcase("literature-kras-g12c"), "local-replay", executor, {
      session: {}, signal: new AbortController().signal, packageRoot: process.cwd(),
    });
    expect(result).toMatchObject({
      status: "failed",
      steps: [],
      error: { code: "REPRODUCTION_ROUTE_UNAVAILABLE", message: expect.stringContaining("lesson and replay") },
    });
    expect(executor.calls).toEqual([]);
  });

  it("recomputes the retained sequence cases that include their scientific inputs", async () => {
    const lambda = await run("sequence-lambda-annotation");
    expect(lambda.status).toBe("completed");
    expect(lambda.steps[1]?.result).toMatchObject({ analysis: "genbank_cds_validation", result: { gene: "cI", codingBases: 714, translatedResidues: 237, terminalStopPresent: true, matchesAnnotatedTranslation: true, translationTable: 11, proteinId: "NP_040628.1" } });

    const ras = await run("sequence-ras-alignment");
    expect(ras.status).toBe("completed");
    expect(ras.steps[1]?.result).toMatchObject({ analysis: "alignment_metrics", result: { rowCount: 3, alignedLength: 191, meanIdentity: 0.9284467713787081 } });

    const fastq = showcase("sequence-fastq-qc");
    expect(fastq.recipe.requiredInputs).not.toContain("showcases/biological-sequence-viewer/cases/sequence-fastq-qc/inputs/DRR037765.first500.fastq");
    expect(fastq.reproductionSteps.length).toBeGreaterThan(0);
  });

  it("passes each opened viewer session to later steps when several sequence cases share one DSH session", async () => {
    const executor = new LocalScienceExecutor();
    const sharedSession = {};
    for (const id of ["sequence-lambda-annotation", "sequence-ras-alignment"]) {
      const item = showcase(id);
      const result = await reproduceShowcase(item, item.recipe.providerIds[0]!, executor, {
        session: sharedSession,
        signal: new AbortController().signal,
        packageRoot: process.cwd(),
      });
      expect(result.status, id).toBe("completed");
      expect(result.steps[1]?.result.status, id).toBe("completed");
    }
  });

  it("returns a precise input diagnostic before planning NGS cases with no declared scientific inputs", async () => {
    for (const id of ["ngs-fastq-qc", "ngs-bulk-rnaseq", "ngs-single-cell"]) {
      const item = showcase(id);
      const result = await reproduceShowcase(item, item.recipe.providerIds[0]!, new RunnableNgsExecutor(), {
        session: {},
        signal: new AbortController().signal,
        packageRoot: process.cwd(),
      });
      expect(result.status, id).toBe("failed");
      expect(result.error).toMatchObject({ code: "NGS_INPUT_CONFIGURATION_REQUIRED" });
      expect(result.steps).toEqual([]);
    }
  });

  it("uses user-supplied existing inputs and configuration, then retains a reviewable plan when the local runtime is unavailable", async () => {
    const expectedWorkflows: Record<string, { id: string; version: string; catalogChecksum: string }> = {
      "ngs-fastq-qc": { id: "oai_fastq_qc", version: "version-8e0c15a605d394be27a4e68246a061ef", catalogChecksum: "705bf609376de4193dafbb50a8967b75bc30ffeb5c17e1849a56cafe949db201" },
      "ngs-bulk-rnaseq": { id: "oai_bulk_rnaseq_counts_qc", version: "version-a99d0908ddacd176e3b77e9ec2e482f3", catalogChecksum: "eddf2cd523b62c20b3fa4496c4d441b9dfb48a303de9c5b922bad30d7e30f9cc" },
      "ngs-single-cell": { id: "oai_scrnaseq_fastq_to_count", version: "version-f3c773924a7ebc534c3adc131d4356ec", catalogChecksum: "6f7aa0dcf4ed6fdb6e187ff0f8d1128b6ffa93504bc688aee341fe250a893510" },
    };
    for (const id of Object.keys(expectedWorkflows)) {
      const item = showcase(id);
      const { request } = ngsRequest();
      const result = await reproduceShowcase(item, item.recipe.providerIds[0]!, new LocalScienceExecutor(), ngsContext(request));
      const expected = expectedWorkflows[id]!;
      expect(result.status, id).toBe("awaiting_confirmation");
      expect(result.steps).toHaveLength(4);
      const workflows = result.steps[0]?.result.workflows as Array<Record<string, unknown>>;
      expect(workflows).toEqual(expect.arrayContaining([
        expect.objectContaining({ workflow_id: expected.id, engine: "snakemake", active_version_id: expected.version, catalog_source_checksum: expected.catalogChecksum, source_available: true }),
      ]));
      expect(result.steps[2]?.result).toMatchObject({ workflow_id: expected.id, engine: "snakemake" });
      expect(result.steps[2]?.result).toHaveProperty("diagnostics");
      expect(result.steps[2]?.result).toMatchObject({ ok: false, status: "blocked", ready: false, code: "COMPUTE_UNAVAILABLE" });
      expect(result.steps[3]).toMatchObject({
        serviceId: "ngs",
        operation: "plan_snakemake",
        result: {
          workflow_id: expected.id,
          engine: "snakemake",
          executable: false,
          command: null,
          plan_id: expect.stringMatching(/^plan-/),
          plan_checksum: expect.any(String),
        },
      });
      expect(result.pendingPlan).toMatchObject({
        planId: expect.stringMatching(/^plan-/),
        planName: expect.any(String),
        planChecksum: expect.any(String),
      });
      expect(result.error?.code).toBe("NGS_PLAN_APPROVAL_REQUIRED");
    }
  });

  it("does not execute an NGS plan without an exact DSH-approved plan identity", async () => {
    const item = showcase("ngs-fastq-qc");
    const executor = new RunnableNgsExecutor();
    const { request } = ngsRequest();
    const result = await reproduceShowcase(item, item.recipe.providerIds[0]!, executor, ngsContext(request));

    expect(result.status).toBe("awaiting_confirmation");
    expect(result.error).toMatchObject({ code: "NGS_PLAN_APPROVAL_REQUIRED" });
    expect(result.pendingPlan).toEqual({ planId: "plan-showcase", planName: "Showcase plan", planChecksum: "checksum-showcase" });
    expect(executor.calls.map((call) => call.operation)).toEqual([
      "list_workflows",
      "get_runtime_environment",
      "check_snakemake_readiness",
      "plan_snakemake",
    ]);
    expect(executor.calls.some((call) => call.operation === "execute_plan")).toBe(false);

    const mismatched = new RunnableNgsExecutor();
    const mismatch = await reproduceShowcase(item, item.recipe.providerIds[0]!, mismatched, ngsContext({ ...request, approvedPlan: { planId: "plan-showcase", planName: "Showcase plan", planChecksum: "other-checksum" } }));
    expect(mismatch.status).toBe("awaiting_confirmation");
    expect(mismatched.calls.some((call) => call.operation === "execute_plan")).toBe(false);
  });

  it("executes only an exactly approved NGS plan identity and waits for a terminal scientific report", async () => {
    const item = showcase("ngs-fastq-qc");
    const executor = new RunnableNgsExecutor();
    const { request } = ngsRequest({ approvedPlan: { planId: "plan-showcase", planName: "Showcase plan", planChecksum: "checksum-showcase" } });
    const result = await reproduceShowcase(item, item.recipe.providerIds[0]!, executor, {
      ...ngsContext(request),
    });

    expect(result.status).toBe("completed");
    expect(executor.calls.map((call) => call.operation)).toEqual([
      "list_workflows",
      "get_runtime_environment",
      "check_snakemake_readiness",
      "plan_snakemake",
      "execute_plan",
      "observe_ngs_run",
      "get_ngs_run_report",
    ]);
    expect(executor.calls[4]?.args).toEqual({
      plan_id: "plan-showcase",
      plan_name: "Showcase plan",
      plan_checksum: "checksum-showcase",
    });
    expect(executor.calls[5]?.args).toEqual({ registry_run_id: "run-showcase" });
    expect(executor.calls[6]?.args).toEqual({ registry_run_id: "run-showcase" });
  });

  it("does not report a running, failed, or cancelled NGS run as completed", async () => {
    const item = showcase("ngs-fastq-qc");
    const approvedPlan = { planId: "plan-showcase", planName: "Showcase plan", planChecksum: "checksum-showcase" };

    const runningExecutor = new RunnableNgsExecutor({ observations: [
      { status: "completed", ok: true, state: "running", registry_run_id: "run-showcase", observation: { terminal: false } },
    ] });
    const runningRequest = ngsRequest({ approvedPlan, maxObservationAttempts: 1 }).request;
    const running = await reproduceShowcase(item, item.recipe.providerIds[0]!, runningExecutor, ngsContext(runningRequest));
    expect(running.status).toBe("running");
    expect(running.error).toMatchObject({ code: "NGS_RUN_STILL_RUNNING" });
    expect(runningExecutor.calls.some((call) => call.operation === "get_ngs_run_report")).toBe(false);

    const completedAfterObservation = new RunnableNgsExecutor({ observations: [
      { status: "completed", ok: true, state: "running", registry_run_id: "run-showcase", observation: { terminal: false } },
      { status: "completed", ok: true, state: "completed", registry_run_id: "run-showcase", observation: { terminal: true } },
    ] });
    const completed = await reproduceShowcase(item, item.recipe.providerIds[0]!, completedAfterObservation, ngsContext(ngsRequest({ approvedPlan, maxObservationAttempts: 2 }).request));
    expect(completed.status).toBe("completed");
    expect(completedAfterObservation.calls.filter((call) => call.operation === "observe_ngs_run")).toHaveLength(2);

    for (const state of ["failed", "cancelled"] as const) {
      const executor = new RunnableNgsExecutor({ observations: [
        { status: "completed", ok: true, state, registry_run_id: "run-showcase", observation: { terminal: true } },
      ] });
      const result = await reproduceShowcase(item, item.recipe.providerIds[0]!, executor, ngsContext(ngsRequest({ approvedPlan }).request));
      expect(result.status, state).toBe(state === "cancelled" ? "cancelled" : "failed");
      expect(result.error?.code, state).toBe(`NGS_RUN_${state.toUpperCase()}`);
      expect(executor.calls.some((call) => call.operation === "get_ngs_run_report"), state).toBe(false);
    }
  });

  it("resolves relative NGS configuration and input paths from the user run directory", async () => {
    const { root, request } = ngsRequest({ configFile: "scientific-config.yaml", inputPaths: ["sample_R1.fastq.gz"] });
    const executor = new RunnableNgsExecutor();
    const item = showcase("ngs-fastq-qc");
    const planned = await reproduceShowcase(item, "local", executor, ngsContext(request));
    expect(planned.status).toBe("awaiting_confirmation");
    const readiness = executor.calls.find((call) => call.operation === "check_snakemake_readiness")!;
    const planner = executor.calls.find((call) => call.operation === "plan_snakemake")!;
    for (const call of [readiness, planner]) {
      expect(call.args).toMatchObject({
        run_dir: root,
        config_file: join(root, "scientific-config.yaml"),
        input_paths: [join(root, "sample_R1.fastq.gz")],
      });
    }
  });

  it("rejects unavailable inputs and showcase-source run directories before creating an NGS plan", async () => {
    const item = showcase("ngs-fastq-qc");
    const missing = ngsRequest({ inputPaths: [join(tmpdir(), "missing-showcase-input.fastq.gz")] });
    const missingExecutor = new RunnableNgsExecutor();
    const missingResult = await reproduceShowcase(item, item.recipe.providerIds[0]!, missingExecutor, ngsContext(missing.request));
    expect(missingResult.status).toBe("failed");
    expect(missingResult.error).toMatchObject({ code: "NGS_INPUT_UNAVAILABLE" });
    expect(missingExecutor.calls.some((call) => call.operation === "plan_snakemake")).toBe(false);

    const sourceDirectory = "showcases/ngs-analysis-workbench/cases/ngs-fastq-qc";
    const sourceRequest = ngsRequest({ runDirectory: sourceDirectory });
    const sourceExecutor = new RunnableNgsExecutor();
    const sourceResult = await reproduceShowcase(item, item.recipe.providerIds[0]!, sourceExecutor, ngsContext(sourceRequest.request));
    expect(sourceResult.status).toBe("failed");
    expect(sourceResult.error).toMatchObject({ code: "NGS_RUN_DIRECTORY_IN_SHOWCASE_SOURCE" });
    expect(sourceExecutor.calls.some((call) => call.operation === "plan_snakemake")).toBe(false);
  });

  it("keeps retained Slide artifacts in replay and requests raw sources before recomputation", async () => {
    for (const id of ["slide-tissue-architecture", "slide-spatial-expression", "slide-segmentation-overlay", "slide-research-export"]) {
      const result = await run(id);
      expect(result.status).toBe("awaiting_confirmation");
      expect(result.steps).toEqual([]);
      expect(result.error).toMatchObject({ code: "REPRODUCTION_INPUT_REQUIRED" });
      expect(result.error?.message).toMatch(/Provide the authorized/);
    }
  });

  it("rejects an unrecorded Slide look-alike and reports unavailable H5AD capabilities without writing outputs", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-slide-reproduction-"));
    try {
      const tiff = join(root, "CMU-1-JP2K-33005.svs"); writeFileSync(tiff, metadataTiff(46000, 32893));
      const h5ad = join(root, "source.h5ad"); writeFileSync(h5ad, Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]));
      const runtime = new ScienceRuntime();
      const execute = (id: string, sourcePath: string) => reproduceShowcase(showcase(id), "local-slide", runtime, {
        session: {}, signal: new AbortController().signal, packageRoot: process.cwd(),
        authorizedPaths: [root, sourcePath],
        showcaseReproduction: { runDirectory: root, sourcePaths: [sourcePath] },
      });
      const tissue = await execute("slide-tissue-architecture", tiff);
      expect(tissue).toMatchObject({ status: "failed", error: { code: "SOURCE_PROVENANCE_MISMATCH" } });
      expect(tissue.steps.map((step) => step.operation)).toEqual(["slide.open_from_chat"]);
      expect(tissue.steps[0]?.result).toMatchObject({ source: { width: 46000, height: 32893, format: "svs" } });
      const expected = {
        "slide-spatial-expression": "H5AD_INDEX_UNAVAILABLE",
        "slide-segmentation-overlay": "SEGMENTATION_GENERATOR_UNAVAILABLE",
        "slide-research-export": "SPATIAL_VECTOR_UNAVAILABLE",
      } as const;
      for (const [id, code] of Object.entries(expected)) {
        const result = await execute(id, h5ad);
        expect(result).toMatchObject({ status: "failed", error: { code } });
        expect(result.steps.map((step) => step.operation)).toEqual(["slide.open_from_chat"]);
      }
      expect(readdirSync(root).sort()).toEqual(["CMU-1-JP2K-33005.svs", "source.h5ad"]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("recomputes retained structure cases and validates the molecular-design records", async () => {
    const runtime = new ScienceRuntime();
    const execute = async (id: string) => {
      const item = showcase(id);
      return reproduceShowcase(item, item.recipe.providerIds[0]!, runtime, {
        session: {},
        signal: new AbortController().signal,
        packageRoot: process.cwd(),
      });
    };

    const mdm2 = await execute("structure-mdm2-p53");
    expect(mdm2.status).toBe("completed");
    expect(mdm2.steps[1]?.result).toMatchObject({ selectedResidueCount: 3 });
    expect(mdm2.steps[2]?.result).toMatchObject({ atomContactCount: 105, residuePairCount: 34 });

    const adenylate = await execute("structure-adenylate-kinase");
    expect(adenylate.status).toBe("completed");
    expect(adenylate.steps[2]?.result).toMatchObject({
      method: "structure",
      alignedResidueCount: 214,
      matrix: expect.any(Array),
      correspondence: { kind: "stable-author-residue-C-alpha", count: 214, mobileObjectId: "closed", referenceObjectId: "primary" },
      implementation: { engine: "DSH-Rosalind local Kabsch", version: "1.1.0" },
    });
    expect(Number(adenylate.steps[2]?.result.rmsdAngstrom)).toBeGreaterThan(0);

    const gfp = await execute("structure-gfp-figure");
    expect(gfp.status).toBe("completed");
    expect(gfp.steps[0]?.result).toMatchObject({ structure: { atomCount: 1866, polymerResidueCount: 225, ligandCount: 1 } });
    expect(gfp.steps[1]?.result).toMatchObject({ residuePairCount: 18, thresholdAngstrom: 4 });
    expect(gfp.steps[2]).toMatchObject({
      operation: "structure.validate_render",
      result: { ok: true, valid: true },
    });
    expect(gfp.steps[3]).toMatchObject({
      operation: "structure.render_image",
      result: {
        ok: true,
        job: { state: "completed", outputPath: expect.stringContaining("gfp-figure.png") },
        artifact: { format: "png" },
      },
    });

    const design = await execute("rosalind-molecular-design");
    expect(design.status).toBe("awaiting_confirmation");
    expect(design.steps).toEqual([]);
    expect(design.error).toMatchObject({ code: "REPRODUCTION_PROVIDER_REQUIRED" });
  });

  it("uses real category services after opening each Rosalind launcher", async () => {
    const runtime = new ScienceRuntime();
    const execute = async (id: string) => {
      const item = showcase(id);
      return reproduceShowcase(item, item.recipe.providerIds[0]!, runtime, {
        session: {},
        signal: new AbortController().signal,
        packageRoot: process.cwd(),
      });
    };

    const structure = await execute("rosalind-structure-analysis");
    expect(structure.status).toBe("completed");
    expect(structure.steps.map((step) => step.operation)).toEqual(["rosalind.open", "structure.open_from_chat", "structure.get_state"]);
    expect(structure.steps[1]?.result).toMatchObject({ structure: { atomCount: expect.any(Number) } });

    const genomics = await execute("rosalind-genomics");
    expect(genomics.status).toBe("completed");
    expect(genomics.steps.map((step) => step.operation)).toEqual(["rosalind.open", "sequence.open_from_chat", "sequence.run_analysis"]);
    expect(genomics.steps[2]?.result).toMatchObject({ analysis: "alignment_metrics", result: { rowCount: 3, alignedLength: 191 } });

    const compute = await execute("rosalind-scientific-compute");
    expect(compute.status).toBe("completed");
    expect(compute.steps.map((step) => step.operation)).toEqual(["rosalind.open", "list_workflows", "get_runtime_environment", "list_compute_targets"]);
    expect(compute.steps[3]?.result).toHaveProperty("targets");
  });
});
