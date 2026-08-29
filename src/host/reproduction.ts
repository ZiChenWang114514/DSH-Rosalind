import type { JsonValue } from "@deepseek-ai/dsh-tools";

import type { ShowcaseDefinition } from "../shared/types.js";
import type { ScienceExecutionContext, ScienceExecutor } from "./science-tools.js";

export interface ReproductionStepResult {
  serviceId: string;
  operation: string;
  result: Record<string, JsonValue>;
}

export interface ReproductionResult {
  status: "completed" | "failed";
  summary: string;
  steps: ReproductionStepResult[];
  error?: { code: string; message: string };
}

type CallSpec = [serviceId: string, operation: string, args: Record<string, unknown>];

function casePath(showcase: ShowcaseDefinition, relative: string): string {
  return `${showcase.readmePath.slice(0, -"README.md".length)}${relative}`;
}

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
      const workflowId = showcase.id === "ngs-fastq-qc" ? "oai_fastq_qc" : showcase.id === "ngs-bulk-rnaseq" ? "oai_bulk_rnaseq_counts_qc" : "oai_scrnaseq_fastq_to_count";
      const engine = "snakemake";
      return [
        ["ngs", "list_workflows", { engine, include_archived: false }],
        ["ngs", "get_runtime_environment", {}],
        ["ngs", engine === "snakemake" ? "check_snakemake_readiness" : "check_nextflow_readiness", { workflow_id: workflowId, run_dir: `.rosalind-runs/${showcase.id}` }],
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
        ["structure", "structure.validate_render", { format: "png", width: 1600, height: 1200 }],
        ["structure", "structure.render_image", { format: "png", width: 1600, height: 1200, outputPath: `.rosalind-runs/${showcase.id}/gfp-figure.png` }],
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
    case "rosalind-genomics":
    case "rosalind-scientific-compute":
      return [["rosalind", "rosalind.open", { area: showcase.id.replace("rosalind-", "") }]];
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
  const explicitlyFailed = result.ok === false;
  const readinessBlocked = result.ready === false;
  if (!["failed", "blocked", "unavailable", "cancelled"].includes(status) && !readinessBlocked && !explicitlyFailed) return undefined;
  const error = result.error && typeof result.error === "object" && !Array.isArray(result.error)
    ? result.error as Record<string, JsonValue>
    : undefined;
  return {
    code: typeof error?.code === "string"
      ? error.code
      : typeof result.code === "string"
        ? result.code
        : status.toUpperCase(),
    message: typeof error?.message === "string"
      ? error.message
      : Array.isArray(result.diagnostics) && result.diagnostics.every((item) => typeof item === "string")
        ? result.diagnostics.join(" ")
        : `Scientific operation reported ${readinessBlocked ? "readiness=false" : explicitlyFailed ? "ok=false" : status}.`,
  };
}

export async function reproduceShowcase(
  showcase: ShowcaseDefinition,
  providerId: string,
  executor: ScienceExecutor,
  context: ScienceExecutionContext,
): Promise<ReproductionResult> {
  const steps: ReproductionStepResult[] = [];
  const viewerSessions = new Map<string, string>();
  for (const [serviceId, operation, args] of callsFor(showcase, providerId)) {
    if (context.signal.aborted) throw context.signal.reason ?? new Error("reproduction cancelled");
    const sessionId = viewerSessions.get(serviceId);
    const resolvedArgs = sessionId && args.sessionId === undefined
      ? { ...args, sessionId }
      : args;
    const result = await executor.execute(serviceId, operation, resolvedArgs, context);
    steps.push({ serviceId, operation, result });
    if (typeof result.viewerSessionId === "string" && result.viewerSessionId.trim()) {
      viewerSessions.set(serviceId, result.viewerSessionId);
    }
    const error = failedResult(result);
    if (error) return { status: "failed", summary: `${showcase.title}: ${error.message}`, steps, error };
  }
  return {
    status: "completed",
    summary: `${showcase.title} completed through ${steps.length} scientific operation${steps.length === 1 ? "" : "s"}.`,
    steps,
  };
}
