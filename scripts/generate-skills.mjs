import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const literature = [
  ["biorxiv-skill", "bioRxiv and medRxiv", ["biorxiv", "medrxiv"]],
  ["ncbi-entrez-skill", "NCBI Entrez literature", ["ncbi-entrez"]],
  ["ncbi-pmc-skill", "NCBI PubMed Central", ["ncbi-pmc"]],
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

function publicRequestSkill(name, title, tool, providers) {
  const requestedProviders = providers.map((provider) => `\`provider: "${provider}"\``).join(" or ");
  return document(name, `Use ${title} through DSH-Rosalind's typed public-service request tool.`, `
# ${title}

Use \`${tool}\` with ${requestedProviders}. Select the source requested by the user. Do not silently replace a requested service with another provider, mirror, archive, or identifier resolver.

## Request and pagination

Use the typed fields accepted by the selected provider. Start with a narrow query and one modest page; retain the returned cursor, page token, offset, or HATEOAS link when more records are requested. Do not enlarge a request merely because the first response is incomplete. Request raw or machine-readable output only when the user asks for it, and report a saved artifact path instead of pasting a large payload.

## Evidence and reporting

Keep the provider, request parameters, identifiers, response time, official source URL, and returned record identifiers with the result. Link substantive claims only to returned source records. Separate returned observations from interpretation, describe empty or failed responses plainly, and refresh stale network results before relying on them in a long conversation.

## Authorization and cancellation

This Skill uses only the registered public-service provider. Respect any host prompt or user restriction on external access, and do not use a different service when the requested one is unavailable. A request inherits conversation cancellation; after cancellation, do not reissue it unless the user asks again.
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
    const operations = [...line.matchAll(/([a-zA-Z][a-zA-Z0-9]*):\s*\{\s*path:/g)].map((match) => match[1]);
    metadata.set(id, { id, label, baseUrl, defaultPath, pagination, operations });
  }
  return metadata;
}

function databaseSkill(name, title, provider) {
  const operations = provider.operations.length
    ? provider.operations.map((operation) => `\`${operation}\``).join(", ")
    : "the provider's default query";
  return publicRequestSkill(name, title, "database_request", [provider.id]).replace(
    "## Request and pagination",
    `## Fixed provider contract\n\nThe registered provider is \`${provider.id}\` (${provider.label}) at \`${provider.baseUrl}\`. Its default relative route is \`${provider.defaultPath || "/"}\`; named \`operation\` values are ${operations}. Pagination mode is \`${provider.pagination}\`. Use only a named operation or a relative path documented by that official service. The runtime rejects undeclared origins and non-HTTPS absolute paths.\n\nUse \`id\`, \`identifier\`, \`accession\`, \`variant\`, \`target\`, \`gene\`, \`disease\`, \`dataset\`, \`term\`, or typed \`params\` only when the selected operation accepts them. GraphQL and POST providers use \`query\`, \`variables\`, \`body\`, or \`json_body\`; do not invent fields that the source does not define.\n\n## Request and pagination`,
  );
}

const specialSkills = {
  "sequence/biological-sequence-viewer": document("biological-sequence-viewer", "Open and inspect biological sequence, alignment, annotation, and sequencing artifacts with DSH-Rosalind.", `
# Biological Sequence and Alignment Viewer

Use \`sequence_open_from_chat\` with an exact authorized local path to create a viewer session. A successful call creates a session but does not prove that the viewer has rendered. Read current state with \`sequence_query_viewer\` before reporting selection, coordinates, records, metrics, or analysis results.

For an existing viewer card, reuse its session with \`sequence_control_viewer\`; use its display-mode action to move it to the side pane rather than opening a duplicate. Use \`sequence_run_analysis\` only for a requested analysis and retain its inputs, selected records, coordinate convention, method, and result identifiers. Use \`sequence_cancel_job\` only for the exact running job the user asks to stop.

Edits and exports require explicit user intent. Use \`sequence_export_artifact\` for requested outputs, keep private artifacts private unless an authorized destination is confirmed, and identify the saved artifact and its source revision. Page record, feature, chromatogram, and alignment queries rather than inferring undisplayed content. Preserve imported annotation qualifiers and coordinate provenance.

Do not read raw file bytes merely to open the viewer, do not claim an unsupported viewer comparison, and do not repeat a cancelled action automatically. Record source identity, revision, viewer session, analysis parameters, and generated artifact IDs in scientific reporting.
`),
  "ngs/design-ngs-analysis": document("design-ngs-analysis", "Design a defensible NGS analysis before workflow selection or execution.", `
# Design NGS Analysis

Clarify the scientific question, experimental units, groups, covariates, contrasts, endpoints, assay, reference, QC criteria, expected outputs, and limits on interpretation. This Skill is read-only and does not register or execute a workflow. Distinguish an analysis design from a compute-ready implementation and identify evidence that still needs review.

Record the intended method, sample and reference provenance, assumptions, exclusions, and supportable claims. Do not treat a proposed workflow, dataset description, or successful software check as a scientific result.
`),
  "ngs/ngs-analysis-workbench": document("ngs-analysis-workbench", "Route NGS requests to data understanding, design, execution, or results interpretation.", `
# NGS Analysis Workbench

Route a concrete goal directly to its focused skill: inspect starting material with Understand NGS Data, design a study with Design NGS Analysis, prepare or operate a run with Run NGS Analysis, and interpret available output with Understand NGS Results. Keep the current scientific question, material, plan identity, run identity, and observed state connected across these activities.

For broad requests, explain which information is needed next. Do not register, install, download, or execute a workflow merely while routing the request.
`),
  "ngs/run-ngs-analysis": document("run-ngs-analysis", "Prepare, authorize, observe, cancel, and interpret an NGS workflow run.", `
# Run NGS Analysis

Inspect registered compute targets with \`ngs_list_compute_targets\`, \`ngs_inspect_compute_target\`, and \`ngs_get_runtime_environment\`. Inspect candidate workflows and their exact revisions before selection. Discovery, catalog inspection, and readiness checks do not authorize installation, downloads, setup hooks, workflow execution, or a dry run.

After a user-selected workflow is available, use \`ngs_check_nextflow_readiness\` or \`ngs_check_snakemake_readiness\`, then create a matching plan with \`ngs_plan_nextflow\` or \`ngs_plan_snakemake\`. Preserve target, absolute run directory, workflow revision, inputs, reference material, configuration, samplesheet, and preparation records. Keep unknown requirements distinct from missing ones.

Call \`ngs_execute_plan\` only with the exact identity returned by the planner. The host-native approval request is the only authorization for preparation and execution; prose or a structured prompt cannot authorize it. After a denial, wait for a new user request. Do not change service, compute target, workflow, or revision silently when a selected option is unavailable.

After start, retain \`registry_run_id\`, target, and run directory. Read the current in-process run record with \`ngs_get_ngs_run\`, then observe with \`ngs_observe_ngs_run\` until a terminal state. This record remains available only while the current DSH plugin instance is running; keep external workflow outputs in the declared run directory. Use \`ngs_cancel_ngs_run\` only when the user explicitly requests cancellation and with the exact run identity. Do not start another run after an unavailable observation or cancellation.

For completed, partial, failed, cancelled, or orphaned work, inspect actual outputs and logs before interpretation. Record workflow, sample, method, configuration, reference, run, result, and failure provenance. Write the requested analysis summary through \`ngs_update_ngs_run_analysis_summary\`; a status page or file list alone is not a scientific conclusion.
`),
  "ngs/understand-ngs-data": document("understand-ngs-data", "Inspect NGS inputs and evidence before choosing a workflow.", `
# Understand NGS Data

Inspect available reads, matrices, metadata, references, prior plans, runs, and result artifacts without choosing a workflow, installing software,
transforming inputs, or creating an execution plan. Record identity, role, provenance, observed state, assay, sample relationships, and material limitations.

Separate what is observed from what is inferred. Explain which questions the available material can support and what is absent or uncertain. Do not create a run merely to preserve an inspection summary.
`),
  "ngs/understand-ngs-results": document("understand-ngs-results", "Interpret observed NGS outputs and execution history without inventing unsupported claims.", `
# Understand NGS Results

Use \`ngs_get_ngs_run\` and \`ngs_observe_ngs_run\` to obtain recorded run identity, lifecycle, inputs, workflow revision, configuration, reference, output paths, logs, and result projection. Interpret only verified artifacts. Distinguish completed results from partial, failed, cancelled, or orphaned execution.

Report the scientific question, assay, method, observed findings, provenance, unsupported claims, limitations, and next permitted action. Do not re-run a workflow merely to obtain an interpretation, and do not treat plan approval or a status label as evidence of scientific validity.
`),
  "structure/structure-viewer": document("structure-viewer", "Open, inspect, analyze, and export molecular structure sessions with DSH-Rosalind.", `
# Molecular Structure Viewer

Open an authorized structure with \`structure_open_from_chat\` and inspect the active session with \`structure_get_state\`. Use current session state before reporting selections, residue numbering, chains, calculated properties, render status, or scene contents. Reuse a mounted session rather than opening a duplicate to move or change the display.

Use registered \`structure_\` operations for requested selection, analysis, scene styling, rendering, animation, and export. Preserve source identity, revision, model and chain selection, calculation parameters, scene state, and output artifact IDs. Export only when requested and only to an authorized destination.

Render and analysis jobs may be cancelled only with their exact active job identity and explicit user instruction. Do not turn an unavailable source, viewer, or service into an automatic provider substitution. Treat an unfinished render, an empty selection, or a visual scene as observation rather than structural proof.
`),
  "slide/slide-viewer": document("slide-viewer", "Open, inspect, analyze, and export slide and spatial data with DSH-Rosalind.", `
# Slide Viewer

Open an authorized slide or spatial source, then use \`slide_get_viewer_state\` before stating viewport, selected region, layer, annotation, measurement, or workflow status. Reuse the current session with \`slide_control_viewer\` for display changes instead of opening another viewer.

Use \`slide_query_scientific_layer\`, \`slide_list_scientific_layers\`, and \`slide_get_scientific_entity\` for paged source-backed queries. Use \`slide_run_analysis_from_chat\` or \`slide_run_pathology\` only for a requested workflow. Read progress with \`slide_get_workflow\` or \`slide_get_pathology\`; use \`slide_read_workflow_artifact\` for an identified result.

Only explicit user intent permits stopping work: use \`slide_cancel_workflow\` or \`slide_cancel_pathology\` with the exact active identity. Use \`slide_resume_workflow\` or \`slide_resume_pathology\` only when the recorded workflow supports resumption. Preserve source revision, selected region, parameters, model or method version, workflow identity, generated artifact identifiers, and result limitations. Do not automatically switch to another source or analysis service when a requested service is unavailable.
`),
};

const generated = [];
for (const [name, title, providers] of literature) generated.push({ path: `literature/${name}/SKILL.md`, content: publicRequestSkill(name, title, "literature_request", providers) });
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
console.log(`Generated ${generated.length} project-authored Skill documents.`);
