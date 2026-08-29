/**
 * Independent clients for the three public literature sources used by
 * DSH-Rosalind.  The service is deliberately small: callers provide the
 * requested operation and receive a provenance-rich, JSON-safe response.
 */

export type JsonRecord = Record<string, unknown>;

export interface ScienceExecutionContext {
  session: object;
  signal: AbortSignal;
  packageRoot: string;
  /** Explicit opt-in for live public requests.  Fixtures never need it. */
  allowNetwork?: boolean;
}

export interface SourceResult {
  ok: boolean;
  service: "biorxiv" | "entrez" | "pmc";
  operation: string;
  records: unknown[];
  sources: Array<{ name: string; url: string; checkedAt: string }>;
  pagination?: { cursor?: number; pageSize?: number; total?: number };
  diagnostics: string[];
  request?: { method: string; url: string };
  error?: { code: string; message: string; status?: number };
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class ScienceServiceError extends Error {
  constructor(readonly code: string, message: string, readonly status?: number) {
    super(message);
    this.name = "ScienceServiceError";
  }
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function integer(value: unknown, fallback: number, min = 0, max = 1000): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function queryFrom(values: JsonRecord, excluded: readonly string[] = []): URLSearchParams {
  const excludedSet = new Set(excluded);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (excludedSet.has(key) || value === undefined || value === null || typeof value === "object") continue;
    query.set(key, String(value));
  }
  return query;
}

function valueAt(object: unknown, key: string): unknown {
  return object && typeof object === "object" ? (object as JsonRecord)[key] : undefined;
}

function recordsFrom(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const key of ["collection", "records", "result", "articles", "response"]) {
      const candidate = valueAt(payload, key);
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return payload === null || payload === undefined ? [] : [payload];
}

function checkedSource(name: string, url: string): SourceResult["sources"][number] {
  return { name, url, checkedAt: new Date().toISOString() };
}

const PMCID_RE = /^PMC(?<accession>\d+)(?:\.(?<version>\d+))?$/i;
const DOI_RE = /^10\.\d{4,9}\/.+/i;
const PMC_CLOUD_BASE = "https://pmc-oa-opendata.s3.amazonaws.com/";

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function nestedArg(args: JsonRecord, key: string): unknown {
  return args[key] ?? valueAt(args.params, key);
}

function directPmcid(identifier: string): { pmcid: string; version?: number } | undefined {
  const match = PMCID_RE.exec(identifier);
  if (!match?.groups) return undefined;
  return {
    pmcid: `PMC${match.groups.accession}`,
    ...(match.groups.version ? { version: Number(match.groups.version) } : {}),
  };
}

function pmcSearchTerm(identifier: string): string {
  if (DOI_RE.test(identifier)) return `"${identifier}"[doi]`;
  if (/^\d+$/.test(identifier)) return `${identifier}[pmid]`;
  return `"${identifier}"[all fields]`;
}

function pmcVersionKeys(xml: string): string[] {
  const versions = new Set<string>();
  for (const match of xml.matchAll(/<(?:\w+:)?Prefix>(PMC\d+(?:\.\d+)?)\/?<\/(?:\w+:)?Prefix>/gi)) {
    const candidate = match[1];
    if (candidate && PMCID_RE.test(candidate)) versions.add(candidate.toUpperCase());
  }
  return [...versions].sort((left, right) => {
    const a = directPmcid(left);
    const b = directPmcid(right);
    return Number(a?.pmcid.slice(3)) - Number(b?.pmcid.slice(3)) || (a?.version ?? 0) - (b?.version ?? 0);
  });
}

function pmcDownloadUrl(value: unknown): string | undefined {
  const url = scalar(value);
  if (!url) return undefined;
  const prefix = "s3://pmc-oa-opendata/";
  return url.startsWith(prefix) ? `${PMC_CLOUD_BASE}${url.slice(prefix.length)}` : url;
}

function compactPmcMetadata(value: unknown, maxFiles: number): JsonRecord | undefined {
  const data = record(value);
  if (!data) return undefined;
  const media = Array.isArray(data.media_urls) ? data.media_urls : [];
  const normalizedMedia = media.slice(0, maxFiles).map(pmcDownloadUrl).filter((item): item is string => Boolean(item));
  return {
    pmcid: data.pmcid,
    version: data.version,
    pmid: data.pmid,
    doi: data.doi,
    title: data.title,
    citation: data.citation,
    is_pmc_openaccess: data.is_pmc_openaccess,
    is_manuscript: data.is_manuscript,
    is_historical_ocr: data.is_historical_ocr,
    is_retracted: data.is_retracted,
    license_code: data.license_code,
    pdf_url: pmcDownloadUrl(data.pdf_url),
    xml_url: pmcDownloadUrl(data.xml_url),
    text_url: pmcDownloadUrl(data.text_url),
    media_url_count: media.length,
    media_urls_truncated: media.length > normalizedMedia.length,
    media_urls: normalizedMedia,
  };
}

function doiPath(doi: string): string {
  // bioRxiv keeps the DOI slash as a path separator; encode each component so
  // punctuation in a DOI cannot alter the enclosing request path.
  return doi.split("/").map((part) => encodeURIComponent(part)).join("/");
}

export class LiteratureService {
  private readonly fetcher: FetchLike;
  private readonly defaultAllowNetwork: boolean;

  constructor(options: { fetch?: FetchLike; allowNetwork?: boolean } = {}) {
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.defaultAllowNetwork = options.allowNetwork ?? false;
  }

  async execute(operation: string, args: JsonRecord, context: ScienceExecutionContext): Promise<SourceResult> {
    const normalized = operation.toLowerCase();
    if (normalized === "biorxiv.request" || normalized.startsWith("biorxiv.")) return this.biorxiv(normalized, args, context);
    if (normalized === "entrez.request" || normalized.startsWith("entrez.") || normalized.startsWith("ncbi-entrez.")) return this.entrez(normalized, args, context);
    if (normalized === "pmc.request" || normalized.startsWith("pmc.") || normalized.startsWith("ncbi-pmc.")) return this.pmc(normalized, args, context);
    if (normalized === "literature.request" || normalized === "literature.search" || normalized === "literature.fetch") {
      const provider = scalar(args.provider)?.toLowerCase();
      if (provider === "biorxiv" || provider === "medrxiv") return this.biorxiv(normalized, { ...args, server: provider }, context);
      if (provider === "entrez" || provider === "ncbi-entrez") return this.entrez(normalized, args, context);
      if (provider === "pmc" || provider === "ncbi-pmc") return this.pmc(normalized, args, context);
    }
    throw new ScienceServiceError("UNKNOWN_LITERATURE_OPERATION", `Unsupported literature operation: ${operation}`);
  }

  private networkAllowed(context: ScienceExecutionContext): boolean {
    return context.allowNetwork === true || this.defaultAllowNetwork || process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK === "1";
  }

  private async request(
    service: SourceResult["service"],
    operation: string,
    url: URL,
    init: RequestInit,
    context: ScienceExecutionContext,
  ): Promise<SourceResult> {
    const method = init.method ?? "GET";
    const request = { method, url: url.toString() };
    if (!this.networkAllowed(context)) {
      return { ok: false, service, operation, records: [], sources: [], diagnostics: ["Live public requests require explicit network authorization."], request, error: { code: "NETWORK_NOT_AUTHORIZED", message: "Set allowNetwork for this call or DSH_ROSALIND_ENABLE_LIVE_NETWORK=1." } };
    }
    if (context.signal.aborted) throw new ScienceServiceError("CANCELLED", "The literature request was cancelled before it began.");
    try {
      const response = await this.fetcher(url, { ...init, signal: context.signal, headers: { accept: "application/json, application/xml;q=0.8, text/xml;q=0.7", ...init.headers } });
      const text = await response.text();
      let payload: unknown = text;
      try { payload = text ? JSON.parse(text) : {}; } catch { /* XML is intentionally retained as text. */ }
      if (!response.ok) {
        return { ok: false, service, operation, records: [], sources: [], diagnostics: [`HTTP ${response.status} from ${url.hostname}.`], request, error: { code: "HTTP_ERROR", message: typeof payload === "string" ? payload.slice(0, 500) : `HTTP ${response.status}`, status: response.status } };
      }
      const records = recordsFrom(payload);
      const sources = [checkedSource(service === "entrez" ? "NCBI Entrez" : service === "pmc" ? "PubMed Central" : "bioRxiv / medRxiv", url.toString())];
      return { ok: true, service, operation, records, sources, diagnostics: records.length ? [] : ["The source returned no matching records."], request };
    } catch (error) {
      if (context.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new ScienceServiceError("CANCELLED", "The literature request was cancelled.");
      return { ok: false, service, operation, records: [], sources: [], diagnostics: ["The public source could not be reached."], request, error: { code: "NETWORK_ERROR", message: error instanceof Error ? error.message : String(error) } };
    }
  }

  private async biorxiv(operation: string, args: JsonRecord, context: ScienceExecutionContext): Promise<SourceResult> {
    const server = scalar(args.server)?.toLowerCase() === "medrxiv" ? "medrxiv" : "biorxiv";
    const action = scalar(args.action) ?? (operation.includes("publication") || operation.includes("link") ? "pubs" : operation.includes("doi") ? "doi" : "details");
    const cursor = integer(args.cursor, 0);
    const doi = scalar(args.doi);
    let path: string;
    if (action === "pubs" || action === "publication" || action === "publication-link") {
      path = doi ? `pubs/${server}/${doiPath(doi)}/na/json` : `pubs/${server}/${scalar(args.start) ?? "2020-01-01"}/${scalar(args.end) ?? new Date().toISOString().slice(0, 10)}/${cursor}`;
    } else if (doi) {
      path = `details/${server}/${doiPath(doi)}/na/json`;
    } else {
      path = `details/${server}/${scalar(args.start) ?? "2020-01-01"}/${scalar(args.end) ?? new Date().toISOString().slice(0, 10)}/${cursor}/json`;
    }
    const response = await this.request("biorxiv", operation, new URL(path, "https://api.biorxiv.org/"), { method: "GET" }, context);
    if (response.ok) response.pagination = { cursor, pageSize: integer(args.pageSize ?? args.maxItems, 10, 1, 100) };
    return response;
  }

  private async entrez(operation: string, args: JsonRecord, context: ScienceExecutionContext): Promise<SourceResult> {
    const action = scalar(args.action) ?? (operation.includes("fetch") ? "fetch" : operation.includes("summary") ? "summary" : operation.includes("link") || operation.includes("map") ? "link" : "search");
    const endpoint = action === "fetch" ? "efetch.fcgi" : action === "summary" ? "esummary.fcgi" : action === "link" || action === "map" ? "elink.fcgi" : "esearch.fcgi";
    const url = new URL(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${endpoint}`);
    const query = queryFrom(args, ["provider", "action", "allowNetwork", "page", "pageSize", "maxItems"]);
    query.set("db", scalar(args.db) ?? "pubmed");
    query.set("retmode", scalar(args.retmode) ?? "json");
    if (action === "search") {
      query.set("term", scalar(args.term ?? args.query) ?? "");
      query.set("retstart", String(integer(args.page, 0) * integer(args.pageSize ?? args.maxItems, 10, 1, 100)));
      query.set("retmax", String(integer(args.pageSize ?? args.maxItems, 10, 1, 100)));
    } else if (scalar(args.id ?? args.ids)) query.set("id", scalar(args.id ?? args.ids)!);
    url.search = query.toString();
    const response = await this.request("entrez", operation, url, { method: "GET" }, context);
    if (response.ok && action === "search") {
      const root = response.records[0];
      const search = valueAt(root, "esearchresult");
      const ids = valueAt(search, "idlist");
      response.records = Array.isArray(ids) ? ids : response.records;
      const total = Number(valueAt(search, "count"));
      response.pagination = { pageSize: integer(args.pageSize ?? args.maxItems, 10, 1, 100), ...(total ? { total } : {}) };
    }
    return response;
  }

  private async pmc(operation: string, args: JsonRecord, context: ScienceExecutionContext): Promise<SourceResult> {
    const action = scalar(args.action) ?? (operation.includes("article-dataset") || operation.includes("metadata") ? "article-dataset" : operation.includes("open") || operation.includes("license") ? "open-access" : operation.includes("map") ? "map" : operation.includes("fetch") ? "fetch" : "search");
    const identifier = scalar(nestedArg(args, "id") ?? nestedArg(args, "identifier") ?? nestedArg(args, "pmcid") ?? nestedArg(args, "pmid") ?? nestedArg(args, "doi"));
    if (action === "article-dataset" || action === "metadata" || action === "article-metadata") {
      return this.pmcArticleDataset(operation, identifier, args, context);
    }
    let url: URL;
    if (action === "map" || action === "open-access") {
      url = new URL(action === "map" ? "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/" : "https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi");
      if (identifier) url.searchParams.set(action === "map" ? "ids" : "id", identifier);
      if (action === "map") url.searchParams.set("format", "json");
    } else {
      url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/" + (action === "fetch" ? "efetch.fcgi" : "esearch.fcgi"));
      url.searchParams.set("db", "pmc");
      url.searchParams.set("retmode", "json");
      if (action === "fetch" && identifier) url.searchParams.set("id", identifier);
      if (action !== "fetch") url.searchParams.set("term", scalar(args.term ?? args.query) ?? "");
    }
    return this.request("pmc", operation, url, { method: "GET" }, context);
  }

  private async pmcArticleDataset(
    operation: string,
    identifier: string | undefined,
    args: JsonRecord,
    context: ScienceExecutionContext,
  ): Promise<SourceResult> {
    const request = { method: "GET", url: PMC_CLOUD_BASE };
    if (!identifier) {
      return {
        ok: false,
        service: "pmc",
        operation,
        records: [],
        sources: [],
        diagnostics: ["PMC Article Dataset metadata requires a PMCID, PMID, DOI, or searchable identifier."],
        request,
        error: { code: "MISSING_IDENTIFIER", message: "Provide params.id, id, identifier, pmcid, pmid, or doi." },
      };
    }

    const maxItems = integer(args.maxItems ?? args.max_items ?? valueAt(args.params, "max_items"), 10, 1, 100);
    const retmax = integer(args.retmax ?? valueAt(args.params, "retmax"), 10, 1, 100);
    const direct = directPmcid(identifier);
    let pmcids: string[];
    let availablePmcids: number;
    const sources: SourceResult["sources"] = [];
    const diagnostics: string[] = [];

    if (direct) {
      pmcids = [direct.pmcid];
      availablePmcids = 1;
    } else {
      const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
      searchUrl.searchParams.set("db", "pmc");
      searchUrl.searchParams.set("term", pmcSearchTerm(identifier));
      searchUrl.searchParams.set("retmode", "json");
      searchUrl.searchParams.set("retmax", String(retmax));
      const search = await this.request("pmc", operation, searchUrl, { method: "GET" }, context);
      if (!search.ok) return search;
      sources.push(...search.sources);
      const payload = record(search.records[0]);
      const result = record(payload?.esearchresult);
      const ids = Array.isArray(result?.idlist) ? result.idlist : [];
      pmcids = ids.map(scalar).filter((id): id is string => Boolean(id && /^\d+$/.test(id))).map((id) => `PMC${id}`);
      const total = Number(result?.count);
      availablePmcids = Number.isFinite(total) ? total : pmcids.length;
    }

    const versionKeys: string[] = [];
    for (const pmcid of pmcids) {
      if (direct?.version !== undefined) {
        versionKeys.push(`${pmcid}.${direct.version}`);
        continue;
      }
      const listUrl = new URL(PMC_CLOUD_BASE);
      listUrl.searchParams.set("list-type", "2");
      listUrl.searchParams.set("prefix", `${pmcid}.`);
      listUrl.searchParams.set("delimiter", "/");
      const listed = await this.request("pmc", operation, listUrl, { method: "GET" }, context);
      if (!listed.ok) return { ...listed, sources: [...sources, ...listed.sources] };
      sources.push(...listed.sources);
      const xml = scalar(listed.records[0]);
      if (!xml) {
        return {
          ok: false,
          service: "pmc",
          operation,
          records: [],
          sources,
          diagnostics: ["PMC Cloud returned a version listing that was not XML text."],
          request: listed.request ?? request,
          error: { code: "INVALID_RESPONSE", message: "PMC Cloud version listing did not contain XML text." },
        };
      }
      versionKeys.push(...pmcVersionKeys(xml));
    }

    if (pmcids.length && versionKeys.length === 0) diagnostics.push("No current PMC Article Dataset versions were found for the resolved PMCID.");
    const records: JsonRecord[] = [];
    let finalRequest = request;
    for (const versionKey of versionKeys.slice(0, maxItems)) {
      const metadataUrl = new URL(`metadata/${encodeURIComponent(versionKey)}.json`, PMC_CLOUD_BASE);
      const metadata = await this.request("pmc", operation, metadataUrl, { method: "GET" }, context);
      finalRequest = metadata.request ?? finalRequest;
      if (!metadata.ok) {
        if (metadata.error?.status === 404) {
          diagnostics.push(`No PMC Cloud metadata was found for ${versionKey}.`);
          continue;
        }
        return { ...metadata, sources: [...sources, ...metadata.sources] };
      }
      sources.push(...metadata.sources);
      const compact = compactPmcMetadata(metadata.records[0], maxItems);
      if (!compact) {
        return {
          ok: false,
          service: "pmc",
          operation,
          records: [],
          sources,
          diagnostics: ["PMC Cloud metadata was not a JSON object."],
          request: finalRequest,
          error: { code: "INVALID_RESPONSE", message: `PMC metadata for ${versionKey} was not a JSON object.` },
        };
      }
      records.push(compact);
    }

    return {
      ok: true,
      service: "pmc",
      operation,
      records,
      sources,
      pagination: { pageSize: maxItems, total: versionKeys.length },
      diagnostics,
      request: finalRequest,
    };
  }
}
