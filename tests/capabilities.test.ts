import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CapabilityRegistry } from "../src/host/capabilities.js";
import { createScienceTools, type ScienceExecutor } from "../src/host/science-tools.js";
import { createScienceSkills } from "../src/host/skills.js";

describe("fixed-version capability registry", () => {
  it("loads seven services, 55 Skills, 121 unique DSH operations, and 100 showcases", () => {
    const registry = new CapabilityRegistry();
    expect(registry.manifest.target).toMatchObject({
      dshVersion: "0.1.1-rc.2",
      serviceCount: 7,
      skillCount: 55,
      requiredOperationCount: 121,
      showcaseCount: 100,
    });
    expect(registry.operations).toHaveLength(121);
    expect(new Set(registry.operations.map((item) => item.registeredName))).toHaveLength(121);
  });

  it("builds every operation with a DSH-compatible input schema and complete presentation contract", () => {
    const executor: ScienceExecutor = {
      async execute(serviceId, operation) {
        return { serviceId, operation, status: "completed" };
      },
    };
    const registry = new CapabilityRegistry();
    const tools = createScienceTools(executor, registry);
    expect(tools).toHaveLength(121);
    for (const [index, tool] of tools.entries()) {
      const contract = registry.operations[index]!;
      expect(tool.parameters).toMatchObject({ type: "object" });
      expect(tool.output.schema, `${tool.name} manifest output schema`).toEqual(contract.record.outputSchema);
      expect(tool.output.schema, tool.name).toMatchObject({
        type: "object",
        properties: {
          serviceId: { type: "string", const: contract.record.serviceId },
          operation: { type: "string", const: contract.record.operation },
          status: { type: "string" },
          ok: { type: "boolean" },
          error: {
            type: "object",
            required: ["code", "message"],
            additionalProperties: false,
          },
        },
        required: ["serviceId", "operation", "status"],
        additionalProperties: false,
      });
      expect(tool.output.render).toBeTypeOf("function");
      expect(tool.presentCall).toBeTypeOf("function");
      expect(tool.presentResult).toBeTypeOf("function");
    }
  });

  it("checks source Skill invocation metadata without recording execution evidence", () => {
    const skills = createScienceSkills(process.cwd());
    expect(skills).toHaveLength(55);
    for (const skill of skills) {
      expect(skill.whenToUse, skill.name).toMatch(/^Use for .+ research tasks in DSH-Rosalind\.$/);
      expect(skill.invocation, skill.name).toEqual({ modelInvocable: true, userInvocable: true });
      expect(skill.path, skill.name).toMatch(/SKILL\.md$/);
      expect(existsSync(skill.path!), skill.name).toBe(true);
    }
  });

  it("distinguishes located files from recorded execution evidence", () => {
    const root = process.cwd();
    const manifest = JSON.parse(readFileSync(resolve(root, "capabilities/capability-manifest.json"), "utf8")) as {
      verificationRuns: Array<{ id: string; status: string; evidencePath: string; machineEvidencePath: string; testFiles: string[]; contentIdentityMatch: boolean }>;
      services: Array<Record<string, any>>;
      skills: Array<Record<string, any>>;
      operations: Array<Record<string, any>>;
      statusCounts: Record<string, Record<string, number>>;
      target: Record<string, number>;
      evidencePolicy: string;
      statusDefinitions: Record<string, string>;
    };
    expect(manifest.evidencePolicy).toContain("proves implementation reachability and failure behavior only");
    expect(manifest.statusDefinitions.verified).toContain("operation-specific local scientific result");
    const runs = new Map(manifest.verificationRuns.map((run) => [run.id, run]));
    const hasCurrentPassingEvidence = [...runs.values()].every((run) =>
      run.status === "passed"
      && run.contentIdentityMatch === true
      && existsSync(resolve(root, run.evidencePath))
      && existsSync(resolve(root, run.machineEvidencePath))
    );
    for (const run of runs.values()) {
      expect(["passed", "not-recorded"]).toContain(run.status);
      expect(existsSync(resolve(root, run.evidencePath))).toBe(true);
      expect(existsSync(resolve(root, run.machineEvidencePath))).toBe(true);
      expect(run.contentIdentityMatch).toBe(run.status === "passed");
      for (const test of run.testFiles) expect(existsSync(resolve(root, test)), test).toBe(true);
    }
    for (const item of [...manifest.services, ...manifest.skills, ...manifest.operations]) {
      expect(item.evidence).toHaveProperty("implementation");
      expect(item.evidence).toHaveProperty("fixture");
      expect(item.evidence).toHaveProperty("live");
      expect(item.evidence).toHaveProperty("cancellation");
      expect(item.evidence).toHaveProperty("error");
      const implementation = item.evidence.implementation;
      expect(implementation.status).toBe("located");
      expect(implementation.path).toBe(item.implementationPath);
      expect(readFileSync(resolve(root, implementation.path), "utf8")).toContain(implementation.locator);
      for (const field of ["fixture", "live", "cancellation", "error", "workflow", "registration", "profile"]) {
        const evidence = item.evidence[field];
        if (!evidence || evidence.status === "not-applicable" || evidence.status === "missing") continue;
        expect(evidence.status, `${item.id}.${field}`).toBe("executed");
        const run = runs.get(evidence.executionId);
        expect(run?.status, `${item.id}.${field}`).toBe("passed");
        expect(run?.testFiles, `${item.id}.${field}`).toContain(evidence.path);
        expect(readFileSync(resolve(root, evidence.path), "utf8"), `${item.id}.${field}`).toContain(evidence.locator);
      }
      if (item.status === "verified" && item.operation) {
        const isExactNgsDiagnostic = item.serviceId === "ngs" && item.fixtureOutcome === "exact-diagnostic";
        expect(item.verificationScope, item.id).toBe(isExactNgsDiagnostic
          ? "local-exact-diagnostic-fixture-contract"
          : "local-result-fixture-contract");
        expect(["successful-local-result", "exact-diagnostic"], item.id).toContain(item.fixtureOutcome);
        expect(item.evidence.fixture.kind, item.id).toBe("operation-contract-fixture");
        expect(item.evidence.fixture.assertionLocator, item.id).toBeTypeOf("string");
        expect(readFileSync(resolve(root, item.evidence.fixture.path), "utf8"), item.id).toContain(item.evidence.fixture.assertionLocator);
        expect(item.evidence.registration).toMatchObject({
          status: "executed",
          kind: "dsh-tool-registry-and-presentation-fixture",
        });
      }
    }
    if (!hasCurrentPassingEvidence) {
      expect(manifest.services.every((item) => item.status === "implemented")).toBe(true);
      expect(manifest.skills.every((item) => item.status === "implemented")).toBe(true);
      expect(manifest.operations.every((item) => item.status === "implemented")).toBe(true);
      expect(manifest.statusCounts.services!.verified).toBe(0);
      expect(manifest.statusCounts.skills!.verified).toBe(0);
      expect(manifest.statusCounts.operations!.verified).toBe(0);
      expect(manifest.statusCounts.services!.implemented).toBe(7);
      expect(manifest.statusCounts.skills!.implemented).toBe(55);
      expect(manifest.statusCounts.operations!.implemented).toBe(121);
      return;
    }
    expect(manifest.services.filter((item) => item.status === "verified")).toHaveLength(7);
    expect(manifest.skills.filter((item) => item.status === "verified")).toHaveLength(55);
    expect(manifest.operations.filter((item) => item.status === "verified")).toHaveLength(118);
    expect(manifest.operations.filter((item) => item.status === "implemented")).toHaveLength(3);
    for (const service of manifest.services) {
      expect(service.evidence.profile).toMatchObject({
        status: "executed",
        kind: "isolated-dsh-profile-service-fixture",
      });
      expect(service.evidence.registration).toMatchObject({
        status: "executed",
        kind: "dsh-service-operation-registry-fixture",
      });
    }
    for (const skill of manifest.skills) {
      expect(skill.evidence.fixture).toMatchObject({ status: "executed", kind: "skill-specific-registry-and-tool-fixture" });
      expect(skill.evidence.workflow).toMatchObject({ status: "executed" });
      expect(skill.evidence.registration).toMatchObject({ status: "executed", kind: "dsh-skill-registry-readback-fixture" });
      expect(skill.evidence.profile).toMatchObject({ status: "executed", kind: "isolated-dsh-profile-skill-readback-fixture" });
      expect(skill.evidence.live.status).toBe("missing");
      expect(skill.evidenceGaps.join("\n")).toContain("no model-selected Skill choice");
    }
    expect(manifest.operations.filter((item) => item.evidence.live.status !== "missing")).toHaveLength(0);
    expect(manifest.operations.filter((item) => item.fixtureOutcome === "exact-diagnostic").length).toBeGreaterThan(0);
    expect(manifest.operations.filter((item) => item.fixtureOutcome === "successful-local-result").length).toBeGreaterThan(0);
    expect(manifest.skills.filter((item) => item.evidence.live.status !== "missing")).toHaveLength(0);
    expect(manifest.operations.find((item) => item.operation === "plan_nextflow")?.status).toBe("verified");
    expect(manifest.operations.find((item) => item.operation === "inspect_compute_target")).toMatchObject({
      status: "verified",
      fixtureOutcome: "exact-diagnostic",
      verificationScope: "local-exact-diagnostic-fixture-contract",
    });
    expect(manifest.operations.find((item) => item.operation === "rosalind.open")?.status).toBe("verified");
    expect(manifest.statusCounts.services!.verified).toBe(manifest.target.verifiedServiceCount);
    expect(manifest.statusCounts.skills!.verified).toBe(manifest.target.verifiedSkillCount);
    expect(manifest.statusCounts.operations!.verified).toBe(manifest.target.verifiedOperationCount);
  });

  it("passes the standalone capability evidence validator", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "capabilities/capability-manifest.json"), "utf8")) as {
      verificationRuns: Array<{ status: string; contentIdentityMatch: boolean }>;
    };
    const result = spawnSync(process.execPath, ["scripts/validate-capabilities.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const hasCurrentPassingEvidence = manifest.verificationRuns.every((run) => run.status === "passed" && run.contentIdentityMatch === true);
    if (hasCurrentPassingEvidence) {
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    } else {
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/machine evidence hash differs|requires executed DSH ToolRuntime|declared Vitest JSON report is missing/);
    }
  });
});
