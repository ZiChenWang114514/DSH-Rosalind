import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { SHOWCASES } from "../src/generated/catalog.js";
import { ShowcaseCatalog } from "../src/host/catalog.js";
import { RosalindRuntime } from "../src/host/runtime.js";
import { validateShowcase } from "../src/host/validators.js";
import type { ShowcaseDefinition } from "../src/shared/types.js";

const repositoryRoot = resolve(import.meta.dirname, "..");
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function showcase(id: string): ShowcaseDefinition {
  const entry = SHOWCASES.find((item) => item.id === id);
  if (!entry) throw new Error(`Missing showcase ${id}`);
  return structuredClone(entry);
}

function materialize(entry: ShowcaseDefinition): string {
  const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-replay-"));
  temporaryRoots.push(root);
  for (const artifact of entry.artifacts) {
    if (!artifact.path) continue;
    const destination = join(root, artifact.path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(repositoryRoot, artifact.path), destination);
  }
  return root;
}

function replaceSameLength(root: string, path: string, before: string, after: string): void {
  expect(after).toHaveLength(before.length);
  const absolute = join(root, path);
  const text = readFileSync(absolute, "utf8");
  expect(text).toContain(before);
  writeFileSync(absolute, text.replace(before, after), "utf8");
}

describe("23-case showcase replay scientific matrix", () => {
  it("gives every ready showcase structured and scientific checks", () => {
    expect(SHOWCASES).toHaveLength(23);
    const inputDriven = new Set<string>();
    for (const entry of SHOWCASES) {
      const validation = validateShowcase(repositoryRoot, entry);
      expect(validation.ok, `${entry.id}: ${validation.checks.filter((item) => !item.ok).map((item) => item.name).join(", ")}`).toBe(true);
      expect(validation.checks.some((item) => item.category === "file-structure"), entry.id).toBe(true);
      expect(validation.checks.some((item) => item.category === "recorded-result-consistency"), entry.id).toBe(true);
      if (validation.checks.some((item) => item.category === "input-driven-recomputation")) inputDriven.add(entry.id);
    }
    expect(inputDriven).toEqual(new Set([
      "sequence-lambda-annotation",
      "sequence-ras-alignment",
      "sequence-fastq-qc",
      "structure-mdm2-p53",
      "structure-adenylate-kinase",
      "structure-gfp-figure",
    ]));
  });

  it("runs lesson and replay for all 23 ready showcases", async () => {
    const runtime = new RosalindRuntime({ catalog: new ShowcaseCatalog(repositoryRoot) });
    try {
      for (const mode of ["lesson", "replay"] as const) {
        for (const entry of SHOWCASES) {
          const session = {};
          const plan = runtime.plan(session, entry.id, mode);
          expect(plan.state, `${mode}:${entry.id}`).toBe("queued");
          const result = await runtime.run(session, plan.id, new AbortController().signal);
          expect(result.state, `${mode}:${entry.id}: ${result.error?.message ?? ""}`).toBe("completed");
          expect(result.progress, `${mode}:${entry.id}`).toBe(1);
        }
      }
    } finally {
      runtime.dispose();
    }
  });

  it("rejects same-byte identifier tampering even when file-size checks pass", () => {
    const entry = showcase("literature-pmc-availability");
    const root = materialize(entry);
    replaceSameLength(root, entry.artifacts.find((item) => item.path?.endsWith("outputs/results.json"))!.path!, "22253597", "22253598");
    const result = validateShowcase(root, entry);
    expect(result.ok).toBe(false);
    expect(result.checks.filter((item) => item.category === "file-structure").every((item) => item.ok)).toBe(true);
    expect(result.checks.find((item) => item.name === "PMC identifier triplet")?.ok).toBe(false);
  });

  it("rejects a changed critical readiness field", () => {
    const entry = showcase("ngs-fastq-qc");
    const root = materialize(entry);
    replaceSameLength(root, entry.artifacts.find((item) => item.path?.endsWith("outputs/workflow-evidence.json"))!.path!, '"registered_runs": 0', '"registered_runs": 1');
    const result = validateShowcase(root, entry);
    expect(result.ok).toBe(false);
    expect(result.checks.find((item) => item.name === "ngs-fastq-qc no run executed")?.ok).toBe(false);
  });

  it("rejects a same-size input whose retained output no longer agrees", () => {
    const entry = showcase("sequence-ras-alignment");
    const root = materialize(entry);
    replaceSameLength(root, entry.artifacts.find((item) => item.path?.endsWith("human-RAS-UniProt-SV1.aln-fasta"))!.path!, "\nMTEYKLVVVG", "\nATEYKLVVVG");
    const result = validateShowcase(root, entry);
    expect(result.ok).toBe(false);
    expect(result.checks.filter((item) => item.category === "file-structure").every((item) => item.ok)).toBe(true);
    expect(result.checks.some((item) => item.category === "input-driven-recomputation" && item.name.startsWith("RAS distance") && !item.ok)).toBe(true);
  });
});
