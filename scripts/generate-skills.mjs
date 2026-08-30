import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const literature = [
  ["biorxiv-skill", "bioRxiv and medRxiv", ["biorxiv", "medrxiv"], "details"],
  ["ncbi-entrez-skill", "NCBI Entrez literature", ["ncbi-entrez"], "search"],
  ["ncbi-pmc-skill", "NCBI PubMed Central", ["ncbi-pmc"], "search"],
];

const databases = [
  ["alphafold-skill", "AlphaFold DB"], ["bgee-skill", "Bgee"], ["bindingdb-skill", "BindingDB"],
  ["biobankjapan-phewas-skill", "BioBank Japan PheWAS"], ["biostudies-arrayexpress-skill", "BioStudies and ArrayExpress"],
  ["cbioportal-skill", "cBioPortal"], ["cellxgene-skill", "CELLxGENE"], ["chebi-skill", "ChEBI"],
  ["chembl-skill", "ChEMBL"], ["civic-skill", "CIViC"], ["clinicaltrials-skill", "ClinicalTrials.gov"],
  ["clinvar-variation-skill", "ClinVar and NCBI Variation"], ["efo-ontology-skill", "Experimental Factor Ontology"],
  ["encode-skill", "ENCODE"], ["ensembl-skill", "Ensembl"], ["epigraphdb-skill", "EpiGraphDB"],
  ["eqtl-catalogue-skill", "eQTL Catalogue"], ["eva-skill", "European Variation Archive"],
  ["finngen-phewas-skill", "FinnGen PheWAS"], ["genebass-gene-burden-skill", "Genebass gene burden"],
  ["gnomad-graphql-skill", "gnomAD"], ["gtex-eqtl-skill", "GTEx eQTL"], ["gwas-catalog-skill", "GWAS Catalog"],
  ["human-protein-atlas-skill", "Human Protein Atlas"], ["ipd-skill", "IPD"], ["metabolights-skill", "MetaboLights"],
  ["mgnify-skill", "MGnify"], ["ncbi-clinicaltables-skill", "NCBI Clinical Tables"],
  ["ncbi-datasets-skill", "NCBI Datasets"], ["ncbi-entrez-skill", "NCBI Entrez biological records"],
  ["opentargets-skill", "Open Targets"], ["pharmgkb-skill", "PharmGKB"], ["pride-skill", "PRIDE"],
  ["proteomexchange-skill", "ProteomeXchange"], ["pubchem-pug-skill", "PubChem PUG REST"],
  ["quickgo-skill", "QuickGO"], ["rcsb-pdb-skill", "RCSB PDB"], ["reactome-skill", "Reactome"],
  ["rhea-skill", "Rhea"], ["rnacentral-skill", "RNAcentral"], ["string-skill", "STRING"],
  ["tpmi-phewas-skill", "TPMI PheWAS"], ["ukb-topmed-phewas-skill", "UKB-TOPMed PheWAS"],
  ["uniprot-skill", "UniProt"],
];

function document(name, description, body) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body.trim()}\n`;
}

/**
 * DSH-specific tool mappings layered onto the fixed-version Skill documents.
 */
const DATABASE_CONTRACTS = {
  alphafold: ["predicted structure metadata, a UniProt summary, sequence coverage, or AlphaFold annotations", "prediction, uniprot, sequence, or annotations with one UniProt accession; annotations may include `params.type`", "prediction metadata or compact annotation records"],
  bgee: ["healthy wild-type expression metadata or a narrowly scoped Bgee SPARQL question", "a read-only `query` or `sparql` string; keep a SELECT query bounded with LIMIT", "SPARQL result bindings"],
  bindingdb: ["ligand-target binding records by PDB entry, UniProt accession, SMILES, or compound", "pdb, uniprot, smiles, or compound plus the source-specific cutoff and response parameters when needed", "compact ligand, target, or affinity records"],
  "biobankjapan-phewas": ["BioBank Japan phenotype associations for one variant", "exactly one of `rsid`, `grch37`, `grch38`, or `variant`; optionally `max_items`", "the canonical queried variant, association count, and truncation state"],
  "biostudies-arrayexpress": ["BioStudies or ArrayExpress study discovery and accession metadata", "search or arrayexpress with `query`, or study with an accession; use page and pageSize for discovery", "study hits or an accession-specific study record"],
  cbioportal: ["cancer study discovery, molecular profiles, or mutation records", "studies for discovery; mutations requires a profile and a JSON body with sample list and Entrez genes", "study, profile, clinical, sample, or mutation records"],
  cellxgene: ["CELLxGENE public collection discovery or a collection record", "collection with a collection ID, or the bounded collections listing", "collection metadata and dataset references"],
  chebi: ["a ChEBI compound, chemical name search, or ontology relationship", "search with a text query or compound with a CHEBI identifier", "compound properties or ontology terms"],
  chembl: ["ChEMBL activity, molecule, target, mechanism, or name-search data", "activity, molecule, target, mechanism, or search plus a ChEMBL ID or concise query", "activity, molecule, target, or mechanism records"],
  civic: ["CIViC cancer-variant evidence with a focused GraphQL question", "a GraphQL `query` and optional `variables`; request only needed fields", "CIViC evidence records or a GraphQL diagnostic"],
  clinicaltrials: ["ClinicalTrials.gov study search, API metadata, field values, or enumerations", "studies with typed `params`, or metadata, searchareas, enums, field_values, and field_sizes as appropriate", "study pages, metadata, or field-statistics records"],
  "clinvar-variation": ["ClinVar search results or a VCV, RCV, SCV, or RefSNP record", "search with `terms`, or vcv, rcv, scv, or refsnp with the matching identifier", "clinical-table rows or a Variation API record"],
  "efo-ontology": ["an EFO term search, term record, descendants, or children", "search with text and ontology=efo, or term with a double-encoded EFO IRI", "ontology term records and relationship pages"],
  encode: ["ENCODE accession metadata or a focused portal search", "an accession `path`, or search with an assay/type query and bounded `limit`", "ENCODE object metadata or search graph records"],
  ensembl: ["an Ensembl lookup, region overlap, cross-reference, or variation record", "lookup, overlap, xrefs, or variation with a stable identifier, species, or genomic region", "gene, region, variation, or xref records"],
  epigraphdb: ["EpiGraphDB ontology, literature, MR, gene-drug, or druggability evidence", "a targeted relative `path` with its documented query parameters", "targeted evidence records rather than a broad graph dump"],
  "eqtl-catalogue": ["eQTL Catalogue association evidence for a dataset or rsID", "associations with `rsid`, or dataset with `dataset` and rsid; use modest page size", "association records, empty results, or an HTTP diagnostic"],
  eva: ["European Variation Archive species, clustered-variant, or study metadata", "species, identifiers, or a documented EVA path with an accession", "EVA metadata or variation records"],
  "finngen-phewas": ["FinnGen phenotype associations for one variant", "exactly one of `rsid`, `grch37`, `grch38`, or `variant`; optionally `max_items`", "canonical variant, association count, regions, and truncation state"],
  "genebass-gene-burden": ["Genebass gene-burden associations", "an Ensembl gene identifier and optional burden set (`pLoF`, `missense|LC`, or `synonymous`)", "burden-set and phenotype association records"],
  "gnomad-graphql": ["gnomAD variant frequency, gene constraint, or consequence context", "a focused GraphQL `query` or package-relative `query_path`, with `variables`", "GraphQL data or a validation diagnostic"],
  "gtex-eqtl": ["GTEx single-tissue eQTL associations for a resolved variant", "exactly one `rsid`, `grch37`, `grch38`, or `variant`; the service resolves to GRCh38", "canonical GRCh38 variant and bounded eQTL rows"],
  "gwas-catalog": ["GWAS Catalog studies, associations, SNPs, loci, genes, publications, or EFO traits", "a named resource and its trait, SNP, gene, study, or publication identifier", "GWAS association or catalogue records with pagination"],
  "human-protein-atlas": ["Human Protein Atlas gene expression, tissue, or cell-line information", "gene, tissue, or cellline with a gene symbol or concise search term", "expression-oriented source records or downloadable tabular metadata"],
  ipd: ["IPD allele or cell-level metadata", "the allele, cell, or download operation with a specific identifier where required", "IPD allele or cell records"],
  metabolights: ["MetaboLights study discovery or study-level metabolomics metadata", "study with an MTBLS accession or a bounded studies query", "study summaries or study metadata"],
  mgnify: ["MGnify microbiome studies, samples, or biome metadata", "studies, samples, or biomes with concise filters and paging", "microbiome study, sample, or biome records"],
  "ncbi-clinicaltables": ["NCBI Clinical Tables human-gene lookup", "a gene `terms` query and optional `offset`, `count`, `df`, `sf`, `ef`, or `extra_fields`", "total count and display rows"],
  "ncbi-datasets": ["NCBI Datasets gene, genome, or taxonomy metadata", "gene, genome, or taxonomy with a stable symbol, accession, or taxon", "dataset reports or bounded records"],
  "ncbi-entrez": ["NCBI E-Utilities data outside the literature-only PubMed workflow", "search, summary, fetch, or links with explicit `db`, identifier or term, and `retmode`", "Entrez IDs, summaries, fetch output, or linked records"],
  opentargets: ["Open Targets target-disease evidence", "a focused GraphQL `query`, or target with an Ensembl ID and optional disease", "target identity and association-score rows"],
  pharmgkb: ["PharmGKB gene, variant, clinical-annotation, or dosing-guideline data", "gene, variant, clinicalannotation, or dosingguideline with a PharmGKB identifier", "PharmGKB evidence and clinical annotation records"],
  pride: ["PRIDE Archive project discovery or a project accession", "projects with a small search query, or project with PXD accession", "project metadata and study records"],
  proteomexchange: ["ProteomeXchange datasets, libraries, peptidoforms, proteins, PSMs, or spectra", "dataset, library, or peptidoform with an accession or targeted query", "PROXI dataset and proteomics records"],
  "pubchem-pug": ["PubChem compound identity or property data", "cid, property, or name with a CID or compound name", "PubChem property or information records"],
  quickgo: ["QuickGO GO-term, annotation, children, or ancestry information", "term or annotation with a GO identifier or bounded filter", "GO term or annotation records"],
  "rcsb-pdb": ["RCSB PDB entry, assembly, FASTA, or a structured PDB search", "entry, assembly, fasta, or search with a PDB ID or a focused POST JSON query", "PDB core metadata, assembly data, FASTA preview, or search results"],
  reactome: ["Reactome event, participant, pathway, or search information", "event, participants, pathways, or a focused search using a stable event/protein identifier", "Reactome pathway and participant records"],
  rhea: ["a Rhea biochemical reaction or equation through SPARQL", "a targeted `query` with a reaction identifier, `LIMIT`, and JSON result format", "Rhea reaction bindings"],
  rnacentral: ["RNAcentral entry discovery, an RNA entry, or cross-references", "rna or xrefs with a URS identifier; use page size for discovery", "RNAcentral records and xrefs"],
  string: ["STRING interaction network, partners, or enrichment", "network, partners, or enrichment with identifiers, species, and optional small limit", "network edges, partners, or enrichment records"],
  "tpmi-phewas": ["TPMI PheWAS associations for one variant", "exactly one of `rsid`, `grch37`, `grch38`, or `variant`; optionally `max_items`", "canonical variant, association count, and truncation state"],
  "ukb-topmed-phewas": ["UKB-TOPMed PheWAS associations for one variant", "exactly one of `rsid`, `grch37`, `grch38`, or `variant`; optionally `max_items`", "canonical variant, association count, and truncation state"],
  uniprot: ["UniProtKB, UniRef, UniParc, or protein FASTA metadata", "entry, search, uniref, uniparc, or stream with a stable accession or concise query", "protein records, clusters, or a bounded text preview"],
};

const LITERATURE_CONTRACTS = {
  "biorxiv-skill": ["bioRxiv or medRxiv preprint metadata, versions, and publication linkage", "a details or publication-link action with a DOI, or a date range plus one cursor page", "versioned preprint records, publication links, and pagination"],
  "ncbi-entrez-skill": ["PubMed search, summary, fetch, or publication links", "provider: `ncbi-entrez`, explicit action `search`, `summary`, `fetch`, or `links`; keep `db=pubmed` and a small retmax", "PubMed identifiers, metadata, or a bounded XML/text result"],
  "ncbi-pmc-skill": ["PMC open-access, license, retraction, manuscript, or current article-file metadata", "provider: `ncbi-pmc` and one PMCID, PMID, DOI, or identifier; optional retmax only for an ambiguous resolver", "resolved PMCID records with availability, license, and file-URL metadata"],
};

function serviceRequestSkill({ name, title, tool, provider, sourcePackage, trigger, input, success, defaultOperation }) {
  return document(name, `Use ${title} through the fixed DSH-Rosalind service contract.`, `
# ${title}

## When to use

Use this Skill for ${trigger}. Its fixed reference is \`${sourcePackage}/skills/${name}/SKILL.md\`; the DSH mapping below preserves that source workflow while routing execution through the registered DSH service.

## Tool call sequence

1. Confirm that the requested scientific source matches \`${provider}\` and identify the smallest relevant question.
2. Call \`${tool}\` with \`provider: "${provider}"\`, \`allowNetwork: true\`, and ${input}. ${defaultOperation ? `Start with \`${defaultOperation}\` unless the requested record needs another documented operation.` : "Use the explicit action requested by the source contract."}
3. Keep one bounded page at a time. Use the returned pagination cursor or page only when the user asks for more.
4. Read the returned \`status\`, \`records\`, \`sources\`, \`request\`, and \`pagination\` before presenting a scientific conclusion.

## Success and interpretation

On \`status: "completed"\`, report ${success}. Cite only returned \`sources\`; distinguish source observations from analysis. For raw or machine-readable output, request it explicitly and provide the generated artifact path rather than pasting an unbounded payload.

## Failure, authorization, and cancellation

Live public requests need the host approval produced by \`allowNetwork: true\`. If approval is denied or the service returns \`NETWORK_NOT_AUTHORIZED\`, say that the selected source was not contacted; do not query a mirror or another provider. Preserve source-specific validation, HTTP, rate-limit, and empty-result diagnostics. The call receives the conversation cancellation signal; after cancellation, do not reissue it unless the user asks again.

## Provenance and viewer handoff

Keep provider, operation, identifiers, typed parameters, request URL or method, checked time, returned record IDs, pagination state, and source URLs with the result. This Skill has no embedded viewer: if a returned accession is later opened in a Sequence, Structure, or Slide session, record that viewer session separately instead of treating a search result as viewer evidence.
`);
}

function databaseProviderMetadata(source) {
  const metadata = new Map();
  for (const line of source.split(/\r?\n/)) {
    const id = line.match(/^\s*\{ id: "([^"]+)"/)?.[1];
    if (!id) continue;
    const label = line.match(/label: "([^"]+)"/)?.[1] ?? id;
    const baseUrl = line.match(/baseUrl: "([^"]+)"/)?.[1] ?? "";
    const defaultPath = line.match(/defaultPath: "([^"]*)"/)?.[1] ?? "";
    const pagination = line.match(/pagination: "([^"]+)"/)?.[1] ?? "none";
    const routes = [...line.matchAll(/([a-zA-Z][a-zA-Z0-9]*):\s*\{\s*path:\s*"([^"]*)"/g)].map((match) => ({
      operation: match[1],
      path: match[2],
    }));
    const operations = routes.map((route) => route.operation);
    const defaultOperation = routes.find((route) => route.path === defaultPath)?.operation;
    metadata.set(id, { id, label, baseUrl, defaultPath, pagination, operations, defaultOperation });
  }
  return metadata;
}

function databaseSkill(name, title, provider) {
  const contract = DATABASE_CONTRACTS[provider.id];
  if (!contract) throw new Error(`No project-authored Skill contract found for ${provider.id}.`);
  const [trigger, input, success] = contract;
  const operations = provider.operations.length ? provider.operations.map((operation) => `\`${operation}\``).join(", ") : "the default operation";
  const generated = serviceRequestSkill({
    name,
    title,
    tool: "database_request",
    provider: provider.id,
    sourcePackage: "life-sciences-databases-0.1.5",
    trigger,
    input,
    success,
    defaultOperation: provider.defaultOperation,
  });
  return generated.replace(
    "## Tool call sequence",
    `## Fixed provider contract\n\nThe registered provider is \`${provider.id}\` (${provider.label}) at \`${provider.baseUrl}\`. Its default relative route is \`${provider.defaultPath || "/"}\`; named \`operation\` values are ${operations}; pagination mode is \`${provider.pagination}\`. Use only a named operation or an official relative path accepted by that provider.\n\n## Tool call sequence`,
  );
}

function operationalSkill({ name, title, description, sourcePackage, when, sequence, success, failure, provenance }) {
  const normalizedWhen = when.endsWith(".") ? when.slice(0, -1) : when;
  return document(name, description, `
# ${title}

## When to use

Use this Skill when ${normalizedWhen}. Fixed reference: \`${sourcePackage}/skills/${name}/SKILL.md\`. The DSH mapping preserves the fixed-version workflow and uses DSH-Rosalind's registered tools.

## Tool call sequence

${sequence}

## Success and viewer state

${success}

## Failure, authorization, and cancellation

${failure}

## Provenance

${provenance}
`);
}

const specialSkills = {
  "sequence/biological-sequence-viewer": operationalSkill({
    name: "biological-sequence-viewer", title: "Biological Sequence and Alignment Viewer", description: "Open and inspect biological sequence, alignment, annotation, and sequencing artifacts with DSH-Rosalind.", sourcePackage: "sequence-viewer-0.1.43",
    when: "the user wants to open, inspect, analyze, safely edit, or export an authorized local FASTA, FASTQ, GenBank, EMBL, alignment, chromatogram, or SnapGene artifact.",
    sequence: "1. Resolve one authorized local path and call `sequence_open_from_chat` with that exact path.\n2. Read `sequence_query_viewer` using the returned session identity before answering questions about records, coordinates, selection, metrics, or visible tracks.\n3. Use `sequence_control_viewer` for the existing session; `sequence_run_analysis` only for a requested translation, QC, distance/tree, or alignment analysis.\n4. Use `sequence_edit_copy` and `sequence_export_artifact` only after the user asks to create a copy or output.",
    success: "Opening confirms session creation, not an already-rendered visual. Report live viewer state, including coordinate conventions and current reference, after a successful state query. Keep the current card/session when moving the viewer to the side pane instead of opening a duplicate.",
    failure: "An unavailable, changed, or unauthorized file must be reported with its diagnostic; do not guess a new source. Use `sequence_cancel_job` only for the exact running job requested by the user. Exports and edits need the host approval for their target path; a cancelled job is never automatically restarted.",
    provenance: "Keep source path and revision, viewer session, selected records and coordinate basis, analysis arguments, job/result identifiers, annotation qualifiers, and exported artifact path. A viewer selection alone is not a biological interpretation.",
  }),
  "ngs/design-ngs-analysis": operationalSkill({
    name: "design-ngs-analysis", title: "Design NGS Analysis", description: "Design a defensible NGS analysis before workflow selection or execution.", sourcePackage: "ngs-analysis-workbench-0.2.16",
    when: "a biological question needs an analysis plan before choosing or running a workflow.",
    sequence: "1. Establish objective, assay, biological experimental unit, groups, covariates, contrast, endpoint, reference, and present data state.\n2. If identities or relationships are unclear, use Understand NGS Data before selecting a method.\n3. Produce an `analysis_plan` covering validity criteria, methods, evidence required, limitations, and supported versus unsupported claims. This Skill is read-only: it does not call a run, registration, install, or download tool.",
    success: "A completed plan states a scientifically identifiable comparison and shows which result could support each claim. It is an analysis-design artifact, not a workflow result or readiness confirmation.",
    failure: "When replication, confounding, reference, or endpoint details are unresolved, state them as unknown rather than selecting a pipeline. There is no cancellable job or authorization request in this reasoning-only Skill.",
    provenance: "Retain input material identities, assay and reference assumptions, design rationale, data exclusions, validity criteria, and the plan revision that later workflow work uses.",
  }),
  "ngs/ngs-analysis-workbench": operationalSkill({
    name: "ngs-analysis-workbench", title: "NGS Analysis Workbench", description: "Route NGS requests to data understanding, design, execution, or results interpretation.", sourcePackage: "ngs-analysis-workbench-0.2.16",
    when: "an NGS request may involve data understanding, design, execution, or interpretation and needs the appropriate workflow.",
    sequence: "1. Route data identity and usability questions to Understand NGS Data.\n2. Route a decision or contrast to Design NGS Analysis.\n3. Route a user-approved operational request to Run NGS Analysis.\n4. Route completed, partial, failed, or historical output to Understand NGS Results. Preserve the question, material, plan identity, run identity, and observed status across handoffs.",
    success: "A successful route names the next focused Skill and the information that must travel with it. It does not create a workflow, install software, execute a pipeline, or claim a result.",
    failure: "For an underspecified request, explain the information needed next. There is no cancellation or authorization action while routing; do not initiate external work implicitly.",
    provenance: "Record the starting material, question, plan or run identities when present, and why the selected handoff fits the observed lifecycle.",
  }),
  "ngs/run-ngs-analysis": operationalSkill({
    name: "run-ngs-analysis", title: "Run NGS Analysis", description: "Prepare, authorize, observe, cancel, and interpret an NGS workflow run.", sourcePackage: "ngs-analysis-workbench-0.2.16",
    when: "a user has selected a concrete Nextflow or Snakemake workflow and wants a compute-ready, observable execution.",
    sequence: "1. Inspect `ngs_list_compute_targets`, `ngs_inspect_compute_target`, `ngs_get_runtime_environment`, the workflow, and its exact revision.\n2. Call `ngs_check_nextflow_readiness` or `ngs_check_snakemake_readiness`, then create the matching `ngs_plan_nextflow` or `ngs_plan_snakemake` using target, run directory, inputs, references, and configuration.\n3. Call `ngs_execute_plan` only with the exact plan_id, plan_name, and plan_checksum returned by that planner.\n4. Read `ngs_get_ngs_run`, observe with `ngs_observe_ngs_run`, then write an interpretation using `ngs_update_ngs_run_analysis_summary` only after examining outputs and logs.",
    success: "The run record provides registry_run_id, workflow revision, target, run directory, lifecycle, outputs, and execution evidence. Only completed verified outputs support a scientific conclusion; partial, failed, cancelled, and orphaned runs retain their distinct states.",
    failure: "Readiness and planning do not authorize setup or execution. `ngs_execute_plan` requires host approval for the exact plan. On denial or unavailable compute, retain diagnostics and wait for a user-directed change. Use `ngs_cancel_ngs_run` only for the specified registry_run_id; do not automatically restart a cancelled run.",
    provenance: "Keep workflow/revision, target, run directory, plan checksum, inputs, reference, configuration, preparation, registry_run_id, observation logs, artifacts, and result limitations together.",
  }),
  "ngs/understand-ngs-data": operationalSkill({
    name: "understand-ngs-data", title: "Understand NGS Data", description: "Inspect NGS inputs and evidence before choosing a workflow.", sourcePackage: "ngs-analysis-workbench-0.2.16",
    when: "the user asks what NGS material exists, how samples relate, whether inputs are usable, or which analyses the material could support.",
    sequence: "1. Inventory reads, BCL material, alignments, VCFs, count matrices, single-cell objects, metadata, references, plans, runs, and existing results.\n2. Use parsers, manifests, and recorded run metadata rather than filename guesses.\n3. Create a `starting_point_assessment` with identities, relationships, provenance, supportable tasks, missing information, and one justified handoff. Do not choose a workflow, transform inputs, install software, or create a plan.",
    success: "The assessment distinguishes observations from inferences and identifies the material that a later scientific decision can use. It does not show readiness, execution, or results.",
    failure: "Conflicting, missing, or unusable material is reported directly. This inspection-oriented Skill has no execution job, cancellation action, or approval request.",
    provenance: "Keep each artifact's identity, role, assay, source, reference/annotation context, sample relationships, durable run identities, and constraints.",
  }),
  "ngs/understand-ngs-results": operationalSkill({
    name: "understand-ngs-results", title: "Understand NGS Results", description: "Interpret observed NGS outputs and execution history without inventing unsupported claims.", sourcePackage: "ngs-analysis-workbench-0.2.16",
    when: "the user needs to interpret completed, partial, failed, cancelled, or historical NGS output.",
    sequence: "1. Call `ngs_get_ngs_run` using the exact registry_run_id and read `ngs_observe_ngs_run` for the current lifecycle.\n2. Inspect only declared output paths, logs, configuration, workflow revision, reference, and result projection relevant to the question.\n3. Write `ngs_update_ngs_run_analysis_summary` with observed findings, limitations, and the next permitted action.",
    success: "The result summary connects the question, assay, method, verified artifacts, findings, and limitations. A terminal run state is still insufficient without examining the stated outputs.",
    failure: "Do not re-run a workflow merely to obtain an interpretation. Preserve partial, failed, cancelled, or orphaned states and their diagnostics; cancellation applies only to a currently running exact registry_run_id.",
    provenance: "Record registry_run_id, workflow revision, target, run directory, configuration and reference hashes, logs, inspected artifact paths, and the summary revision.",
  }),
  "structure/structure-viewer": operationalSkill({
    name: "structure-viewer", title: "Molecular Structure Viewer", description: "Open, inspect, analyze, and export molecular structure sessions with DSH-Rosalind.", sourcePackage: "structure-viewer-0.1.80",
    when: "an authorized molecular structure needs visual inspection, selection, measurement, analysis, comparison, scene work, rendering, or export.",
    sequence: "1. Call `structure_open_from_chat` with one authorized structure path, then read `structure_get_state` before reporting atoms, residues, chains, selections, objects, or render state.\n2. Reuse the session with `structure_control_viewer`, `structure_query`, `structure_analyze`, `structure_measure`, or `structure_align_structures` as requested.\n3. Use scene, render, animation, and export tools only for the specific requested output.",
    success: "Report a viewer as ready only from the returned live state. Measurements and analyses retain their method and parameters; a rendered scene or empty selection is an observation, not structural proof.",
    failure: "Keep source, renderer, and analysis diagnostics explicit. Cancel a render only via `structure_cancel_render` with its exact job identity and explicit user request. `structure_export` needs host approval; do not substitute a viewer or external service when one is unavailable.",
    provenance: "Keep source/revision, session, object/model/chain selection, selection expression, analysis method/parameters, scene revision, render job, and output artifact IDs.",
  }),
  "slide/slide-viewer": operationalSkill({
    name: "slide-viewer", title: "Slide Viewer", description: "Open, inspect, analyze, and export slide and spatial data with DSH-Rosalind.", sourcePackage: "slide-viewer-0.1.56",
    when: "an authorized whole-slide, OME, DICOM, spatial-expression, annotation, segmentation, or pathology workflow source needs inspection or analysis.",
    sequence: "1. Open the authorized source with the appropriate `slide_open_*` tool, then call `slide_get_viewer_state` before reporting viewport, region, layer, annotation, measurement, or workflow state.\n2. Reuse the session through `slide_control_viewer`; use `slide_list_scientific_layers`, `slide_query_scientific_layer`, and `slide_get_scientific_entity` for source-backed data.\n3. Start `slide_run_analysis_from_chat`, `slide_run_pathology`, or `slide_run_workflow` only for the requested method; monitor with `slide_get_workflow` or `slide_get_pathology` and read a named artifact with `slide_read_workflow_artifact`.",
    success: "Viewer state establishes source revision and selected regions/layers. Present spatial or pathology results only after the matching job/result artifact is available and identify any model or method version.",
    failure: "Source authorization, imports, and file writes follow the host approval flow. Use `slide_cancel_workflow` or `slide_cancel_pathology` only for the exact active identity; resume only with `slide_resume_workflow` or `slide_resume_pathology` when the recorded job allows it. Do not choose a different source or service automatically.",
    provenance: "Keep source/revision, session, visible region and geometry, selected matrix/gene/layer, analysis or pathology request, model/method version, job identity, artifact IDs, and limitations.",
  }),
};

const generated = [];
for (const [name, title, providers, defaultOperation] of literature) {
  const contract = LITERATURE_CONTRACTS[name];
  if (!contract) throw new Error(`No project-authored Skill contract found for ${name}.`);
  const [trigger, input, success] = contract;
  const content = serviceRequestSkill({
    name,
    title,
    tool: "literature_request",
    provider: providers[0],
    sourcePackage: "life-sciences-literature-0.1.5",
    trigger,
    input,
    success,
    defaultOperation,
  }).replace(
    `provider: \"${providers[0]}\"`,
    providers.map((provider) => `provider: \"${provider}\"`).join(" or "),
  ).replace(
    `requested scientific source matches \`${providers[0]}\` and identify`,
    `requested scientific source matches one selected provider, ${providers.map((provider) => `\`${provider}\``).join(" or ")}. Identify`,
  );
  generated.push({ path: `literature/${name}/SKILL.md`, content });
}
const databaseSource = await readFile(join(repositoryRoot, "src", "host", "science", "databases.ts"), "utf8");
const providerMetadata = databaseProviderMetadata(databaseSource);
for (const [name, title] of databases) {
  const providerId = name.replace(/-skill$/, "");
  const provider = providerMetadata.get(providerId);
  if (!provider) throw new Error(`No fixed provider metadata found for ${providerId}.`);
  generated.push({ path: `databases/${name}/SKILL.md`, content: databaseSkill(name, title, provider) });
}
for (const [path, content] of Object.entries(specialSkills)) generated.push({ path: `${path}/SKILL.md`, content });

if (generated.length !== 55) throw new Error(`Expected 55 Skill documents, found ${generated.length}.`);

for (const item of generated) {
  const output = join(repositoryRoot, "skills", item.path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, item.content, "utf8");
}
console.log(`Generated ${generated.length} project-authored DSH Skill documents.`);
