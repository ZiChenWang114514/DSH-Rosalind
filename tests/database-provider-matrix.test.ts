import { describe, expect, it } from "vitest";

import { DATABASE_PROVIDERS, DatabaseService } from "../src/host/science/databases.js";
import { LiteratureService } from "../src/host/science/literature.js";
import { SCIENCE_SKILL_SPECS } from "../src/host/skills.js";

const packageRoot = process.cwd();
const context = (signal = new AbortController().signal) => ({ session: {}, signal, packageRoot, allowNetwork: true });
const record = (provider: string) => ({ provider, fixture: `${provider}-native-record` });

type Fixture = { args: Record<string, unknown>; path: string; method?: "POST"; bodyFormat?: "json" | "form" | "sparql" };

/* Exact paths and request forms are asserted as supported DSH provider contracts. */
const FIXTURES: Record<string, Fixture> = {
  alphafold: { args: { operation: "prediction", identifier: "P00533" }, path: "/api/prediction/P00533" },
  bgee: { args: { query: "SELECT ?gene WHERE { ?gene ?p ?o } LIMIT 1" }, path: "/sparql/", method: "POST", bodyFormat: "sparql" },
  bindingdb: { args: { operation: "pdb", params: { pdb: "1Q0L" } }, path: "/rest/getLigandsByPDBs" },
  "biobankjapan-phewas": { args: { variant: "10:114758349-C-T" }, path: "/api/variant/10%3A114758349-C-T" },
  "biostudies-arrayexpress": { args: { operation: "arrayexpress", params: { query: "single cell" } }, path: "/biostudies/api/v1/ArrayExpress/search" },
  cbioportal: { args: { operation: "mutations", profile: "brca_tcga_mutations", body: { sampleListId: "brca_tcga_all" } }, path: "/api/molecular-profiles/brca_tcga_mutations/mutations/fetch", method: "POST", bodyFormat: "json" },
  cellxgene: { args: { operation: "collection", identifier: "db468083" }, path: "/curation/v1/collections/db468083" },
  chebi: { args: { operation: "search", params: { query: "aspirin" } }, path: "/chebi/backend/api/public/es_search/" },
  chembl: { args: { operation: "target", identifier: "CHEMBL203" }, path: "/chembl/api/data/target/CHEMBL203.json" },
  civic: { args: { query: "query { __typename }" }, path: "/api/graphql", method: "POST", bodyFormat: "json" },
  clinicaltrials: { args: { params: { "query.term": "asthma" } }, path: "/api/v2/studies" },
  "clinvar-variation": { args: { operation: "variant", identifier: "rs7903146" }, path: "/api/variants/v4/search" },
  "efo-ontology": { args: { params: { q: "asthma" } }, path: "/ols4/api/search" },
  encode: { args: { params: { type: "Experiment" } }, path: "/search/" },
  ensembl: { args: { operation: "variation", identifier: "rs7903146" }, path: "/variation/homo_sapiens/rs7903146" },
  epigraphdb: { args: { path: "meta/status" }, path: "/meta/status" },
  "eqtl-catalogue": { args: { params: { variant_id: "1_154454494_A_C" } }, path: "/eqtl/api/v3/associations" },
  eva: { args: { operation: "species" }, path: "/eva/webservices/rest/v1/meta/species/list" },
  "finngen-phewas": { args: { variant: "rs7903146" }, path: "/api/variant/rs7903146" },
  "genebass-gene-burden": { args: { operation: "gene", identifier: "ENSG00000141510" }, path: "/api/gene/ENSG00000141510" },
  "gnomad-graphql": { args: { identifier: "ENSG00000141510" }, path: "/api", method: "POST", bodyFormat: "json" },
  "gtex-eqtl": { args: { operation: "variant", variant: "1:154454494:A:C" }, path: "/api/v2/association/singleTissueEqtl" },
  "gwas-catalog": { args: { params: { efoTrait: "EFO_0000270" } }, path: "/gwas/rest/api/v2/associations" },
  "human-protein-atlas": { args: { operation: "gene", identifier: "ENSG00000141510" }, path: "/ENSG00000141510.json" },
  ipd: { args: { operation: "cell" }, path: "/cgi-bin/ipd/api/cell" },
  metabolights: { args: { operation: "study", identifier: "MTBLS1" }, path: "/metabolights/ws/studies/MTBLS1" },
  mgnify: { args: { operation: "biomes" }, path: "/metagenomics/api/v1/biomes" },
  "ncbi-clinicaltables": { args: { params: { terms: "TP53" } }, path: "/api/ncbi_genes/v3/search" },
  "ncbi-datasets": { args: { operation: "gene", identifier: "TP53" }, path: "/datasets/v2/gene/symbol/TP53" },
  "ncbi-entrez": { args: { operation: "search", term: "TREM2" }, path: "/entrez/eutils/esearch.fcgi" },
  opentargets: { args: { operation: "target-disease", target: "ENSG00000160712", disease: "MONDO_0004979" }, path: "/api/v4/graphql", method: "POST", bodyFormat: "json" },
  pharmgkb: { args: { operation: "variant", identifier: "PA166104949" }, path: "/v1/data/variant/PA166104949" },
  pride: { args: { operation: "project", identifier: "PXD000001" }, path: "/pride/ws/archive/v2/projects/PXD000001" },
  proteomexchange: { args: { operation: "dataset", identifier: "PXD000001" }, path: "/api/proxi/v0.1/datasets/PXD000001" },
  "pubchem-pug": { args: { operation: "cid", identifier: "2244" }, path: "/rest/pug/compound/cid/2244/property/Title/JSON" },
  quickgo: { args: { operation: "term", identifier: "GO:0006915" }, path: "/QuickGO/services/ontology/go/terms/GO%3A0006915" },
  "rcsb-pdb": { args: { operation: "entry", identifier: "1M17" }, path: "/rest/v1/core/entry/1M17" },
  reactome: { args: { operation: "event", identifier: "R-HSA-177929" }, path: "/ContentService/data/query/R-HSA-177929" },
  rhea: { args: { query: "SELECT ?accession WHERE { ?s ?p ?o } LIMIT 1" }, path: "/sparql", method: "POST", bodyFormat: "sparql" },
  rnacentral: { args: { operation: "xrefs", identifier: "URS0000000001" }, path: "/api/v1/rna/URS0000000001/xrefs/" },
  string: { args: { operation: "partners", identifier: "TP53" }, path: "/api/json/interaction_partners", method: "POST", bodyFormat: "form" },
  "tpmi-phewas": { args: { variant: "6:160540105-T-C" }, path: "/api/variant/6%3A160540105-T-C" },
  "ukb-topmed-phewas": { args: { variant: "10:112998590-C-T" }, path: "/UKB-TOPMed/api/variant/10%3A112998590-C-T" },
  uniprot: { args: { operation: "entry", identifier: "P00533" }, path: "/uniprotkb/P00533" },
};

function sourcePayload(provider: string): unknown {
  const item = record(provider);
  if (["bgee", "rhea"].includes(provider)) return { results: { bindings: [item] } };
  if (provider === "opentargets") return { data: { target: { associatedDiseases: { rows: [item] } } } };
  if (provider === "gnomad-graphql") return { data: { gene: item } };
  if (provider === "civic") return { data: { civic: item } };
  if (provider === "gtex-eqtl" || provider === "mgnify" || provider === "ipd" || provider === "pharmgkb" || provider === "proteomexchange" || provider === "epigraphdb") return { data: [item] };
  if (provider === "clinvar-variation" || provider === "ncbi-clinicaltables") return { display_rows: [item] };
  if (provider === "biostudies-arrayexpress") return { hits: [item] };
  if (provider === "gwas-catalog" || provider === "pride") return { _embedded: { associations: [item], projects: [item] } };
  if (provider === "chembl") return { molecules: [item], activities: [item], mechanisms: [item] };
  if (provider === "pubchem-pug") return { PropertyTable: { Properties: [item] } };
  if (provider === "clinicaltrials") return { studies: [item], nextPageToken: "fixture-next" };
  if (provider === "efo-ontology") return { response: { docs: [item] } };
  if (provider === "encode") return { "@graph": [item] };
  if (["biobankjapan-phewas", "finngen-phewas", "tpmi-phewas", "ukb-topmed-phewas"].includes(provider)) return { associations: [item] };
  if (provider === "rnacentral" || provider === "quickgo") return { results: [item] };
  if (provider === "ncbi-datasets") return { genes: [item] };
  if (provider === "ncbi-entrez") return { esearchresult: { idlist: [item] } };
  if (provider === "cellxgene") return { collections: [item] };
  if (provider === "chebi") return { results: [item] };
  return [item];
}

describe("44 fixed-version database providers", () => {
  const databaseSkills = SCIENCE_SKILL_SPECS.filter((skill) => skill.serviceId === "databases");

  it("keeps a one-to-one provider and Skill inventory", () => {
    expect(DATABASE_PROVIDERS).toHaveLength(44);
    expect(databaseSkills).toHaveLength(44);
    expect(new Set(Object.keys(FIXTURES))).toEqual(new Set(DATABASE_PROVIDERS.map((provider) => provider.id)));
    expect(new Set(DATABASE_PROVIDERS.map((provider) => provider.id))).toEqual(new Set(databaseSkills.map((skill) => skill.sourceName.replace(/-skill$/, ""))));
  });

  it.each(DATABASE_PROVIDERS.map((provider) => [provider.id, provider] as const))("%s executes its source-native path, request encoding, and response extraction", async (id, provider) => {
    const fixture = FIXTURES[id]!;
    let observedUrl = ""; let observedInit: RequestInit | undefined;
    const service = new DatabaseService({ fetch: async (input, init) => {
      observedUrl = String(input); observedInit = init;
      return new Response(JSON.stringify(sourcePayload(id)), { status: 200, headers: { "content-type": "application/json" } });
    } });
    const result = await service.execute("database.request", { provider: provider.id, ...fixture.args }, context());
    expect(result.ok).toBe(true);
    expect(result.records).toContainEqual(record(id));
    expect(result.sources[0]?.name).toBe(provider.label);
    expect(new URL(observedUrl).pathname).toBe(fixture.path);
    expect(observedInit?.method).toBe(fixture.method ?? "GET");
    expect(result.request?.bodyFormat).toBe(fixture.bodyFormat);
    if (id === "opentargets") expect(String(observedInit?.body)).toContain("TargetDiseases");
    if (id === "gtex-eqtl") expect(observedUrl).toContain("variantId=chr1_154454494_A_C_b38");
    if (id === "string") expect(String(observedInit?.body)).toContain("caller_identity=dsh-rosalind");
  });

  it("reports cancellation before any provider fetch", async () => {
    const controller = new AbortController(); controller.abort(new Error("fixture cancellation"));
    let called = false;
    const service = new DatabaseService({ fetch: async () => { called = true; return new Response("{}"); } });
    await expect(service.execute("database.request", { provider: "uniprot" }, context(controller.signal))).rejects.toMatchObject({ code: "CANCELLED" });
    expect(called).toBe(false);
  });

  it("uses the fixed eQTL Catalogue v3 dataset-scoped associations route", async () => {
    let observedUrl = "";
    const service = new DatabaseService({ fetch: async (input) => {
      observedUrl = String(input);
      return new Response(JSON.stringify({ associations: [{ id: "fixture-association" }] }), { status: 200 });
    } });
    const result = await service.execute("database.request", {
      provider: "eqtl-catalogue", action: "dataset", dataset: "QTD000001",
    }, context());
    expect(result.ok).toBe(true);
    expect(new URL(observedUrl).pathname).toBe("/eqtl/api/v3/datasets/QTD000001/associations");
  });

  it("rejects arbitrary HTTPS origins before a provider request is sent", async () => {
    let called = false;
    const service = new DatabaseService({ fetch: async () => { called = true; return new Response("{}"); } });
    await expect(service.execute("database.request", {
      provider: "uniprot", path: "https://example.com/uniprotkb/P00533",
    }, context())).rejects.toMatchObject({ code: "INVALID_PROVIDER_ORIGIN" });
    expect(called).toBe(false);
  });

  it("allows a declared official alternate origin such as RCSB Search", async () => {
    let observedUrl = "";
    const service = new DatabaseService({ fetch: async (input) => {
      observedUrl = String(input);
      return new Response(JSON.stringify({ result_set: [{ identifier: "1M17" }] }), { status: 200 });
    } });
    const result = await service.execute("database.request", {
      provider: "rcsb-pdb", action: "search", body: { query: { type: "terminal" }, return_type: "entry" },
    }, context());
    expect(result.ok).toBe(true);
    expect(new URL(observedUrl).origin).toBe("https://search.rcsb.org");
  });
});

describe("three fixed-version literature providers", () => {
  it.each([["biorxiv", { provider: "biorxiv", doi: "10.1101/fixture", action: "details" }], ["entrez", { provider: "entrez", query: "TREM2", pageSize: 2 }], ["pmc", { provider: "pmc", id: "PMC000000", action: "map" }]] as const)("%s executes through a provenance-bearing request", async (provider, args) => {
    const service = new LiteratureService({ fetch: async () => new Response(JSON.stringify({ records: [{ id: `${provider}-fixture` }] }), { status: 200, headers: { "content-type": "application/json" } }) });
    const result = await service.execute("literature.request", args, context());
    expect(result.ok).toBe(true); expect(result.sources).toHaveLength(1); expect(result.request?.method).toBe("GET");
  });
});
