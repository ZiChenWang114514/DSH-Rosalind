import { describe, expect, it } from "vitest";
import path from "node:path";
import { buildCatalogue, reproductionRouteIds, scientificAcceptance, validateShowcases } from "../scripts/lib/showcase-data.mjs";
import { REPRODUCIBLE_SHOWCASE_IDS } from "../src/host/reproduction.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

describe("generated showcase catalogue", () => {
  it("builds 100 ready, searchable definitions with only recorded fresh-run routes", async () => {
    const catalogue = await buildCatalogue(repositoryRoot);
    const routedIds = await reproductionRouteIds(repositoryRoot);
    expect(catalogue).toHaveLength(100);
    expect(routedIds).toHaveLength(23);
    expect(REPRODUCIBLE_SHOWCASE_IDS).toEqual(routedIds);
    expect(new Set(catalogue.filter((showcase) => showcase.modes.includes("reproduce")).map((showcase) => showcase.id))).toEqual(new Set(routedIds));
    expect(new Set(catalogue.map((item) => item.categoryId))).toEqual(new Set(["literature", "databases", "sequence", "ngs", "structure", "slide", "workbench"]));
    for (const showcase of catalogue) {
      expect(showcase.status).toBe("ready");
      expect(showcase.modes.slice(0, 2)).toEqual(["lesson", "replay"]);
      expect(showcase.question.length).toBeGreaterThan(10);
      expect(showcase.searchText).toContain(showcase.title.toLowerCase());
      expect(showcase.recipe.adapter).toBeTruthy();
      expect(showcase.domain).toBeTruthy();
      expect(showcase.caseType).toBeTruthy();
      expect(showcase.difficulty).toBeTruthy();
      expect(showcase.evidenceLevel).toBeTruthy();
      expect(showcase.execution.actualTools.length).toBeGreaterThan(0);
      expect(showcase.reproductionSteps.length).toBeGreaterThan(0);
      expect(showcase.artifacts.length).toBeGreaterThanOrEqual(3);
      expect(showcase.preview?.resourceUri).toMatch(/^(data:image\/svg\+xml;base64,|dsh-rosalind:\/\/)/);
      expect(showcase.claims.every((claim) => ["observation", "computed", "interpretation"].includes(claim.kind))).toBe(true);
    }
  });

  it("keeps the three scientific evidence classes and limitations as separate fields", async () => {
    const catalogue = await buildCatalogue(repositoryRoot);
    const lambda = catalogue.find((item) => item.id === "sequence-lambda-annotation");
    expect(lambda?.observations.join(" ")).toContain("48,502-base genome");
    expect(lambda?.computedResults.join(" ")).toContain("714-base interval");
    expect(lambda?.interpretation).toBeInstanceOf(Array);
    expect(lambda?.limitations.join(" ")).toContain("viewer");
    expect(lambda?.claims.some((claim) => claim.kind === "computed")).toBe(true);
  });

  it("connects every showcase to explicit services, operations, fixtures, assertions, and provenance", async () => {
    const catalogue = await buildCatalogue(repositoryRoot);
    for (const showcase of catalogue) {
      expect(showcase.requiredMcpServers.length).toBeGreaterThan(0);
      expect(showcase.requiredOperations.length).toBeGreaterThan(0);
      expect(showcase.fixtures.length).toBeGreaterThan(0);
      expect(showcase.expectedArtifacts.length).toBeGreaterThan(0);
      expect(showcase.scientificAssertions.length).toBeGreaterThan(0);
      expect(showcase.provenance.sourceCommit).toBe("f8c2ea83ac3b3b9258b160b80039dc3db37d76c4");
      expect(showcase.provenance.sources).toEqual(showcase.sources);
      expect(showcase.provenance.records.length).toBeGreaterThan(0);
      expect(showcase.visualAssertions.length).toBe(showcase.preview ? 1 : 0);
    }
  });

  it("retains cross-service dependencies and the updated scientific-compute record", async () => {
    const catalogue = await buildCatalogue(repositoryRoot);
    const structure = catalogue.find((item) => item.id === "rosalind-structure-analysis");
    expect(structure).toMatchObject({
      requiredMcpServers: ["rosalind"],
      requiredOperations: ["rosalind.open", "structure.open_from_chat"],
      rosalindTasks: ["predict-kras-g12c"],
    });
    expect(structure?.fixtures).toContain("rosalind-structure-analysis:inputs/6OIM.pdb");
    expect(structure?.expectedArtifacts).toContain("rosalind-structure-analysis:outputs/structure-summary.json");

    const genomics = catalogue.find((item) => item.id === "rosalind-genomics");
    expect(genomics).toMatchObject({
      requiredMcpServers: ["rosalind"],
      requiredOperations: ["rosalind.open", "list_workflows"],
      rosalindTasks: ["analyze-airway-rnaseq"],
    });
    expect(genomics?.fixtures).toContain("rosalind-genomics:inputs/GSE52778_Dex_vs_Untreated_gene_exp.diff.gz");
    expect(genomics?.expectedArtifacts).toContain("rosalind-genomics:outputs/analysis-summary.json");

    const compute = catalogue.find((item) => item.id === "rosalind-scientific-compute");
    expect(compute).toMatchObject({
      domain: "scientific-computing",
      caseType: "analysis",
      evidenceLevel: "computed-result",
      rosalindTasks: ["embed-gb1-sequences"],
    });
    expect(compute?.fixtures).toContain("rosalind-scientific-compute:inputs/gb1-variants-first-500.csv");
    expect(compute?.expectedArtifacts).toContain("rosalind-scientific-compute:outputs/embedding-summary.json");
    expect(compute?.reproductionSteps.join(" ")).toContain("ProteinGym");
  });

  it("retains exact artifact sizes, recorded hashes, and browser-safe previews", async () => {
    const catalogue = await buildCatalogue(repositoryRoot);
    const ras = catalogue.find((item) => item.id === "sequence-ras-alignment");
    const alignment = ras?.artifacts.find((item) => item.path?.endsWith("human-RAS-UniProt-SV1.aln-fasta"));
    expect(alignment).toMatchObject({ bytes: 786, sha256: "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f", mediaType: "text/x-fasta" });
    expect(ras?.preview?.resourceUri?.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const gfp = catalogue.find((item) => item.id === "structure-gfp-figure");
    expect(gfp?.preview).toMatchObject({ bytes: 738922, mediaType: "image/png" });
  });
});

describe("scientific acceptance records", () => {
  it("derives every release metric from the pinned fixtures", async () => {
    const values = await scientificAcceptance(repositoryRoot);
    expect(values.lambda).toEqual({ codingBases: 714, residues: 237, translationMatches: true });
    expect(values.ras.alignedLength).toBe(191);
    expect(values.ras.meanIdentity).toBe(0.9284467713787081);
    expect(values.fastq).toEqual({ reads: 500, bases: 235490, q30Percent: 95.39768143020935 });
    expect(values.mdm2).toEqual({ atomContacts: 105, residuePairs: 34 });
    expect(values.gfp).toEqual({ residues: 225, atoms: 1866, contactResidues: 18 });
    expect(values.slide).toEqual({ width: 46000, height: 32893 });
    expect(values.spatial).toEqual({ observations: 684, genes: 18078, exportedRows: 684 });
    expect(values.pdl1).toEqual({ candidates: 20, topFiveRows: 5, ensemblePredictions: 25, firstCandidate: "NB13_E104Q" });
  });

  it("parses the complete 1224-file release snapshot", async () => {
    const report = await validateShowcases(repositoryRoot);
    expect(report.errors).toEqual([]);
    expect(report).toMatchObject({ ok: true, pluginCount: 7, showcaseCount: 100, fileCount: 1224 });
    expect(Object.values(report.parsedByType).reduce((sum, count) => sum + count, 0)).toBe(1224);
  });
});
