import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";

import type { ShowcaseDefinition } from "../shared/types.js";
import { resolveInside } from "./catalog.js";

export interface ValidationResult {
  ok: boolean;
  checks: Array<{
    category: "file-structure" | "recorded-result-consistency" | "input-driven-recomputation";
    name: string;
    ok: boolean;
    actual: string;
    expected: string;
  }>;
}

type CheckCategory = ValidationResult["checks"][number]["category"];

function check(name: string, actual: unknown, expected: unknown, category: CheckCategory = "recorded-result-consistency"): ValidationResult["checks"][number] {
  return { category, name, ok: Object.is(actual, expected), actual: String(actual), expected: String(expected) };
}

function inputCheck(name: string, actual: unknown, expected: unknown): ValidationResult["checks"][number] {
  return check(name, actual, expected, "input-driven-recomputation");
}

function readJson<T>(root: string, path: string): T {
  return JSON.parse(readFileSync(resolveInside(root, path), "utf8")) as T;
}

function caseFile(entry: ShowcaseDefinition, suffix: string): string {
  const prefix = entry.readmePath.slice(0, -"README.md".length);
  return `${prefix}${suffix}`;
}

export function artifactByteCounts(bytes: Uint8Array): { actual: number; lfEquivalent: number; windowsEquivalent: number } {
  let lfWithoutCr = 0;
  let crlfCount = 0;
  for (let index = 0; index < bytes.length; index++) {
    if (bytes[index] !== 0x0a) continue;
    if (index > 0 && bytes[index - 1] === 0x0d) crlfCount++;
    else lfWithoutCr++;
  }
  return {
    actual: bytes.length,
    lfEquivalent: bytes.length - crlfCount,
    windowsEquivalent: bytes.length + lfWithoutCr,
  };
}

/**
 * The catalogue records text identity as UTF-8 after CRLF has been normalized
 * to LF. Binary artifacts retain their original bytes. This mirrors the
 * catalogue generator so a checkout on Windows and one on Unix validate the
 * same declared artifact identity.
 */
export function canonicalArtifactBuffer(mediaType: string, bytes: Uint8Array): Buffer {
  const isText = mediaType.startsWith("text/")
    || mediaType === "application/json"
    || mediaType === "application/geo+json"
    || mediaType === "image/svg+xml"
    || mediaType.startsWith("chemical/");
  if (!isText) return Buffer.from(bytes);
  return Buffer.from(Buffer.from(bytes).toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

export function canonicalArtifactSha256(mediaType: string, bytes: Uint8Array): string {
  return createHash("sha256").update(canonicalArtifactBuffer(mediaType, bytes)).digest("hex");
}

function validateArtifacts(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  return entry.artifacts.map((artifact) => {
    if (!artifact.path) return { category: "file-structure", name: artifact.id, ok: true, actual: "resource", expected: "resource" };
    const absolute = resolveInside(root, artifact.path);
    if (!existsSync(absolute)) return { category: "file-structure", name: artifact.id, ok: false, actual: "missing", expected: "present" };
    const bytes = readFileSync(absolute);
    const actualBytes = statSync(absolute).size;
    const canonicalBytes = canonicalArtifactBuffer(artifact.mediaType, bytes);
    const expected = artifact.bytes;
    const byteCountOk = expected === undefined || expected === canonicalBytes.length;
    const actualSha256 = canonicalArtifactSha256(artifact.mediaType, bytes);
    const sha256Ok = artifact.sha256 === undefined || artifact.sha256 === actualSha256;
    const text = bytes.toString("utf8");
    let structureOk = bytes.length > 0;
    try {
      if (artifact.mediaType === "application/json" || artifact.mediaType === "application/geo+json") JSON.parse(text);
      else if (artifact.mediaType === "text/csv") parseCsv(text);
      else if (artifact.mediaType === "image/svg+xml") structureOk = /<svg\b/.test(text) && /<\/svg>/.test(text);
      else if (artifact.mediaType === "image/png") structureOk = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      else if (artifact.mediaType === "chemical/x-pdb") structureOk = /^(ATOM  |HETATM)/m.test(text);
      else if (artifact.mediaType === "chemical/x-mmcif") structureOk = /^data_/m.test(text) && /_(?:atom_site|refln)\./.test(text);
      else if (artifact.mediaType === "text/x-genbank") structureOk = /^LOCUS\s/m.test(text) && /^ORIGIN\s*$/m.test(text) && /^\/\/$/m.test(text);
      else if (artifact.mediaType === "text/x-fasta") structureOk = /^>\S+/m.test(text);
      else if (artifact.mediaType === "text/x-newick") structureOk = text.trim().endsWith(";");
    } catch {
      structureOk = false;
    }
    return {
      category: "file-structure",
      name: artifact.id,
      ok: byteCountOk && sha256Ok && structureOk,
      actual: `${actualBytes} physical bytes; ${canonicalBytes.length} canonical UTF-8/LF bytes; sha256 ${actualSha256}; ${structureOk ? "structure parsed" : "invalid structure"}`,
      expected: `${expected === undefined ? "byte count unspecified" : `${expected} canonical UTF-8/LF bytes`}; ${artifact.sha256 === undefined ? "sha256 unspecified" : `sha256 ${artifact.sha256}`}; structure parsed`,
    };
  });
}

function validateScientificRecord(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const artifactIds = new Set(entry.artifacts.map((artifact) => artifact.id));
  const claimIds = new Set(entry.claims.map((claim) => claim.id));
  const referencedIds = entry.claims.flatMap((claim) => claim.artifactIds);
  const expectedScientificAssertions = entry.claims.filter((claim) => claim.kind !== "interpretation");
  const recipePaths = [...entry.recipe.requiredInputs, ...entry.recipe.expectedOutputs];
  return [
    check("showcase is ready", entry.status, "ready"),
    check("lesson mode declared", entry.modes.includes("lesson"), true),
    check("replay mode declared", entry.modes.includes("replay"), true),
    check("reproduce mode declared", entry.modes.includes("reproduce"), true),
    check("source observations recorded", entry.observations.length > 0, true),
    check("scientific assertions recorded", entry.scientificAssertions.length > 0, true),
    check("scientific interpretation recorded", entry.interpretation.length > 0, true),
    check("limitations recorded", entry.limitations.length > 0, true),
    check("artifact IDs are unique", artifactIds.size, entry.artifacts.length),
    check("claim IDs are unique", claimIds.size, entry.claims.length),
    check("claim artifact references resolve", referencedIds.every((id) => artifactIds.has(id)), true),
    check("scientific assertions match observation and computed claims", JSON.stringify(entry.scientificAssertions) === JSON.stringify(expectedScientificAssertions), true),
    check("recipe files are present", recipePaths.every((path) => existsSync(resolveInside(root, path))), true),
  ];
}

function validateRas(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const fasta = readFileSync(resolveInside(root, caseFile(entry, "inputs/human-RAS-UniProt-SV1.aln-fasta")), "utf8");
  const rows = fasta.trim().split(/^>/m).filter(Boolean).map((record) => {
    const lines = record.trim().split(/\r?\n/);
    return { id: lines[0]!.split(/\s+/)[0]!, sequence: lines.slice(1).join("").trim() };
  });
  const analysis = readJson<{ row_order: string[]; distance: { matrix: number[][] }; tree: { newick: string } }>(root, caseFile(entry, "outputs/analysis.json"));
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
    inputCheck("RAS row identities", rows.map((row) => row.id).join(","), "P01116,P01111,P01112"),
    inputCheck("RAS row order matches analysis", analysis.row_order.join(","), rows.map((row) => row.id).join(",")),
    inputCheck("RAS aligned columns", rows.every((row) => row.sequence.length === 191), true),
    inputCheck("RAS ungapped protein lengths", rows.every((row) => row.sequence.replace(/-/g, "").length === 189), true),
    check("RAS Newick output matches analysis", readFileSync(resolveInside(root, caseFile(entry, "outputs/RAS-P01116-P01111-P01112-NJ.nwk")), "utf8").trim(), analysis.tree.newick),
  ];
  for (let left = 0; left < rows.length; left++) {
    for (let right = left + 1; right < rows.length; right++) {
      checks.push(inputCheck(
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
    accession_version: string;
    genome_length: number;
    cI_location: string;
    cI_coding_bases: number;
    translation_table: number;
    protein_id: string;
    translated_residues: number;
    matches_genbank_translation: boolean;
  }>(root, caseFile(entry, "outputs/analysis.json"));
  const genbank = readFileSync(resolveInside(root, caseFile(entry, "inputs/NC_001416.1.gb")), "utf8");
  const genome = genbank.slice(genbank.indexOf("ORIGIN")).replace(/^ORIGIN.*$/m, "").replace(/^\/\/.*$/m, "").replace(/[^acgtn]/gi, "");
  const feature = genbank.match(/^     CDS\s+complement\(37227\.\.37940\)([\s\S]*?)(?=^     \S)/m)?.[1] ?? "";
  const annotatedProtein = feature.match(/\/translation="([\s\S]*?)"/)?.[1]?.replace(/[^A-Z*]/g, "") ?? "";
  return [
    inputCheck("Lambda accession from GenBank", result.accession_version, genbank.match(/^VERSION\s+(\S+)/m)?.[1]),
    inputCheck("Lambda genome length from GenBank", result.genome_length, genome.length),
    inputCheck("Lambda cI location from GenBank", result.cI_location, "complement(37227..37940)"),
    inputCheck("Lambda coding bases from coordinates", result.cI_coding_bases, 37940 - 37227 + 1),
    inputCheck("Lambda translation table from GenBank", result.translation_table, Number(feature.match(/\/transl_table=(\d+)/)?.[1])),
    inputCheck("Lambda protein ID from GenBank", result.protein_id, feature.match(/\/protein_id="([^"]+)"/)?.[1]),
    inputCheck("Lambda translated residues from annotation", result.translated_residues, annotatedProtein.length),
    inputCheck("Lambda recorded translation equality", result.matches_genbank_translation, true),
  ];
}

function validateFastqSummary(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const result = readJson<{ records: number; bases: number; read_length_min: number; read_length_max: number; gc_percent: number; q30_percent: number }>(
    root,
    caseFile(entry, "outputs/quality-summary.json"),
  );
  const lines = readFileSync(resolveInside(root, caseFile(entry, "inputs/DRR037765.first500.fastq")), "utf8").trimEnd().split(/\r?\n/);
  let bases = 0; let gc = 0; let q30 = 0; let valid = lines.length % 4 === 0; const lengths: number[] = [];
  for (let index = 0; index < lines.length; index += 4) {
    const sequence = lines[index + 1] ?? ""; const quality = lines[index + 3] ?? "";
    valid &&= (lines[index] ?? "").startsWith("@") && (lines[index + 2] ?? "").startsWith("+") && sequence.length === quality.length;
    bases += sequence.length; lengths.push(sequence.length);
    gc += [...sequence.toUpperCase()].filter((base) => base === "G" || base === "C").length;
    q30 += [...quality].filter((character) => character.charCodeAt(0) - 33 >= 30).length;
  }
  return [inputCheck("FASTQ complete records", valid, true), inputCheck("FASTQ records", result.records, lines.length / 4), inputCheck("FASTQ bases", result.bases, bases),
    inputCheck("FASTQ minimum read length", result.read_length_min, Math.min(...lengths)), inputCheck("FASTQ maximum read length", result.read_length_max, Math.max(...lengths)),
    inputCheck("FASTQ GC percent", Math.abs(result.gc_percent - gc / bases * 100) < 1e-12, true), inputCheck("FASTQ Q30 percent", Math.abs(result.q30_percent - q30 / bases * 100) < 1e-12, true)];
}

interface PdbAtom { record: string; atomName: string; chain: string; residueName: string; residueId: string; residue: string; element: string; x: number; y: number; z: number }

function pdbAtoms(text: string): PdbAtom[] {
  const atoms: PdbAtom[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("ATOM  ") && !line.startsWith("HETATM")) continue;
    const x = Number(line.slice(30, 38));
    const y = Number(line.slice(38, 46));
    const z = Number(line.slice(46, 54));
    if (![x, y, z].every(Number.isFinite)) continue;
    atoms.push({
      record: line.slice(0, 6).trim(),
      atomName: line.slice(12, 16).trim(),
      chain: line.slice(21, 22).trim(),
      residueName: line.slice(17, 20).trim(),
      residueId: line.slice(22, 27).trim(),
      residue: `${line.slice(17, 20).trim()} ${line.slice(21, 22).trim()}:${line.slice(22, 27).trim()}`,
      element: line.slice(76, 78).trim(),
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
  const result = readJson<{ source_verification: { atom_count: number; chain_atom_counts: Record<string, number> }; computed_from_pinned_pdb: { atom_contact_count: number; residue_pair_count: number } }>(root, caseFile(entry, "outputs/results.json"));
  return [inputCheck("MDM2-p53 atoms", result.source_verification.atom_count, atoms.length), inputCheck("MDM2-p53 chain A atoms", result.source_verification.chain_atom_counts.A, chainA.length), inputCheck("MDM2-p53 chain B atoms", result.source_verification.chain_atom_counts.B, chainB.length), inputCheck("MDM2-p53 atom contacts", result.computed_from_pinned_pdb.atom_contact_count, contacts), inputCheck("MDM2-p53 residue pairs", result.computed_from_pinned_pdb.residue_pair_count, residuePairs.size)];
}

function validateAdenylate(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const open = pdbAtoms(readFileSync(resolveInside(root, caseFile(entry, "inputs/4AKE.pdb")), "utf8"));
  const closed = pdbAtoms(readFileSync(resolveInside(root, caseFile(entry, "inputs/1AKE.pdb")), "utf8"));
  const countCa = (textPath: string) => readFileSync(resolveInside(root, textPath), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("ATOM  ") && line.slice(12, 16).trim() === "CA" && line.slice(21, 22) === "A").length;
  const result = readJson<{ source_verification: Record<string, { atom_count: number; chain_a_ca_count: number; ap5_atom_counts?: Record<string, number> }>; starter_contract_expected: { aligned_residue_count: number } }>(root, caseFile(entry, "outputs/results.json"));
  const caOpen = countCa(caseFile(entry, "inputs/4AKE.pdb")); const caClosed = countCa(caseFile(entry, "inputs/1AKE.pdb"));
  return [inputCheck("4AKE atoms", result.source_verification["4AKE"]!.atom_count, open.length), inputCheck("1AKE atoms", result.source_verification["1AKE"]!.atom_count, closed.length), inputCheck("4AKE chain A CA", result.source_verification["4AKE"]!.chain_a_ca_count, caOpen), inputCheck("1AKE chain A CA", result.source_verification["1AKE"]!.chain_a_ca_count, caClosed), check("adenylate aligned count matches CA correspondence", result.starter_contract_expected.aligned_residue_count, caOpen)];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  if (quoted || rows.length === 0 || rows.some((item) => item.length !== rows[0]!.length)) throw new Error("invalid CSV");
  return rows;
}

function csvRecords(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text); const header = rows[0]!;
  return rows.slice(1).map((row) => Object.fromEntries(header.map((name, index) => [name, row[index]!])));
}

function validateLiteratureDatabase(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const result = readJson<Record<string, unknown>>(root, caseFile(entry, "outputs/results.json"));
  switch (entry.id) {
    case "literature-trem2-landscape": {
      const records = result.records as Array<{ pmid: string }>; const counts = result.theme_counts as Record<string, number>; const preprint = result.preprint as Record<string, unknown>;
      return [check("TREM2 record count matches records", result.record_count, records.length), check("TREM2 retained snapshot size", records.length, 10), check("TREM2 PMID identities unique", new Set(records.map((record) => record.pmid)).size, records.length), check("TREM2 review and research counts cover records", counts["primary or model research"]! + counts["reviews or perspectives"]!, records.length), check("TREM2 review count", counts["reviews or perspectives"], 6), check("TREM2 research count", counts["primary or model research"], 4), check("TREM2 preprint DOI", preprint.doi, "10.1101/2025.03.28.646038"), check("TREM2 publication link checked without a match", preprint.publication_link_checked === true && preprint.linked_publication_found === false, true)];
    }
    case "literature-pmc-availability": {
      const files = result.article_files as string[]; const urls = result.canonical_urls as Record<string, string>;
      return [check("PMC identifier triplet", `${result.pmcid}|${result.pmid}|${result.doi}`, "PMC3257301|22253597|10.1371/journal.ppat.1002485"), check("PMC canonical URLs preserve identifiers", urls.pmc!.includes(String(result.pmcid)) && urls.pubmed!.includes(String(result.pmid)) && urls.doi!.endsWith(String(result.doi)), true), check("PMC open-access license", result.is_pmc_openaccess === true && result.license === "CC BY", true), check("PMC status flags", result.is_manuscript === false && result.is_retracted === false, true), check("PMC file types", [...files].sort().join(","), ["PDF", "XML", "plain text"].sort().join(",")), check("PMC media URL count", result.media_url_count, 22)];
    }
    case "literature-preprint-publication-link": {
      const preprint = result.preprint as { doi: string; title: string; versions: Array<{ date: string }> }; const publication = result.publication as { doi: string; pmid: string; title: string; date: string }; const linkage = result.linkage as { elapsed_days: number; title_changed: boolean; preprint_first_date: string; publication_date: string };
      const elapsed = Math.round((Date.parse(publication.date) - Date.parse(preprint.versions[0]!.date)) / 86_400_000);
      return [check("preprint DOI", preprint.doi, "10.1101/2020.09.09.20191205"), check("preprint version dates", preprint.versions.map((version) => version.date).join(","), "2020-09-10,2020-09-11"), check("linked publication identity", `${publication.doi}|${publication.pmid}`, "10.1038/s41467-021-21444-5|33608522"), check("preprint elapsed days recomputed", linkage.elapsed_days, elapsed), check("preprint linkage dates match records", `${linkage.preprint_first_date}|${linkage.publication_date}`, `${preprint.versions[0]!.date}|${publication.date}`), check("preprint title-change flag recomputed", linkage.title_changed, preprint.title !== publication.title)];
    }
    case "databases-il6r-asthma": {
      const target = result.target as Record<string, unknown>; const disease = result.disease as Record<string, unknown>; const open = result.open_targets as { asthma_rows_returned: number; datasource_scores: Record<string, number> }; const gwas = result.gwas_catalog as Record<string, unknown>; const gtex = result.gtex as { variant: string; eqtl_rows_total: number; il6r_eqtl_rows: number; il6r_tissues: string[]; il6r_nes_range: { minimum: number; maximum: number } };
      return [check("IL6R target and disease identifiers", `${target.symbol}|${target.ensembl_id}|${disease.id}`, "IL6R|ENSG00000160712|MONDO_0004979"), check("IL6R asthma row", open.asthma_rows_returned, 1), check("IL6R datasource scores retained", `${open.datasource_scores.gwas_credible_sets}|${open.datasource_scores.europepmc}`, "0.8824150241840469|0.6641557469258165"), check("IL6R GWAS slice size", gwas.records_returned, 10), check("IL6R GTEx row counts", `${gtex.eqtl_rows_total}|${gtex.il6r_eqtl_rows}|${gtex.il6r_tissues.length}`, "15|7|7"), check("IL6R NES range negative and ordered", gtex.il6r_nes_range.minimum < gtex.il6r_nes_range.maximum && gtex.il6r_nes_range.maximum < 0, true), check("IL6R variant", gtex.variant, "rs2228145")];
    }
    case "databases-variant-interpretation": {
      const variant = result.variant as Record<string, unknown>; const clinvar = result.clinvar as { records_returned: number; selected_alt: string; selected_variation_id: string; other_alt_record: { alt: string; variation_id: string } }; const ensembl = result.ensembl as { name: string; returned_synonyms_include: string[] }; const ukb = result.ukb_topmed as Record<string, unknown>; const gnomad = result.gnomad as Record<string, unknown>;
      return [check("variant allele identity across records", variant.grch38, ukb.variant), check("variant rsID identity across records", variant.rsid, ensembl.name), check("variant ClinVar alleles remain distinct", `${clinvar.records_returned}|${clinvar.selected_alt}|${clinvar.selected_variation_id}|${clinvar.other_alt_record.alt}|${clinvar.other_alt_record.variation_id}`, "2|T|7413|G|1692994"), check("variant Ensembl synonym", ensembl.returned_synonyms_include.includes("VCV000007413"), true), check("variant cohort frequency", ukb.allele_frequency, 0.29), check("variant association count", ukb.association_count_total, 1419), check("variant gnomAD evidence retained", gnomad.status === "success" && gnomad.used_as_evidence === true && gnomad.dataset === "gnomad_r4", true)];
    }
    default: {
      const protein = result.protein as Record<string, unknown>; const target = result.target as Record<string, unknown>; const mechanism = result.mechanism_slice as Record<string, unknown>; const compounds = result.selected_compounds as Array<Record<string, unknown>>; const structure = result.structure as Record<string, unknown>; const pathway = result.pathway as Record<string, unknown>; const notes = result.service_notes as Array<Record<string, unknown>>;
      return [check("EGFR stable identifiers", `${protein.uniprot}|${target.chembl_id}|${structure.pdb_id}|${pathway.reactome_id}`, "P00533|CHEMBL203|1M17|R-HSA-177929"), check("EGFR reviewed human target", protein.reviewed === true && protein.entry_version === 300 && target.organism === "Homo sapiens", true), check("EGFR mechanism slice", `${mechanism.records_returned}|${mechanism.max_phase_4_records}|${mechanism.action_type}`, "10|8|INHIBITOR in all returned records"), check("EGFR selected compounds phase four", compounds.length === 3 && compounds.every((compound) => compound.max_phase === 4), true), check("EGFR structure", structure.method === "X-RAY DIFFRACTION" && structure.resolution_angstrom === 2.6 && /erlotinib/i.test(String(structure.title)), true), check("EGFR pathway", pathway.name, "Signaling by EGFR"), check("EGFR Reactome evidence retained", notes.every((note) => note.status === "success" && note.used_as_evidence === true), true)];
    }
  }
}

function validateNgs(root: string, entry: ShowcaseDefinition, workflowId: string): ValidationResult["checks"] {
  const evidence = readJson<{ workbench_version: string; compute_targets: Array<{ id: string; inspection: string }>; local_runtime: Record<string, string>; registered_runs: number; execution_performed: boolean; workflow: { id: string; engine: string; version: string; source_sha256: string }; evidence_labels: { unknown: string[] } }>(root, caseFile(entry, "outputs/workflow-evidence.json"));
  const review = readFileSync(resolveInside(root, caseFile(entry, "outputs/readiness-review.md")), "utf8");
  return [check(`${entry.id} workflow identity`, evidence.workflow.id, workflowId), check(`${entry.id} Workbench version`, evidence.workbench_version, "0.2.16"), check(`${entry.id} workflow engine`, evidence.workflow.engine, "Snakemake"), check(`${entry.id} workflow version structured`, /^version-[0-9a-f]{32}$/.test(evidence.workflow.version), true), check(`${entry.id} workflow source identity structured`, /^sha256:[0-9a-f]{64}$/.test(evidence.workflow.source_sha256), true), check(`${entry.id} no run executed`, evidence.registered_runs === 0 && !evidence.execution_performed, true), check(`${entry.id} local runtime unavailable`, evidence.local_runtime.snakemake === "missing" && evidence.local_runtime.docker_daemon === "unreachable", true), check(`${entry.id} remote target unavailable`, evidence.compute_targets.some((target) => target.id !== "local" && target.inspection === "unreachable"), true), check(`${entry.id} scientific result unavailable`, evidence.evidence_labels.unknown.includes("biological result") && review.includes("Result availability: unavailable"), true)];
}

function validateGfp(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const atoms = pdbAtoms(readFileSync(resolveInside(root, caseFile(entry, "inputs/1EMA.pdb")), "utf8"));
  const ligand = atoms.filter((atom) => atom.residueName === "CRO" && atom.chain === "A" && atom.residueId === "66" && atom.element !== "H"); const polymer = atoms.filter((atom) => atom.record === "ATOM" && atom.element !== "H"); const contacts = new Set<string>();
  for (const atom of polymer) for (const other of ligand) { const dx = atom.x - other.x; const dy = atom.y - other.y; const dz = atom.z - other.z; if (dx * dx + dy * dy + dz * dz <= 16) { contacts.add(atom.residue); break; } }
  const residues = new Set(atoms.filter((atom) => atom.record === "ATOM" || atom.residueName === "MSE").map((atom) => `${atom.chain}:${atom.residueId}`));
  const render = readJson<{ artifact: { byteLength: number }; provenance: { output: { width: number; height: number }; replay: { width: number; height: number }; source: { fileName: string } } }>(root, caseFile(entry, "previews/gfp.png.render.json")); const png = readFileSync(resolveInside(root, caseFile(entry, "previews/gfp.png")));
  return [inputCheck("GFP coordinate atoms", atoms.length, 1866), inputCheck("GFP modeled polymer residues", residues.size, 225), inputCheck("GFP CRO atoms", ligand.length, 22), inputCheck("GFP CRO contact residues", contacts.size, 18), check("GFP PNG bytes match render record", png.length, render.artifact.byteLength), check("GFP PNG dimensions match render record", `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, `${render.provenance.output.width}x${render.provenance.output.height}`), check("GFP replay dimensions match output", `${render.provenance.replay.width}x${render.provenance.replay.height}`, `${render.provenance.output.width}x${render.provenance.output.height}`), check("GFP render source", render.provenance.source.fileName, "1EMA.pdb")];
}

function validateLauncher(root: string, entry: ShowcaseDefinition, area: string): ValidationResult["checks"] {
  const record = readJson<{ schema: string; ready: boolean; view: string; visible_scientific_areas: string[]; task_list_exposed_to_tool: boolean; scientific_job_executed: boolean; selected_area: string }>(root, caseFile(entry, "outputs/launcher-observation.json"));
  return [check(`${entry.id} launcher schema`, record.schema, "life-sciences.launcher/v1"), check(`${entry.id} launcher ready`, record.ready && record.view === "launcher", true), check(`${entry.id} four scientific areas visible`, record.visible_scientific_areas.length === 4 && ["molecular design", "structure analysis", "genomics", "scientific compute"].every((value) => record.visible_scientific_areas.includes(value)), true), check(`${entry.id} selected area`, record.selected_area, area), check(`${entry.id} no task or result claimed`, !record.task_list_exposed_to_tool && !record.scientific_job_executed, true)];
}

function validateSpatial(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  if (entry.id === "slide-tissue-architecture") {
    const metadata = readJson<{ main_image: { width: number; height: number; tile_width: number; tile_height: number; samples_per_pixel: number; bits_per_sample: number }; pyramid_levels: Array<{ width: number; height: number; downsample_x: number; downsample_y: number }>; associated_images: Array<{ kind: string }> }>(root, caseFile(entry, "outputs/pyramid-metadata.json"));
    return [check("slide dimensions", `${metadata.main_image.width}x${metadata.main_image.height}`, "46000x32893"), check("slide tile and RGB metadata", `${metadata.main_image.tile_width}x${metadata.main_image.tile_height}|${metadata.main_image.samples_per_pixel}|${metadata.main_image.bits_per_sample}`, "240x240|3|8"), check("slide pyramid dimensions", metadata.pyramid_levels.map((level) => `${level.width}x${level.height}@${level.downsample_x}`).join(","), "46000x32893@1,11500x8223@4,2875x2055@16"), check("slide vertical ratios recomputed", metadata.pyramid_levels.every((level) => Math.abs(level.downsample_y - metadata.main_image.height / level.height) < 1e-12), true), check("slide associated images", metadata.associated_images.map((image) => image.kind).sort().join(","), ["thumbnail", "label", "macro"].sort().join(","))];
  }
  if (entry.id === "slide-spatial-expression") {
    const metadata = readJson<{ observations: number; genes: number; matrix: string; matrix_format: string; matrix_shape: number[]; value_scale: string }>(root, caseFile(entry, "outputs/metadata-summary.json")); const expression = readJson<Record<string, { gene_index: number; n: number; nonzero: number; max: number; mean: number }>>(root, caseFile(entry, "outputs/expression-summary.json"));
    return [check("spatial matrix dimensions", `${metadata.observations}x${metadata.genes}`, metadata.matrix_shape.join("x")), check("spatial matrix identity", `${metadata.matrix}|${metadata.matrix_format}|${metadata.value_scale}`, "X|csr|unknown"), check("spatial expression coverage", `${expression.Slc17a7!.n}|${expression.Gad1!.n}`, "684|684"), check("spatial gene indices", `${expression.Slc17a7!.gene_index}|${expression.Gad1!.gene_index}`, "7717|1607"), check("spatial Slc17a7 statistics", `${expression.Slc17a7!.nonzero}|${expression.Slc17a7!.max}|${expression.Slc17a7!.mean}`, "671|4.05490255355835|2.7109799739735867"), check("spatial Gad1 statistics", `${expression.Gad1!.nonzero}|${expression.Gad1!.max}|${expression.Gad1!.mean}`, "490|3.9498746395111084|1.071753799871743")];
  }
  if (entry.id === "slide-research-export") {
    const rows = csvRecords(readFileSync(resolveInside(root, caseFile(entry, "outputs/spatial-observations-expression.csv")), "utf8")); const provenance = readJson<{ coordinates: { bounds: Record<string, number> }; coverage: { observations_exported: number; observations_total: number; in_tissue: number } }>(root, caseFile(entry, "outputs/export-provenance.json")); const values = (key: string) => rows.map((row) => Number(row[key])); const xs = values("x"); const ys = values("y"); const slc = values("Slc17a7_X"); const gad = values("Gad1_X"); const mean = (items: number[]) => items.reduce((sum, value) => sum + value, 0) / items.length;
    return [check("spatial export coverage", `${rows.length}|${provenance.coverage.observations_exported}|${provenance.coverage.observations_total}`, "684|684|684"), check("spatial export indices sequential", rows.every((row, index) => Number(row.observation_index) === index), true), check("spatial export ID companion fields", rows.every((row) => (JSON.parse(row.observation_id_json!) as { value: string }).value === row.observation_id), true), check("spatial export in-tissue count", rows.filter((row) => row.in_tissue === "true").length, provenance.coverage.in_tissue), check("spatial export coordinate bounds", `${Math.min(...xs)}|${Math.max(...xs)}|${Math.min(...ys)}|${Math.max(...ys)}`, `${provenance.coordinates.bounds.min_x}|${provenance.coordinates.bounds.max_x}|${provenance.coordinates.bounds.min_y}|${provenance.coordinates.bounds.max_y}`), check("spatial export gene means", `${mean(slc)}|${mean(gad)}`, "2.7109799739735867|1.071753799871743"), check("spatial export gene maxima", `${Math.max(...slc)}|${Math.max(...gad)}`, "4.05490255355835|3.9498746395111084")];
  }
  const geojson = readJson<{ type: string; source_association: { matrix_revision: string }; features: Array<{ properties: { observation_index: number; radius_pixels: number; biological_interpretation: string }; geometry: { type: string; coordinates: number[][][] } }> }>(root, caseFile(entry, "outputs/source-aligned-annotations.geojson")); const provenance = readJson<{ matrix_revision: string; feature_count: number }>(root, caseFile(entry, "outputs/overlay-provenance.json")); const centers = [[1575,98],[2538,1774],[1850,98]]; const geometryOk = geojson.features.every((feature, index) => { const ring = feature.geometry.coordinates[0]!; const center = centers[index]!; return feature.geometry.type === "Polygon" && feature.properties.radius_pixels === 55 && ring.length === 17 && ring.slice(0,-1).every(([x,y]) => Math.abs(Math.hypot(x! - center[0]!, y! - center[1]!) - 55) < 0.001); });
  return [check("GeoJSON type", geojson.type, "FeatureCollection"), check("GeoJSON feature count", geojson.features.length, provenance.feature_count), check("GeoJSON observation indices", geojson.features.map((feature) => feature.properties.observation_index).join(","), "0,1,2"), check("GeoJSON circle geometry", geometryOk, true), check("GeoJSON matrix revision", geojson.source_association.matrix_revision, provenance.matrix_revision), check("GeoJSON no biological classification", geojson.features.every((feature) => feature.properties.biological_interpretation === "none"), true)];
}

function validateDesign(root: string, entry: ShowcaseDefinition): ValidationResult["checks"] {
  const result = readJson<{
    designed_candidates: number;
    top5_ensemble_predictions_successful: number;
    top5: Array<{ candidate: string }>;
  }>(root, caseFile(entry, "outputs/result-summary.json"));
  const candidates = csvRecords(readFileSync(resolveInside(root, caseFile(entry, "outputs/candidates.csv")), "utf8")); const ranking = csvRecords(readFileSync(resolveInside(root, caseFile(entry, "outputs/top5_ensemble_ranking.csv")), "utf8")); const candidateById = new Map(candidates.map((row) => [row.candidate, row])); const scores = ranking.map((row) => Number(row.ensemble_score_mean)); const summary = readJson<{ designed_candidates: number; initial_predictions_successful: number; historical_run_structure_files: number; public_case_structure_files: number; top5_ensemble_predictions_successful: number; top5: Array<Record<string,string>> }>(root, caseFile(entry, "outputs/result-summary.json")); const cif = readFileSync(resolveInside(root, caseFile(entry, "outputs/NB13_E104Q_best_model.cif")), "utf8");
  return [check("PD-L1 candidate counts", `${summary.designed_candidates}|${summary.initial_predictions_successful}|${candidates.length}`, "20|20|20"), check("PD-L1 candidate identities unique", new Set(candidates.map((row) => row.candidate)).size, candidates.length), check("PD-L1 candidate sequences", candidates.every((row) => row.sequence?.length === 130 && Number(row.length) === 130 && [...row.sequence].filter((residue) => residue === "C").length === Number(row.cysteines)), true), check("PD-L1 ranking order", ranking.length === 5 && ranking.every((row,index) => Number(row.rank) === index + 1) && scores.every((score,index) => index === 0 || scores[index-1]! >= score), true), check("PD-L1 ranking sequences match candidate table", ranking.every((row) => candidateById.get(row.candidate)?.sequence === row.sequence), true), check("PD-L1 ensemble and structure accounting", `${result.top5_ensemble_predictions_successful}|${summary.historical_run_structure_files}|${summary.public_case_structure_files}`, "25|40|1"), check("PD-L1 leading candidate", result.top5[0]?.candidate, "NB13_E104Q"), check("PD-L1 best model mmCIF structure", /^data_model/m.test(cif) && /_struct\.pdbx_structure_determination_methodology computational/.test(cif) && /_atom_site\./.test(cif), true)];
}

export function validateShowcase(root: string, entry: ShowcaseDefinition): ValidationResult {
  const checks = [...validateScientificRecord(root, entry), ...validateArtifacts(root, entry)];
  switch (entry.id) {
    case "literature-trem2-landscape":
    case "literature-pmc-availability":
    case "literature-preprint-publication-link":
    case "databases-il6r-asthma":
    case "databases-variant-interpretation":
    case "databases-egfr-landscape": checks.push(...validateLiteratureDatabase(root, entry)); break;
    case "sequence-lambda-annotation": checks.push(...validateLambda(root, entry)); break;
    case "sequence-ras-alignment": checks.push(...validateRas(root, entry)); break;
    case "ngs-fastq-qc": checks.push(...validateNgs(root, entry, "oai_fastq_qc")); break;
    case "ngs-bulk-rnaseq": checks.push(...validateNgs(root, entry, "oai_bulk_rnaseq_counts_qc")); break;
    case "ngs-single-cell": checks.push(...validateNgs(root, entry, "oai_scrnaseq_fastq_to_count")); break;
    case "structure-mdm2-p53": checks.push(...validateMdm2(root, entry)); break;
    case "structure-adenylate-kinase": checks.push(...validateAdenylate(root, entry)); break;
    case "structure-gfp-figure": checks.push(...validateGfp(root, entry)); break;
    case "slide-tissue-architecture":
    case "slide-spatial-expression":
    case "slide-segmentation-overlay":
    case "slide-research-export": checks.push(...validateSpatial(root, entry)); break;
    case "rosalind-molecular-design": checks.push(...validateDesign(root, entry)); break;
    case "rosalind-structure-analysis": checks.push(...validateLauncher(root, entry, "structure analysis")); break;
    case "rosalind-genomics": checks.push(...validateLauncher(root, entry, "genomics")); break;
    default:
      checks.push(check("audited showcase metadata retained", Boolean(
        entry.domain
        && entry.caseType
        && entry.difficulty
        && entry.evidenceLevel
        && entry.capabilities.length
        && entry.execution.actualTools.length
        && entry.reproductionSteps.length
        && entry.provenance.records.length,
      ), true));
  }
  return { ok: checks.every((item) => item.ok), checks };
}
