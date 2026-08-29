import { existsSync, readFileSync, statSync } from "node:fs";

import type { ShowcaseDefinition } from "../shared/types.js";
import { resolveInside } from "./catalog.js";

export interface ValidationResult {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; actual: string; expected: string }>;
}

function check(name: string, actual: unknown, expected: unknown): ValidationResult["checks"][number] {
  return { name, ok: Object.is(actual, expected), actual: String(actual), expected: String(expected) };
}

function readJson<T>(root: string, path: string): T {
  return JSON.parse(readFileSync(resolveInside(root, path), "utf8")) as T;
}

function caseFile(entry: ShowcaseDefinition, suffix: string): string {
  const prefix = entry.readmePath.slice(0, -"README.md".length);
  return `${prefix}${suffix}`;
}

function validateArtifacts(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  return entry.artifacts.map((artifact) => {
    if (!artifact.path) return { name: artifact.id, ok: true, actual: "resource", expected: "resource" };
    const absolute = resolveInside(root, artifact.path);
    if (!existsSync(absolute)) return { name: artifact.id, ok: false, actual: "missing", expected: "present" };
    const actualBytes = statSync(absolute).size;
    const expected = artifact.bytes ?? actualBytes;
    return check(artifact.id, actualBytes, expected);
  });
}

function validateScientificRecord(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const artifactIds = new Set(entry.artifacts.map((artifact) => artifact.id));
  const referencedIds = entry.claims.flatMap((claim) => claim.artifactIds);
  const recipePaths = [...entry.recipe.requiredInputs, ...entry.recipe.expectedOutputs];
  return [
    check("showcase is ready", entry.status, "ready"),
    check("lesson mode declared", entry.modes.includes("lesson"), true),
    check("replay mode declared", entry.modes.includes("replay"), true),
    check("reproduce mode declared", entry.modes.includes("reproduce"), true),
    check("source observations recorded", entry.observations.length > 0, true),
    check("computed results recorded", entry.computedResults.length > 0, true),
    check("scientific interpretation recorded", entry.interpretation.length > 0, true),
    check("limitations recorded", entry.limitations.length > 0, true),
    check("claim artifact references resolve", referencedIds.every((id) => artifactIds.has(id)), true),
    check("recipe files are present", recipePaths.every((path) => existsSync(resolveInside(root, path))), true),
  ];
}

function validateRas(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const fasta = readFileSync(resolveInside(root, caseFile(entry, "inputs/human-RAS-UniProt-SV1.aln-fasta")), "utf8");
  const rows = fasta.trim().split(/^>/m).filter(Boolean).map((record) => {
    const lines = record.trim().split(/\r?\n/);
    return { id: lines[0]!.split(/\s+/)[0]!, sequence: lines.slice(1).join("").trim() };
  });
  const analysis = readJson<{ distance: { matrix: number[][] } }>(root, caseFile(entry, "outputs/analysis.json"));
  const distance = (left: string, right: string) => {
    let compared = 0;
    let mismatches = 0;
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
      const a = left[index];
      const b = right[index];
      if (a === undefined || b === undefined || (a === "-" && b === "-")) continue;
      compared++;
      if (a !== b) mismatches++;
    }
    return mismatches / compared;
  };
  const checks = [
    check("RAS row count", rows.length, 3),
    check("RAS aligned columns", rows[0]?.sequence.length, 191),
  ];
  for (let left = 0; left < rows.length; left++) {
    for (let right = left + 1; right < rows.length; right++) {
      checks.push(check(
        `RAS distance ${left}-${right}`,
        distance(rows[left]!.sequence, rows[right]!.sequence),
        analysis.distance.matrix[left]![right],
      ));
    }
  }
  return checks;
}

function validateLambda(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const result = readJson<{
    cI_coding_bases: number;
    translated_residues: number;
    matches_genbank_translation: boolean;
  }>(root, caseFile(entry, "outputs/analysis.json"));
  const genbank = readFileSync(resolveInside(root, caseFile(entry, "inputs/NC_001416.1.gb")), "utf8");
  return [
    check("Lambda coding bases", result.cI_coding_bases, 714),
    check("Lambda translated residues", result.translated_residues, 237),
    check("Lambda translation match", result.matches_genbank_translation, true),
    check("Lambda accession present", genbank.includes("NC_001416.1"), true),
  ];
}

function validateFastqSummary(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const result = readJson<{ records: number; bases: number; q30_percent: number }>(
    root,
    caseFile(entry, "outputs/quality-summary.json"),
  );
  return [
    check("FASTQ records", result.records, 500),
    check("FASTQ bases", result.bases, 235490),
    check("FASTQ Q30", result.q30_percent, 95.39768143020935),
  ];
}

interface PdbAtom { chain: string; residue: string; x: number; y: number; z: number }

function pdbAtoms(text: string): PdbAtom[] {
  const atoms: PdbAtom[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("ATOM  ") && !line.startsWith("HETATM")) continue;
    const x = Number(line.slice(30, 38));
    const y = Number(line.slice(38, 46));
    const z = Number(line.slice(46, 54));
    if (![x, y, z].every(Number.isFinite)) continue;
    atoms.push({
      chain: line.slice(21, 22).trim(),
      residue: `${line.slice(17, 20).trim()} ${line.slice(21, 22).trim()}:${line.slice(22, 27).trim()}`,
      x,
      y,
      z,
    });
  }
  return atoms;
}

function validateMdm2(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const text = readFileSync(resolveInside(root, caseFile(entry, "inputs/1YCR.pdb")), "utf8");
  const atoms = pdbAtoms(text);
  const chainA = atoms.filter((atom) => atom.chain === "A");
  const chainB = atoms.filter((atom) => atom.chain === "B");
  let contacts = 0;
  const residuePairs = new Set<string>();
  for (const left of chainA) {
    for (const right of chainB) {
      const dx = left.x - right.x;
      const dy = left.y - right.y;
      const dz = left.z - right.z;
      if (dx * dx + dy * dy + dz * dz <= 16) {
        contacts++;
        residuePairs.add(`${left.residue}|${right.residue}`);
      }
    }
  }
  return [
    check("MDM2-p53 atoms", atoms.length, 818),
    check("MDM2-p53 atom contacts", contacts, 105),
    check("MDM2-p53 residue pairs", residuePairs.size, 34),
  ];
}

function validateAdenylate(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const open = pdbAtoms(readFileSync(resolveInside(root, caseFile(entry, "inputs/4AKE.pdb")), "utf8"));
  const closed = pdbAtoms(readFileSync(resolveInside(root, caseFile(entry, "inputs/1AKE.pdb")), "utf8"));
  const countCa = (textPath: string) => readFileSync(resolveInside(root, textPath), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("ATOM  ") && line.slice(12, 16).trim() === "CA" && line.slice(21, 22) === "A").length;
  return [
    check("4AKE atoms", open.length, 3459),
    check("1AKE atoms", closed.length, 3816),
    check("4AKE chain A CA", countCa(caseFile(entry, "inputs/4AKE.pdb")), 214),
    check("1AKE chain A CA", countCa(caseFile(entry, "inputs/1AKE.pdb")), 214),
  ];
}

function validateSpatial(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  if (entry.id === "slide-tissue-architecture") {
    const metadata = readJson<{ main_image: { width: number; height: number } }>(root, caseFile(entry, "outputs/pyramid-metadata.json"));
    return [check("slide width", metadata.main_image.width, 46000), check("slide height", metadata.main_image.height, 32893)];
  }
  if (entry.id === "slide-spatial-expression") {
    const metadata = readJson<{ observations: number; genes: number }>(root, caseFile(entry, "outputs/metadata-summary.json"));
    return [check("spatial observations", metadata.observations, 684), check("spatial genes", metadata.genes, 18078)];
  }
  if (entry.id === "slide-research-export") {
    const csv = readFileSync(resolveInside(root, caseFile(entry, "outputs/spatial-observations-expression.csv")), "utf8").trim();
    return [check("spatial export rows", csv.split(/\r?\n/).length - 1, 684)];
  }
  const geojson = readJson<{ type: string; features: unknown[] }>(root, caseFile(entry, "outputs/source-aligned-annotations.geojson"));
  return [check("GeoJSON type", geojson.type, "FeatureCollection"), check("GeoJSON has features", geojson.features.length > 0, true)];
}

function validateDesign(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const result = readJson<{
    designed_candidates: number;
    top5_ensemble_predictions_successful: number;
    top5: Array<{ candidate: string }>;
  }>(root, caseFile(entry, "outputs/result-summary.json"));
  return [
    check("PD-L1 candidates", result.designed_candidates, 20),
    check("PD-L1 ensemble records", result.top5_ensemble_predictions_successful, 25),
    check("PD-L1 leading candidate", result.top5[0]?.candidate, "NB13_E104Q"),
  ];
}

export function validateShowcase(root: string, entry: ShowcaseDefinition): ValidationResult {
  const checks = [...validateScientificRecord(root, entry), ...validateArtifacts(root, entry)];
  switch (entry.id) {
    case "sequence-lambda-annotation": checks.push(...validateLambda(root, entry)); break;
    case "sequence-ras-alignment": checks.push(...validateRas(root, entry)); break;
    case "sequence-fastq-qc": checks.push(...validateFastqSummary(root, entry)); break;
    case "structure-mdm2-p53": checks.push(...validateMdm2(root, entry)); break;
    case "structure-adenylate-kinase": checks.push(...validateAdenylate(root, entry)); break;
    case "slide-tissue-architecture":
    case "slide-spatial-expression":
    case "slide-segmentation-overlay":
    case "slide-research-export": checks.push(...validateSpatial(root, entry)); break;
    case "rosalind-molecular-design": checks.push(...validateDesign(root, entry)); break;
    default: break;
  }
  return { ok: checks.every((item) => item.ok), checks };
}
