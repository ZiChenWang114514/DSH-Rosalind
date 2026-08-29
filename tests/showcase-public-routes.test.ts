import type { JsonValue } from "@deepseek-ai/dsh-tools";
import { describe, expect, it } from "vitest";

import { SHOWCASES } from "../src/generated/catalog.js";
import { reproduceShowcase } from "../src/host/reproduction.js";
import type { ScienceExecutionContext, ScienceExecutor } from "../src/host/science-tools.js";

interface ExpectedStep {
  serviceId: "literature" | "databases";
  operation: "entrez.request" | "pmc.request" | "biorxiv.request" | "database.request";
  args: Record<string, unknown>;
}

const routes: Record<string, ExpectedStep[]> = {
  "literature-trem2-landscape": [
    { serviceId: "literature", operation: "entrez.request", args: { provider: "ncbi-entrez", action: "search", identifier: "TREM2[Title/Abstract] AND microglia[Title/Abstract]", term: "TREM2[Title/Abstract] AND microglia[Title/Abstract]", db: "pubmed", sort: "pub date", pageSize: 10, params: { retmax: 10, sort: "pub date" } } },
    { serviceId: "literature", operation: "entrez.request", args: { provider: "ncbi-entrez", action: "summary", identifier: "42437587,42341895,41467385,42570638,42396649,42342036,42288287,42160848,42102578,42632547", params: { db: "pubmed", retmode: "json" } } },
    { serviceId: "literature", operation: "biorxiv.request", args: { provider: "biorxiv", action: "details", identifier: "10.1101/2025.03.28.646038", server: "biorxiv", params: { max_items: 10 } } },
    { serviceId: "literature", operation: "biorxiv.request", args: { provider: "biorxiv", action: "publication-link", identifier: "10.1101/2025.03.28.646038", server: "biorxiv", params: { max_items: 10 } } },
  ],
  "literature-pmc-availability": [
    { serviceId: "literature", operation: "pmc.request", args: { provider: "ncbi-pmc", action: "article-dataset", identifier: "PMC3257301", id: "PMC3257301", params: { id: "PMC3257301", max_items: 10 } } },
  ],
  "literature-preprint-publication-link": [
    { serviceId: "literature", operation: "biorxiv.request", args: { provider: "biorxiv", action: "details", identifier: "10.1101/2020.09.09.20191205", server: "medrxiv", params: { max_items: 10 } } },
    { serviceId: "literature", operation: "biorxiv.request", args: { provider: "biorxiv", action: "publication-link", identifier: "10.1101/2020.09.09.20191205", server: "medrxiv", params: { max_items: 10 } } },
    { serviceId: "literature", operation: "entrez.request", args: { provider: "ncbi-entrez", action: "search", identifier: "10.1038/s41467-021-21444-5", term: "10.1038/s41467-021-21444-5[DOI]", params: { retmax: 10 } } },
    { serviceId: "literature", operation: "entrez.request", args: { provider: "ncbi-entrez", action: "summary", identifier: "33608522", id: "33608522", params: { db: "pubmed", retmode: "json" } } },
  ],
  "databases-il6r-asthma": [
    { serviceId: "databases", operation: "database.request", args: { provider: "opentargets", action: "query", operation: "associated-diseases", identifier: "ENSG00000160712", target: "ENSG00000160712", disease: "MONDO_0004979", pageSize: 200, variables: { ensemblId: "ENSG00000160712", index: 0, size: 200 }, params: { diseaseId: "MONDO_0004979" } } },
    { serviceId: "databases", operation: "database.request", args: { provider: "gwas-catalog", action: "fetch", operation: "associations", identifier: "IL6R", pageSize: 10, params: { mapped_gene: "IL6R", size: 10 } } },
    { serviceId: "databases", operation: "database.request", args: { provider: "gtex-eqtl", action: "variant", operation: "variant", identifier: "1:154454494-A-C", variant: "1:154454494-A-C", gene: "ENSG00000160712", params: { variantId: "chr1_154454494_A_C_b38" } } },
  ],
  "databases-variant-interpretation": [
    { serviceId: "databases", operation: "database.request", args: { provider: "clinvar-variation", action: "search", operation: "search", identifier: "rs7903146", terms: "rs7903146", params: { terms: "rs7903146", maxList: 10 } } },
    { serviceId: "databases", operation: "database.request", args: { provider: "ensembl", action: "fetch", operation: "variation", identifier: "rs7903146", params: { "content-type": "application/json" } } },
    { serviceId: "databases", operation: "database.request", args: { provider: "ukb-topmed-phewas", action: "variant", operation: "variant", identifier: "10:112998590-C-T", variant: "10:112998590-C-T", params: { max_results: 10 } } },
    { serviceId: "databases", operation: "database.request", args: { provider: "gnomad-graphql", action: "query", operation: "variant", identifier: "10-112998590-C-T", dataset: "gnomad_r4", variables: { variantId: "10-112998590-C-T", dataset: "gnomad_r4" }, params: { max_items: 5 } } },
  ],
  "databases-egfr-landscape": [
    { serviceId: "databases", operation: "database.request", args: { provider: "uniprot", action: "fetch", operation: "entry", identifier: "P00533", params: { format: "json" } } },
    { serviceId: "databases", operation: "database.request", args: { provider: "chembl", action: "fetch", operation: "target", identifier: "CHEMBL203", params: {} } },
    { serviceId: "databases", operation: "database.request", args: { provider: "chembl", action: "fetch", operation: "mechanism", identifier: "CHEMBL203", pageSize: 10, params: { target_chembl_id: "CHEMBL203", limit: 10 } } },
    { serviceId: "databases", operation: "database.request", args: { provider: "chembl", action: "fetch", operation: "molecule", identifier: "CHEMBL939", params: {} } },
    { serviceId: "databases", operation: "database.request", args: { provider: "chembl", action: "fetch", operation: "molecule", identifier: "CHEMBL553", params: {} } },
    { serviceId: "databases", operation: "database.request", args: { provider: "chembl", action: "fetch", operation: "molecule", identifier: "CHEMBL3353410", params: {} } },
    { serviceId: "databases", operation: "database.request", args: { provider: "rcsb-pdb", action: "fetch", operation: "entry", identifier: "1M17", params: {} } },
    { serviceId: "databases", operation: "database.request", args: { provider: "reactome", action: "fetch", operation: "pathways", identifier: "P00533", pageSize: 10, params: { species: "Homo sapiens" } } },
  ],
};

class StrictExecutor implements ScienceExecutor {
  readonly calls: Array<{ serviceId: string; operation: string; args: Record<string, unknown> }> = [];

  constructor(
    private readonly expected: ExpectedStep[],
    private readonly failAt?: number,
    private readonly expectedAllowNetwork = true,
  ) {}

  async execute(serviceId: string, operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<Record<string, JsonValue>> {
    const index = this.calls.length;
    const expected = this.expected[index];
    expect(expected, `unexpected call ${index + 1}`).toBeDefined();
    expect(serviceId).toBe(expected?.serviceId);
    expect(operation).toBe(expected?.operation);
    expect(args).toMatchObject(expected?.args ?? {});
    expect(args.provider).toBeTypeOf("string");
    expect(args.action).toBeTypeOf("string");
    expect(args.identifier).toBeTypeOf("string");
    expect(args.params).toEqual(expect.any(Object));
    expect(context.allowNetwork).toBe(this.expectedAllowNetwork);
    this.calls.push({ serviceId, operation, args });
    if (index === this.failAt) {
      return { status: "completed", ok: false, error: { code: "TEST_SOURCE_FAILURE", message: "Required public source failed." } };
    }
    return { status: "completed", ok: true, provider: String(args.provider) };
  }
}

function showcase(id: string) {
  const item = SHOWCASES.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing showcase ${id}.`);
  return item;
}

async function executeRoute(id: string, failAt?: number, allowNetwork = true) {
  const item = showcase(id);
  const expected = routes[id]!;
  const executor = new StrictExecutor(expected, failAt, allowNetwork);
  const result = await reproduceShowcase(item, item.recipe.providerIds[0]!, executor, {
    session: {}, signal: new AbortController().signal, packageRoot: process.cwd(), allowNetwork,
  });
  return { item, expected, executor, result };
}

describe("public showcase reproduction routes", () => {
  for (const id of Object.keys(routes)) {
    it(`${id} calls every documented public source in order`, async () => {
      const { item, expected, executor, result } = await executeRoute(id);
      expect(result.status).toBe("completed");
      expect(result.steps).toHaveLength(expected.length);
      expect(executor.calls).toHaveLength(expected.length);
      expect([...new Set(executor.calls.map((call) => String(call.args.provider)))]).toEqual(item.recipe.providerIds);
    });

    it(`${id} completes only after every required source succeeds`, async () => {
      for (let failAt = 0; failAt < routes[id]!.length; failAt += 1) {
        const { executor, result } = await executeRoute(id, failAt);
        expect(result.status, `failure at step ${failAt + 1}`).toBe("failed");
        expect(result.error?.code).toBe("TEST_SOURCE_FAILURE");
        expect(result.steps).toHaveLength(failAt + 1);
        expect(executor.calls).toHaveLength(failAt + 1);
      }
    });
  }

  it("forwards network authorization without enabling it inside a route", async () => {
    const { executor, result } = await executeRoute("literature-pmc-availability", 0, false);
    expect(executor.calls).toHaveLength(1);
    expect(result.status).toBe("failed");
  });
});
