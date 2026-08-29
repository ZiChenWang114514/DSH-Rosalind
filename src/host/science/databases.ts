import { ScienceServiceError, type FetchLike, type JsonRecord, type ScienceExecutionContext } from "./literature.js";

/** Public-source request adapters for the fixed 0.1.5 database Skills. */
export interface DatabaseProvider {
  id: string;
  label: string;
  baseUrl: string;
  defaultPath: string;
  method?: "GET" | "POST";
  graphql?: boolean;
  requestStyle: "query" | "json" | "form" | "sparql";
  recordPaths: readonly string[];
  pagination: "page" | "page-size" | "offset" | "cursor" | "none";
}

export interface DatabaseResult {
  ok: boolean;
  provider: string;
  operation: string;
  records: unknown[];
  sources: Array<{ name: string; url: string; checkedAt: string }>;
  pagination?: { page: number; pageSize: number; nextCursor?: string; total?: number };
  diagnostics: string[];
  request?: { method: string; url: string; bodyFormat?: "json" | "form" | "sparql" };
  error?: { code: string; message: string; status?: number };
}

type Route = { path: string; method?: "GET" | "POST"; style?: DatabaseProvider["requestStyle"]; recordPaths?: readonly string[] };
type ProviderDefinition = DatabaseProvider & { routes?: Readonly<Record<string, Route>> };

const PROVIDER_DEFINITIONS: readonly ProviderDefinition[] = [
  { id: "alphafold", label: "AlphaFold Protein Structure Database", baseUrl: "https://alphafold.ebi.ac.uk/api", defaultPath: "prediction/", requestStyle: "query", recordPaths: [""], pagination: "none", routes: { prediction: { path: "prediction/" }, uniprot: { path: "uniprot/summary/" }, annotations: { path: "annotations/" }, sequence: { path: "sequence/summary" } } },
  { id: "bgee", label: "Bgee", baseUrl: "https://www.bgee.org/sparql/", defaultPath: "", method: "POST", requestStyle: "sparql", recordPaths: ["results.bindings"], pagination: "none" },
  { id: "bindingdb", label: "BindingDB", baseUrl: "https://bindingdb.org", defaultPath: "rest/getLigandsByUniprots", requestStyle: "query", recordPaths: ["", "results", "records"], pagination: "none", routes: { pdb: { path: "rest/getLigandsByPDBs" }, uniprot: { path: "rest/getLigandsByUniprots" }, smiles: { path: "rest/getLigandsBySmiles" }, compound: { path: "rest/getTargetsByCompound" } } },
  { id: "biobankjapan-phewas", label: "BioBank Japan PheWAS", baseUrl: "https://pheweb.jp", defaultPath: "api/variant/", requestStyle: "query", recordPaths: ["associations", "results", ""], pagination: "none" },
  { id: "biostudies-arrayexpress", label: "BioStudies / ArrayExpress", baseUrl: "https://www.ebi.ac.uk/biostudies/api/v1", defaultPath: "search", requestStyle: "query", recordPaths: ["hits", "results", ""], pagination: "page-size", routes: { arrayexpress: { path: "ArrayExpress/search", recordPaths: ["hits"] }, study: { path: "studies/" } } },
  { id: "cbioportal", label: "cBioPortal", baseUrl: "https://www.cbioportal.org/api", defaultPath: "studies", requestStyle: "query", recordPaths: ["", "studies"], pagination: "page-size", routes: { mutations: { path: "molecular-profiles/{profile}/mutations/fetch", method: "POST", style: "json" } } },
  { id: "cellxgene", label: "CELLxGENE Discover", baseUrl: "https://api.cellxgene.cziscience.com/curation/v1", defaultPath: "collections", requestStyle: "query", recordPaths: ["collections", ""], pagination: "none", routes: { collection: { path: "collections/" } } },
  { id: "chebi", label: "ChEBI", baseUrl: "https://www.ebi.ac.uk", defaultPath: "chebi/backend/api/public/es_search/", requestStyle: "query", recordPaths: ["results", ""], pagination: "page-size", routes: { compound: { path: "chebi/backend/api/public/compound/" }, search: { path: "chebi/backend/api/public/es_search/" } } },
  { id: "chembl", label: "ChEMBL", baseUrl: "https://www.ebi.ac.uk/chembl/api/data", defaultPath: "molecule/search.json", requestStyle: "query", recordPaths: ["molecules", "activities", "mechanisms", ""], pagination: "offset", routes: { target: { path: "target/" }, molecule: { path: "molecule/" }, activity: { path: "activity.json", recordPaths: ["activities"] }, mechanism: { path: "mechanism.json", recordPaths: ["mechanisms"] }, search: { path: "molecule/search.json", recordPaths: ["molecules"] } } },
  { id: "civic", label: "CIViC", baseUrl: "https://civicdb.org/api/graphql", defaultPath: "", method: "POST", graphql: true, requestStyle: "json", recordPaths: ["data.civic", "data", ""], pagination: "none" },
  { id: "clinicaltrials", label: "ClinicalTrials.gov", baseUrl: "https://clinicaltrials.gov/api/v2", defaultPath: "studies", requestStyle: "query", recordPaths: ["studies", ""], pagination: "cursor", routes: { metadata: { path: "studies/metadata" }, searchareas: { path: "studies/search-areas", recordPaths: ["areas"] }, enums: { path: "studies/enums", recordPaths: ["enums"] } } },
  { id: "clinvar-variation", label: "ClinVar", baseUrl: "https://clinicaltables.nlm.nih.gov/api/variants/v4", defaultPath: "search", requestStyle: "query", recordPaths: ["display_rows", "records", ""], pagination: "none", routes: { vcv: { path: "https://api.ncbi.nlm.nih.gov/variation/v0/beta/vcv/" }, rcv: { path: "https://api.ncbi.nlm.nih.gov/variation/v0/beta/rcv/" }, scv: { path: "https://api.ncbi.nlm.nih.gov/variation/v0/beta/scv/" }, refsnp: { path: "https://api.ncbi.nlm.nih.gov/variation/v0/beta/refsnp/" } } },
  { id: "efo-ontology", label: "Experimental Factor Ontology", baseUrl: "https://www.ebi.ac.uk/ols4/api", defaultPath: "search", requestStyle: "query", recordPaths: ["response.docs", "_embedded.terms", ""], pagination: "page-size", routes: { term: { path: "ontologies/efo/terms/" } } },
  { id: "encode", label: "ENCODE", baseUrl: "https://www.encodeproject.org", defaultPath: "search/", requestStyle: "query", recordPaths: ["@graph", ""], pagination: "page-size" },
  { id: "ensembl", label: "Ensembl", baseUrl: "https://rest.ensembl.org", defaultPath: "lookup/id/", requestStyle: "query", recordPaths: ["", "data"], pagination: "none", routes: { variation: { path: "variation/homo_sapiens/" }, lookup: { path: "lookup/id/" }, xrefs: { path: "xrefs/id/" }, overlap: { path: "overlap/region/homo_sapiens/" } } },
  { id: "epigraphdb", label: "EpiGraphDB", baseUrl: "https://api.epigraphdb.org", defaultPath: "", requestStyle: "query", recordPaths: ["data", "results", ""], pagination: "none" },
  { id: "eqtl-catalogue", label: "eQTL Catalogue", baseUrl: "https://www.ebi.ac.uk/eqtl/api/v3", defaultPath: "associations", requestStyle: "query", recordPaths: ["results", "associations", ""], pagination: "page-size", routes: { dataset: { path: "datasets/{dataset}/associations" }, associations: { path: "associations" } } },
  { id: "eva", label: "European Variation Archive", baseUrl: "https://www.ebi.ac.uk/eva/webservices/rest/v1", defaultPath: "meta/species/list", requestStyle: "query", recordPaths: ["response.docs", "", "data"], pagination: "none", routes: { species: { path: "meta/species/list" }, identifiers: { path: "https://www.ebi.ac.uk/eva/webservices/identifiers/v1/" } } },
  { id: "finngen-phewas", label: "FinnGen PheWAS", baseUrl: "https://r12.finngen.fi", defaultPath: "api/variant/", requestStyle: "query", recordPaths: ["associations", "results", ""], pagination: "none" },
  { id: "genebass-gene-burden", label: "Genebass", baseUrl: "https://main.genebass.org/api", defaultPath: "gene/", requestStyle: "query", recordPaths: ["results", "phenotypes", ""], pagination: "none" },
  { id: "gnomad-graphql", label: "gnomAD", baseUrl: "https://gnomad.broadinstitute.org/api", defaultPath: "", method: "POST", graphql: true, requestStyle: "json", recordPaths: ["data.gene", "data", ""], pagination: "none" },
  { id: "gtex-eqtl", label: "GTEx", baseUrl: "https://gtexportal.org/api/v2", defaultPath: "association/singleTissueEqtl", requestStyle: "query", recordPaths: ["data", "eqtls", ""], pagination: "page", routes: { variant: { path: "association/singleTissueEqtl", recordPaths: ["data"] } } },
  { id: "gwas-catalog", label: "GWAS Catalog", baseUrl: "https://www.ebi.ac.uk/gwas/rest/api/v2", defaultPath: "associations", requestStyle: "query", recordPaths: ["_embedded.associations", "associations", ""], pagination: "page-size" },
  { id: "human-protein-atlas", label: "Human Protein Atlas", baseUrl: "https://www.proteinatlas.org", defaultPath: "search_download.php", requestStyle: "query", recordPaths: ["", "results"], pagination: "none", routes: { gene: { path: "" }, tissue: { path: "search/tissue/" }, cellline: { path: "search/cellline/" } } },
  { id: "ipd", label: "IPD", baseUrl: "https://www.ebi.ac.uk/cgi-bin/ipd/api", defaultPath: "allele", requestStyle: "query", recordPaths: ["data", "results", ""], pagination: "none", routes: { cell: { path: "cell" }, download: { path: "allele/download" } } },
  { id: "metabolights", label: "MetaboLights", baseUrl: "https://www.ebi.ac.uk/metabolights/ws", defaultPath: "studies", requestStyle: "query", recordPaths: ["content", "studies", ""], pagination: "page-size", routes: { study: { path: "studies/" } } },
  { id: "mgnify", label: "MGnify", baseUrl: "https://www.ebi.ac.uk/metagenomics/api/v1", defaultPath: "studies", requestStyle: "query", recordPaths: ["data", ""], pagination: "page-size", routes: { samples: { path: "samples" }, biomes: { path: "biomes" } } },
  { id: "ncbi-clinicaltables", label: "NCBI Clinical Tables", baseUrl: "https://clinicaltables.nlm.nih.gov/api/ncbi_genes/v3", defaultPath: "search", requestStyle: "query", recordPaths: ["display_rows", ""], pagination: "none" },
  { id: "ncbi-datasets", label: "NCBI Datasets", baseUrl: "https://api.ncbi.nlm.nih.gov/datasets/v2", defaultPath: "gene/symbol/", requestStyle: "query", recordPaths: ["genes", "reports", ""], pagination: "page-size", routes: { gene: { path: "gene/symbol/" }, genome: { path: "genome/accession/" }, taxonomy: { path: "taxonomy/taxon/" } } },
  { id: "ncbi-entrez", label: "NCBI Entrez", baseUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils", defaultPath: "esearch.fcgi", requestStyle: "query", recordPaths: ["esearchresult.idlist", "result", ""], pagination: "page-size", routes: { summary: { path: "esummary.fcgi" }, fetch: { path: "efetch.fcgi" }, links: { path: "elink.fcgi" } } },
  { id: "opentargets", label: "Open Targets Platform", baseUrl: "https://api.platform.opentargets.org/api/v4/graphql", defaultPath: "", method: "POST", graphql: true, requestStyle: "json", recordPaths: ["data.target.associatedDiseases.rows", "data.target", "data", ""], pagination: "page" },
  { id: "pharmgkb", label: "PharmGKB", baseUrl: "https://api.clinpgx.org/v1/data", defaultPath: "gene/", requestStyle: "query", recordPaths: ["data", ""], pagination: "page-size", routes: { variant: { path: "variant/" }, clinicalannotation: { path: "clinicalAnnotation" }, dosingguideline: { path: "dosingGuideline" } } },
  { id: "pride", label: "PRIDE Archive", baseUrl: "https://www.ebi.ac.uk/pride/ws/archive/v2", defaultPath: "projects", requestStyle: "query", recordPaths: ["_embedded.projects", "projects", ""], pagination: "page-size", routes: { project: { path: "projects/" } } },
  { id: "proteomexchange", label: "ProteomeXchange", baseUrl: "https://proteomecentral.proteomexchange.org/api/proxi/v0.1", defaultPath: "datasets", requestStyle: "query", recordPaths: ["data", "datasets", ""], pagination: "page-size", routes: { dataset: { path: "datasets/" }, library: { path: "libraries" }, peptidoform: { path: "peptidoforms" } } },
  { id: "pubchem-pug", label: "PubChem", baseUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug", defaultPath: "compound/name/", requestStyle: "query", recordPaths: ["PropertyTable.Properties", "InformationList.Information", ""], pagination: "none", routes: { cid: { path: "compound/cid/" }, property: { path: "compound/cid/" }, name: { path: "compound/name/" } } },
  { id: "quickgo", label: "QuickGO", baseUrl: "https://www.ebi.ac.uk/QuickGO/services", defaultPath: "ontology/go/search", requestStyle: "query", recordPaths: ["results", ""], pagination: "page-size", routes: { term: { path: "ontology/go/terms/" }, annotation: { path: "annotation/search" } } },
  { id: "rcsb-pdb", label: "RCSB Protein Data Bank", baseUrl: "https://data.rcsb.org/rest/v1", defaultPath: "core/entry/", requestStyle: "query", recordPaths: ["", "result_set"], pagination: "none", routes: { entry: { path: "core/entry/" }, assembly: { path: "core/assembly/" }, search: { path: "https://search.rcsb.org/rcsbsearch/v2/query", method: "POST", style: "json", recordPaths: ["result_set"] }, fasta: { path: "https://www.rcsb.org/fasta/entry/" } } },
  { id: "reactome", label: "Reactome", baseUrl: "https://reactome.org/ContentService", defaultPath: "search/query", requestStyle: "query", recordPaths: ["results", "entries", ""], pagination: "none", routes: { event: { path: "data/query/" }, participants: { path: "data/participants/" }, pathways: { path: "data/pathways/low/entity/" } } },
  { id: "rhea", label: "Rhea", baseUrl: "https://sparql.rhea-db.org", defaultPath: "sparql", method: "POST", requestStyle: "sparql", recordPaths: ["results.bindings"], pagination: "none" },
  { id: "rnacentral", label: "RNAcentral", baseUrl: "https://rnacentral.org/api/v1", defaultPath: "rna/", requestStyle: "query", recordPaths: ["results", ""], pagination: "page-size", routes: { rna: { path: "rna/" }, xrefs: { path: "rna/{id}/xrefs/" } } },
  { id: "string", label: "STRING", baseUrl: "https://string-db.org/api/json", defaultPath: "network", method: "POST", requestStyle: "form", recordPaths: [""], pagination: "none", routes: { partners: { path: "interaction_partners" }, enrichment: { path: "enrichment" } } },
  { id: "tpmi-phewas", label: "TPMI PheWAS", baseUrl: "https://pheweb.ibms.sinica.edu.tw", defaultPath: "api/variant/", requestStyle: "query", recordPaths: ["associations", "results", ""], pagination: "none" },
  { id: "ukb-topmed-phewas", label: "UKB-TOPMed PheWAS", baseUrl: "https://pheweb.org/UKB-TOPMed", defaultPath: "api/variant/", requestStyle: "query", recordPaths: ["associations", "results", ""], pagination: "none" },
  { id: "uniprot", label: "UniProt", baseUrl: "https://rest.uniprot.org", defaultPath: "uniprotkb/search", requestStyle: "query", recordPaths: ["results", ""], pagination: "page-size", routes: { entry: { path: "uniprotkb/" }, search: { path: "uniprotkb/search" }, uniref: { path: "uniref/" }, uniparc: { path: "uniparc/search" }, stream: { path: "uniprotkb/stream" } } },
] as const;

export const DATABASE_PROVIDERS: readonly DatabaseProvider[] = PROVIDER_DEFINITIONS;

function asRecord(value: unknown): JsonRecord | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined; }
function stringValue(value: unknown): string | undefined { if (typeof value === "string" && value.trim()) return value.trim(); if (typeof value === "number") return String(value); return undefined; }
function integer(value: unknown, fallback: number, max: number): number { const parsed = typeof value === "number" ? value : Number(value); return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : fallback; }
function safePath(value: unknown): string { if (typeof value !== "string" || !value.trim()) return ""; const trimmed = value.trim(); if (trimmed.includes("..")) throw new ScienceServiceError("INVALID_PATH", "Provider paths may not contain '..'."); if (/^https:\/\//.test(trimmed)) return trimmed; if (trimmed.includes("://")) throw new ScienceServiceError("INVALID_PATH", "Provider paths must be relative or use HTTPS."); return trimmed.replace(/^\/+/, ""); }
function getPath(value: unknown, dottedPath: string): unknown { if (!dottedPath) return value; return dottedPath.split(".").reduce<unknown>((current, key) => asRecord(current)?.[key], value); }
function recordsFrom(payload: unknown, paths: readonly string[]): unknown[] { if (Array.isArray(payload)) return payload; for (const path of paths) { const selected = getPath(payload, path); if (Array.isArray(selected)) return selected; if (selected && path && typeof selected === "object") return [selected]; } return payload === null || payload === undefined ? [] : [payload]; }
function identifier(args: JsonRecord): string | undefined { return stringValue(args.identifier) ?? stringValue(args.id) ?? stringValue(args.accession) ?? stringValue(args.variant) ?? stringValue(args.target) ?? stringValue(args.gene); }
function operationName(args: JsonRecord): string { return (stringValue(args.operation) ?? stringValue(args.action) ?? "").toLowerCase().replace(/[-_]/g, ""); }
function replaceTemplate(path: string, id: string | undefined, args: JsonRecord): string { return path.replace(/\{([^}]+)\}/g, (_match, key: string) => encodeURIComponent(stringValue(args[key]) ?? (key === "id" ? id ?? "" : ""))); }
function appendIdentifier(path: string, id: string | undefined): string { return id && /\/$/.test(path) ? `${path}${encodeURIComponent(id)}` : path; }
function joinUrl(baseUrl: string, path: string): URL { if (!path) return new URL(baseUrl); return /^https:\/\//.test(path) ? new URL(path) : new URL(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`); }
function providerOrigins(provider: ProviderDefinition): Set<string> {
  const origins = new Set([new URL(provider.baseUrl).origin]);
  for (const route of Object.values(provider.routes ?? {})) {
    if (/^https:\/\//.test(route.path)) origins.add(new URL(route.path).origin);
  }
  return origins;
}
function validateProviderUrl(provider: ProviderDefinition, url: URL): void {
  if (url.protocol !== "https:" || !providerOrigins(provider).has(url.origin)) {
    throw new ScienceServiceError("INVALID_PROVIDER_ORIGIN", `${provider.label} requests must use one of its declared official HTTPS origins.`);
  }
}
function setIfMissing(params: URLSearchParams, key: string, value: string): void { if (!params.has(key)) params.set(key, value); }
function collectParameters(args: JsonRecord): URLSearchParams { const params = new URLSearchParams(); const supplied = asRecord(args.params) ?? (typeof args.query === "object" ? asRecord(args.query) : undefined); if (supplied) for (const [key, value] of Object.entries(supplied)) if (value !== null && value !== undefined && typeof value !== "object") params.set(key, String(value)); return params; }
function gtexVariant(args: JsonRecord): string | undefined { const raw = identifier(args); if (!raw) return undefined; if (/^chr.+_b38$/i.test(raw)) return raw; const match = raw.replace(/^chr/i, "").match(/^([^:_-]+)[:_-](\d+)[:_-]([A-Za-z]+)[:_-]([A-Za-z]+)$/); return match ? `chr${match[1]!}_${match[2]!}_${match[3]!.toUpperCase()}_${match[4]!.toUpperCase()}_b38` : raw; }
function graphqlQuery(provider: DatabaseProvider, args: JsonRecord, page: number, pageSize: number): { query: string; variables: JsonRecord } { const explicit = stringValue(args.query); const variables = asRecord(args.variables) ?? {}; if (explicit) return { query: explicit, variables }; if (provider.id === "opentargets") { const target = stringValue(args.target) ?? stringValue(args.ensemblId) ?? ""; const disease = stringValue(args.disease) ?? stringValue(args.diseaseId) ?? ""; return { query: "query TargetDiseases($ensemblId: String!, $index: Int!, $size: Int!) { target(ensemblId: $ensemblId) { id approvedSymbol associatedDiseases(page: {index: $index, size: $size}) { rows { disease { id name } score } } } }", variables: { ensemblId: target, index: page, size: pageSize, ...(disease ? { diseaseId: disease } : {}), ...variables } }; } if (provider.id === "gnomad-graphql") return { query: "query Gene($geneId: String!) { gene(gene_id: $geneId, reference_genome: GRCh38) { gene_id symbol } }", variables: { geneId: identifier(args) ?? "", ...variables } }; return { query: "query Civic { __typename }", variables }; }
function sourceRoute(provider: ProviderDefinition, args: JsonRecord): Route { const requestedPath = safePath(args.path); if (requestedPath) return { path: requestedPath, method: stringValue(args.method)?.toUpperCase() === "POST" ? "POST" : "GET", style: provider.requestStyle }; const operation = operationName(args); return provider.routes?.[operation] ?? provider.routes?.[operation.replace(/s$/, "")] ?? { path: provider.defaultPath }; }
function plannedPath(provider: ProviderDefinition, route: Route, args: JsonRecord): string { const id = identifier(args); let path = replaceTemplate(route.path, id, args); const operation = operationName(args); if (/\{[^}]+\}/.test(route.path)) return path; const variantProviders = new Set(["biobankjapan-phewas", "finngen-phewas", "tpmi-phewas", "ukb-topmed-phewas"]); if (variantProviders.has(provider.id) && id) return appendIdentifier(path, id); const identifierRoutes = new Set(["entry", "target", "molecule", "gene", "study", "project", "collection", "compound", "term", "event", "participants", "pathways", "rna", "xrefs", "vcv", "rcv", "scv", "refsnp", "prediction", "uniprot", "annotations", "lookup", "variation", "variant", "overlap", "assembly", "dataset", "cid", "name", "fasta"]); if (!identifierRoutes.has(operation)) return path; if (provider.id === "chembl" && ["target", "molecule"].includes(operation) && id) return `${path.replace(/\/$/, "")}/${encodeURIComponent(id)}.json`; if (provider.id === "uniprot" && operation === "entry" && id) return `${path}${encodeURIComponent(id)}`; if (provider.id === "human-protein-atlas" && operation === "gene" && id) return `${encodeURIComponent(id)}.json`; if (provider.id === "pubchem-pug" && operation === "cid" && id) return `${path}${encodeURIComponent(id)}/property/Title/JSON`; if (provider.id === "rcsb-pdb" && operation === "fasta" && id) return `${path}${encodeURIComponent(id)}/download`; return appendIdentifier(path, id); }
function addPagination(provider: DatabaseProvider, params: URLSearchParams, page: number, pageSize: number): void { switch (provider.pagination) { case "page": setIfMissing(params, "page", String(page)); setIfMissing(params, provider.id === "gtex-eqtl" ? "itemsPerPage" : "pageSize", String(pageSize)); break; case "page-size": setIfMissing(params, "page", String(page)); setIfMissing(params, "pageSize", String(pageSize)); break; case "offset": setIfMissing(params, "offset", String(page * pageSize)); setIfMissing(params, "limit", String(pageSize)); break; case "cursor": setIfMissing(params, "pageSize", String(pageSize)); break; default: break; } }
function adaptParameters(provider: DatabaseProvider, args: JsonRecord, params: URLSearchParams, page: number, pageSize: number): void { const id = identifier(args); const op = operationName(args); addPagination(provider, params, page, pageSize); if (provider.id === "gtex-eqtl" && id) setIfMissing(params, "variantId", gtexVariant(args) ?? id); if (provider.id === "clinvar-variation" && !["vcv", "rcv", "scv", "refsnp"].includes(op)) { setIfMissing(params, "terms", id ?? stringValue(args.terms) ?? ""); setIfMissing(params, "maxList", String(pageSize)); } if (provider.id === "uniprot") { if (op !== "entry") { setIfMissing(params, "query", id ?? stringValue(args.term) ?? "*"); setIfMissing(params, "format", "json"); setIfMissing(params, "size", String(pageSize)); } else setIfMissing(params, "format", "json"); } if (provider.id === "ensembl") setIfMissing(params, "content-type", "application/json"); if (provider.id === "chembl" && op === "search") { setIfMissing(params, "q", id ?? stringValue(args.term) ?? ""); setIfMissing(params, "limit", String(pageSize)); } if (provider.id === "bindingdb") setIfMissing(params, "response", "application/json"); if (provider.id === "ncbi-entrez") { setIfMissing(params, "retmode", "json"); setIfMissing(params, "retmax", String(pageSize)); setIfMissing(params, "db", stringValue(args.db) ?? "gene"); if (op === "" || op === "search") setIfMissing(params, "term", stringValue(args.term) ?? id ?? ""); } if (provider.id === "string") { setIfMissing(params, "caller_identity", "dsh-rosalind"); setIfMissing(params, "limit", String(pageSize)); if (id) setIfMissing(params, op === "partners" ? "identifier" : "identifiers", id); setIfMissing(params, "species", String(args.species ?? 9606)); } if (provider.id === "rhea" || provider.id === "bgee") setIfMissing(params, "query", stringValue(args.query) ?? stringValue(args.sparql) ?? "SELECT * WHERE { ?s ?p ?o } LIMIT 10"); }
function nextCursorFrom(payload: unknown): string | undefined { const record = asRecord(payload); return stringValue(record?.nextPageToken) ?? stringValue(record?.next_cursor) ?? stringValue(record?.nextCursor); }
function totalFrom(payload: unknown): number | undefined { const record = asRecord(payload); for (const key of ["totalCount", "total", "count", "totalNumberOfItems"]) { const value = record?.[key]; if (typeof value === "number" && Number.isFinite(value)) return value; } const paging = asRecord(record?.paging_info); const nested = paging?.totalNumberOfItems; return typeof nested === "number" && Number.isFinite(nested) ? nested : undefined; }

export class DatabaseService {
  private readonly fetcher: FetchLike;
  private readonly defaultAllowNetwork: boolean;
  constructor(options: { fetch?: FetchLike; allowNetwork?: boolean } = {}) { this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis); this.defaultAllowNetwork = options.allowNetwork ?? false; }
  listProviders(): readonly DatabaseProvider[] { return DATABASE_PROVIDERS; }
  async execute(operation: string, args: JsonRecord, context: ScienceExecutionContext): Promise<DatabaseResult> {
    const normalized = operation.toLowerCase();
    const providerId = (stringValue(args.provider) ?? normalized.replace(/^database\./, "").replace(/\.(request|search|get|query|fetch)$/, "")).toLowerCase().replace(/-skill$/, "");
    const provider = PROVIDER_DEFINITIONS.find((candidate) => candidate.id === providerId);
    if (!provider) throw new ScienceServiceError("UNKNOWN_DATABASE_PROVIDER", `Unknown database provider: ${providerId}`);
    if (!(["database.request", "database.search", "database.fetch"].includes(normalized) || normalized.startsWith(`${provider.id}.`))) throw new ScienceServiceError("UNKNOWN_DATABASE_OPERATION", `Unsupported database operation: ${operation}`);
    const page = integer(args.page, 0, 1_000_000);
    const pageSize = Math.max(1, integer(args.pageSize ?? args.maxItems ?? args.max_items, 20, 500));
    const route = sourceRoute(provider, args);
    const path = plannedPath(provider, route, args);
    const method = route.method ?? provider.method ?? "GET";
    const style = route.style ?? provider.requestStyle;
    const url = joinUrl(provider.baseUrl, path);
    validateProviderUrl(provider, url);
    const params = collectParameters(args);
    adaptParameters(provider, args, params, page, pageSize);
    const headers: Record<string, string> = { accept: "application/json" };
    let body: string | undefined;
    if (method === "GET") url.search = params.toString();
    else if (style === "form") { headers["content-type"] = "application/x-www-form-urlencoded"; body = params.toString(); }
    else if (style === "sparql") { headers["content-type"] = "application/sparql-query"; headers.accept = "application/sparql-results+json, application/json"; body = params.get("query") ?? ""; }
    else { headers["content-type"] = "application/json"; const explicit = asRecord(args.body) ?? asRecord(args.json_body); body = JSON.stringify(provider.graphql ? graphqlQuery(provider, args, page, pageSize) : explicit ?? Object.fromEntries(params)); }
    const request: NonNullable<DatabaseResult["request"]> = { method, url: url.toString(), ...(method === "POST" ? { bodyFormat: style === "form" ? "form" : style === "sparql" ? "sparql" : "json" } : {}) };
    const live = context.allowNetwork === true || this.defaultAllowNetwork || process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK === "1";
    if (!live) return { ok: false, provider: provider.id, operation, records: [], sources: [], diagnostics: ["Live public requests require explicit network authorization."], request, error: { code: "NETWORK_NOT_AUTHORIZED", message: "Set allowNetwork for this call or DSH_ROSALIND_ENABLE_LIVE_NETWORK=1." } };
    if (context.signal.aborted) throw new ScienceServiceError("CANCELLED", "The database request was cancelled before it began.");
    try {
      const response = await this.fetcher(url, { method, headers, ...(body === undefined ? {} : { body }), signal: context.signal });
      const text = await response.text();
      let payload: unknown = text;
      try { payload = text ? JSON.parse(text) : {}; } catch { /* Some declared sources return FASTA or TSV. */ }
      if (!response.ok) return { ok: false, provider: provider.id, operation, records: [], sources: [], diagnostics: [`HTTP ${response.status} from ${url.hostname}.`], request, error: { code: "HTTP_ERROR", message: typeof payload === "string" ? payload.slice(0, 500) : `HTTP ${response.status}`, status: response.status } };
      const records = recordsFrom(payload, route.recordPaths ?? provider.recordPaths);
      const nextCursor = nextCursorFrom(payload);
      const total = totalFrom(payload);
      return { ok: true, provider: provider.id, operation, records, sources: [{ name: provider.label, url: url.toString(), checkedAt: new Date().toISOString() }], pagination: { page, pageSize, ...(nextCursor ? { nextCursor } : {}), ...(total === undefined ? {} : { total }) }, diagnostics: records.length ? [] : ["The source returned no matching records."], request };
    } catch (error) {
      if (context.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new ScienceServiceError("CANCELLED", "The database request was cancelled.");
      return { ok: false, provider: provider.id, operation, records: [], sources: [], diagnostics: ["The public source could not be reached."], request, error: { code: "NETWORK_ERROR", message: error instanceof Error ? error.message : String(error) } };
    }
  }
}
