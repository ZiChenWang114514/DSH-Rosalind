import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import type { JsonValue } from "@deepseek-ai/dsh-tools";

import type { NgsPlanIdentity, NgsReproductionInputs, ShowcaseDefinition, ShowcaseReproductionInputs } from "../shared/types.js";
export type { NgsPlanIdentity } from "../shared/types.js";
import { resolveInside } from "./catalog.js";
import type { ScienceExecutionContext, ScienceExecutor } from "./science-tools.js";

export interface ReproductionStepResult {
  serviceId: string;
  operation: string;
  result: Record<string, JsonValue>;
}

export interface ReproductionResult {
  status: "completed" | "failed" | "awaiting_confirmation" | "running" | "cancelled";
  summary: string;
  steps: ReproductionStepResult[];
  error?: { code: string; message: string };
  pendingPlan?: NgsPlanIdentity;
  registryRunId?: string;
}

/** Inputs supplied by a user before an NGS showcase can plan a scientific run. */
export interface NgsReproductionRequest extends NgsReproductionInputs {
  /** Exact plan returned by the first invocation and retained by Rosalind. */
  pendingPlan?: NgsPlanIdentity;
  approvedPlan?: NgsPlanIdentity;
  /** Durable NGS registry identity once execution has started. */
  registryRunId?: string;
  /** Number of read-only observations before returning a still-running state. */
  maxObservationAttempts?: number;
}

export type NgsReproductionContext = ScienceExecutionContext & { ngsReproduction?: NgsReproductionRequest };
export type ShowcaseReproductionContext = ScienceExecutionContext & {
  ngsReproduction?: NgsReproductionRequest;
  showcaseReproduction?: ShowcaseReproductionInputs;
};

type CallSpec = [serviceId: string, operation: string, args: Record<string, unknown>];

function casePath(showcase: ShowcaseDefinition, relative: string): string {
  return `${showcase.readmePath.slice(0, -"README.md".length)}${relative}`;
}

const SOURCE_REQUIRED_REPRODUCTIONS: Readonly<Record<string, string>> = Object.freeze({
  "slide-tissue-architecture": "Provide the authorized CMU-1-JP2K-33005.svs source in a user-selected run directory so the Slide service can inspect its TIFF pyramid and query decoded pixels.",
  "slide-spatial-expression": "Provide the authorized visium_hne_adata_crop.h5ad source in a user-selected run directory so the Slide service can build an H5AD index and recompute expression vectors.",
  "slide-segmentation-overlay": "Provide the authorized spatial H5AD source plus an explicit coordinate/radius construction request so new GeoJSON geometry can be generated outside the retained showcase outputs.",
  "slide-research-export": "Provide the authorized spatial H5AD source and a create-new run directory so a new 684-row CSV can be generated from source-indexed observations.",
});

function callsFor(showcase: ShowcaseDefinition, providerId: string): CallSpec[] {
  switch (showcase.id) {
    case "literature-trem2-landscape": {
      const term = "TREM2[Title/Abstract] AND microglia[Title/Abstract]";
      const pmids = "42437587,42341895,41467385,42570638,42396649,42342036,42288287,42160848,42102578,42632547";
      const doi = "10.1101/2025.03.28.646038";
      return [
        ["literature", "entrez.request", { provider: "ncbi-entrez", action: "search", identifier: term, term, db: "pubmed", retmode: "json", sort: "pub date", page: 0, pageSize: 10, params: { db: "pubmed", term, retmode: "json", retmax: 10, sort: "pub date" } }],
        ["literature", "entrez.request", { provider: "ncbi-entrez", action: "summary", identifier: pmids, id: pmids, db: "pubmed", retmode: "json", pageSize: 10, params: { db: "pubmed", id: pmids, retmode: "json" } }],
        ["literature", "biorxiv.request", { provider: "biorxiv", action: "details", identifier: doi, doi, server: "biorxiv", pageSize: 10, params: { server: "biorxiv", doi, max_items: 10 } }],
        ["literature", "biorxiv.request", { provider: "biorxiv", action: "publication-link", identifier: doi, doi, server: "biorxiv", pageSize: 10, params: { server: "biorxiv", doi, max_items: 10 } }],
      ];
    }
    case "literature-pmc-availability": {
      const identifier = "PMC3257301";
      return [["literature", "pmc.request", { provider: "ncbi-pmc", action: "article-dataset", identifier, id: identifier, pageSize: 10, params: { id: identifier, max_items: 10 } }]];
    }
    case "literature-preprint-publication-link": {
      const preprintDoi = "10.1101/2020.09.09.20191205";
      const publicationDoi = "10.1038/s41467-021-21444-5";
      const publicationPmid = "33608522";
      const term = `${publicationDoi}[DOI]`;
      return [
        ["literature", "biorxiv.request", { provider: "biorxiv", action: "details", identifier: preprintDoi, doi: preprintDoi, server: "medrxiv", pageSize: 10, params: { server: "medrxiv", doi: preprintDoi, max_items: 10 } }],
        ["literature", "biorxiv.request", { provider: "biorxiv", action: "publication-link", identifier: preprintDoi, doi: preprintDoi, server: "medrxiv", pageSize: 10, params: { server: "medrxiv", doi: preprintDoi, max_items: 10 } }],
        ["literature", "entrez.request", { provider: "ncbi-entrez", action: "search", identifier: publicationDoi, term, db: "pubmed", retmode: "json", page: 0, pageSize: 10, params: { db: "pubmed", term, retmode: "json", retmax: 10 } }],
        ["literature", "entrez.request", { provider: "ncbi-entrez", action: "summary", identifier: publicationPmid, id: publicationPmid, db: "pubmed", retmode: "json", pageSize: 10, params: { db: "pubmed", id: publicationPmid, retmode: "json" } }],
      ];
    }
    case "databases-il6r-asthma":
      return [
        ["databases", "database.request", {
          provider: "opentargets", action: "query", operation: "associated-diseases", identifier: "ENSG00000160712", target: "ENSG00000160712", disease: "MONDO_0004979", page: 0, pageSize: 200,
          query: "query Il6rAsthma($ensemblId: String!, $index: Int!, $size: Int!) { target(ensemblId: $ensemblId) { id approvedSymbol associatedDiseases(page: {index: $index, size: $size}) { count rows { disease { id name } datasourceScores { id score } } } } }",
          variables: { ensemblId: "ENSG00000160712", index: 0, size: 200 },
          params: { diseaseId: "MONDO_0004979", page: 0, pageSize: 200 },
        }],
        ["databases", "database.request", { provider: "gwas-catalog", action: "fetch", operation: "associations", identifier: "IL6R", page: 0, pageSize: 10, params: { mapped_gene: "IL6R", size: 10 } }],
        ["databases", "database.request", { provider: "gtex-eqtl", action: "variant", operation: "variant", identifier: "1:154454494-A-C", variant: "1:154454494-A-C", gene: "ENSG00000160712", page: 0, pageSize: 200, params: { variantId: "chr1_154454494_A_C_b38", itemsPerPage: 200 } }],
      ];
    case "databases-variant-interpretation":
      return [
        ["databases", "database.request", { provider: "clinvar-variation", action: "search", operation: "search", identifier: "rs7903146", terms: "rs7903146", pageSize: 10, params: { terms: "rs7903146", maxList: 10 } }],
        ["databases", "database.request", { provider: "ensembl", action: "fetch", operation: "variation", identifier: "rs7903146", params: { "content-type": "application/json" } }],
        ["databases", "database.request", { provider: "ukb-topmed-phewas", action: "variant", operation: "variant", identifier: "10:112998590-C-T", variant: "10:112998590-C-T", pageSize: 10, params: { max_results: 10 } }],
        ["databases", "database.request", {
          provider: "gnomad-graphql", action: "query", operation: "variant", identifier: "10-112998590-C-T", dataset: "gnomad_r4",
          query: "query Variant($variantId: String!, $dataset: DatasetId!) { variant(variantId: $variantId, dataset: $dataset) { variantId genome { ac an af } } }",
          variables: { variantId: "10-112998590-C-T", dataset: "gnomad_r4" },
          params: { max_items: 5 },
        }],
      ];
    case "databases-egfr-landscape":
      return [
        ["databases", "database.request", { provider: "uniprot", action: "fetch", operation: "entry", identifier: "P00533", params: { format: "json" } }],
        ["databases", "database.request", { provider: "chembl", action: "fetch", operation: "target", identifier: "CHEMBL203", params: {} }],
        ["databases", "database.request", { provider: "chembl", action: "fetch", operation: "mechanism", identifier: "CHEMBL203", page: 0, pageSize: 10, params: { target_chembl_id: "CHEMBL203", limit: 10 } }],
        ["databases", "database.request", { provider: "chembl", action: "fetch", operation: "molecule", identifier: "CHEMBL939", params: {} }],
        ["databases", "database.request", { provider: "chembl", action: "fetch", operation: "molecule", identifier: "CHEMBL553", params: {} }],
        ["databases", "database.request", { provider: "chembl", action: "fetch", operation: "molecule", identifier: "CHEMBL3353410", params: {} }],
        ["databases", "database.request", { provider: "rcsb-pdb", action: "fetch", operation: "entry", identifier: "1M17", params: {} }],
        ["databases", "database.request", { provider: "reactome", action: "fetch", operation: "pathways", identifier: "P00533", pageSize: 10, params: { species: "Homo sapiens" } }],
      ];
    case "sequence-lambda-annotation":
      return [
        ["sequence", "sequence.open_from_chat", { path: casePath(showcase, "inputs/NC_001416.1.gb"), presentation: "inline" }],
        ["sequence", "sequence.run_analysis", { analysis: "genbank_cds_validation", gene: "cI" }],
      ];
    case "sequence-ras-alignment":
      return [
        ["sequence", "sequence.open_from_chat", { path: casePath(showcase, "inputs/human-RAS-UniProt-SV1.aln-fasta"), presentation: "inline" }],
        ["sequence", "sequence.run_analysis", { analysis: "alignment_metrics" }],
      ];
    case "sequence-fastq-qc":
      return [
        ["sequence", "sequence.open_from_chat", { path: casePath(showcase, "inputs/DRR037765.first500.fastq"), presentation: "inline" }],
        ["sequence", "sequence.run_analysis", { analysis: "fastq_qc" }],
      ];
    case "ngs-fastq-qc":
    case "ngs-bulk-rnaseq":
    case "ngs-single-cell": {
      const engine = "snakemake";
      return [
        ["ngs", "list_workflows", { engine, include_archived: false }],
        ["ngs", "get_runtime_environment", {}],
      ];
    }
    case "structure-mdm2-p53":
      return [
        ["structure", "structure.open_from_chat", { path: casePath(showcase, "inputs/1YCR.pdb"), openIntentId: crypto.randomUUID(), presentation: "inline" }],
        ["structure", "structure.set_selection", { expression: { kind: "residues", objectId: "primary", residues: [{ chain: "B", residue: 19 }, { chain: "B", residue: 23 }, { chain: "B", residue: 26 }] }, mode: "set", name: "p53-hotspots" }],
        ["structure", "structure.analyze", { kind: "contacts", selections: [{ kind: "chain", objectId: "primary", chain: "A" }, { kind: "chain", objectId: "primary", chain: "B" }], options: { contactDistanceAngstrom: 4 } }],
        ["structure", "structure.get_state", {}],
      ];
    case "structure-adenylate-kinase":
      return [
        ["structure", "structure.open_from_chat", { path: casePath(showcase, "inputs/4AKE.pdb"), openIntentId: crypto.randomUUID(), presentation: "inline" }],
        ["structure", "structure.add_structure", { path: casePath(showcase, "inputs/1AKE.pdb"), objectId: "closed", representation: "cartoon", color: "#c026d3" }],
        ["structure", "structure.align_structures", { method: "structure", mobile: { kind: "chain", objectId: "closed", chain: "A" }, reference: { kind: "chain", objectId: "primary", chain: "A" } }],
        ["structure", "structure.get_state", {}],
      ];
    case "structure-gfp-figure":
      return [
        ["structure", "structure.open_from_chat", { path: casePath(showcase, "inputs/1EMA.pdb"), openIntentId: crypto.randomUUID(), presentation: "inline" }],
        ["structure", "structure.control_viewer", { action: "show_ligand_contacts", objectId: "primary", compId: "CRO", chain: "A", thresholdAngstrom: 4 }],
        ["structure", "structure.validate_render", { request: { kind: "image", format: "png", width: 1600, height: 1200 } }],
        ["structure", "structure.render_image", { format: "png", width: 1600, height: 1200, outputPath: `.rosalind-runs/${showcase.id}/gfp-figure.png`, overwrite: true }],
      ];
    case "slide-tissue-architecture":
      return [["slide", "slide.open_from_chat", { path: casePath(showcase, "outputs/pyramid-metadata.json"), presentation: "inline" }]];
    case "slide-spatial-expression":
      return [
        ["slide", "slide.open_from_chat", { path: casePath(showcase, "outputs/metadata-summary.json"), presentation: "inline" }],
        ["slide", "slide.spatial_indexed", { operation: "metadata" }],
        ["slide", "slide.spatial_indexed", { operation: "expression", gene: "Slc17a7" }],
        ["slide", "slide.spatial_indexed", { operation: "expression", gene: "Gad1" }],
      ];
    case "slide-segmentation-overlay":
      return [
        ["slide", "slide.open_from_chat", { path: "showcases/slide-viewer/cases/slide-tissue-architecture/outputs/pyramid-metadata.json", presentation: "inline" }],
        ["slide", "slide.import_scientific_layer", { path: casePath(showcase, "outputs/source-aligned-annotations.geojson"), format: "geojson", entityKind: "region", coordinateUnits: "pixels", kind: "annotations" }],
      ];
    case "slide-research-export":
      return [
        ["slide", "slide.open_from_chat", { path: "showcases/slide-viewer/cases/slide-spatial-expression/outputs/metadata-summary.json", presentation: "inline" }],
        ["slide", "slide.spatial_indexed", { operation: "metadata" }],
        ["slide", "slide.spatial_indexed", { operation: "expression", gene: "Slc17a7" }],
      ];
    case "rosalind-structure-analysis":
      return [
        ["rosalind", "rosalind.open", { area: "structure-analysis" }],
        ["structure", "structure.open_from_chat", { path: "showcases/molecular-structure-viewer/cases/structure-mdm2-p53/inputs/1YCR.pdb", openIntentId: crypto.randomUUID(), presentation: "inline" }],
        ["structure", "structure.get_state", {}],
      ];
    case "rosalind-genomics":
      return [
        ["rosalind", "rosalind.open", { area: "genomics" }],
        ["sequence", "sequence.open_from_chat", { path: "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta", presentation: "inline" }],
        ["sequence", "sequence.run_analysis", { analysis: "alignment_metrics" }],
      ];
    case "rosalind-scientific-compute":
      return [
        ["rosalind", "rosalind.open", { area: "scientific-compute" }],
        ["ngs", "list_workflows", { include_archived: false }],
        ["ngs", "get_runtime_environment", {}],
        ["ngs", "list_compute_targets", {}],
      ];
    case "rosalind-molecular-design":
      return [
        ["rosalind", "rosalind.open", { area: "molecular-design", providerId }],
        ["structure", "structure.open_from_chat", { path: casePath(showcase, "outputs/NB13_E104Q_best_model.cif"), openIntentId: crypto.randomUUID(), presentation: "inline" }],
        ["structure", "structure.get_state", {}],
      ];
    default:
      throw new Error(`No reproduction route is recorded for ${showcase.id}`);
  }
}

function failedResult(result: Record<string, JsonValue>): { code: string; message: string } | undefined {
  const status = typeof result.status === "string" ? result.status : "completed";
  const runState = typeof result.state === "string" ? result.state : undefined;
  const explicitlyFailed = result.ok === false;
  const readinessBlocked = result.ready === false;
  const executionFailed = runState !== undefined && ["failed", "blocked", "orphaned", "termination_failed", "cancelled"].includes(runState);
  if (!["failed", "blocked", "unavailable", "cancelled"].includes(status) && !readinessBlocked && !explicitlyFailed && !executionFailed) return undefined;
  const error = result.error && typeof result.error === "object" && !Array.isArray(result.error)
    ? result.error as Record<string, JsonValue>
    : undefined;
  return {
    code: typeof error?.code === "string"
      ? error.code
      : typeof result.code === "string"
        ? result.code
        : executionFailed && runState
          ? runState.toUpperCase()
          : status.toUpperCase(),
    message: typeof error?.message === "string"
      ? error.message
      : Array.isArray(result.diagnostics) && result.diagnostics.every((item) => typeof item === "string")
        ? result.diagnostics.join(" ")
        : `Scientific operation reported ${readinessBlocked ? "readiness=false" : explicitlyFailed ? "ok=false" : executionFailed ? `state=${runState}` : status}.`,
  };
}

function requiredResultString(result: Record<string, JsonValue>, field: string): string {
  const value = result[field];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Scientific operation did not return ${field}.`);
  return value;
}

async function executeStep(
  spec: CallSpec,
  executor: ScienceExecutor,
  context: ScienceExecutionContext,
  viewerSessions: Map<string, string>,
  steps: ReproductionStepResult[],
): Promise<{ result: Record<string, JsonValue>; error?: { code: string; message: string } }> {
  if (context.signal.aborted) throw context.signal.reason ?? new Error("reproduction cancelled");
  const [serviceId, operation, args] = spec;
  const sessionId = viewerSessions.get(serviceId);
  const resolvedArgs = sessionId && args.sessionId === undefined ? { ...args, sessionId } : args;
  const result = await executor.execute(serviceId, operation, resolvedArgs, context);
  steps.push({ serviceId, operation, result });
  if (typeof result.viewerSessionId === "string" && result.viewerSessionId.trim()) viewerSessions.set(serviceId, result.viewerSessionId);
  const error = failedResult(result);
  return error ? { result, error } : { result };
}

function isNgsShowcase(showcase: ShowcaseDefinition): boolean {
  return showcase.id === "ngs-fastq-qc" || showcase.id === "ngs-bulk-rnaseq" || showcase.id === "ngs-single-cell";
}

type NgsReproductionOutcome = {
  status: "completed" | "failed" | "awaiting_confirmation" | "running" | "cancelled";
  error?: { code: string; message: string };
  pendingPlan?: NgsPlanIdentity;
  registryRunId?: string;
};

const NGS_TERMINAL_STATES = new Set(["completed", "failed", "cancelled", "blocked", "orphaned", "termination_failed"]);

function ngsRequest(context: ScienceExecutionContext): NgsReproductionRequest | undefined {
  return (context as NgsReproductionContext).ngsReproduction;
}

function showcaseRequest(context: ScienceExecutionContext): ShowcaseReproductionInputs | undefined {
  return (context as ShowcaseReproductionContext).showcaseReproduction;
}

function resolveRequestPath(packageRoot: string, value: string): string {
  return isAbsolute(value) ? value : resolve(packageRoot, value);
}

function existingPath(path: string, kind: "file" | "directory"): boolean {
  try {
    const stats = statSync(path);
    return kind === "file" ? stats.isFile() : stats.isDirectory();
  } catch {
    return false;
  }
}

function validateShowcaseRequest(context: ScienceExecutionContext, request: ShowcaseReproductionInputs | undefined): {
  runDirectory?: string;
  sourcePaths?: string[];
  error?: { code: string; message: string };
} {
  if (!request) return { error: { code: "REPRODUCTION_INPUT_REQUIRED", message: "An authorized run directory and explicit source files are required for this scientific reproduction." } };
  if (!request.runDirectory.trim() || request.sourcePaths.length === 0 || request.sourcePaths.some((path) => !path.trim())) {
    return { error: { code: "REPRODUCTION_INPUT_REQUIRED", message: "The reproduction input must include a non-empty run directory and at least one non-empty source path." } };
  }
  const runDirectory = resolveRequestPath(context.packageRoot, request.runDirectory);
  if (!existingPath(runDirectory, "directory")) return { error: { code: "REPRODUCTION_RUN_DIRECTORY_UNAVAILABLE", message: `The selected reproduction directory is unavailable: ${request.runDirectory}.` } };
  const sourcePaths = request.sourcePaths.map((path) => isAbsolute(path) ? path : resolve(runDirectory, path));
  const missing = sourcePaths.find((path) => !existingPath(path, "file"));
  if (missing) return { error: { code: "REPRODUCTION_SOURCE_UNAVAILABLE", message: `The selected scientific source is unavailable: ${missing}.` } };
  return { runDirectory, sourcePaths };
}

function readObject(path: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function sourceSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function verifyTissueSource(showcase: ShowcaseDefinition, context: ShowcaseReproductionContext, sourcePath: string, opened: Record<string, JsonValue>): { code: string; message: string } | undefined {
  const provenancePath = resolveInside(context.packageRoot, casePath(showcase, "outputs/source-provenance.json"));
  const pyramidPath = resolveInside(context.packageRoot, casePath(showcase, "outputs/pyramid-metadata.json"));
  const provenance = readObject(provenancePath);
  const pyramid = readObject(pyramidPath);
  if (!provenance || !pyramid) return { code: "SOURCE_PROVENANCE_UNAVAILABLE", message: "The retained Slide showcase is missing its source-provenance or pyramid-metadata record." };

  const declaredName = typeof provenance.artifact === "string" ? provenance.artifact : "";
  const sourceName = sourcePath.split(/[\\/]/).at(-1) ?? "";
  if (!declaredName || sourceName !== declaredName) {
    return { code: "SOURCE_IDENTITY_MISMATCH", message: `The selected source file is ${sourceName || "unnamed"}, but this showcase permits only ${declaredName || "the recorded source artifact"}.` };
  }
  const openedSource = opened.source && typeof opened.source === "object" && !Array.isArray(opened.source) ? opened.source as Record<string, JsonValue> : undefined;
  const openedFormat = openedSource?.format;
  if (openedFormat !== "svs") return { code: "SOURCE_FORMAT_MISMATCH", message: `The selected ${sourceName} was opened as ${String(openedFormat ?? "unknown")}; this showcase requires an Aperio SVS source.` };
  const mainImage = pyramid.main_image && typeof pyramid.main_image === "object" && !Array.isArray(pyramid.main_image) ? pyramid.main_image as Record<string, unknown> : undefined;
  const expectedWidth = numberField(mainImage?.width);
  const expectedHeight = numberField(mainImage?.height);
  const actualWidth = numberField(openedSource?.width);
  const actualHeight = numberField(openedSource?.height);
  if (expectedWidth === undefined || expectedHeight === undefined || actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
    return { code: "SOURCE_DIMENSIONS_MISMATCH", message: `The selected source dimensions are ${actualWidth ?? "unknown"}×${actualHeight ?? "unknown"}; the retained source record requires ${expectedWidth ?? "unknown"}×${expectedHeight ?? "unknown"}.` };
  }
  const expectedBytes = numberField(provenance.bytes);
  const expectedSha = typeof provenance.sha256 === "string" ? provenance.sha256 : "";
  const actualBytes = statSync(sourcePath).size;
  const actualSha = sourceSha256(sourcePath);
  if (expectedBytes === undefined || expectedSha.length !== 64 || actualBytes !== expectedBytes || actualSha !== expectedSha) {
    return { code: "SOURCE_PROVENANCE_MISMATCH", message: `The selected source identity does not match the retained record (bytes ${actualBytes}/${expectedBytes ?? "unknown"}, sha256 ${actualSha}/${expectedSha || "unknown"}).` };
  }
  return undefined;
}

async function reproduceSlideShowcase(
  showcase: ShowcaseDefinition,
  executor: ScienceExecutor,
  context: ShowcaseReproductionContext,
  viewerSessions: Map<string, string>,
  steps: ReproductionStepResult[],
): Promise<ReproductionResult> {
  const checked = validateShowcaseRequest(context, showcaseRequest(context));
  if (checked.error) return { status: "awaiting_confirmation", summary: `${showcase.title}: source input is required before scientific recomputation.`, steps, error: checked.error };
  const sourcePath = checked.sourcePaths![0]!;
  const authorizedContext: ShowcaseReproductionContext = {
    ...context,
    authorizedPaths: [checked.runDirectory!, ...checked.sourcePaths!],
  };
  const opened = await executeStep(["slide", "slide.open_from_chat", { path: sourcePath }], executor, authorizedContext, viewerSessions, steps);
  if (opened.error) return { status: "failed", summary: `${showcase.title}: ${opened.error.message}`, steps, error: opened.error };
  if (showcase.id === "slide-tissue-architecture") {
    const sourceError = verifyTissueSource(showcase, authorizedContext, sourcePath, opened.result);
    if (sourceError) return { status: "failed", summary: `${showcase.title}: ${sourceError.message}`, steps, error: sourceError };
    const state = await executeStep(["slide", "slide.get_viewer_state", {}], executor, authorizedContext, viewerSessions, steps);
    if (state.error) return { status: "failed", summary: `${showcase.title}: ${state.error.message}`, steps, error: state.error };
    return { status: "completed", summary: `${showcase.title}: source dimensions and TIFF pyramid metadata were recomputed from the authorized slide; compressed source pixels may still require the native microscopy codec.`, steps };
  }
  const limitations: Record<string, { code: string; message: string }> = {
    "slide-spatial-expression": { code: "H5AD_INDEX_UNAVAILABLE", message: "The H5AD container was authenticated, but this bundle does not yet provide the native expression-vector index required to recompute spatial gene summaries." },
    "slide-segmentation-overlay": { code: "SEGMENTATION_GENERATOR_UNAVAILABLE", message: "The source container was authenticated, but raw spatial coordinates and source-derived GeoJSON construction are not implemented in the local Slide service." },
    "slide-research-export": { code: "SPATIAL_VECTOR_UNAVAILABLE", message: "The source container was authenticated, but per-observation spatial vectors are unavailable, so no new 684-row research CSV was written." },
  };
  const limitation = limitations[showcase.id]!;
  return { status: "failed", summary: `${showcase.title}: ${limitation.message}`, steps, error: limitation };
}

function isWithin(parent: string, candidate: string): boolean {
  const relation = relative(parent, candidate);
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}

function planIdentity(result: Record<string, JsonValue>): NgsPlanIdentity {
  return {
    planId: requiredResultString(result, "plan_id"),
    planName: requiredResultString(result, "plan_name"),
    planChecksum: requiredResultString(result, "plan_checksum"),
  };
}

function approvedExactPlan(approval: NgsPlanIdentity | undefined, plan: NgsPlanIdentity): boolean {
  return approval?.planId === plan.planId
    && approval.planName === plan.planName
    && approval.planChecksum === plan.planChecksum;
}

function observationIsTerminal(result: Record<string, JsonValue>): boolean {
  if (typeof result.state === "string" && NGS_TERMINAL_STATES.has(result.state)) return true;
  const observation = result.observation;
  return Boolean(observation && typeof observation === "object" && !Array.isArray(observation)
    && (observation as Record<string, JsonValue>).terminal === true);
}

function validateNgsRequest(showcase: ShowcaseDefinition, context: ScienceExecutionContext, request: NgsReproductionRequest | undefined): {
  request?: NgsReproductionRequest;
  runDirectory?: string;
  configFile?: string;
  error?: { code: string; message: string };
} {
  if (!request) {
    return { error: { code: "NGS_INPUT_CONFIGURATION_REQUIRED", message: "Scientific NGS reproduction requires a user-supplied runDirectory, configFile, and declared inputPaths before planning." } };
  }
  if (!request.runDirectory.trim() || !request.configFile.trim() || request.inputPaths.length === 0) {
    return { error: { code: "NGS_INPUT_CONFIGURATION_REQUIRED", message: "Scientific NGS reproduction requires a non-empty runDirectory, configFile, and at least one declared input path before planning." } };
  }
  const runDirectory = resolveRequestPath(context.packageRoot, request.runDirectory);
  const configFile = resolveRequestPath(runDirectory, request.configFile);
  const showcaseDirectory = resolve(context.packageRoot, casePath(showcase, ""));
  if (!existingPath(runDirectory, "directory")) {
    return { error: { code: "NGS_RUN_DIRECTORY_UNAVAILABLE", message: `The requested NGS run directory does not exist: ${request.runDirectory}. Create a user workspace outside the showcase source directory before planning.` } };
  }
  if (isWithin(showcaseDirectory, runDirectory)) {
    return { error: { code: "NGS_RUN_DIRECTORY_IN_SHOWCASE_SOURCE", message: "NGS runs must use a user workspace outside the retained showcase source directory." } };
  }
  if (!existingPath(configFile, "file")) {
    return { error: { code: "NGS_CONFIG_UNAVAILABLE", message: `The declared NGS configuration file is unavailable: ${request.configFile}.` } };
  }
  if (/^\s*smoke_mode:\s*true\s*(?:#.*)?$/m.test(readFileSync(configFile, "utf8"))) {
    return { error: { code: "NGS_ENGINEERING_SMOKE_CONFIG", message: "The supplied NGS configuration is an engineering smoke configuration and cannot produce a scientific showcase result." } };
  }
  const normalizedInputPaths = request.inputPaths.map((input) => resolveRequestPath(runDirectory, input));
  const missingInputs = request.inputPaths
    .map((input, index) => ({ input, path: normalizedInputPaths[index]! }))
    .filter(({ path }) => !existsSync(path));
  if (missingInputs.length > 0) {
    return { error: { code: "NGS_INPUT_UNAVAILABLE", message: `The declared NGS input path is unavailable: ${missingInputs[0]!.input}. No plan was created.` } };
  }
  return {
    request: { ...request, runDirectory, configFile, inputPaths: normalizedInputPaths },
    runDirectory,
    configFile,
  };
}

async function reproduceNgsShowcase(
  showcase: ShowcaseDefinition,
  executor: ScienceExecutor,
  context: ScienceExecutionContext,
  viewerSessions: Map<string, string>,
  steps: ReproductionStepResult[],
): Promise<NgsReproductionOutcome> {
  const requestCheck = validateNgsRequest(showcase, context, ngsRequest(context));
  if (requestCheck.error) return { status: "failed", error: requestCheck.error };
  const request = requestCheck.request!;
  const workflowId = showcase.id === "ngs-fastq-qc" ? "oai_fastq_qc" : showcase.id === "ngs-bulk-rnaseq" ? "oai_bulk_rnaseq_counts_qc" : "oai_scrnaseq_fastq_to_count";
  if (!request.pendingPlan && !request.registryRunId) {
    const initialCalls = callsFor(showcase, showcase.recipe.providerIds[0] ?? "local");
    for (const spec of initialCalls) {
      const executed = await executeStep(spec, executor, context, viewerSessions, steps);
      if (executed.error) return { status: "failed", error: executed.error };
    }
  }

  let plan = request.pendingPlan;
  if (!plan && !request.registryRunId) {
    const plannerArgs = {
      workflow_id: workflowId,
      run_dir: requestCheck.runDirectory!,
      config_file: requestCheck.configFile!,
      input_paths: [...request.inputPaths],
    };
    const readiness = await executeStep(
      ["ngs", "check_snakemake_readiness", plannerArgs],
      executor,
      context,
      viewerSessions,
      steps,
    );
    const planned = await executeStep(
      ["ngs", "plan_snakemake", { ...plannerArgs, display_name: `${showcase.title} reproduction` }],
      executor,
      context,
      viewerSessions,
      steps,
    );
    if (planned.error) return { status: "failed", error: planned.error };
    plan = planIdentity(planned.result);
    // A reviewed NGS plan is always shown before execution. Readiness is
    // retained in the planner result and execute_plan will make a precise
    // blocked diagnosis if the environment still cannot launch it.
  }

  if (!plan && !request.registryRunId) {
    return { status: "failed", error: { code: "NGS_PLAN_UNAVAILABLE", message: "No exact NGS plan was retained for this reproduction." } };
  }
  if (plan && !approvedExactPlan(request.approvedPlan, plan)) {
    return {
      status: "awaiting_confirmation",
      pendingPlan: plan,
      error: { code: "NGS_PLAN_APPROVAL_REQUIRED", message: "The exact NGS plan was created for review. Approve this plan_id, plan_name, and plan_checksum through the DSH host before execution." },
    };
  }

  let registryRunId = request.registryRunId;
  if (!registryRunId) {
    const started = await executeStep(
      ["ngs", "execute_plan", {
        plan_id: plan!.planId,
        plan_name: plan!.planName,
        plan_checksum: plan!.planChecksum,
      }],
      executor,
      context,
      viewerSessions,
      steps,
    );
    if (started.error) return { status: "failed", error: started.error };
    registryRunId = requiredResultString(started.result, "registry_run_id");
  }
  const attempts = Math.max(1, Math.min(20, request.maxObservationAttempts ?? 3));
  let observed: Awaited<ReturnType<typeof executeStep>> | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    observed = await executeStep(["ngs", "observe_ngs_run", { registry_run_id: registryRunId }], executor, context, viewerSessions, steps);
    if (observed.error && !observationIsTerminal(observed.result)) return { status: "failed", error: observed.error };
    if (observationIsTerminal(observed.result)) break;
  }
  if (!observed || !observationIsTerminal(observed.result)) {
    const state = typeof observed?.result.state === "string" ? observed.result.state : "running";
    return { status: "running", registryRunId, error: { code: "NGS_RUN_STILL_RUNNING", message: `NGS run ${registryRunId} remains ${state} after ${attempts} read-only observation attempt${attempts === 1 ? "" : "s"}; no report was requested.` } };
  }
  if (observed.result.state === "cancelled") {
    return { status: "cancelled", registryRunId, error: { code: "NGS_RUN_CANCELLED", message: `NGS run ${registryRunId} was cancelled.` } };
  }
  if (observed.result.state !== "completed") {
    return { status: "failed", registryRunId, error: { code: `NGS_RUN_${String(observed.result.state ?? "TERMINAL").toUpperCase()}`, message: `NGS run ${registryRunId} reached terminal state ${String(observed.result.state ?? "unknown")}.` } };
  }
  const report = await executeStep(["ngs", "get_ngs_run_report", { registry_run_id: registryRunId }], executor, context, viewerSessions, steps);
  if (report.error) return { status: "failed", registryRunId, error: report.error };
  if (report.result.availability !== "available" || !report.result.report || typeof report.result.report !== "object") {
    return { status: "failed", registryRunId, error: { code: "NGS_REPORT_UNAVAILABLE", message: `NGS run ${registryRunId} completed, but no reproducible run report is available.` } };
  }
  return { status: "completed", registryRunId };
}

export async function reproduceShowcase(
  showcase: ShowcaseDefinition,
  providerId: string,
  executor: ScienceExecutor,
  context: ShowcaseReproductionContext,
): Promise<ReproductionResult> {
  const steps: ReproductionStepResult[] = [];
  const viewerSessions = new Map<string, string>();
  const sourceRequirement = SOURCE_REQUIRED_REPRODUCTIONS[showcase.id];
  if (sourceRequirement) {
    const result = await reproduceSlideShowcase(showcase, executor, context, viewerSessions, steps);
    if (result.error?.code === "REPRODUCTION_INPUT_REQUIRED") result.error.message = sourceRequirement;
    return result;
  }
  if (showcase.id === "rosalind-molecular-design") {
    return {
      status: "awaiting_confirmation",
      summary: `${showcase.title}: a provider-specific design plan must be reviewed before execution.`,
      steps,
      error: {
        code: providerId === "local-replay" ? "REPRODUCTION_PROVIDER_REQUIRED" : "REPRODUCTION_CONFIRMATION_REQUIRED",
        message: providerId === "local-replay"
          ? "local-replay can inspect the retained CSV and CIF artifacts, but it cannot create a new nanobody design run. Select one provider and supply target, candidate, model/checkpoint, seed, compute, and output-directory settings."
          : `Provider ${providerId} requires an explicit target/candidate configuration, model/checkpoint, seed, compute estimate, output directory, credentials where applicable, and user confirmation before a job can start.`,
      },
    };
  }
  if (isNgsShowcase(showcase)) {
    const ngs = await reproduceNgsShowcase(showcase, executor, context, viewerSessions, steps);
    if (ngs.status !== "completed") return { status: ngs.status, summary: `${showcase.title}: ${ngs.error?.message ?? ngs.status}`, steps, ...(ngs.error ? { error: ngs.error } : {}), ...(ngs.pendingPlan ? { pendingPlan: ngs.pendingPlan } : {}), ...(ngs.registryRunId ? { registryRunId: ngs.registryRunId } : {}) };
    return { status: "completed", summary: `${showcase.title} launched and observed through ${steps.length} NGS operations.`, steps };
  }
  for (const [serviceId, operation, args] of callsFor(showcase, providerId)) {
    const executed = await executeStep([serviceId, operation, args], executor, context, viewerSessions, steps);
    if (executed.error) return { status: "failed", summary: `${showcase.title}: ${executed.error.message}`, steps, error: executed.error };
  }
  return {
    status: "completed",
    summary: `${showcase.title} completed through ${steps.length} scientific operation${steps.length === 1 ? "" : "s"}.`,
    steps,
  };
}
