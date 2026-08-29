import { readFileSync } from "node:fs";
import { dirname } from "node:path";

import type { SkillRegistration } from "@deepseek-ai/dsh-skill";

import { findPackageRoot, resolveInside } from "./catalog.js";

interface SkillSpec {
  serviceId: "literature" | "databases" | "sequence" | "ngs" | "structure" | "slide";
  sourceName: string;
  title: string;
  description: string;
  /** A fixed primary tool only when the source Skill itself names one. */
  tool?: string;
  executionMode?: "primary-tool" | "reasoning-only" | "routing" | "inspection-guided";
}

const literature: SkillSpec[] = [
  { serviceId: "literature", sourceName: "biorxiv-skill", title: "bioRxiv and medRxiv", description: "Search versioned preprints and follow publication links without conflating preprint versions with journal articles.", tool: "literature_request" },
  { serviceId: "literature", sourceName: "ncbi-entrez-skill", title: "NCBI Entrez literature", description: "Search and retrieve PubMed records with explicit pagination, identifiers, dates, and query provenance.", tool: "literature_request" },
  { serviceId: "literature", sourceName: "ncbi-pmc-skill", title: "NCBI PubMed Central", description: "Resolve PMID, PMCID, and DOI identifiers and inspect open-access, license, and article-file availability.", tool: "literature_request" },
];

const databaseNames = [
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
] as const;

const databases: SkillSpec[] = databaseNames.map(([sourceName, title]) => ({
  serviceId: "databases",
  sourceName,
  title,
  description: `Query ${title} through its public scientific interface, retain source identifiers and response metadata, and separate returned records from interpretation.`,
  tool: "database_request",
}));

const viewersAndNgs: SkillSpec[] = [
  { serviceId: "sequence", sourceName: "biological-sequence-viewer", title: "Biological Sequence and Alignment Viewer", description: "Open, inspect, analyze, edit safe copies, and export biological sequence, alignment, annotation, and FASTQ data.", tool: "sequence_open_from_chat" },
  { serviceId: "ngs", sourceName: "design-ngs-analysis", title: "Design NGS analysis", description: "Translate a biological question and assay design into an executable, reviewable NGS workflow plan.", executionMode: "reasoning-only" },
  { serviceId: "ngs", sourceName: "ngs-analysis-workbench", title: "NGS Analysis Workbench", description: "Coordinate NGS data understanding, workflow selection, readiness, execution, observation, and interpretation.", executionMode: "routing" },
  { serviceId: "ngs", sourceName: "run-ngs-analysis", title: "Run NGS analysis", description: "Check compute readiness, prepare a Nextflow or Snakemake plan, request approval when required, and observe a real run.", tool: "ngs_execute_plan" },
  { serviceId: "ngs", sourceName: "understand-ngs-data", title: "Understand NGS data", description: "Inspect reads, matrices, metadata, references, and assay constraints before choosing a workflow.", executionMode: "inspection-guided" },
  { serviceId: "ngs", sourceName: "understand-ngs-results", title: "Understand NGS results", description: "Interpret completed, partial, failed, cancelled, or historical NGS runs from recorded outputs and run provenance.", tool: "ngs_get_ngs_run" },
  { serviceId: "structure", sourceName: "structure-viewer", title: "Molecular Structure Viewer", description: "Load, query, analyze, compare, style, animate, and export molecular structures while retaining scene and calculation provenance.", tool: "structure_get_state" },
  { serviceId: "slide", sourceName: "slide-viewer", title: "Slide Viewer", description: "Open and control whole-slide, DICOM, OME, spatial-expression, annotation, segmentation, and pathology workflow data.", tool: "slide_get_viewer_state" },
];

export const SCIENCE_SKILL_SPECS = [...literature, ...databases, ...viewersAndNgs] as const;

function runtimeName(spec: SkillSpec): string {
  const base = spec.sourceName.replace(/-skill$/, "");
  return `rosalind-${spec.serviceId}-${base}`;
}

function stripFrontmatter(value: string): string {
  return value.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

function sourceSkillPath(spec: SkillSpec, packageRoot: string): string {
  const relativePath = `skills/${spec.serviceId}/${spec.sourceName}/SKILL.md`;
  return resolveInside(packageRoot, relativePath);
}

function instructionBody(spec: SkillSpec, packageRoot: string): string {
  return stripFrontmatter(readFileSync(sourceSkillPath(spec, packageRoot), "utf8"));
}

export function createScienceSkills(packageRoot = findPackageRoot()): SkillRegistration[] {
  return SCIENCE_SKILL_SPECS.map((spec) => {
    const path = sourceSkillPath(spec, packageRoot);
    return {
      name: runtimeName(spec),
      description: spec.description,
      whenToUse: `Use for ${spec.title} research tasks in DSH-Rosalind.`,
      content: instructionBody(spec, packageRoot),
      source: "bundled",
      provider: "dsh-rosalind",
      path,
      resourceBase: { kind: "directory", path: dirname(path) },
      invocation: { modelInvocable: true, userInvocable: true },
    };
  });
}
