import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";

import { createScienceSkills, SCIENCE_SKILL_SPECS } from "../src/host/skills.js";

describe("project-authored science Skills", () => {
  it("loads all 55 bundled Skill documents without a reference-plugin dependency", () => {
    const skills = createScienceSkills();

    expect(SCIENCE_SKILL_SPECS).toHaveLength(55);
    expect(skills).toHaveLength(55);
    expect(new Set(skills.map((skill) => skill.name)).size).toBe(55);
    for (const skill of skills) {
      expect(skill.path, skill.name).toBeTypeOf("string");
      expect(existsSync(skill.path!), skill.name).toBe(true);
      expect(skill.resourceBase, skill.name).toMatchObject({ kind: "directory" });
      if (skill.resourceBase?.kind === "directory") expect(existsSync(skill.resourceBase.path), skill.name).toBe(true);
      expect(relative(process.cwd(), skill.path!).replaceAll("\\", "/"), skill.name).toMatch(/^skills\/(?:literature|databases|sequence|ngs|structure|slide)\/.+\/SKILL\.md$/);
      expect(readFileSync(skill.path!, "utf8"), skill.name).not.toContain("reference-plugins/");
    }
  });

  it("documents representative DSH tools, provenance, authorization, cancellation, and pagination", () => {
    const skills = createScienceSkills();
    const literature = skills.find((skill) => skill.name === "rosalind-literature-biorxiv");
    const sequence = skills.find((skill) => skill.name === "rosalind-sequence-biological-sequence-viewer");
    const structure = skills.find((skill) => skill.name === "rosalind-structure-structure-viewer");
    const ngsRun = skills.find((skill) => skill.name === "rosalind-ngs-run-ngs-analysis");
    const slide = skills.find((skill) => skill.name === "rosalind-slide-slide-viewer");

    expect(literature?.content).toContain('provider: "biorxiv"');
    expect(literature?.content).toContain('provider: "medrxiv"');
    expect(literature?.content).toContain("bioRxiv");
    expect(literature?.content).toContain("pagination");
    expect(literature?.content).toContain("Do not silently replace");
    expect(sequence?.content).toContain("sequence_");
    expect(sequence?.content).not.toContain("sequence.open");
    expect(structure?.content).toContain("structure_");
    expect(structure?.content).not.toContain("structure.get_state");
    expect(ngsRun?.content).toContain("ngs_execute_plan");
    expect(ngsRun?.content).toContain("ngs_observe_ngs_run");
    expect(ngsRun?.content).not.toMatch(/`execute_plan`|`observe_ngs_run`/);
    for (const operation of [
      "slide_control_viewer", "slide_run_analysis_from_chat", "slide_run_pathology",
      "slide_query_scientific_layer", "slide_get_workflow", "slide_cancel_workflow",
      "slide_resume_workflow", "slide_read_workflow_artifact", "slide_get_pathology",
      "slide_cancel_pathology", "slide_resume_pathology", "slide_list_scientific_layers",
      "slide_get_scientific_entity",
    ]) expect(slide?.content, operation).toContain(operation);
  });
});
