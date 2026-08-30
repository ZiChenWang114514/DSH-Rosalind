import { describe, expect, it } from "vitest";

import { SHOWCASES } from "../src/generated/catalog.js";
import { CapabilityRegistry } from "../src/host/capabilities.js";
import { reproduceShowcase } from "../src/host/reproduction.js";
import { createScienceGatewayTools } from "../src/host/science-gateway-tools.js";
import { createScienceTools, type ScienceExecutor } from "../src/host/science-tools.js";
import { ScienceRuntime } from "../src/host/science/runtime.js";
import { createScienceSkills } from "../src/host/skills.js";

const signal = new AbortController().signal;

describe("unified science runtime", () => {
  it("builds 121 fixed-version tools and 55 executable Skills", () => {
    const registry = new CapabilityRegistry();
    const runtime = new ScienceRuntime();
    const tools = createScienceTools(runtime, registry);
    const skills = createScienceSkills();
    expect(tools).toHaveLength(121);
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(121);
    expect(skills).toHaveLength(55);
    expect(new Set(skills.map((skill) => skill.name)).size).toBe(55);
    for (const tool of tools) {
      expect(tool.output?.render).toBeTypeOf("function");
      expect(tool.presentCall).toBeTypeOf("function");
      expect(tool.presentResult).toBeTypeOf("function");
    }
  });

  it("dispatches every required operation to its scientific service", async () => {
    const registry = new CapabilityRegistry();
    const runtime = new ScienceRuntime();
    for (const contract of registry.operations) {
      const result = await runtime.execute(contract.record.serviceId, contract.record.operation, {}, {
        session: {}, signal, packageRoot: registry.packageRoot,
      });
      expect(result.serviceId).toBe(contract.record.serviceId);
      expect(result.operation).toBe(contract.record.operation);
      const error = result.error && typeof result.error === "object" && !Array.isArray(result.error) ? result.error : undefined;
      const code = error && typeof error.code === "string" ? error.code : "";
      expect(code).not.toMatch(/UNKNOWN_(SEQUENCE|NGS|STRUCTURE|SLIDE|ROSALIND)_OPERATION/);
    }
  });

  it("provides literature/database gateways and four Slide Skill compatibility tools", () => {
    const registry = new CapabilityRegistry();
    const tools = createScienceGatewayTools(new ScienceRuntime(), registry.packageRoot);
    expect(tools.map((tool) => tool.name)).toEqual([
      "literature_request", "database_request", "slide_control_viewer",
      "slide_run_analysis_from_chat", "slide_run_pathology", "slide_query_scientific_layer",
    ]);
    for (const tool of tools) expect(tool.output?.render).toBeTypeOf("function");
  });
});

describe("showcase reproduction routes", () => {
  it("maps all 23 ready showcases to real science operations and reports missing scientific inputs or providers precisely", async () => {
    const calls: Array<{ serviceId: string; operation: string }> = [];
    const ngsCases = new Set(["ngs-fastq-qc", "ngs-bulk-rnaseq", "ngs-single-cell"]);
    const sourceRequiredCases = new Set([
      "slide-tissue-architecture",
      "slide-spatial-expression",
      "slide-segmentation-overlay",
      "slide-research-export",
    ]);
    const executor: ScienceExecutor = {
      async execute(serviceId, operation) {
        calls.push({ serviceId, operation });
        return { status: "completed", serviceId, operation };
      },
    };
    for (const showcase of SHOWCASES) {
      const result = await reproduceShowcase(showcase, showcase.recipe.providerIds[0]!, executor, {
        session: {}, signal, packageRoot: process.cwd(),
      });
      if (ngsCases.has(showcase.id)) {
        expect(result.status, showcase.id).toBe("failed");
        expect(result.error, showcase.id).toMatchObject({ code: "NGS_INPUT_CONFIGURATION_REQUIRED" });
      } else if (sourceRequiredCases.has(showcase.id)) {
        expect(result.status, showcase.id).toBe("awaiting_confirmation");
        expect(result.error, showcase.id).toMatchObject({ code: "REPRODUCTION_INPUT_REQUIRED" });
      } else if (showcase.id === "rosalind-molecular-design") {
        expect(result.status, showcase.id).toBe("awaiting_confirmation");
        expect(result.error, showcase.id).toMatchObject({ code: "REPRODUCTION_PROVIDER_REQUIRED" });
      } else {
        expect(result.status, showcase.id).toBe("completed");
      }
      if (result.status === "completed") {
        expect(result.steps.length, showcase.id).toBeGreaterThan(0);
      }
    }
    expect(new Set(calls.map((call) => call.serviceId))).toEqual(new Set(["literature", "databases", "sequence", "ngs", "structure", "rosalind"]));
    expect(calls.some((call) => call.serviceId === "slide")).toBe(false);
  });
});
