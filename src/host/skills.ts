import type { SkillRegistration } from "@deepseek-ai/dsh-skill";

import { DATABASE_SKILL_SPECS, createDatabaseSkills } from "../modules/life-sciences-databases.js";
import { LITERATURE_SKILL_SPECS, createLiteratureSkills } from "../modules/life-sciences-literature.js";
import { findPackageRoot } from "./catalog.js";
import { createSkillRegistrations, type SkillSpec } from "./skill-registration.js";

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

export const SCIENCE_SKILL_SPECS = [...LITERATURE_SKILL_SPECS, ...DATABASE_SKILL_SPECS, ...viewersAndNgs] as const;

export function createCoreScienceSkills(
  packageRoot = findPackageRoot(),
  serviceId?: SkillSpec["serviceId"],
): SkillRegistration[] {
  return createSkillRegistrations(
    viewersAndNgs.filter((spec) => serviceId === undefined || spec.serviceId === serviceId),
    packageRoot,
  );
}

export function createScienceSkills(packageRoot = findPackageRoot(), serviceId?: SkillSpec["serviceId"]): SkillRegistration[] {
  if (serviceId === "literature") return createLiteratureSkills(packageRoot);
  if (serviceId === "databases") return createDatabaseSkills(packageRoot);
  if (serviceId !== undefined) return createCoreScienceSkills(packageRoot, serviceId);
  return [
    ...createLiteratureSkills(packageRoot),
    ...createDatabaseSkills(packageRoot),
    ...createCoreScienceSkills(packageRoot),
  ];
}
