import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, isAbsolute, resolve } from "node:path";

export interface ScienceExecutionContext {
  session: object;
  sessionId?: string;
  signal: AbortSignal;
  packageRoot: string;
}

type Json = Record<string, unknown>;
type MoleculeType = "dna" | "rna" | "protein" | "unknown";

interface SequenceRecord {
  id: string;
  label: string;
  sequence: string;
  moleculeType: MoleculeType;
  features: Json[];
}

interface SequenceJob {
  id: string;
  kind: string;
  state: "completed" | "cancelled";
  result?: Json;
}

interface SequenceState {
  viewerSessionId: string;
  sourcePath: string;
  sourceFormat: string;
  mode: "sequence" | "alignment";
  records: SequenceRecord[];
  options: Json;
  selectedRows: string[];
  selectedRange?: { record: string; start: number; end: number };
  search?: { query: string; hits: Json[]; selectedHit: number | null };
  tracks: Json[];
  artifacts: Json[];
  annotations: Json[];
  jobs: Map<string, SequenceJob>;
  analyses: Json[];
}

const CONTROL_ACTIONS = new Set([
  "clear_alignment_selection", "clear_read_selection", "clear_sequence_selection", "compute_alignment_guide_tree", "dismiss_workbench_feedback",
  "filter_alignment_rows", "focus_alignment_cell", "focus_alignment_reference_coordinate", "focus_sequence_coordinate",
  "navigate_alignment_search_hit", "navigate_sequence_search_hit", "navigate_sequence_feature", "reset_alignment_view",
  "search_alignment", "search_sequence", "select_alignment_columns", "select_alignment_rows", "select_read",
  "select_sequence_feature", "select_sequence_range", "set_alignment_reference", "set_alignment_row_visibility",
  "set_alignment_view_options", "set_chromatogram_view_options", "set_display_mode", "set_mode", "set_quality_view_options",
  "set_read_pileup_options", "set_sequence_annotation_index", "set_sequence_record", "set_sequence_record_browser",
  "set_sequence_view_options", "set_toolbar_visibility", "set_workbench_panel", "set_workbench_disclosure", "show_all_alignment_rows",
]);

const DNA = new Set("ACGTRYSWKMBDHVN".split(""));
const RNA = new Set("ACGURYSWKMBDHVN".split(""));
const PROTEIN = new Set("ACDEFGHIKLMNPQRSTVWYXBZJUO*".split(""));

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) throw new Error(`${label} must be a positive integer.`);
  return value as number;
}

function clone<T>(value: T): T { return structuredClone(value); }

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Operation cancelled.");
}

function moleculeType(sequence: string): MoleculeType {
  const clean = sequence.replace(/[-.\s]/g, "").toUpperCase();
  if (!clean) return "unknown";
  if ([...clean].every((base) => DNA.has(base)) && !clean.includes("U")) return "dna";
  if ([...clean].every((base) => RNA.has(base)) && clean.includes("U")) return "rna";
  if ([...clean].every((base) => PROTEIN.has(base))) return "protein";
  return "unknown";
}

function parseFasta(source: string): SequenceRecord[] {
  const records: SequenceRecord[] = [];
  let header: string | undefined;
  let lines: string[] = [];
  const flush = () => {
    if (!header) return;
    const [id = `record-${records.length + 1}`, ...rest] = header.split(/\s+/);
    const sequence = lines.join("").replace(/\s/g, "").toUpperCase();
    if (!sequence) throw new Error(`FASTA record ${id} has no sequence.`);
    records.push({ id, label: rest.join(" ") || id, sequence, moleculeType: moleculeType(sequence), features: [] });
  };
  for (const line of source.replace(/\r/g, "").split("\n")) {
    if (line.startsWith(">")) { flush(); header = line.slice(1).trim(); lines = []; }
    else if (line.trim()) lines.push(line.trim());
  }
  flush();
  if (!records.length) throw new Error("No FASTA records were found.");
  return records;
}

function parseFastq(source: string): SequenceRecord[] {
  const lines = source.replace(/\r/g, "").split("\n").filter((line) => line !== "");
  if (lines.length < 4 || lines.length % 4 !== 0) throw new Error("FASTQ requires complete four-line records.");
  const records: SequenceRecord[] = [];
  for (let i = 0; i < lines.length; i += 4) {
    const header = lines[i]!;
    const sequence = lines[i + 1]!.trim().toUpperCase();
    const quality = lines[i + 3]!;
    if (!header.startsWith("@") || quality.length !== sequence.length) throw new Error(`Invalid FASTQ record at line ${i + 1}.`);
    records.push({ id: header.slice(1).split(/\s+/)[0] || `read-${i / 4 + 1}`, label: header.slice(1), sequence, moleculeType: moleculeType(sequence), features: [{ quality }] });
  }
  return records;
}

function parseGenBank(source: string): SequenceRecord[] {
  const locus = /^LOCUS\s+(\S+)/m.exec(source)?.[1] ?? "genbank-record";
  const origin = /^ORIGIN[^\r\n]*\r?\n([\s\S]*?)^\/\/\s*$/m.exec(source)?.[1] ?? "";
  const sequence = origin.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (!sequence) throw new Error("GenBank ORIGIN sequence is unavailable.");
  const features: Json[] = [];
  const featureSource = /^FEATURES[^\n]*\n([\s\S]*?)^ORIGIN\b/m.exec(source)?.[1] ?? "";
  const starts = [...featureSource.matchAll(/^\s{5}(\S+)\s+(.+)$/gm)];
  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index]!;
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? featureSource.length;
    const block = featureSource.slice(start, end);
    const qualifiers: Json = {};
    for (const qualifier of block.matchAll(/\/([A-Za-z0-9_]+)=(?:"([\s\S]*?)"|([^\r\n]+))/g)) {
      const value = (qualifier[2] ?? qualifier[3] ?? "").replace(/\s+/g, "").trim();
      qualifiers[qualifier[1]!] = value;
    }
    features.push({ type: match[1], location: match[2]?.trim(), qualifiers });
  }
  return [{ id: locus, label: locus, sequence, moleculeType: moleculeType(sequence), features }];
}

function parseInput(path: string): { records: SequenceRecord[]; format: string } {
  const source = readFileSync(path, "utf8");
  const extension = extname(path).toLowerCase();
  if (extension === ".fastq" || extension === ".fq" || source.trimStart().startsWith("@")) return { records: parseFastq(source), format: "fastq" };
  if (extension === ".gb" || extension === ".gbk" || /^LOCUS\s/m.test(source)) return { records: parseGenBank(source), format: "genbank" };
  return { records: parseFasta(source), format: /[.-]/.test(source) ? "aligned-fasta" : "fasta" };
}

function pairwiseIdentity(a: string, b: string): { compared: number; identical: number; identity: number; distance: number } {
  let compared = 0; let identical = 0;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const x = a[i] ?? "-"; const y = b[i] ?? "-";
    if (x === "-" || y === "-") continue;
    compared += 1; if (x === y) identical += 1;
  }
  const identity = compared ? identical / compared : 0;
  return { compared, identical, identity, distance: 1 - identity };
}

function alignmentMetrics(records: readonly SequenceRecord[]): Json {
  if (!records.length) throw new Error("An alignment needs at least one record.");
  const width = Math.max(...records.map((record) => record.sequence.length));
  const columns: Json[] = [];
  let identitySum = 0; let conservationSum = 0;
  for (let index = 0; index < width; index += 1) {
    const residues = records.map((record) => record.sequence[index] ?? "-").filter((residue) => residue !== "-");
    const counts = new Map<string, number>();
    for (const residue of residues) counts.set(residue, (counts.get(residue) ?? 0) + 1);
    const maximum = Math.max(0, ...counts.values());
    const identity = residues.length ? maximum / residues.length : 0;
    identitySum += identity;
    const conservation = residues.length > 1 ? (maximum - 1) / (residues.length - 1) : identity;
    conservationSum += conservation;
    columns.push({ column: index + 1, identity, conservation, gapFraction: 1 - residues.length / records.length });
  }
  const pairs: Json[] = [];
  for (let i = 0; i < records.length; i += 1) for (let j = i + 1; j < records.length; j += 1) {
    const left = records[i]!; const right = records[j]!;
    pairs.push({ left: left.id, right: right.id, ...pairwiseIdentity(left.sequence, right.sequence) });
  }
  return { rowCount: records.length, alignedLength: width, meanIdentity: identitySum / width, meanConservationNormalized: conservationSum / width, pairs, columns };
}

interface PairwiseAlignment {
  left: string;
  right: string;
  score: number;
}

/** Deterministic global Needleman-Wunsch alignment. Ties prefer diagonal, then deletion, then insertion. */
function needlemanWunsch(left: string, right: string): PairwiseAlignment {
  const match = 2; const mismatch = -1; const gap = -2;
  const scores = Array.from({ length: left.length + 1 }, () => new Int32Array(right.length + 1));
  const directions = Array.from({ length: left.length + 1 }, () => new Uint8Array(right.length + 1));
  for (let i = 1; i <= left.length; i += 1) { scores[i]![0] = i * gap; directions[i]![0] = 2; }
  for (let j = 1; j <= right.length; j += 1) { scores[0]![j] = j * gap; directions[0]![j] = 3; }
  for (let i = 1; i <= left.length; i += 1) for (let j = 1; j <= right.length; j += 1) {
    const diagonal = scores[i - 1]![j - 1]! + (left[i - 1] === right[j - 1] ? match : mismatch);
    const deletion = scores[i - 1]![j]! + gap;
    const insertion = scores[i]![j - 1]! + gap;
    if (diagonal >= deletion && diagonal >= insertion) { scores[i]![j] = diagonal; directions[i]![j] = 1; }
    else if (deletion >= insertion) { scores[i]![j] = deletion; directions[i]![j] = 2; }
    else { scores[i]![j] = insertion; directions[i]![j] = 3; }
  }
  let i = left.length; let j = right.length; const alignedLeft: string[] = []; const alignedRight: string[] = [];
  while (i > 0 || j > 0) {
    const direction = directions[i]![j]!;
    if (direction === 1) { alignedLeft.push(left[i - 1]!); alignedRight.push(right[j - 1]!); i -= 1; j -= 1; }
    else if (direction === 2) { alignedLeft.push(left[i - 1]!); alignedRight.push("-"); i -= 1; }
    else { alignedLeft.push("-"); alignedRight.push(right[j - 1]!); j -= 1; }
  }
  return { left: alignedLeft.reverse().join(""), right: alignedRight.reverse().join(""), score: scores[left.length]![right.length]! };
}

interface CenterPairLayout {
  gaps: string[];
  residues: string[];
}

function asCenterPairLayout(rawCenter: string, pair: PairwiseAlignment): CenterPairLayout {
  const gaps = Array.from({ length: rawCenter.length + 1 }, () => "");
  const residues: string[] = [];
  let centerIndex = 0;
  for (let index = 0; index < pair.left.length; index += 1) {
    const center = pair.left[index]!; const target = pair.right[index]!;
    if (center === "-") gaps[centerIndex] += target;
    else {
      if (center !== rawCenter[centerIndex]) throw new Error("Needleman-Wunsch center reconstruction failed.");
      residues.push(target); centerIndex += 1;
    }
  }
  if (centerIndex !== rawCenter.length) throw new Error("Needleman-Wunsch center reconstruction is incomplete.");
  return { gaps, residues };
}

function centerStar(records: readonly SequenceRecord[]): { records: SequenceRecord[]; centerId: string; pairScores: Json[] } {
  const raw = records.map((record) => record.sequence.replace(/[-.]/g, ""));
  const pairCache = new Map<string, PairwiseAlignment>();
  const getPair = (leftIndex: number, rightIndex: number) => {
    const key = `${leftIndex}:${rightIndex}`;
    const existing = pairCache.get(key);
    if (existing) return existing;
    const result = needlemanWunsch(raw[leftIndex]!, raw[rightIndex]!);
    pairCache.set(key, result); return result;
  };
  const totals = raw.map((_, index) => raw.reduce((sum, __, other) => index === other ? sum : sum + getPair(index, other).score, 0));
  let center = 0;
  for (let index = 1; index < totals.length; index += 1) if (totals[index]! > totals[center]!) center = index;
  const rawCenter = raw[center]!;
  const layouts = new Map<number, CenterPairLayout>();
  const maximumGaps = new Array<number>(rawCenter.length + 1).fill(0);
  for (let index = 0; index < records.length; index += 1) if (index !== center) {
    const layout = asCenterPairLayout(rawCenter, getPair(center, index));
    layouts.set(index, layout);
    for (let slot = 0; slot < layout.gaps.length; slot += 1) maximumGaps[slot] = Math.max(maximumGaps[slot]!, layout.gaps[slot]!.length);
  }
  const render = (index: number): string => {
    const layout = layouts.get(index);
    let output = "";
    for (let slot = 0; slot <= rawCenter.length; slot += 1) {
      const inserted = layout?.gaps[slot] ?? "";
      output += inserted + "-".repeat(maximumGaps[slot]! - inserted.length);
      if (slot < rawCenter.length) output += index === center ? rawCenter[slot]! : layout!.residues[slot]!;
    }
    return output;
  };
  const pairScores: Json[] = [];
  for (let index = 0; index < records.length; index += 1) if (index !== center) pairScores.push({ center: records[center]!.id, target: records[index]!.id, score: getPair(center, index).score });
  return { records: records.map((record, index) => ({ ...clone(record), sequence: render(index) })), centerId: records[center]!.id, pairScores };
}

function threeTaxonNewick(records: readonly SequenceRecord[]): string | undefined {
  if (records.length !== 3) return undefined;
  const d01 = pairwiseIdentity(records[0]!.sequence, records[1]!.sequence).distance;
  const d02 = pairwiseIdentity(records[0]!.sequence, records[2]!.sequence).distance;
  const d12 = pairwiseIdentity(records[1]!.sequence, records[2]!.sequence).distance;
  const left = Math.max(0, (d01 + d02 - d12) / 2);
  const middle = Math.max(0, d01 - left);
  const right = Math.max(0, d02 - left);
  return `(${records[0]!.id}:${left.toFixed(6)},${records[1]!.id}:${middle.toFixed(6)},${records[2]!.id}:${right.toFixed(6)});`;
}

const CODONS: Record<string, string> = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L", TCT: "S", TCC: "S", TCA: "S", TCG: "S", TAT: "Y", TAC: "Y", TAA: "*", TAG: "*", TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L", CCT: "P", CCC: "P", CCA: "P", CCG: "P", CAT: "H", CAC: "H", CAA: "Q", CAG: "Q", CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M", ACT: "T", ACC: "T", ACA: "T", ACG: "T", AAT: "N", AAC: "N", AAA: "K", AAG: "K", AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V", GCT: "A", GCC: "A", GCA: "A", GCG: "A", GAT: "D", GAC: "D", GAA: "E", GAG: "E", GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

function translate(sequence: string, frame = 1): string {
  const dna = sequence.replace(/[-.\s]/g, "").toUpperCase().replace(/U/g, "T");
  let peptide = "";
  for (let index = frame - 1; index + 2 < dna.length; index += 3) peptide += CODONS[dna.slice(index, index + 3)] ?? "X";
  return peptide;
}

function reverseComplement(sequence: string): string {
  const complements: Record<string, string> = { A: "T", C: "G", G: "C", T: "A", U: "A", N: "N" };
  return [...sequence.toUpperCase()].reverse().map((base) => complements[base] ?? "N").join("");
}

function validateGenBankCds(record: SequenceRecord, gene: string): Json {
  const feature = record.features.find((candidate) => {
    const qualifiers = object(candidate.qualifiers);
    return candidate.type === "CDS" && qualifiers.gene === gene;
  });
  if (!feature) throw new Error(`GenBank CDS for gene ${gene} is unavailable.`);
  const location = string(feature.location, "feature location");
  const coordinates = [...location.matchAll(/(\d+)\.\.(\d+)/g)].map((match) => [Number(match[1]), Number(match[2])] as const);
  if (!coordinates.length) throw new Error(`GenBank location ${location} is not supported by the local CDS validator.`);
  const pieces = coordinates.map(([start, end]) => record.sequence.slice(start - 1, end));
  let codingSequence = pieces.join("");
  if (/^complement\(/i.test(location)) codingSequence = reverseComplement(codingSequence);
  const qualifiers = object(feature.qualifiers);
  const codonStart = Number(qualifiers.codon_start ?? 1);
  if (Number.isInteger(codonStart) && codonStart > 1) codingSequence = codingSequence.slice(codonStart - 1);
  const computed = translate(codingSequence);
  const terminalStopPresent = computed.endsWith("*");
  const peptide = computed.replace(/\*$/, "");
  const annotated = typeof qualifiers.translation === "string" ? qualifiers.translation : "";
  return {
    gene,
    location,
    codingBases: codingSequence.length,
    translatedResidues: peptide.length,
    terminalStopPresent,
    matchesAnnotatedTranslation: Boolean(annotated) && peptide === annotated,
    translationTable: Number(qualifiers.transl_table ?? 1),
    proteinId: typeof qualifiers.protein_id === "string" ? qualifiers.protein_id : null,
    computedPeptide: peptide,
    annotatedPeptide: annotated || null,
  };
}

function fastqMetrics(records: readonly SequenceRecord[]): Json {
  const qualities = records.map((record) => String(record.features[0]?.quality ?? ""));
  const bases = records.reduce((total, record) => total + record.sequence.length, 0);
  let q30 = 0;
  let calls = 0;
  const perCycle: number[] = [];
  for (const quality of qualities) for (let index = 0; index < quality.length; index += 1) {
    const value = quality.charCodeAt(index) - 33;
    calls += 1; if (value >= 30) q30 += 1;
    perCycle[index] = (perCycle[index] ?? 0) + value;
  }
  return { readCount: records.length, bases, q30Fraction: calls ? q30 / calls : 0, meanQualityByCycle: perCycle.map((total, index) => ({ cycle: index + 1, meanQuality: total / records.filter((record) => record.sequence.length > index).length })) };
}

function sourceLines(path: string): string[] {
  return readFileSync(path, "utf8").replace(/\r/g, "").split("\n");
}

function attributes(text: string, format: "gff3" | "gtf"): Json {
  const parsed: Json = {};
  if (format === "gff3") for (const field of text.split(";")) {
    const [key, value = ""] = field.split("=", 2);
    if (key?.trim()) parsed[key.trim()] = decodeURIComponent(value.trim());
  }
  else for (const match of text.matchAll(/([^\s;]+)\s+"([^"]*)"\s*;?/g)) parsed[match[1]!] = match[2]!;
  return parsed;
}

function countValues(values: readonly string[]): Json {
  const result: Json = {};
  for (const value of values) result[value] = Number(result[value] ?? 0) + 1;
  return result;
}

function parseAnnotationTrack(path: string, format: "gff3" | "gtf"): Json {
  const features: Json[] = [];
  for (const [lineIndex, line] of sourceLines(path).entries()) {
    if (!line || line.startsWith("#")) continue;
    const fields = line.split("\t");
    if (fields.length !== 9) throw new Error(`${format.toUpperCase()} line ${lineIndex + 1} must have nine tab-separated fields.`);
    const start = Number(fields[3]); const end = Number(fields[4]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) throw new Error(`${format.toUpperCase()} line ${lineIndex + 1} has an invalid coordinate interval.`);
    features.push({ seqid: fields[0], source: fields[1] === "." ? null : fields[1], type: fields[2], start, end, score: fields[5] === "." ? null : Number(fields[5]), strand: fields[6], phase: fields[7] === "." ? null : Number(fields[7]), attributes: attributes(fields[8]!, format) });
  }
  return { featureCount: features.length, sequenceCount: new Set(features.map((feature) => String(feature.seqid))).size, typeCounts: countValues(features.map((feature) => String(feature.type))), features };
}

function parseBedTrack(path: string): Json {
  const intervals: Json[] = [];
  for (const [lineIndex, line] of sourceLines(path).entries()) {
    if (!line || line.startsWith("#") || line.startsWith("track") || line.startsWith("browser")) continue;
    const fields = line.split("\t"); const start = Number(fields[1]); const end = Number(fields[2]);
    if (fields.length < 3 || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) throw new Error(`BED line ${lineIndex + 1} must start with chrom, 0-based start, and end.`);
    intervals.push({ chrom: fields[0], start, end, startOneBased: start + 1, name: fields[3] || null, score: fields[4] ? Number(fields[4]) : null, strand: fields[5] || null });
  }
  return { intervalCount: intervals.length, contigCount: new Set(intervals.map((item) => String(item.chrom))).size, totalBases: intervals.reduce((sum, item) => sum + Number(item.end) - Number(item.start), 0), intervals };
}

function classifyVariant(reference: string, alternate: string): string {
  if (alternate.startsWith("<") || alternate.includes("[") || alternate.includes("]")) return "symbolic";
  if (reference.length === 1 && alternate.length === 1) return "snv";
  if (reference.length === alternate.length) return "mnv";
  return reference.length < alternate.length ? "insertion" : "deletion";
}

function parseVcfTrack(path: string): Json {
  const variants: Json[] = []; let sampleCount = 0;
  for (const [lineIndex, line] of sourceLines(path).entries()) {
    if (line.startsWith("#CHROM")) { sampleCount = Math.max(0, line.split("\t").length - 9); continue; }
    if (!line || line.startsWith("#")) continue;
    const fields = line.split("\t"); const position = Number(fields[1]);
    if (fields.length < 8 || !Number.isInteger(position) || position < 1) throw new Error(`VCF line ${lineIndex + 1} is malformed.`);
    const alternatives = fields[4]!.split(",");
    for (const alternate of alternatives) variants.push({ chrom: fields[0], position, id: fields[2] === "." ? null : fields[2], reference: fields[3], alternate, quality: fields[5] === "." ? null : Number(fields[5]), filter: fields[6], info: attributes(fields[7]!, "gff3"), kind: classifyVariant(fields[3]!, alternate) });
  }
  return { variantCount: variants.length, sampleCount, contigCount: new Set(variants.map((variant) => String(variant.chrom))).size, kindCounts: countValues(variants.map((variant) => String(variant.kind))), filterCounts: countValues(variants.map((variant) => String(variant.filter))), variants };
}

function parseSamTrack(path: string): Json {
  const reads: Json[] = []; const headers: Json[] = [];
  for (const [lineIndex, line] of sourceLines(path).entries()) {
    if (!line) continue;
    if (line.startsWith("@")) { headers.push({ type: line.slice(1, 3), fields: line.split("\t").slice(1) }); continue; }
    const fields = line.split("\t"); const flag = Number(fields[1]); const position = Number(fields[3]); const mapq = Number(fields[4]);
    if (fields.length < 11 || !Number.isInteger(flag) || !Number.isInteger(position) || !Number.isInteger(mapq)) throw new Error(`SAM line ${lineIndex + 1} is malformed.`);
    reads.push({ queryName: fields[0], flag, mapped: (flag & 0x4) === 0, secondary: (flag & 0x100) !== 0, supplementary: (flag & 0x800) !== 0, reverse: (flag & 0x10) !== 0, reference: fields[2], position, mappingQuality: mapq, cigar: fields[5], sequenceLength: fields[9] === "*" ? 0 : fields[9]!.length });
  }
  const mapped = reads.filter((read) => read.mapped === true);
  return { headerCount: headers.length, readCount: reads.length, mappedReadCount: mapped.length, unmappedReadCount: reads.length - mapped.length, meanMappingQuality: mapped.length ? mapped.reduce((sum, read) => sum + Number(read.mappingQuality), 0) / mapped.length : null, referenceCounts: countValues(mapped.map((read) => String(read.reference))), reads, headers };
}

function resultError(error: unknown): Error { return error instanceof Error ? error : new Error(String(error)); }

export class SequenceService {
  private readonly states = new WeakMap<object, Map<string, SequenceState>>();
  private readonly saved = new Map<string, Omit<SequenceState, "jobs">>();

  async execute(operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<Json> {
    checkAbort(context.signal);
    switch (operation) {
      case "sequence.open_from_chat": return this.open(args, context);
      case "sequence.acquire_public_example": return this.acquireExample(args, context);
      case "sequence.query_viewer": return this.query(args, context);
      case "sequence.control_viewer": return this.control(args, context);
      case "sequence.run_analysis": return this.analyze(args, context);
      case "sequence.align": return this.align(args, context);
      case "sequence.cancel_job": return this.cancel(args, context);
      case "sequence.edit_copy": return this.editCopy(args, context);
      case "sequence.load_track": return this.loadTrack(args, context);
      case "sequence.manage_annotations": return this.annotations(args, context);
      case "sequence.save_session": return this.save(args, context);
      case "sequence.restore_session": return this.restore(args, context);
      case "sequence.export_artifact": return this.export(args, context);
      default: throw new Error(`Unsupported Sequence Viewer operation: ${operation}`);
    }
  }

  private sessionMap(session: object): Map<string, SequenceState> {
    let states = this.states.get(session);
    if (!states) { states = new Map(); this.states.set(session, states); }
    return states;
  }

  private state(args: Record<string, unknown>, context: ScienceExecutionContext): SequenceState {
    const states = this.sessionMap(context.session);
    const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId : undefined;
    if (!sessionId && states.size === 1) return states.values().next().value as SequenceState;
    if (!sessionId) throw new Error("sessionId is required when this DSH session has no active or more than one Sequence Viewer.");
    const state = states.get(sessionId);
    if (!state) throw new Error(`Sequence viewer session ${sessionId} is not active in this DSH session.`);
    return state;
  }

  private open(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const supplied = string(args.path, "path");
    const path = isAbsolute(supplied) ? supplied : resolve(context.packageRoot, supplied);
    if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Sequence source is unavailable: ${supplied}`);
    const parsed = parseInput(path);
    const mode = parsed.records.length > 1 && (parsed.format === "aligned-fasta" || parsed.records.some((record) => record.sequence.includes("-"))) ? "alignment" : "sequence";
    const viewerSessionId = randomUUID();
    const state: SequenceState = { viewerSessionId, sourcePath: path, sourceFormat: parsed.format, mode, records: parsed.records, options: { displayMode: "inline", toolbarVisible: true }, selectedRows: [], tracks: [], artifacts: [], annotations: parsed.records.flatMap((record) => record.features.map((feature) => ({ record: record.id, ...feature }))), jobs: new Map(), analyses: [] };
    this.sessionMap(context.session).set(viewerSessionId, state);
    return { viewer: mode === "alignment" ? "alignment" : "sequence", viewerSessionId, artifact: { filePath: supplied, format: parsed.format, rowCount: parsed.records.length, moleculeType: parsed.records[0]?.moleculeType ?? "unknown" }, state: this.summary(state) };
  }

  private acquireExample(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const id = string(args.exampleId, "exampleId");
    const examples: Record<string, string> = {
      "uniprot-human-ras-sv1": "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta",
      "ncbi-nc-001416-1": "showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/inputs/NC_001416.1.gb",
    };
    const path = examples[id];
    if (!path) throw new Error(`Public example ${id} requires a live authorized acquisition route and is not bundled by this package.`);
    return this.open({ path }, context);
  }

  private query(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context);
    const target = string(args.target, "target");
    if (target === "sequence-ui-state" || target === "alignment-ui-state" || target === "viewer-state") return this.summary(state);
    if (target === "rows" || target === "records") return { records: state.records.map((record, index) => ({ id: record.id, label: record.label, length: record.sequence.replace(/-/g, "").length, moleculeType: record.moleculeType, index })) };
    if (target === "alignment-metrics") return alignmentMetrics(state.records);
    if (target === "jobs") return { jobs: [...state.jobs.values()].map((job) => clone(job)) };
    if (target === "annotations") return { annotations: clone(state.annotations) };
    if (target === "tracks") return { tracks: clone(state.tracks) };
    if (target === "artifacts") return { artifacts: clone(state.artifacts) };
    if (target === "search") return clone(state.search ?? { query: "", hits: [], selectedHit: null });
    return { target, state: this.summary(state), note: "The requested viewer target is available through the current in-memory scientific session." };
  }

  private control(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context); const action = string(args.action, "action");
    checkAbort(context.signal);
    if (!CONTROL_ACTIONS.has(action)) throw new Error(`Unsupported Sequence Viewer control action: ${action}`);
    if (action === "search_alignment" || action === "search_sequence") {
      const query = string(args.query, "query").toUpperCase(); const hits: Json[] = [];
      for (const record of state.records) { let from = 0; while (true) { const at = record.sequence.indexOf(query, from); if (at < 0) break; hits.push({ record: record.id, start: at + 1, end: at + query.length }); from = at + 1; } }
      state.search = { query, hits, selectedHit: hits.length ? 0 : null };
    } else if (action === "select_alignment_rows") {
      const rows = Array.isArray(args.rows) ? args.rows.map((value) => String(value)) : [];
      const unknown = rows.filter((row) => !state.records.some((record) => record.id === row || record.label === row));
      if (unknown.length) throw new Error(`Alignment rows are unavailable: ${unknown.join(", ")}.`);
      state.selectedRows = rows;
    } else if (action === "select_sequence_range") {
      const record = string(args.record, "record"); const start = integer(args.start, "start"); const end = integer(args.end, "end");
      const target = state.records.find((item) => item.id === record || item.label === record);
      if (!target) throw new Error(`Sequence record ${record} is unavailable.`);
      if (start > target.sequence.replace(/[-.]/g, "").length || end > target.sequence.replace(/[-.]/g, "").length) throw new Error("Selected sequence range exceeds the active record.");
      if (start > end && args.wraparound !== true) throw new Error("Sequence range start must not exceed end unless wraparound is true.");
      state.selectedRange = { record: target.id, start, end };
    }
    else if (action === "clear_sequence_selection") delete state.selectedRange;
    else if (action === "clear_alignment_selection") state.selectedRows = [];
    else if (action === "filter_alignment_rows") state.options.rowFilter = String(args.query ?? "");
    else if (action === "set_alignment_row_visibility") state.options.hiddenRows = Array.isArray(args.rows) ? [...args.rows] : [];
    else if (action === "show_all_alignment_rows") state.options.hiddenRows = [];
    else if (action === "set_mode") {
      if (args.mode !== "sequence" && args.mode !== "alignment") throw new Error("mode must be sequence or alignment.");
      state.mode = args.mode;
    } else if (action === "set_sequence_record") {
      const record = string(args.record, "record"); const target = state.records.find((item) => item.id === record || item.label === record);
      if (!target) throw new Error(`Sequence record ${record} is unavailable.`);
      state.options.activeRecord = target.id;
    } else if (action === "focus_alignment_cell") {
      const row = string(args.row, "row"); const target = state.records.find((item) => item.id === row || item.label === row);
      if (!target) throw new Error(`Alignment row ${row} is unavailable.`);
      state.options.focus = { row: target.id, column: integer(args.column, "column") };
    } else if (action === "focus_sequence_coordinate") state.options.focus = { record: typeof args.record === "string" ? args.record : state.records[0]?.id, coordinate: integer(args.coordinate, "coordinate") };
    else if (action === "focus_alignment_reference_coordinate") state.options.focus = { reference: args.reference ?? "consensus", coordinate: integer(args.coordinate, "coordinate") };
    else if (action === "select_alignment_columns") state.options.selectedColumns = { start: integer(args.start, "start"), end: integer(args.end, "end") };
    else if (action === "select_sequence_feature") state.options.selectedFeature = string(args.featureId, "featureId");
    else if (action === "set_display_mode" || action === "set_toolbar_visibility" || action === "set_sequence_view_options" || action === "set_alignment_view_options" || action === "set_chromatogram_view_options" || action === "set_quality_view_options" || action === "set_read_pileup_options" || action === "set_sequence_annotation_index" || action === "set_sequence_record_browser" || action === "set_alignment_reference" || action === "set_workbench_panel" || action === "set_workbench_disclosure") Object.assign(state.options, object(args));
    else if (action.startsWith("navigate_") && state.search) state.search.selectedHit = state.search.hits.length ? ((state.search.selectedHit ?? 0) + (args.direction === "previous" ? -1 : 1) + state.search.hits.length) % state.search.hits.length : null;
    else if (action === "reset_alignment_view") { state.selectedRows = []; delete state.options.rowFilter; state.options.hiddenRows = []; }
    else if (action === "clear_read_selection") delete state.options.selectedRead;
    else if (action === "select_read") state.options.selectedRead = { trackId: string(args.trackId, "trackId"), sourceReadIndex: Number(args.sourceReadIndex) };
    else if (action === "compute_alignment_guide_tree") state.options.guideTreeRequested = true;
    else if (action === "dismiss_workbench_feedback") state.options.dismissedFeedbackId = string(args.feedbackId, "feedbackId");
    else if (action === "navigate_sequence_feature") state.options.featureNavigation = args.direction ?? "next";
    return { applied: true, action, state: this.summary(state), selection: { rows: state.selectedRows, range: state.selectedRange ?? null } };
  }

  private analyze(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context); const analysis = string(args.analysis, "analysis");
    checkAbort(context.signal);
    const job: SequenceJob = { id: randomUUID(), kind: analysis, state: "completed" };
    const selected = this.selectedRecords(state, args);
    let result: Json;
    if (["alignment_metrics", "distance-matrix", "build-tree", "conservation"].includes(analysis)) {
      const metrics = alignmentMetrics(selected);
      result = { ...metrics, ...(analysis === "build-tree" ? { newick: threeTaxonNewick(selected) } : {}) };
    } else if (["fastq_qc", "quality", "fastq-qc"].includes(analysis)) result = fastqMetrics(selected);
    else if (["translation", "translate"].includes(analysis)) { const record = selected[0]; if (!record) throw new Error("No sequence record is active."); result = { record: record.id, frame: Number(args.frame ?? 1), peptide: translate(record.sequence, Number(args.frame ?? 1)) }; }
    else if (analysis === "annotation_summary") result = { records: selected.map((record) => ({ id: record.id, length: record.sequence.replace(/-/g, "").length, moleculeType: record.moleculeType, featureCount: record.features.length, features: record.features })), annotationCount: state.annotations.length };
    else if (["genbank_cds_validation", "cds-validation"].includes(analysis)) { const record = selected[0]; if (!record) throw new Error("No GenBank record is active."); result = validateGenBankCds(record, typeof args.gene === "string" ? args.gene : "cI"); }
    else if (["orf", "find-orfs"].includes(analysis)) { const record = selected[0]; if (!record) throw new Error("No sequence record is active."); const peptide = translate(record.sequence, Number(args.frame ?? 1)); result = { record: record.id, frame: Number(args.frame ?? 1), orfs: [...peptide.matchAll(/M[^*]{0,}/g)].map((match) => ({ aminoStart: match.index! + 1, aminoAcids: match[0].length, peptide: match[0] })) }; }
    else throw new Error(`Analysis ${analysis} is not available in the local Sequence service.`);
    job.result = result; state.jobs.set(job.id, job); state.analyses.push({ jobId: job.id, analysis, result });
    return { jobId: job.id, state: job.state, analysis, result };
  }

  private align(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context); checkAbort(context.signal);
    const records = this.selectedRecords(state, args); if (records.length < 2) throw new Error("Alignment requires at least two records or rows.");
    const algorithm = typeof args.algorithm === "string" ? args.algorithm : "builtin-center-star";
    let aligned: SequenceRecord[]; let provenance: Json;
    if (algorithm === "builtin-pairwise") {
      if (records.length !== 2) throw new Error("builtin-pairwise requires exactly two records.");
      const pair = needlemanWunsch(records[0]!.sequence.replace(/[-.]/g, ""), records[1]!.sequence.replace(/[-.]/g, ""));
      aligned = [{ ...clone(records[0]!), sequence: pair.left }, { ...clone(records[1]!), sequence: pair.right }];
      provenance = { engine: "needleman-wunsch", algorithm, scoring: { match: 2, mismatch: -1, gap: -2 }, score: pair.score, deterministicTieBreak: ["diagonal", "deletion", "insertion"] };
    } else if (algorithm === "builtin-center-star") {
      const result = centerStar(records); aligned = result.records;
      provenance = { engine: "center-star/needleman-wunsch", algorithm, scoring: { match: 2, mismatch: -1, gap: -2 }, centerRecord: result.centerId, pairScores: result.pairScores, deterministicTieBreak: ["diagonal", "deletion", "insertion"] };
    } else throw new Error(`Unsupported alignment algorithm: ${algorithm}`);
    state.records = aligned; state.mode = "alignment";
    const artifact = { id: randomUUID(), kind: "derived-alignment", format: "aligned-fasta", sourceViewerSessionId: state.viewerSessionId, recordIds: records.map((record) => record.id), alignedLength: aligned[0]!.sequence.length, provenance, records: aligned.map((record) => ({ id: record.id, sequence: record.sequence })) };
    state.artifacts.push(artifact);
    const job: SequenceJob = { id: randomUUID(), kind: algorithm, state: "completed", result: { ...alignmentMetrics(aligned), provenance, derivedArtifactId: artifact.id } };
    state.jobs.set(job.id, job);
    return { jobId: job.id, artifact: { id: artifact.id, format: "aligned-fasta", rowCount: aligned.length, alignedLength: aligned[0]!.sequence.length, provenance }, result: job.result, state: this.summary(state) };
  }

  private cancel(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context); const jobId = string(args.jobId, "jobId"); const job = state.jobs.get(jobId);
    if (!job) return { jobId, cancelled: false, reason: "UNKNOWN_JOB" };
    if (job.state === "completed") return { jobId, cancelled: false, reason: "ALREADY_COMPLETED" };
    job.state = "cancelled"; return { jobId, cancelled: true };
  }

  private editCopy(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context); const operation = string(args.operation, "operation");
    const record = state.records.find((item) => item.id === String(args.record ?? state.records[0]?.id));
    if (!record) throw new Error("The selected record is unavailable.");
    let sequence = record.sequence;
    if (operation === "replace_range") { const start = integer(args.start, "start"); const end = integer(args.end, "end"); sequence = `${sequence.slice(0, start - 1)}${string(args.sequence, "sequence").toUpperCase()}${sequence.slice(end)}`; }
    else if (operation === "reverse_complement") sequence = sequence.split("").reverse().map((base) => ({ A: "T", T: "A", C: "G", G: "C", U: "A" }[base] ?? base)).join("");
    else if (operation === "trim") { const start = integer(args.start, "start"); const end = integer(args.end, "end"); sequence = sequence.slice(start - 1, end); }
    else throw new Error(`Edit operation ${operation} is unavailable without an editable copy workflow.`);
    const copy = { ...record, id: `${record.id}-copy-${state.records.length + 1}`, label: `${record.label} copy`, sequence, features: clone(record.features) };
    state.records.push(copy); return { operation, editableCopy: { id: copy.id, length: copy.sequence.length, sourceRecord: record.id } };
  }

  private loadTrack(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context); const supplied = string(args.path, "path"); const format = string(args.format, "format").toLowerCase();
    const path = isAbsolute(supplied) ? supplied : resolve(context.packageRoot, supplied);
    if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Track source is unavailable: ${supplied}`);
    if (format === "bam" || format === "cram") {
      const defaultIndex = `${path}.${format === "bam" ? "bai" : "crai"}`;
      const indexSupplied = typeof args.indexPath === "string" ? args.indexPath : defaultIndex;
      const indexPath = isAbsolute(indexSupplied) ? indexSupplied : resolve(context.packageRoot, indexSupplied);
      if (!existsSync(indexPath) || !statSync(indexPath).isFile()) throw new Error(`${format.toUpperCase()}_INDEX_REQUIRED: provide an existing ${format === "bam" ? "BAI/CSI" : "CRAI"} index via indexPath.`);
      if (format === "cram" && typeof args.referencePath === "string") {
        const referencePath = isAbsolute(args.referencePath) ? args.referencePath : resolve(context.packageRoot, args.referencePath);
        if (!existsSync(referencePath) || !statSync(referencePath).isFile()) throw new Error("CRAM_REFERENCE_REQUIRED: referencePath is unavailable.");
      }
      throw new Error(`${format.toUpperCase()}_BINARY_DECODER_UNAVAILABLE: index validation succeeded, but this local service does not parse BAM/CRAM bytes without a native decoder.`);
    }
    let summary: Json;
    if (format === "gff3" || format === "gtf") summary = parseAnnotationTrack(path, format);
    else if (format === "bed") summary = parseBedTrack(path);
    else if (format === "vcf") summary = parseVcfTrack(path);
    else if (format === "sam") summary = parseSamTrack(path);
    else summary = { parseStatus: "reference-only", bytes: statSync(path).size };
    const track = { id: randomUUID(), path: supplied, format, reference: args.reference ?? null, start: args.start ?? null, end: args.end ?? null, summary };
    state.tracks.push(track); return { track };
  }

  private annotations(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context); const action = string(args.action, "action");
    if (action === "list") return { annotations: clone(state.annotations) };
    if (action === "remove") { const id = string(args.featureId, "featureId"); state.annotations = state.annotations.filter((feature) => feature.id !== id); return { removed: id }; }
    if (action === "add") { const feature = object(args.feature); const annotation = { id: randomUUID(), ...feature }; state.annotations.push(annotation); return { annotation }; }
    throw new Error(`Annotation action ${action} is unavailable.`);
  }

  private save(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context); const savedSessionId = randomUUID(); const { jobs: _jobs, ...snapshot } = clone(state); this.saved.set(savedSessionId, snapshot); return { savedSessionId, name: args.name ?? basename(state.sourcePath), viewerSessionId: state.viewerSessionId };
  }

  private restore(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const target = this.state(args, context); const savedSessionId = string(args.savedSessionId, "savedSessionId"); const saved = this.saved.get(savedSessionId); if (!saved) throw new Error(`Saved Sequence Viewer session ${savedSessionId} is unavailable.`);
    const restored = { ...clone(saved), viewerSessionId: target.viewerSessionId, jobs: new Map<string, SequenceJob>() }; this.sessionMap(context.session).set(target.viewerSessionId, restored); return { restored: true, savedSessionId, state: this.summary(restored) };
  }

  private export(args: Record<string, unknown>, context: ScienceExecutionContext): Json {
    const state = this.state(args, context); const format = string(args.format, "format"); const name = String(args.name ?? `sequence-export-${state.viewerSessionId}`);
    const filename = `${name.replace(/[^A-Za-z0-9._-]/g, "-")}.${format === "fasta" ? "fasta" : format === "newick" ? "nwk" : "json"}`;
    const directory = resolve(context.packageRoot, "artifacts", "sequence-exports"); mkdirSync(directory, { recursive: true }); const path = resolve(directory, filename);
    if (!path.startsWith(directory)) throw new Error("Export destination is outside the managed artifact directory.");
    const content = format === "fasta" ? state.records.map((record) => `>${record.id} ${record.label}\n${record.sequence}\n`).join("") : format === "newick" ? (threeTaxonNewick(state.records) ?? ";") : JSON.stringify(this.summary(state), null, 2);
    writeFileSync(path, content, "utf8"); return { artifact: { path, format, bytes: Buffer.byteLength(content), generatedAt: new Date().toISOString() } };
  }

  private selectedRecords(state: SequenceState, args: Record<string, unknown>): SequenceRecord[] {
    const ids = Array.isArray(args.rowIds) ? args.rowIds.map(String) : Array.isArray(args.recordIds) ? args.recordIds.map(String) : typeof args.record === "string" ? [args.record] : state.selectedRows.length ? state.selectedRows : state.records.map((record) => record.id);
    const selected = state.records.filter((record) => ids.includes(record.id));
    if (!selected.length) throw new Error("No requested sequence records are present in the active viewer.");
    return selected;
  }

  private summary(state: SequenceState): Json {
    const alignment = state.mode === "alignment" ? alignmentMetrics(state.records) : undefined;
    return { viewerSessionId: state.viewerSessionId, viewer: state.mode === "alignment" ? "alignment" : "sequence", source: { path: state.sourcePath, format: state.sourceFormat }, recordCount: state.records.length, records: state.records.map((record) => ({ id: record.id, label: record.label, length: record.sequence.replace(/-/g, "").length, moleculeType: record.moleculeType })), options: clone(state.options), selectedRows: [...state.selectedRows], selectedRange: state.selectedRange ?? null, artifactCount: state.artifacts.length, artifacts: state.artifacts.map((artifact) => ({ id: artifact.id, kind: artifact.kind, format: artifact.format })), analysis: alignment ? { meanIdentity: alignment.meanIdentity, meanConservationNormalized: alignment.meanConservationNormalized } : null, jobs: [...state.jobs.values()].map((job) => ({ id: job.id, kind: job.kind, state: job.state })) };
  }
}

export function asSequenceServiceError(cause: unknown): { code: string; message: string } {
  const error = resultError(cause);
  return { code: /cancel/i.test(error.message) ? "CANCELLED" : "SEQUENCE_OPERATION_FAILED", message: error.message };
}
