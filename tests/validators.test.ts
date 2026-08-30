import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ShowcaseDefinition } from "../src/shared/types.js";
import { canonicalArtifactBuffer, canonicalArtifactSha256, validateShowcase } from "../src/host/validators.js";

function fixtureEntry(artifact: ShowcaseDefinition["artifacts"][number]): ShowcaseDefinition {
  const claim = {
    id: "validator-fixture:computed:1",
    statement: "The fixture artifact was generated.",
    kind: "computed" as const,
    artifactIds: [artifact.id],
  };
  return {
    id: "validator-fixture",
    pluginId: "test",
    pluginVersion: "0.0.0",
    categoryId: "sequence",
    domain: "test",
    caseType: "analysis",
    difficulty: "basic",
    evidenceLevel: "computed-result",
    capabilities: ["test.validate"],
    rosalindTasks: [],
    execution: { actualTools: ["fixture"], device: "local", implementation: "fixture", status: "verified" },
    title: "Validator fixture",
    summary: "A validator fixture.",
    question: "Does the fixture validate?",
    status: "ready",
    runDate: "2026-08-30",
    readmePath: "cases/validator-fixture/README.md",
    promptPath: "cases/validator-fixture/prompt.md",
    preview: null,
    artifacts: [artifact],
    sources: [],
    observations: ["A fixture observation."],
    computedResults: ["A fixture result."],
    interpretation: ["A fixture interpretation."],
    limitations: ["A fixture limitation."],
    claims: [claim],
    requiredMcpServers: ["test"],
    requiredOperations: ["test.validate"],
    requiredSkills: ["test-validator"],
    fixtures: [artifact.id],
    expectedArtifacts: [artifact.id],
    scientificAssertions: [claim],
    visualAssertions: [],
    provenance: { sourceCommit: "fixture", sources: [], runDate: "2026-08-30", records: [{ outputs: [artifact.path!], note: "Fixture provenance." }] },
    reproductionSteps: ["Run the fixture validator."],
    recipe: { adapter: "fixture", providerIds: ["local"], strategy: "local", requiredInputs: [], expectedOutputs: [], checks: [] },
    modes: ["lesson", "replay", "reproduce"],
    searchText: "validator fixture",
  };
}

function artifactRecord(bytes: number, sha256: string) {
  return { id: "validator-fixture:artifact.txt", role: "output" as const, mediaType: "text/plain", path: "cases/validator-fixture/artifact.txt", bytes, sha256 };
}

function artifactCheck(result: ReturnType<typeof validateShowcase>) {
  return result.checks.find((item) => item.name === "validator-fixture:artifact.txt")!;
}

function scientificCheck(result: ReturnType<typeof validateShowcase>, name: string) {
  return result.checks.find((item) => item.name === name)!;
}

describe("canonical text artifact validation", () => {
  it("treats LF and CRLF as the same declared UTF-8/LF artifact", () => {
    const lf = Buffer.from("alpha\nbeta\n", "utf8");
    const crlf = Buffer.from("alpha\r\nbeta\r\n", "utf8");
    expect(canonicalArtifactBuffer("text/plain", crlf)).toEqual(lf);
    expect(canonicalArtifactSha256("text/plain", crlf)).toBe("e49c81e2d2f84e259d40e2fb8192f3bcd198b355184845d76d8f58807d0d78ee");
  });

  it("checks the declared canonical byte count and digest, rejecting tampering", () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-validator-"));
    try {
      const caseRoot = join(root, "cases", "validator-fixture");
      const artifactPath = join(caseRoot, "artifact.txt");
      mkdirSync(caseRoot, { recursive: true });
      writeFileSync(join(caseRoot, "README.md"), "# Fixture\n");
      writeFileSync(artifactPath, "alpha\r\nbeta\r\n", "utf8");
      const valid = validateShowcase(root, fixtureEntry(artifactRecord(11, "e49c81e2d2f84e259d40e2fb8192f3bcd198b355184845d76d8f58807d0d78ee")));
      expect(artifactCheck(valid).ok).toBe(true);
      expect(artifactCheck(valid).actual).toContain("13 physical bytes; 11 canonical UTF-8/LF bytes");

      writeFileSync(artifactPath, "alpha\r\nbetA\r\n", "utf8");
      const tampered = validateShowcase(root, fixtureEntry(artifactRecord(11, "e49c81e2d2f84e259d40e2fb8192f3bcd198b355184845d76d8f58807d0d78ee")));
      expect(artifactCheck(tampered).ok).toBe(false);
      expect(artifactCheck(tampered).actual).toContain("sha256");

      const wrongCount = validateShowcase(root, fixtureEntry(artifactRecord(12, canonicalArtifactSha256("text/plain", Buffer.from("alpha\r\nbetA\r\n", "utf8")))));
      expect(artifactCheck(wrongCount).ok).toBe(false);
      expect(artifactCheck(wrongCount).expected).toContain("12 canonical UTF-8/LF bytes");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("scientific record validation", () => {
  it("rejects duplicate artifact and claim IDs", () => {
    const artifact = artifactRecord(11, "e49c81e2d2f84e259d40e2fb8192f3bcd198b355184845d76d8f58807d0d78ee");
    const entry = fixtureEntry(artifact);
    entry.artifacts.push({ ...artifact });
    entry.claims.push({ ...entry.claims[0]! });

    const result = validateShowcase(process.cwd(), entry);
    expect(scientificCheck(result, "artifact IDs are unique").ok).toBe(false);
    expect(scientificCheck(result, "claim IDs are unique").ok).toBe(false);
  });

  it("rejects scientific assertions that drift from observation and computed claims", () => {
    const artifact = artifactRecord(11, "e49c81e2d2f84e259d40e2fb8192f3bcd198b355184845d76d8f58807d0d78ee");
    const entry = fixtureEntry(artifact);
    entry.scientificAssertions[0] = {
      ...entry.scientificAssertions[0]!,
      statement: "A different statement was inserted.",
    };

    const result = validateShowcase(process.cwd(), entry);
    expect(scientificCheck(result, "scientific assertions match observation and computed claims").ok).toBe(false);
  });
});
