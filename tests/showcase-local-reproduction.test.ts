import type { JsonValue } from "@deepseek-ai/dsh-tools";
import { describe, expect, it } from "vitest";

import { SHOWCASES } from "../src/generated/catalog.js";
import { reproduceShowcase } from "../src/host/reproduction.js";
import type { ScienceExecutionContext, ScienceExecutor } from "../src/host/science-tools.js";
import { NgsService } from "../src/host/science/ngs.js";
import { SequenceService } from "../src/host/science/sequence.js";
import { SlideService } from "../src/host/science/slide.js";
import { ScienceRuntime } from "../src/host/science/runtime.js";

type JsonRecord = Record<string, JsonValue>;

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

describe("local showcase reproduction", () => {
  it("recomputes all three retained sequence cases from their scientific inputs", async () => {
    const lambda = await run("sequence-lambda-annotation");
    expect(lambda.status).toBe("completed");
    expect(lambda.steps[1]?.result).toMatchObject({ analysis: "genbank_cds_validation", result: { gene: "cI", codingBases: 714, translatedResidues: 237, terminalStopPresent: true, matchesAnnotatedTranslation: true, translationTable: 11, proteinId: "NP_040628.1" } });

    const ras = await run("sequence-ras-alignment");
    expect(ras.status).toBe("completed");
    expect(ras.steps[1]?.result).toMatchObject({ analysis: "alignment_metrics", result: { rowCount: 3, alignedLength: 191, meanIdentity: 0.9284467713787081 } });

    const fastq = await run("sequence-fastq-qc");
    expect(fastq.status).toBe("completed");
    expect(fastq.steps[1]?.result).toMatchObject({ analysis: "fastq_qc", result: { readCount: 500, bases: 235490, q30Fraction: 0.9539768143020935 } });
  });

  it("passes each opened viewer session to later steps when several sequence cases share one DSH session", async () => {
    const executor = new LocalScienceExecutor();
    const sharedSession = {};
    for (const id of ["sequence-lambda-annotation", "sequence-ras-alignment", "sequence-fastq-qc"]) {
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

  it("reports the three NGS journeys as failed when their declared runtime is unavailable", async () => {
    const expectedWorkflows: Record<string, { id: string; version: string; catalogChecksum: string }> = {
      "ngs-fastq-qc": { id: "oai_fastq_qc", version: "version-8e0c15a605d394be27a4e68246a061ef", catalogChecksum: "705bf609376de4193dafbb50a8967b75bc30ffeb5c17e1849a56cafe949db201" },
      "ngs-bulk-rnaseq": { id: "oai_bulk_rnaseq_counts_qc", version: "version-a99d0908ddacd176e3b77e9ec2e482f3", catalogChecksum: "eddf2cd523b62c20b3fa4496c4d441b9dfb48a303de9c5b922bad30d7e30f9cc" },
      "ngs-single-cell": { id: "oai_scrnaseq_fastq_to_count", version: "version-f3c773924a7ebc534c3adc131d4356ec", catalogChecksum: "6f7aa0dcf4ed6fdb6e187ff0f8d1128b6ffa93504bc688aee341fe250a893510" },
    };
    for (const id of Object.keys(expectedWorkflows)) {
      const result = await run(id);
      const expected = expectedWorkflows[id]!;
      expect(result.status, id).toBe("failed");
      expect(result.steps).toHaveLength(3);
      const workflows = result.steps[0]?.result.workflows as Array<Record<string, unknown>>;
      expect(workflows).toEqual(expect.arrayContaining([
        expect.objectContaining({ workflow_id: expected.id, engine: "snakemake", active_version_id: expected.version, catalog_source_checksum: expected.catalogChecksum, source_available: true }),
      ]));
      expect(result.steps[2]?.result).toMatchObject({ workflow_id: expected.id, engine: "snakemake" });
      expect(result.steps[2]?.result).toHaveProperty("diagnostics");
      expect(result.steps[2]?.result).toMatchObject({ ok: false, status: "blocked", ready: false, code: "COMPUTE_UNAVAILABLE" });
      expect(result.error?.code).toBe("COMPUTE_UNAVAILABLE");
    }
  });

  it("opens retained microscopy metadata and recomputes spatial and segmentation results", async () => {
    const tissue = await run("slide-tissue-architecture");
    expect(tissue.status).toBe("completed");
    expect(tissue.steps[0]?.result).toMatchObject({ source: { width: 46000, height: 32893, format: "svs" } });

    const spatial = await run("slide-spatial-expression");
    expect(spatial.status).toBe("completed");
    expect(spatial.steps[1]?.result).toMatchObject({ observations: 684, genes: 18078 });
    expect(spatial.steps[2]?.result).toMatchObject({ gene: "Slc17a7", observationCount: 684, nonzero: 671 });

    const segmentation = await run("slide-segmentation-overlay");
    expect(segmentation.status).toBe("completed");
    expect(segmentation.steps[1]?.result).toMatchObject({ layer: { featureCount: 3 } });

    const researchExport = await run("slide-research-export");
    expect(researchExport.status).toBe("completed");
    expect(researchExport.steps[2]?.result).toMatchObject({ gene: "Slc17a7", observationCount: 684 });
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
      implementation: { engine: "DSH-Rosalind CA Kabsch", version: "1.0.0" },
    });
    expect(Number(adenylate.steps[2]?.result.rmsdAngstrom)).toBeGreaterThan(0);

    const gfp = await execute("structure-gfp-figure");
    expect(gfp.status).toBe("failed");
    expect(gfp.steps[0]?.result).toMatchObject({ structure: { atomCount: 1866, polymerResidueCount: 225, ligandCount: 1 } });
    expect(gfp.steps[1]?.result).toMatchObject({ residuePairCount: 18, thresholdAngstrom: 4 });
    expect(gfp.steps[2]).toMatchObject({
      operation: "structure.validate_render",
      result: { ok: false, error: { code: "RENDERER_UNAVAILABLE" } },
    });
    expect(gfp.error).toMatchObject({ code: "RENDERER_UNAVAILABLE" });

    const design = await execute("rosalind-molecular-design");
    expect(design.status).toBe("completed");
    expect(design.steps[0]?.result).toMatchObject({ retainedDesign: { candidateCount: 20, topFiveCount: 5, firstCandidate: "NB13_E104Q", rankingIsOrdered: true, rankedCandidatesExist: true, sequencesHaveExpectedLength: true, severeClashFreeLeader: true } });
    expect(design.steps[1]?.result).toMatchObject({ structure: { atomCount: expect.any(Number) } });
    expect(Number((design.steps[1]?.result.structure as { atomCount?: number } | undefined)?.atomCount)).toBeGreaterThan(0);
  });
});
