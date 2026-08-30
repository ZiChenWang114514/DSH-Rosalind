import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DatabaseService, DATABASE_PROVIDERS } from "../src/host/science/databases.js";
import { LiteratureService } from "../src/host/science/literature.js";

const session = {};
const context = (allowNetwork = true, signal = new AbortController().signal) => ({ session, signal, packageRoot: process.cwd(), allowNetwork });
const jsonFetch = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("LiteratureService", () => {
  it("constructs biorxiv requests and retains publication records", async () => {
    const service = new LiteratureService({ fetch: jsonFetch({ collection: [{ doi: "10.1101/example", published: "123456" }] }) });
    const result = await service.execute("biorxiv.request", { server: "medrxiv", action: "publication-link", doi: "10.1101/example" }, context());
    expect(result.ok).toBe(true);
    expect(result.request?.url).toContain("api.biorxiv.org/pubs/medrxiv/10.1101/example");
    expect(result.records).toHaveLength(1);
  });

  it("normalizes Entrez search IDs and refuses unapproved live calls", async () => {
    const fixture = new LiteratureService({ fetch: jsonFetch({ esearchresult: { count: "2", idlist: ["1", "2"] } }) });
    const result = await fixture.execute("entrez.request", { term: "TREM2", pageSize: 2 }, context());
    expect(result.records).toEqual(["1", "2"]);
    const blocked = await new LiteratureService().execute("pmc.request", { action: "map", params: { id: "1" } }, context(false));
    expect(blocked.error?.code).toBe("NETWORK_NOT_AUTHORIZED");
  });

  it("retrieves compact, versioned PMC Article Dataset metadata", async () => {
    const seen: string[] = [];
    const service = new LiteratureService({ fetch: async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("list-type=2")) {
        return new Response("<ListBucketResult><CommonPrefixes><Prefix>PMC3257301.1/</Prefix></CommonPrefixes></ListBucketResult>", { status: 200, headers: { "content-type": "application/xml" } });
      }
      return new Response(JSON.stringify({
        pmcid: "PMC3257301",
        version: 1,
        pmid: "22052899",
        doi: "10.1128/JVI.05638-11",
        title: "Fixture article",
        citation: "Fixture citation",
        is_pmc_openaccess: true,
        is_manuscript: false,
        is_historical_ocr: false,
        is_retracted: false,
        license_code: "CC BY",
        pdf_url: "s3://pmc-oa-opendata/articles/PMC3257301.pdf",
        xml_url: "s3://pmc-oa-opendata/articles/PMC3257301.xml",
        text_url: "s3://pmc-oa-opendata/articles/PMC3257301.txt",
        media_urls: ["s3://pmc-oa-opendata/media/figure-1.png"],
      }), { status: 200, headers: { "content-type": "application/json" } });
    } });
    const result = await service.execute("pmc.request", { action: "article-dataset", params: { id: "PMC3257301" }, maxItems: 10 }, context());
    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toContain("prefix=PMC3257301.");
    expect(seen[1]).toContain("metadata/PMC3257301.1.json");
    expect(result.records[0]).toMatchObject({ pmcid: "PMC3257301", version: 1, license_code: "CC BY", media_url_count: 1 });
    expect((result.records[0] as Record<string, unknown>).pdf_url).toBe("https://pmc-oa-opendata.s3.amazonaws.com/articles/PMC3257301.pdf");
    expect(result.pagination).toEqual({ pageSize: 10, total: 1 });
  });

  it("resolves DOI identifiers through PMC ESearch before reading cloud metadata", async () => {
    const seen: string[] = [];
    const service = new LiteratureService({ fetch: async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("esearch.fcgi")) return new Response(JSON.stringify({ esearchresult: { count: "1", idlist: ["3257301"] } }), { status: 200 });
      if (url.includes("list-type=2")) return new Response("<ListBucketResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><CommonPrefixes><Prefix>PMC3257301.1/</Prefix></CommonPrefixes></ListBucketResult>", { status: 200 });
      return new Response(JSON.stringify({ pmcid: "PMC3257301", version: 1, media_urls: [] }), { status: 200 });
    } });
    const result = await service.execute("pmc.request", { action: "article-dataset", params: { id: "10.1128/JVI.05638-11" } }, context());
    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(3);
    expect(decodeURIComponent(seen[0] ?? "")).toContain('"10.1128/JVI.05638-11"[doi]');
    expect(result.records[0]).toMatchObject({ pmcid: "PMC3257301", version: 1 });
  });

  it("strictly requires params.id for PMC and keeps caller cancellation distinct", async () => {
    const service = new LiteratureService({ fetch: jsonFetch({}) });
    const missing = await service.execute("pmc.request", { action: "article-dataset", id: "PMC3257301" }, context());
    expect(missing.error).toMatchObject({ code: "MISSING_PMC_ID" });
    const controller = new AbortController(); controller.abort();
    await expect(service.execute("entrez.request", { term: "TREM2" }, context(true, controller.signal))).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("parses TSV with record_path, applies max_depth, and only writes a new raw package file", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-rosalind-literature-"));
    try {
      const service = new LiteratureService({ fetch: async () => new Response("id\tmeta\nA\tone\nB\ttwo\n", { status: 200, headers: { "content-type": "text/tab-separated-values" } }) });
      const result = await service.execute("biorxiv.request", {
        response_format: "tsv", record_path: "records", max_items: 1, max_depth: 1,
        save_raw: true, raw_output_path: "artifacts/raw/literature.tsv",
      }, { ...context(), packageRoot: root });
      expect(result.records).toEqual([{ id: "A", meta: "one" }]);
      expect(result.request?.response_format).toBe("tsv");
      expect(result.request?.raw_output_path).toBe("artifacts/raw/literature.tsv");
      await expect(readFile(join(root, "artifacts/raw/literature.tsv"), "utf8")).resolves.toContain("id\tmeta");
      const duplicate = await service.execute("biorxiv.request", {
        save_raw: true, raw_output_path: "artifacts/raw/literature.tsv",
      }, { ...context(), packageRoot: root });
      expect(duplicate.error?.code).toBe("RAW_OUTPUT_EXISTS");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("returns a precise timeout error without treating it as user cancellation", async () => {
    const service = new LiteratureService({ fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }) });
    const result = await service.execute("biorxiv.request", { timeout_sec: 1 }, context());
    expect(result.error).toMatchObject({ code: "TIMEOUT" });
  }, 2_000);
});

describe("DatabaseService", () => {
  it("registers all 44 public database skills", () => {
    expect(DATABASE_PROVIDERS).toHaveLength(44);
    expect(DATABASE_PROVIDERS.map((provider) => provider.id)).toContain("opentargets");
    expect(DATABASE_PROVIDERS.map((provider) => provider.id)).toContain("uniprot");
  });

  it("routes a provider request with fixture data and pagination", async () => {
    const service = new DatabaseService({ fetch: jsonFetch({ results: [{ id: "P01116" }] }) });
    const result = await service.execute("database.request", { provider: "uniprot", query: { query: "gene:KRAS" }, page: 2, pageSize: 5 }, context());
    expect(result.ok).toBe(true);
    expect(result.records).toEqual([{ id: "P01116" }]);
    expect(result.pagination).toEqual({ page: 2, pageSize: 5 });
    expect(result.request?.url).toContain("page=2");
  });

  it("reports provider and HTTP errors precisely", async () => {
    await expect(new DatabaseService().execute("database.request", { provider: "unknown" }, context())).rejects.toMatchObject({ code: "UNKNOWN_DATABASE_PROVIDER" });
    const service = new DatabaseService({ fetch: jsonFetch({ message: "rate limited" }, 429) });
    const result = await service.execute("database.request", { provider: "chembl" }, context());
    expect(result.error).toMatchObject({ code: "HTTP_ERROR", status: 429 });
  });

  it("uses a GraphQL body only for providers that declare it", async () => {
    let observed: RequestInit | undefined;
    const service = new DatabaseService({ fetch: async (_url, init) => {
      observed = init;
      return new Response(JSON.stringify({ data: { target: { id: "ENSG00000133703" } } }), { status: 200 });
    } });
    const result = await service.execute("database.request", { provider: "opentargets", query: "query { target(ensemblId: \\\"ENSG00000133703\\\") { id } }" }, context());
    expect(result.ok).toBe(true);
    expect(observed?.method).toBe("POST");
    expect(String(observed?.body)).toContain("target");
  });

  it("honors form bodies, strips unsafe headers, and parses compact FASTA or TSV records", async () => {
    let observed: RequestInit | undefined;
    const service = new DatabaseService({ fetch: async (_url, init) => {
      observed = init;
      return new Response("id\tvalue\nP00533\tEGFR\n", { status: 200, headers: { "content-type": "text/tab-separated-values" } });
    } });
    const result = await service.execute("database.request", {
      provider: "string", action: "partners", identifier: "TP53",
      form_body: { required_score: 700 }, response_format: "tsv", headers: { "accept-language": "en" },
    }, context());
    expect(result.records).toEqual([{ id: "P00533", value: "EGFR" }]);
    expect(String(observed?.body)).toContain("required_score=700");
    await expect(new DatabaseService({ fetch: jsonFetch({}) }).execute("database.request", {
      provider: "uniprot", headers: { authorization: "Bearer private" },
    }, context())).rejects.toMatchObject({ code: "SENSITIVE_HEADER_NOT_ALLOWED" });
  });

  it("preserves declared text responses and compacts nested JSON by max_depth", async () => {
    const textService = new DatabaseService({ fetch: async () => new Response("plain provider response", { status: 200, headers: { "content-type": "text/plain" } }) });
    const text = await textService.execute("database.request", { provider: "uniprot", response_format: "text" }, context());
    expect(text.records).toEqual(["plain provider response"]);
    const nestedService = new DatabaseService({ fetch: jsonFetch({ results: [{ id: "P00533", details: { nested: { value: "deep" } } }] }) });
    const nested = await nestedService.execute("database.request", { provider: "uniprot", record_path: "results", max_depth: 1 }, context());
    expect(nested.records).toEqual([{ id: "P00533", details: { truncated: true } }]);
  });

  it("strictly validates BioBank Japan and gnomAD request prerequisites", async () => {
    const service = new DatabaseService({ fetch: jsonFetch({}) });
    await expect(service.execute("database.request", { provider: "biobankjapan-phewas", rsid: "rs1", variant: "10:1-A-C" }, context())).rejects.toMatchObject({ code: "INVALID_BBJ_VARIANT_INPUT" });
    await expect(service.execute("database.request", { provider: "biobankjapan-phewas", rsid: "not-an-rsid" }, context())).rejects.toMatchObject({ code: "INVALID_BBJ_VARIANT" });
    await expect(service.execute("database.request", { provider: "gnomad-graphql", identifier: "ENSG00000141510" }, context())).rejects.toMatchObject({ code: "MISSING_GRAPHQL_QUERY" });
  });

  it("reads a gnomAD query only from the package and writes raw response without overwrite", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-rosalind-database-"));
    try {
      await writeFile(join(root, "query.graphql"), "query { __typename }", "utf8");
      const service = new DatabaseService({ fetch: jsonFetch({ data: { gene: { symbol: "TP53" } } }) });
      const result = await service.execute("database.request", {
        provider: "gnomad-graphql", query_path: "query.graphql", save_raw: true, raw_output_path: "raw/gnomad.json",
      }, { ...context(), packageRoot: root });
      expect(result.records).toEqual([{ symbol: "TP53" }]);
      expect(result.request?.raw_output_path).toBe("raw/gnomad.json");
      await expect(readFile(join(root, "raw/gnomad.json"), "utf8")).resolves.toContain("TP53");
      await expect(service.execute("database.request", { provider: "gnomad-graphql", query_path: "../outside.graphql" }, { ...context(), packageRoot: root })).rejects.toMatchObject({ code: "INVALID_QUERY_PATH" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
