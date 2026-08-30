import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, type Dirent } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { deflateSync } from "node:zlib";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";

export interface ScienceExecutionContext {
  session: object;
  signal: AbortSignal;
  packageRoot: string;
  allowNetwork?: boolean;
  authorizedPaths?: readonly string[];
}
export interface ScienceFailure { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }

type Atom = { objectId: string; serial: number; name: string; resName: string; chain: string; residue: number; x: number; y: number; z: number; element: string; record: "ATOM" | "HETATM"; bFactor?: number | null };
type TrajectoryState = { sourcePath: string; format: "dsh-json-fixture"; frames: Array<Array<[number, number, number]>>; currentFrame: number; playing: boolean; loop: boolean; speed: number; stride: number };
type DensityMap = { id: string; path: string; format: "DX"; dimensions: [number, number, number]; voxelCount: number; min: number; max: number; mean: number; visible: boolean; source: "local-fixture" };
type BackgroundImage = { token: string; fileName: string; format: "png" | "jpeg"; bytes: number };
type ObjectState = { id: string; path: string; format: string; atoms: Atom[]; baseAtoms: Atom[]; representation: string; color: string | null; visible: boolean; label?: string; dirty?: boolean; operationLog?: Array<Record<string, unknown>>; transform?: number[]; qualityMetricId?: string | null; displayClashes?: boolean; symmetryRecords?: Array<Record<string, unknown>>; symmetryDisplay?: { selectedIndex: number | null; axes: boolean; cage: boolean; clusterColors: boolean }; trajectory?: TrajectoryState };
type GuideState = { id: string; kind: "label" | "plane" | "orientation"; label: string | null; visible: boolean; color: string; opacity: number; targetAtomIds: string[]; centroid: Point; normal?: number[]; axes?: number[][] };
type WorkspaceState = { explorerVisible: boolean; sequenceVisible: boolean; measurementsVisible: boolean; commandConsoleVisible: boolean; workbenchVisible: boolean; renderPanelVisible: boolean; selectionGranularity: "atom" | "residue" | "chain" | "object"; spinning: boolean };
type SessionSnapshot = { objects: ObjectState[]; selected: string[]; focus: string[]; named: Array<[string, string[]]>; background: "light" | "dark"; backgroundImage: BackgroundImage | null; densityMaps: DensityMap[]; densityDiscoveries: Array<[string, DensityMap]>; showHydrogens: boolean; sideChains: boolean; measurements: Array<Record<string, unknown>>; scenes: Array<[string, Record<string, unknown>]>; guides: GuideState[]; layers: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>>; lighting: "flat" | "soft" | "studio"; displayMode: "inline" | "fullscreen"; toolbarVisible: boolean; workspace: WorkspaceState };
type StructureSession = { id: string; revision: number; objects: Map<string, ObjectState>; selected: Atom[]; focus: Atom[]; named: Map<string, Atom[]>; background: "light" | "dark"; backgroundImage: BackgroundImage | null; densityMaps: Map<string, DensityMap>; densityDiscoveries: Map<string, DensityMap>; showHydrogens: boolean; sideChains: boolean; measurements: Array<Record<string, unknown>>; scenes: Map<string, Record<string, unknown>>; guides: Map<string, GuideState>; layers: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>>; lighting: "flat" | "soft" | "studio"; displayMode: "inline" | "fullscreen"; toolbarVisible: boolean; workspace: WorkspaceState; renderJobs: Map<string, Record<string, unknown>>; relatedDirectories: Map<string, string>; relatedFiles: Map<string, string>; undoStack: SessionSnapshot[]; redoStack: SessionSnapshot[] };
type SelectionResult = { atoms: Atom[] } | ScienceFailure;
type Point = { x: number; y: number; z: number };

const failure = (code: string, message: string, details?: Record<string, unknown>): ScienceFailure => ({ ok: false, error: { code, message, ...(details ? { details } : {}) } });
const isFailure = (value: unknown): value is ScienceFailure => Boolean(value && typeof value === "object" && (value as { ok?: unknown }).ok === false);
const atomKey = (atom: Atom) => `${atom.objectId}:${atom.serial}`;
const residueKey = (atom: Atom) => `${atom.chain}:${atom.resName}${atom.residue}`;
const scopedResidueKey = (atom: Atom) => `${atom.objectId}:${residueKey(atom)}`;
const isPolymerAtom = (atom: Atom) => atom.record === "ATOM" || atom.resName === "MSE";
const uniqueAtoms = (atoms: Atom[]) => [...new Map(atoms.map((atom) => [atomKey(atom), atom])).values()];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const identityMatrix = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiplyMatrices(left: number[], right: number[]): number[] { return Array.from({ length: 16 }, (_, index) => { const row = Math.floor(index / 4), column = index % 4; return [0, 1, 2, 3].reduce((sum, inner) => sum + left[row * 4 + inner]! * right[inner * 4 + column]!, 0); }); }

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Structure operation cancelled.");
}

function encodeMovieWithFfmpeg(args: string[], signal: AbortSignal): Promise<void> {
  checkAbort(signal);
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("ffmpeg", args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let terminationError: Error | undefined;
    const abort = () => {
      terminationError = signal.reason instanceof Error ? signal.reason : new Error("Structure movie encoding cancelled.");
      child.kill("SIGKILL");
    };
    const timeout = setTimeout(() => {
      terminationError = new Error("ffmpeg exceeded the 120 second movie encoding limit.");
      child.kill("SIGKILL");
    }, 120_000);
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 16_384) stderr += chunk.toString("utf8").slice(0, 16_384 - stderr.length);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      rejectPromise(error);
    });
    child.once("close", (code, childSignal) => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      if (terminationError) rejectPromise(terminationError);
      else if (code === 0) resolvePromise();
      else rejectPromise(new Error(stderr.trim() || `ffmpeg exited with code ${String(code)}${childSignal ? ` (${childSignal})` : ""}.`));
    });
  });
}

function formatFor(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdb") || lower.endsWith(".pdb.gz")) return "PDB";
  if (lower.endsWith(".cif") || lower.endsWith(".mmcif") || lower.endsWith(".cif.gz")) return "mmCIF";
  if ([".mol", ".sdf", ".mol2", ".pqr", ".pdbqt", ".gro", ".xyz"].includes(extname(lower))) return extname(lower).slice(1).toUpperCase();
  return null;
}

function sourcePath(value: unknown, root: string): string | ScienceFailure {
  if (typeof value !== "string" || !value.trim()) return failure("SOURCE_PATH_REQUIRED", "A supported local coordinate path is required.");
  const candidate = isAbsolute(value) ? resolve(value) : resolve(root, value);
  const resolvedRoot = resolve(root);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}\\`) && !candidate.startsWith(`${resolvedRoot}/`)) return failure("SOURCE_OUTSIDE_PACKAGE", "The coordinate source must be inside this DSH-Rosalind package root.", { requestedPath: value });
  return candidate;
}

function parsePdb(text: string): Atom[] {
  const atoms: Atom[] = [];
  for (const line of text.split(/\r?\n/)) {
    const record = line.slice(0, 6).trim();
    if (record !== "ATOM" && record !== "HETATM") continue;
    const x = Number.parseFloat(line.slice(30, 38)), y = Number.parseFloat(line.slice(38, 46)), z = Number.parseFloat(line.slice(46, 54)), residue = Number.parseInt(line.slice(22, 26), 10);
    if (![x, y, z, residue].every(Number.isFinite)) continue;
    const name = line.slice(12, 16).trim() || "?";
    const parsedBFactor = Number.parseFloat(line.slice(60, 66));
    atoms.push({ objectId: "primary", serial: Number.parseInt(line.slice(6, 11), 10) || atoms.length + 1, name, resName: line.slice(17, 20).trim() || "UNK", chain: line.slice(21, 22).trim() || "_", residue, x, y, z, element: line.slice(76, 78).trim() || name.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() || "?", record: record as "ATOM" | "HETATM", bFactor: Number.isFinite(parsedBFactor) ? parsedBFactor : null });
  }
  return atoms;
}

function parseCif(text: string): Atom[] {
  const atoms: Atom[] = [], headers: string[] = [];
  let atomLoop = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "loop_") { atomLoop = false; headers.length = 0; continue; }
    if (line.startsWith("_atom_site.")) { atomLoop = true; headers.push(line); continue; }
    if (!atomLoop || !headers.length || !line || line.startsWith("#") || line.startsWith("_")) continue;
    const parts = line.match(/'(?:[^']*)'|"(?:[^"]*)"|\S+/g) ?? [];
    if (parts.length < headers.length) continue;
    const field = (name: string) => { const index = headers.findIndex((header) => header.endsWith(name)); return index >= 0 ? parts[index]!.replace(/^['"]|['"]$/g, "") : ""; };
    const x = Number.parseFloat(field("Cartn_x")), y = Number.parseFloat(field("Cartn_y")), z = Number.parseFloat(field("Cartn_z")), residue = Number.parseInt(field("auth_seq_id") || field("label_seq_id"), 10);
    if (![x, y, z, residue].every(Number.isFinite)) continue;
    atoms.push({ objectId: "primary", serial: Number.parseInt(field("id"), 10) || atoms.length + 1, name: field("auth_atom_id") || field("label_atom_id") || "?", resName: field("auth_comp_id") || field("label_comp_id") || "UNK", chain: field("auth_asym_id") || field("label_asym_id") || "_", residue, x, y, z, element: field("type_symbol") || "?", record: field("group_PDB") === "HETATM" ? "HETATM" : "ATOM" });
  }
  return atoms;
}

function parseCoordinates(path: string): ObjectState | ScienceFailure {
  const format = formatFor(path);
  if (!format) return failure("UNSUPPORTED_COORDINATE_FORMAT", "The coordinate format is not supported.", { path });
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch (cause) { return failure("SOURCE_NOT_READABLE", cause instanceof Error ? cause.message : String(cause), { path }); }
  const atoms = format === "PDB" ? parsePdb(text) : format === "mmCIF" ? parseCif(text) : [];
  if (!atoms.length) return failure("COORDINATE_PARSER_UNAVAILABLE", `The local parser could not read ${format} coordinates.`, { path, format });
  return { id: "primary", path, format, atoms, baseAtoms: atoms.map((atom) => ({ ...atom })), representation: "cartoon", color: null, visible: true, transform: identityMatrix() };
}

function parseDxDensity(path: string): DensityMap | ScienceFailure {
  if (extname(path).toLowerCase() !== ".dx") return failure("DENSITY_FORMAT_UNSUPPORTED", "The local density fixture must be an OpenDX .dx file.", { path });
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch (cause) { return failure("SOURCE_NOT_READABLE", cause instanceof Error ? cause.message : String(cause), { path }); }
  const counts = text.match(/class\s+gridpositions\s+counts\s+(\d+)\s+(\d+)\s+(\d+)/i);
  if (!counts) return failure("DENSITY_FIXTURE_INVALID", "OpenDX gridpositions counts are required.", { path });
  const dimensions = [Number(counts[1]), Number(counts[2]), Number(counts[3])] as [number, number, number], voxelCount = dimensions[0] * dimensions[1] * dimensions[2];
  if (voxelCount < 1 || voxelCount > 2_097_152) return failure("DENSITY_VOXEL_LIMIT", "The local density fixture has an invalid or excessive voxel count.", { voxelCount });
  const dataMarker = text.match(/data\s+follows\s*\r?\n([\s\S]*)$/i);
  if (!dataMarker) return failure("DENSITY_FIXTURE_INVALID", "OpenDX data follows section is required.", { path });
  const values = (dataMarker[1]!.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number).filter(Number.isFinite).slice(0, voxelCount);
  if (values.length !== voxelCount) return failure("DENSITY_FIXTURE_INVALID", "OpenDX density values do not match declared grid dimensions.", { expected: voxelCount, observed: values.length });
  const id = `density-${basename(path).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;
  return { id, path, format: "DX", dimensions, voxelCount, min: Math.min(...values), max: Math.max(...values), mean: values.reduce((sum, value) => sum + value, 0) / values.length, visible: true, source: "local-fixture" };
}

function parseTrajectoryFixture(path: string, atomCount: number): TrajectoryState | ScienceFailure {
  if (extname(path).toLowerCase() !== ".json") return failure("TRAJECTORY_FORMAT_UNSUPPORTED", "The local trajectory test fixture must be a JSON file with explicit Cartesian frames.", { path });
  let input: unknown;
  try { input = JSON.parse(readFileSync(path, "utf8")); } catch (cause) { return failure("TRAJECTORY_FIXTURE_INVALID", cause instanceof Error ? cause.message : String(cause), { path }); }
  const rawFrames = input && typeof input === "object" ? (input as Record<string, unknown>).frames : null;
  const framesRaw: unknown[] | null = Array.isArray(rawFrames) ? rawFrames : null;
  if (!framesRaw?.length || framesRaw.length > 2_000) return failure("TRAJECTORY_FIXTURE_INVALID", "Trajectory fixture frames must contain 1 through 2,000 entries.");
  const frames: Array<Array<[number, number, number]>> = [];
  for (const frame of framesRaw) {
    const rawCoordinates = frame && typeof frame === "object" && !Array.isArray(frame) ? (frame as Record<string, unknown>).coordinates : null;
    const coordinates: unknown[] | null = Array.isArray(frame) ? frame : Array.isArray(rawCoordinates) ? rawCoordinates : null;
    if (!coordinates || coordinates.length !== atomCount) return failure("TRAJECTORY_TOPOLOGY_MISMATCH", "Every trajectory frame must contain one coordinate triple for every topology atom.", { expectedAtomCount: atomCount, observedAtomCount: coordinates?.length ?? 0 });
    const parsed: Array<[number, number, number]> = [];
    for (const coordinate of coordinates) {
      if (!Array.isArray(coordinate) || coordinate.length !== 3 || coordinate.some((value) => typeof value !== "number" || !Number.isFinite(value))) return failure("TRAJECTORY_FIXTURE_INVALID", "Trajectory coordinates must be finite [x, y, z] numeric triples.");
      parsed.push([coordinate[0] as number, coordinate[1] as number, coordinate[2] as number]);
    }
    frames.push(parsed);
  }
  return { sourcePath: path, format: "dsh-json-fixture", frames, currentFrame: 0, playing: false, loop: false, speed: 1, stride: 1 };
}

function imageFormat(path: string): "png" | "jpeg" | null {
  const lower = extname(path).toLowerCase();
  return lower === ".png" ? "png" : lower === ".jpg" || lower === ".jpeg" ? "jpeg" : null;
}

function imageHasExpectedSignature(path: string, format: "png" | "jpeg"): boolean {
  try {
    const bytes = readFileSync(path);
    if (format === "jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
    return bytes.subarray(12, 16).toString("ascii") === "IHDR" && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0;
  } catch { return false; }
}

function pdbAssemblyRecords(path: string): Array<Record<string, unknown>> | ScienceFailure {
  if (formatFor(path) !== "PDB") return failure("ASSEMBLY_METADATA_UNAVAILABLE", "Local assembly metadata is available only from PDB REMARK 350 records.", { path });
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch (cause) { return failure("SOURCE_NOT_READABLE", cause instanceof Error ? cause.message : String(cause), { path }); }
  const records: Array<Record<string, unknown>> = [];
  let current: Record<string, unknown> | null = null;
  const operators = new Map<string, Array<number | null>>();
  const flush = () => {
    if (!current) return;
    const matrices = [...operators.entries()].flatMap(([id, values]) => values.length === 12 && values.every((value) => typeof value === "number") ? [{ id, matrix: [values[0]!, values[1]!, values[2]!, values[3]!, values[4]!, values[5]!, values[6]!, values[7]!, values[8]!, values[9]!, values[10]!, values[11]!, 0, 0, 0, 1] }] : []);
    records.push({ ...current, operatorCount: matrices.length, operators: matrices }); current = null; operators.clear();
  };
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("REMARK 350")) continue;
    const body = line.slice(10).trim();
    const biomolecule = body.match(/^BIOMOLECULE:\s*(.+)$/i);
    if (biomolecule) { flush(); current = { assemblyId: biomolecule[1]!.trim(), source: "PDB REMARK 350", chains: [] }; continue; }
    if (!current) continue;
    const author = body.match(/^AUTHOR DETERMINED BIOLOGICAL UNIT:\s*(.+)$/i); if (author) { current.authorDetermined = author[1]!.trim(); continue; }
    const software = body.match(/^SOFTWARE DETERMINED QUATERNARY STRUCTURE:\s*(.+)$/i); if (software) { current.softwareDetermined = software[1]!.trim(); continue; }
    const chains = body.match(/^APPLY THE FOLLOWING TO CHAINS:\s*(.+)$/i); if (chains) { current.chains = chains[1]!.split(",").map((value) => value.trim()).filter(Boolean); continue; }
    const biomt = body.match(/^BIOMT([123])\s+(\S+)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
    if (biomt) { const row = Number(biomt[1]) - 1, id = biomt[2]!, values = operators.get(id) ?? Array(12).fill(null); values.splice(row * 4, 4, ...biomt.slice(3, 7).map(Number)); operators.set(id, values); }
  }
  flush();
  return records.length ? records : failure("ASSEMBLY_METADATA_UNAVAILABLE", "The PDB file does not contain usable REMARK 350 biological assembly records.", { path });
}

function selectAtoms(session: StructureSession, expression: unknown, defaultObject = "primary"): SelectionResult {
  if (!expression || typeof expression !== "object" || Array.isArray(expression)) return failure("SELECTION_EXPR_INVALID", "SelectionExpr must be an object.");
  const input = expression as Record<string, unknown>, kind = input.kind;
  if (typeof kind !== "string" || !kind) return failure("SELECTION_EXPR_INVALID", "SelectionExpr.kind is required.");
  if (typeof input.instanceId === "string") return failure("SELECTION_SCOPE_UNSUPPORTED", "Assembly-instance selection is unavailable in the local coordinate parser.", { instanceId: input.instanceId });
  if (kind === "expression") return selectAtoms(session, input.expression, defaultObject);
  if (kind === "current_selection") return { atoms: [...session.selected] };
  if (kind === "current_focus") return { atoms: [...session.focus] };
  if (kind === "current") return input.target === "selection" ? { atoms: [...session.selected] } : input.target === "focus" ? { atoms: [...session.focus] } : failure("SELECTION_EXPR_INVALID", "Current selection requires target selection or focus.");
  if (kind === "named") { const atoms = typeof input.name === "string" ? session.named.get(input.name) : undefined; return atoms ? { atoms: [...atoms] } : failure("NAMED_SELECTION_NOT_FOUND", `No named selection called ${String(input.name)} exists.`); }
  if (kind === "anyOf") {
    if (!Array.isArray(input.expressions) || !input.expressions.length) return failure("SELECTION_EXPR_INVALID", "anyOf requires one or more expressions.");
    const atoms: Atom[] = [];
    for (const child of input.expressions) { const result = selectAtoms(session, child, defaultObject); if (isFailure(result)) return result; atoms.push(...result.atoms); }
    return { atoms: uniqueAtoms(atoms) };
  }
  if (kind === "allOf") {
    if (!Array.isArray(input.expressions) || !input.expressions.length) return failure("SELECTION_EXPR_INVALID", "allOf requires one or more expressions.");
    let atoms: Atom[] | null = null;
    for (const child of input.expressions) { const result = selectAtoms(session, child, defaultObject); if (isFailure(result)) return result; const ids = new Set(result.atoms.map(atomKey)); atoms = atoms === null ? result.atoms : atoms.filter((atom) => ids.has(atomKey(atom))); }
    return { atoms: atoms ?? [] };
  }
  if (kind === "not") {
    const child = selectAtoms(session, input.expression, defaultObject); if (isFailure(child)) return child; const ids = new Set(child.atoms.map(atomKey)); return { atoms: [...session.objects.values()].flatMap((entry) => entry.atoms).filter((atom) => !ids.has(atomKey(atom))) };
  }
  if (kind === "within" || kind === "bondedTo") {
    const child = selectAtoms(session, input.expression ?? input.target, defaultObject); if (isFailure(child)) return child; if (!child.atoms.length) return { atoms: [] }; const cutoff = kind === "within" ? Number(input.distanceAngstrom ?? input.distance ?? 4) : Number(input.distanceAngstrom ?? 1.95); if (!Number.isFinite(cutoff) || cutoff <= 0 || cutoff > 100) return failure("SELECTION_EXPR_INVALID", `${kind} requires a positive finite distance.`); const scope = typeof input.objectId === "string" ? session.objects.get(input.objectId)?.atoms ?? [] : [...session.objects.values()].flatMap((entry) => entry.atoms); return { atoms: scope.filter((atom) => child.atoms.some((other) => atomKey(atom) !== atomKey(other) && distance(atom, other) <= cutoff)) };
  }
  const objectId = typeof input.objectId === "string" && input.objectId ? input.objectId : defaultObject;
  const object = session.objects.get(objectId);
  if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No loaded structure object named ${objectId}.`);
  const atoms = object.atoms;
  if (kind === "all" || kind === "object") return kind === "object" && typeof input.objectId !== "string" ? failure("SELECTION_EXPR_INVALID", "Object selection requires objectId.") : { atoms: [...atoms] };
  if (kind === "chain") return typeof input.chain === "string" && input.chain ? { atoms: atoms.filter((atom) => atom.chain === input.chain) } : failure("SELECTION_EXPR_INVALID", "Chain selection requires chain.");
  if (kind === "residue") {
    if (typeof input.chain !== "string" || !Number.isInteger(input.residue)) return failure("SELECTION_EXPR_INVALID", "Residue selection requires chain and integer residue.");
    if (input.insertionCode) return failure("SELECTION_SCOPE_UNSUPPORTED", "Insertion-code selection is unavailable in the local coordinate model.");
    return { atoms: atoms.filter((atom) => atom.chain === input.chain && atom.residue === input.residue) };
  }
  if (kind === "residue_range") {
    if (typeof input.chain !== "string" || !Number.isInteger(input.start) || !Number.isInteger(input.end) || (input.start as number) > (input.end as number)) return failure("SELECTION_EXPR_INVALID", "Residue range requires chain and ordered integer start/end.");
    return { atoms: atoms.filter((atom) => atom.chain === input.chain && atom.residue >= (input.start as number) && atom.residue <= (input.end as number)) };
  }
  if (kind === "residues") {
    if (!Array.isArray(input.residues) || !input.residues.length) return failure("SELECTION_EXPR_INVALID", "Residues selection requires entries.");
    const requested = input.residues as Array<Record<string, unknown>>;
    if (requested.some((item) => typeof item.chain !== "string" || !Number.isInteger(item.residue))) return failure("SELECTION_EXPR_INVALID", "Each residue requires chain and integer residue.");
    return { atoms: atoms.filter((atom) => requested.some((item) => atom.chain === item.chain && atom.residue === item.residue)) };
  }
  if (kind === "atom") return { atoms: atoms.filter((atom) => (typeof input.chain !== "string" || atom.chain === input.chain) && (!Number.isInteger(input.residue) || atom.residue === input.residue) && (typeof input.atomName !== "string" || atom.name === input.atomName) && (typeof input.element !== "string" || atom.element.toUpperCase() === input.element.toUpperCase())) };
  if (kind === "atom_ids") { if (!Array.isArray(input.atomIds) || input.atomIds.some((id) => typeof id !== "string")) return failure("SELECTION_EXPR_INVALID", "atom_ids requires string identifiers."); const ids = new Set(input.atomIds as string[]); return { atoms: [...session.objects.values()].flatMap((entry) => entry.atoms).filter((atom) => ids.has(atomKey(atom))) }; }
  if (kind === "ligand") return typeof input.compId === "string" ? { atoms: atoms.filter((atom) => atom.record === "HETATM" && atom.resName === input.compId && (typeof input.chain !== "string" || atom.chain === input.chain)) } : failure("SELECTION_EXPR_INVALID", "Ligand selection requires compId.");
  if (kind === "component") {
    if (input.component === "all") return { atoms: [...atoms] };
    if (input.component === "polymer" || input.component === "protein") return { atoms: atoms.filter(isPolymerAtom) };
    if (input.component === "ligand" || input.component === "native_ligand") return { atoms: atoms.filter((atom) => atom.record === "HETATM" && atom.resName !== "HOH") };
    if (input.component === "water") return { atoms: atoms.filter((atom) => atom.resName === "HOH") };
    if (input.component === "backbone") return { atoms: atoms.filter((atom) => isPolymerAtom(atom) && ["N", "CA", "C", "O"].includes(atom.name)) };
    if (input.component === "sidechain") return { atoms: atoms.filter((atom) => isPolymerAtom(atom) && !["N", "CA", "C", "O"].includes(atom.name)) };
    if (input.component === "hydrogen") return { atoms: atoms.filter((atom) => atom.element.toUpperCase() === "H") };
  }
  return failure("SELECTION_EXPR_UNSUPPORTED", `SelectionExpr kind ${kind} is not supported by the local parser.`, { supportedKinds: ["all", "object", "chain", "residue", "residue_range", "atom", "atom_ids", "component", "anyOf", "allOf", "not", "within", "bondedTo", "current", "named"] });
}

function summary(session: StructureSession): Record<string, unknown> {
  const primary = session.objects.get("primary");
  const previewLimit = 2_000, previewAtoms = primary?.atoms.slice(0, previewLimit).map((atom) => ({ atomId: atomKey(atom), objectId: atom.objectId, element: atom.element, x: atom.x, y: atom.y, z: atom.z, chain: atom.chain, residue: atom.residue, atomName: atom.name })) ?? [];
  return { ok: true, viewerSessionId: session.id, sessionReady: true, viewerReady: false, sceneRevision: session.revision, load: { status: primary ? "coordinates-ready" : "empty", error: null }, interaction: { renderer: "local-raster-export", rendered: false, interactiveClientRequired: true, clientConfirmation: "ToolView reports its local Canvas mount separately; no host callback is available in the DSH ToolView contract." }, structure: primary ? { atomCount: primary.atoms.length, chainCount: new Set(primary.atoms.map((atom) => atom.chain)).size, residueCount: new Set(primary.atoms.map(scopedResidueKey)).size, polymerResidueCount: new Set(primary.atoms.filter(isPolymerAtom).map(scopedResidueKey)).size, ligandCount: new Set(primary.atoms.filter((atom) => atom.record === "HETATM" && atom.resName !== "HOH" && !isPolymerAtom(atom)).map(scopedResidueKey)).size, source: { fileName: basename(primary.path), format: primary.format } } : null, atoms: previewAtoms, coordinatePreview: { atomCount: previewAtoms.length, totalAtomCount: primary?.atoms.length ?? 0, truncated: (primary?.atoms.length ?? 0) > previewLimit, provenance: "Local coordinate preview supplied to the DSH ToolView Canvas; it is not a WebGL viewport capture." }, display: { background: session.background, backgroundImage: session.backgroundImage ? { fileName: session.backgroundImage.fileName, format: session.backgroundImage.format, bytes: session.backgroundImage.bytes } : null, representation: primary?.representation ?? null, showHydrogens: session.showHydrogens, showSideChains: session.sideChains, lighting: session.lighting, toolbarVisible: session.toolbarVisible, displayMode: session.displayMode }, workspace: session.workspace, selection: { atomCount: session.selected.length, residueCount: new Set(session.selected.map(scopedResidueKey)).size }, focus: { atomCount: session.focus.length, residueCount: new Set(session.focus.map(scopedResidueKey)).size }, objects: [...session.objects.values()].map((object) => ({ id: object.id, label: object.label ?? null, fileName: basename(object.path), format: object.format, atomCount: object.atoms.length, representation: object.representation, color: object.color, visible: object.visible, dirty: object.dirty ?? false, operationLog: object.operationLog ?? [], transform: object.transform, qualityMetricId: object.qualityMetricId ?? null, displayClashes: object.displayClashes ?? false, symmetryDisplay: object.symmetryDisplay ?? null, trajectory: object.trajectory ? { frameCount: object.trajectory.frames.length, currentFrame: object.trajectory.currentFrame, playing: object.trajectory.playing, loop: object.trajectory.loop, speed: object.trajectory.speed, stride: object.trajectory.stride, format: object.trajectory.format } : null })), densityMaps: [...session.densityMaps.values()].map((map) => ({ id: map.id, format: map.format, dimensions: map.dimensions, voxelCount: map.voxelCount, min: map.min, max: map.max, mean: map.mean, visible: map.visible, source: map.source })), layers: session.layers, annotations: session.annotations, measurements: session.measurements, guides: [...session.guides.values()].map((guide) => ({ id: guide.id, kind: guide.kind, label: guide.label, visible: guide.visible, color: guide.color, opacity: guide.opacity, atomCount: guide.targetAtomIds.length })), renderJobs: [...session.renderJobs.values()], history: { undoCount: session.undoStack.length, redoCount: session.redoStack.length } };
}

const cloneObject = (object: ObjectState): ObjectState => ({ ...object, atoms: object.atoms.map((atom) => ({ ...atom })), baseAtoms: object.baseAtoms.map((atom) => ({ ...atom })), ...(object.operationLog ? { operationLog: object.operationLog.map((entry) => ({ ...entry })) } : {}), ...(object.transform ? { transform: [...object.transform] } : {}), ...(object.symmetryRecords ? { symmetryRecords: structuredClone(object.symmetryRecords) } : {}), ...(object.symmetryDisplay ? { symmetryDisplay: { ...object.symmetryDisplay } } : {}), ...(object.trajectory ? { trajectory: { ...object.trajectory, frames: object.trajectory.frames.map((frame) => frame.map((coordinate) => [...coordinate] as [number, number, number])) } } : {}) });
function takeSnapshot(session: StructureSession): SessionSnapshot {
  return { objects: [...session.objects.values()].map(cloneObject), selected: session.selected.map(atomKey), focus: session.focus.map(atomKey), named: [...session.named.entries()].map(([name, atoms]) => [name, atoms.map(atomKey)]), background: session.background, backgroundImage: session.backgroundImage ? { ...session.backgroundImage } : null, densityMaps: [...session.densityMaps.values()].map((map) => ({ ...map, dimensions: [...map.dimensions] as [number, number, number] })), densityDiscoveries: [...session.densityDiscoveries.entries()].map(([id, map]) => [id, { ...map, dimensions: [...map.dimensions] as [number, number, number] }]), showHydrogens: session.showHydrogens, sideChains: session.sideChains, measurements: structuredClone(session.measurements), scenes: [...session.scenes.entries()].map(([name, scene]) => [name, structuredClone(scene)]), guides: structuredClone([...session.guides.values()]), layers: structuredClone(session.layers), annotations: structuredClone(session.annotations), lighting: session.lighting, displayMode: session.displayMode, toolbarVisible: session.toolbarVisible, workspace: structuredClone(session.workspace) };
}
function restoreSnapshot(session: StructureSession, snapshot: SessionSnapshot): void {
  session.objects = new Map(snapshot.objects.map((object) => [object.id, cloneObject(object)]));
  const atoms = new Map([...session.objects.values()].flatMap((object) => object.atoms).map((atom) => [atomKey(atom), atom]));
  session.selected = snapshot.selected.flatMap((id) => atoms.get(id) ?? []); session.focus = snapshot.focus.flatMap((id) => atoms.get(id) ?? []);
  session.named = new Map(snapshot.named.map(([name, ids]) => [name, ids.flatMap((id) => atoms.get(id) ?? [])])); session.background = snapshot.background; session.backgroundImage = snapshot.backgroundImage ? { ...snapshot.backgroundImage } : null; session.densityMaps = new Map(snapshot.densityMaps.map((map) => [map.id, { ...map, dimensions: [...map.dimensions] as [number, number, number] }])); session.densityDiscoveries = new Map(snapshot.densityDiscoveries.map(([id, map]) => [id, { ...map, dimensions: [...map.dimensions] as [number, number, number] }])); session.showHydrogens = snapshot.showHydrogens; session.sideChains = snapshot.sideChains; session.measurements = structuredClone(snapshot.measurements); session.scenes = new Map(snapshot.scenes.map(([name, scene]) => [name, structuredClone(scene)])); session.guides = new Map(snapshot.guides.map((guide) => [guide.id, structuredClone(guide)])); session.layers = structuredClone(snapshot.layers); session.annotations = structuredClone(snapshot.annotations); session.lighting = snapshot.lighting; session.displayMode = snapshot.displayMode; session.toolbarVisible = snapshot.toolbarVisible; session.workspace = structuredClone(snapshot.workspace);
}
function recordMutation(session: StructureSession): void { session.undoStack.push(takeSnapshot(session)); if (session.undoStack.length > 100) session.undoStack.shift(); session.redoStack = []; }

function revisionCheck(args: Record<string, unknown>, session: StructureSession): ScienceFailure | null {
  if (args.expectedRevision === undefined) return null;
  if (!Number.isSafeInteger(args.expectedRevision) || (args.expectedRevision as number) < 0) return failure("EXPECTED_REVISION_INVALID", "expectedRevision must be a non-negative safe integer.");
  return args.expectedRevision === session.revision ? null : failure("REVISION_CONFLICT", `Expected revision ${String(args.expectedRevision)}, current revision is ${session.revision}.`, { expectedRevision: args.expectedRevision, sceneRevision: session.revision });
}

function centroid(atoms: Atom[]): Point { return { x: atoms.reduce((s, a) => s + a.x, 0) / atoms.length, y: atoms.reduce((s, a) => s + a.y, 0) / atoms.length, z: atoms.reduce((s, a) => s + a.z, 0) / atoms.length }; }
const sub = (a: Point, b: Point): number[] => [a.x - b.x, a.y - b.y, a.z - b.z];
const dot = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index]!, 0);
const norm = (a: number[]) => Math.hypot(...a);
const cross = (a: number[], b: number[]): number[] => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
function angle(a: Point, b: Point, c: Point): number { const u = sub(a, b), v = sub(c, b); return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (norm(u) * norm(v))))) * 180 / Math.PI; }
function dihedral(a: Point, b: Point, c: Point, d: Point): number { const b0 = sub(a, b), b1 = sub(c, b), b2 = sub(d, c), unit = b1.map((x) => x / norm(b1)); const v = b0.map((x, i) => x - dot(b0, unit) * unit[i]!), w = b2.map((x, i) => x - dot(b2, unit) * unit[i]!); return Math.atan2(dot(cross(unit, v), w), dot(v, w)) * 180 / Math.PI; }

function principalGeometry(atoms: Atom[]): { values: number[]; axes: number[][] } {
  const center = centroid(atoms), matrix: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], vectors: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (const atom of atoms) { const value = sub(atom, center); for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) matrix[row]![column] = matrix[row]![column]! + value[row]! * value[column]!; }
  for (let iteration = 0; iteration < 60; iteration += 1) {
    let p = 0, q = 1, largest = Math.abs(matrix[0]![1]!);
    for (let row = 0; row < 3; row += 1) for (let column = row + 1; column < 3; column += 1) if (Math.abs(matrix[row]![column]!) > largest) { largest = Math.abs(matrix[row]![column]!); p = row; q = column; }
    if (largest < 1e-12) break;
    const theta = 0.5 * Math.atan2(2 * matrix[p]![q]!, matrix[q]![q]! - matrix[p]![p]!), cosine = Math.cos(theta), sine = Math.sin(theta);
    for (let index = 0; index < 3; index += 1) { const x = matrix[index]![p]!, y = matrix[index]![q]!; matrix[index]![p] = cosine * x - sine * y; matrix[index]![q] = sine * x + cosine * y; }
    for (let index = 0; index < 3; index += 1) { const x = matrix[p]![index]!, y = matrix[q]![index]!; matrix[p]![index] = cosine * x - sine * y; matrix[q]![index] = sine * x + cosine * y; const vx = vectors[index]![p]!, vy = vectors[index]![q]!; vectors[index]![p] = cosine * vx - sine * vy; vectors[index]![q] = sine * vx + cosine * vy; }
  }
  return [0, 1, 2].map((index) => ({ value: matrix[index]![index]!, axis: vectors.map((row) => row[index]!) })).sort((a, b) => b.value - a.value).reduce((result, entry) => ({ values: [...result.values, entry.value], axes: [...result.axes, entry.axis] }), { values: [] as number[], axes: [] as number[][] });
}

function largestEigenvector(matrix: number[][]): number[] {
  const a = matrix.map((row) => [...row]);
  const vectors: number[][] = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => row === column ? 1 : 0));
  for (let iteration = 0; iteration < 80; iteration += 1) {
    let p = 0, q = 1, largest = Math.abs(a[0]![1]!);
    for (let row = 0; row < 4; row += 1) for (let column = row + 1; column < 4; column += 1) if (Math.abs(a[row]![column]!) > largest) { largest = Math.abs(a[row]![column]!); p = row; q = column; }
    if (largest < 1e-12) break;
    const theta = 0.5 * Math.atan2(2 * a[p]![q]!, a[q]![q]! - a[p]![p]!), cosine = Math.cos(theta), sine = Math.sin(theta);
    for (let index = 0; index < 4; index += 1) { const x = a[index]![p]!, y = a[index]![q]!; a[index]![p] = cosine * x - sine * y; a[index]![q] = sine * x + cosine * y; }
    for (let index = 0; index < 4; index += 1) {
      const x = a[p]![index]!, y = a[q]![index]!; a[p]![index] = cosine * x - sine * y; a[q]![index] = sine * x + cosine * y;
      const vx = vectors[index]![p]!, vy = vectors[index]![q]!; vectors[index]![p] = cosine * vx - sine * vy; vectors[index]![q] = sine * vx + cosine * vy;
    }
  }
  let index = 0; for (let i = 1; i < 4; i += 1) if (a[i]![i]! > a[index]![index]!) index = i;
  const vector = vectors.map((row) => row[index]!), length = norm(vector); return vector.map((value) => value / length);
}

function kabsch(mobile: Atom[], reference: Atom[]) {
  const mc = centroid(mobile), rc = centroid(reference), s: number[][] = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let i = 0; i < mobile.length; i += 1) { const m = sub(mobile[i]!, mc), r = sub(reference[i]!, rc); for (let x = 0; x < 3; x += 1) for (let y = 0; y < 3; y += 1) s[x]![y] = s[x]![y]! + m[x]! * r[y]!; }
  const [xx, xy, xz] = s[0]!, [yx, yy, yz] = s[1]!, [zx, zy, zz] = s[2]!;
  const [w, x, y, z] = largestEigenvector([[xx! + yy! + zz!, yz! - zy!, zx! - xz!, xy! - yx!], [yz! - zy!, xx! - yy! - zz!, xy! + yx!, zx! + xz!], [zx! - xz!, xy! + yx!, -xx! + yy! - zz!, yz! + zy!], [xy! - yx!, zx! + xz!, yz! + zy!, -xx! - yy! + zz!]]);
  const r = [[1 - 2 * (y! ** 2 + z! ** 2), 2 * (x! * y! - z! * w!), 2 * (x! * z! + y! * w!)], [2 * (x! * y! + z! * w!), 1 - 2 * (x! ** 2 + z! ** 2), 2 * (y! * z! - x! * w!)], [2 * (x! * z! - y! * w!), 2 * (y! * z! + x! * w!), 1 - 2 * (x! ** 2 + y! ** 2)]];
  const center = r.map((row) => row[0]! * mc.x + row[1]! * mc.y + row[2]! * mc.z), t = [rc.x - center[0]!, rc.y - center[1]!, rc.z - center[2]!];
  const transform = (point: Point): Point => ({ x: r[0]![0]! * point.x + r[0]![1]! * point.y + r[0]![2]! * point.z + t[0]!, y: r[1]![0]! * point.x + r[1]![1]! * point.y + r[1]![2]! * point.z + t[1]!, z: r[2]![0]! * point.x + r[2]![1]! * point.y + r[2]![2]! * point.z + t[2]! });
  const rmsd = Math.sqrt(mobile.reduce((sum, atom, i) => sum + distance(transform(atom), reference[i]!) ** 2, 0) / mobile.length);
  return { rotation: r, translation: t, rmsd, matrix: [r[0]![0]!, r[0]![1]!, r[0]![2]!, t[0]!, r[1]![0]!, r[1]![1]!, r[1]![2]!, t[1]!, r[2]![0]!, r[2]![1]!, r[2]![2]!, t[2]!, 0, 0, 0, 1] };
}

const VDW_RADII: Record<string, number> = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, P: 1.8, S: 1.8, F: 1.47, CL: 1.75, BR: 1.85, I: 1.98 };
const ELEMENT_COLORS: Record<string, [number, number, number]> = { H: [230, 230, 230], C: [132, 145, 166], N: [79, 129, 189], O: [207, 78, 78], S: [224, 184, 54], P: [232, 140, 54] };
const spherePoints = Array.from({ length: 92 }, (_, index) => { const z = 1 - 2 * (index + .5) / 92, radius = Math.sqrt(Math.max(0, 1 - z * z)), theta = Math.PI * (1 + Math.sqrt(5)) * index; return [radius * Math.cos(theta), radius * Math.sin(theta), z] as const; });
const vdw = (atom: Atom) => VDW_RADII[atom.element.trim().toUpperCase()] ?? 1.7;
const atomIdentity = (atom: Atom) => `${atom.chain}:${atom.residue}:${atom.resName}:${atom.name}`;
const crcTable = (() => { const values = new Uint32Array(256); for (let index = 0; index < 256; index += 1) { let value = index; for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; values[index] = value >>> 0; } return values; })();
function crc32(bytes: Uint8Array): number { let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 255]! ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0; }
function pngChunk(type: string, data: Uint8Array): Buffer { const header = Buffer.alloc(8); header.writeUInt32BE(data.length, 0); header.write(type, 4, 4, "ascii"); const body = Buffer.concat([header.subarray(4), Buffer.from(data)]); const trailer = Buffer.alloc(4); trailer.writeUInt32BE(crc32(body), 0); return Buffer.concat([header, Buffer.from(data), trailer]); }
function pngFromRgba(width: number, height: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.allocUnsafe(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) { const target = y * (1 + width * 4); raw[target] = 0; raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), target + 1); }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", new Uint8Array())]);
}
function parseHexColor(value: string | null | undefined, fallback: [number, number, number]): [number, number, number] { if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return fallback; return [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)]; }
function drawDisc(image: Uint8Array, width: number, height: number, x: number, y: number, radius: number, color: [number, number, number], alpha = 255): void {
  const left = Math.max(0, Math.floor(x - radius)), right = Math.min(width - 1, Math.ceil(x + radius)), top = Math.max(0, Math.floor(y - radius)), bottom = Math.min(height - 1, Math.ceil(y + radius));
  for (let py = top; py <= bottom; py += 1) for (let px = left; px <= right; px += 1) { const dx = px + .5 - x, dy = py + .5 - y; if (dx * dx + dy * dy > radius * radius) continue; const offset = (py * width + px) * 4, blend = alpha / 255; image[offset] = Math.round(image[offset]! * (1 - blend) + color[0] * blend); image[offset + 1] = Math.round(image[offset + 1]! * (1 - blend) + color[1] * blend); image[offset + 2] = Math.round(image[offset + 2]! * (1 - blend) + color[2] * blend); image[offset + 3] = 255; }
}
function localRaster(session: StructureSession, width: number, height: number, transparent: boolean, rotationDegrees = 0): { png: Buffer; renderedAtomCount: number; projection: Record<string, unknown> } {
  const visible = [...session.objects.values()].filter((object) => object.visible).flatMap((object) => object.atoms.map((atom) => ({ atom, object })));
  const selected = new Set(session.selected.map(atomKey)), background = transparent ? [0, 0, 0, 0] : session.background === "dark" ? [12, 19, 31, 255] : [246, 248, 252, 255], image = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < image.length; offset += 4) { image[offset] = background[0]!; image[offset + 1] = background[1]!; image[offset + 2] = background[2]!; image[offset + 3] = background[3]!; }
  if (!visible.length) return { png: pngFromRgba(width, height, image), renderedAtomCount: 0, projection: { kind: "orthographic-xy", empty: true } };
  const minX = Math.min(...visible.map(({ atom }) => atom.x)), maxX = Math.max(...visible.map(({ atom }) => atom.x)), minY = Math.min(...visible.map(({ atom }) => atom.y)), maxY = Math.max(...visible.map(({ atom }) => atom.y));
  const span = Math.max(maxX - minX, maxY - minY, 1), scale = Math.max(1, Math.min(width, height) * .82 / span), centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2, radians = rotationDegrees * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
  visible.sort((left, right) => left.atom.z - right.atom.z);
  for (const { atom, object } of visible) { const dx = atom.x - centerX, dy = atom.y - centerY, x = width / 2 + (dx * cosine - dy * sine) * scale, y = height / 2 - (dx * sine + dy * cosine) * scale, element = atom.element.trim().toUpperCase(); const base = object.color && /^#[0-9a-f]{6}$/i.test(object.color) ? parseHexColor(object.color, ELEMENT_COLORS[element] ?? [160, 160, 160]) : ELEMENT_COLORS[element] ?? [160, 160, 160]; drawDisc(image, width, height, x, y, selected.has(atomKey(atom)) ? 3.6 : 2.25, selected.has(atomKey(atom)) ? [255, 205, 56] : base, selected.has(atomKey(atom)) ? 255 : 220); }
  return { png: pngFromRgba(width, height, image), renderedAtomCount: visible.length, projection: { kind: "orthographic-xy", rotationDegrees, scalePixelsPerAngstrom: scale, sourceExtentAngstrom: { minX, maxX, minY, maxY } } };
}
function pdbText(atoms: Atom[]): string {
  const put = (line: string[], offset: number, value: string) => { for (let index = 0; index < value.length && offset + index < line.length; index += 1) line[offset + index] = value[index]!; };
  return atoms.map((atom, index) => {
    const line = Array.from({ length: 80 }, () => " ");
    put(line, 0, atom.record === "HETATM" ? "HETATM" : "ATOM  ");
    put(line, 6, String(index + 1).padStart(5)); put(line, 12, atom.name.slice(0, 4).padStart(4));
    put(line, 17, atom.resName.slice(0, 3).padStart(3)); put(line, 21, atom.chain.slice(0, 1) || " ");
    put(line, 22, String(atom.residue).padStart(4)); put(line, 30, atom.x.toFixed(3).padStart(8));
    put(line, 38, atom.y.toFixed(3).padStart(8)); put(line, 46, atom.z.toFixed(3).padStart(8));
    put(line, 54, "  1.00"); put(line, 60, "  0.00"); put(line, 76, atom.element.slice(0, 2).padStart(2)); return line.join("");
  }).join("\n") + (atoms.length ? "\nEND\n" : "END\n");
}
function mmcifText(atoms: Atom[]): string { return ["data_dsh_rosalind", "#", "loop_", "_atom_site.group_PDB", "_atom_site.id", "_atom_site.type_symbol", "_atom_site.label_atom_id", "_atom_site.label_comp_id", "_atom_site.label_asym_id", "_atom_site.label_seq_id", "_atom_site.Cartn_x", "_atom_site.Cartn_y", "_atom_site.Cartn_z", ...atoms.map((atom, index) => `${atom.record} ${index + 1} ${atom.element} ${atom.name} ${atom.resName} ${atom.chain} ${atom.residue} ${atom.x.toFixed(3)} ${atom.y.toFixed(3)} ${atom.z.toFixed(3)}`), "#", ""].join("\n"); }

export class StructureService {
  private readonly sessions = new WeakMap<object, StructureSession>();

  async execute(operation: string, args: Record<string, unknown>, context: ScienceExecutionContext): Promise<Record<string, unknown> | ScienceFailure> {
    checkAbort(context.signal);
    const name = operation.replace(/^structure\./, "");
    if (name === "open_from_chat") return this.open(args, context);
    const session = this.requireSession(context.session, args.sessionId); if (isFailure(session)) return session;
    if (name === "get_state" || name === "list_structures") return name === "get_state" ? summary(session) : { ok: true, objects: summary(session).objects };
    if (name === "add_structure") return this.add(args, context, session);
    if (name === "set_selection") return this.setSelection(args, session);
    if (name === "control_viewer") return this.control(args, session);
    if (name === "query") return this.query(args, session);
    if (name === "measure") return this.measure(args, session);
    if (name === "analyze") return this.analyze(args, session, context.signal);
    if (name === "apply_scene") return this.applyScene(args, session);
    if (["save_scene", "load_scene", "delete_scene", "list_scenes"].includes(name)) return this.scene(name, args, session);
    if (["set_object_visibility", "remove_structure", "align_structures"].includes(name)) return this.object(name, args, session);
    if (name === "transform_object") return this.transform(args, session);
    if (name === "derive_object") return this.derive(args, session);
    if (name === "undo" || name === "redo") return this.history(name, args, session);
    if (name === "manage_guides") return this.guides(args, session);
    if (name === "quality_assessment") return this.quality(args, session);
    if (name === "set_quality_assessment") return this.setQuality(args, session);
    if (name === "assembly_symmetry") return this.assemblySymmetry(args, session);
    if (name === "set_assembly_symmetry") return this.setAssemblySymmetry(args, session);
    if (name === "set_trajectory_state") return this.setTrajectoryState(args, session);
    if (name === "search_motif") return this.searchMotif(args, context, session);
    if (name === "browse_related_data") return this.browseRelatedData(args, session);
    if (name === "pymol_actions") return this.actionVocabulary(session);
    if (name === "pymol_action") return this.directAction(args, session);
    if (name === "export") return this.export(args, context, session);
    if (name === "validate_render") return this.validateRender(args, session);
    if (name === "render_image") return this.renderImage(args, context, session);
    if (name === "render_movie") return this.renderMovie(args, context, session);
    if (name === "get_render_status") return this.renderStatus(args, session);
    if (name === "cancel_render") return this.cancelRender(args, session);
    if (name === "load_data") return this.loadData(args, context, session);
    if (name === "discover_density") return this.discoverDensity(args, context, session);
    if (name === "load_public_density") return this.loadPublicDensity(args, session);
    if (name === "load_background") return this.loadBackground(args, session);
    return failure("STRUCTURE_OPERATION_UNKNOWN", `${operation} is not registered by the Molecular Structure Viewer contract; no scene or result was changed.`, { operation });
  }

  private requireSession(owner: object, requested: unknown): StructureSession | ScienceFailure {
    if (typeof requested !== "string" || !requested.trim()) return failure("SESSION_ID_REQUIRED", "sessionId is required after open_from_chat.");
    const session = this.sessions.get(owner);
    return session?.id === requested ? session : failure("SESSION_NOT_FOUND", "The requested structure session is not active for this caller.", { requestedSessionId: requested });
  }

  private assemblySymmetry(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const objectId = typeof args.objectId === "string" ? args.objectId : "", object = session.objects.get(objectId);
    if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No loaded structure object named ${objectId}.`);
    const source = args.source && typeof args.source === "object" ? args.source as Record<string, unknown> : null;
    if (!source || source.kind !== "rcsb" || typeof source.entryId !== "string" || typeof source.assemblyId !== "string") return failure("ASSEMBLY_SOURCE_INVALID", "assembly_symmetry requires source.kind rcsb plus entryId and assemblyId.");
    const localEntryId = basename(object.path).replace(/\.(?:pdb|ent)(?:\.gz)?$/i, "").toUpperCase();
    if (String(source.entryId).toUpperCase() !== localEntryId) return failure("ASSEMBLY_SOURCE_MISMATCH", "The requested RCSB entry does not match this local PDB fixture, so no unrelated assembly metadata was applied.", { requestedEntryId: source.entryId, localEntryId });
    if (args.operation === "load" || !object.symmetryRecords) {
      const records = pdbAssemblyRecords(object.path); if (isFailure(records)) return records;
      object.symmetryRecords = records;
    }
    const selected = object.symmetryRecords.filter((record) => record.assemblyId === source.assemblyId);
    if (!selected.length) return failure("ASSEMBLY_NOT_FOUND", `Assembly ${source.assemblyId} is not present in this local PDB REMARK 350 metadata.`, { availableAssemblyIds: object.symmetryRecords.map((record) => record.assemblyId) });
    const offset = Number(args.offset ?? 0), limit = Number(args.limit ?? 100);
    if (!Number.isInteger(offset) || !Number.isInteger(limit) || offset < 0 || limit < 1 || limit > 500) return failure("ASSEMBLY_PAGINATION_INVALID", "offset must be nonnegative and limit must be an integer from 1 through 500.");
    const items = selected.slice(offset, offset + limit);
    return { ok: true, action: args.operation ?? "load", objectId, source: { kind: "rcsb", entryId: localEntryId, assemblyId: source.assemblyId }, items, total: selected.length, offset, limit, nextOffset: offset + items.length < selected.length ? offset + items.length : null, provenance: "Parsed directly from the loaded PDB REMARK 350 biological assembly metadata; no network request was made." };
  }

  private browseRelatedData(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    if (typeof args.callerId !== "string" || typeof args.commandId !== "string") return failure("WORKSPACE_REQUEST_ID_REQUIRED", "browse_related_data requires the callerId and commandId issued for this request.");
    const requestedToken = typeof args.directoryToken === "string" ? args.directoryToken : session.relatedDirectories.keys().next().value;
    const directory = requestedToken ? session.relatedDirectories.get(requestedToken) : undefined;
    if (!directory) return failure("WORKSPACE_DIRECTORY_TOKEN_INVALID", "The directory token is not retained by this local structure session.");
    let entries: Dirent<string>[];
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch (cause) { return failure("WORKSPACE_DIRECTORY_NOT_READABLE", cause instanceof Error ? cause.message : String(cause)); }
    const maxItems = 200, items = entries.slice(0, maxItems).map((entry) => {
      const fullPath = resolve(directory, entry.name), token = crypto.randomUUID();
      if (entry.isDirectory()) { session.relatedDirectories.set(token, fullPath); return { token, kind: "directory", name: entry.name }; }
      session.relatedFiles.set(token, fullPath);
      return { token, kind: "file", name: entry.name, format: formatFor(entry.name) ?? (/[.](?:png|jpe?g)$/i.test(entry.name) ? "image" : "unknown"), bytes: (() => { try { return statSync(fullPath).size; } catch { return null; } })() };
    });
    return { ok: true, callerId: args.callerId, commandId: args.commandId, directoryToken: requestedToken, items, total: entries.length, truncated: entries.length > maxItems, nextCursor: null, provenance: "Opaque tokens were issued only for siblings of the active local coordinate source; no caller path was accepted." };
  }

  private open(args: Record<string, unknown>, context: ScienceExecutionContext): Record<string, unknown> | ScienceFailure {
    const path = sourcePath(args.path, context.packageRoot); if (typeof path !== "string") return path;
    const parsed = parseCoordinates(path); if (isFailure(parsed)) return parsed;
    let session = this.sessions.get(context.session);
    if (!session) { session = { id: crypto.randomUUID(), revision: 0, objects: new Map(), selected: [], focus: [], named: new Map(), background: "light", backgroundImage: null, densityMaps: new Map(), densityDiscoveries: new Map(), showHydrogens: false, sideChains: false, measurements: [], scenes: new Map(), guides: new Map(), layers: [], annotations: [], lighting: "studio", displayMode: "inline", toolbarVisible: true, workspace: { explorerVisible: true, sequenceVisible: true, measurementsVisible: false, commandConsoleVisible: false, workbenchVisible: false, renderPanelVisible: false, selectionGranularity: "residue", spinning: false }, renderJobs: new Map(), relatedDirectories: new Map(), relatedFiles: new Map(), undoStack: [], redoStack: [] }; this.sessions.set(context.session, session); }
    parsed.atoms.forEach((atom) => { atom.objectId = "primary"; }); parsed.baseAtoms.forEach((atom) => { atom.objectId = "primary"; }); session.objects.clear(); session.objects.set("primary", parsed); session.selected = []; session.focus = []; session.named.clear(); session.backgroundImage = null; session.densityMaps.clear(); session.densityDiscoveries.clear(); session.measurements = []; session.scenes.clear(); session.guides.clear(); session.layers = [{ id: "primary-display", name: "Primary structure", target: { objectId: "primary", component: "polymer" }, representation: "cartoon", visible: true }]; session.annotations = []; session.renderJobs.clear(); session.relatedDirectories.clear(); session.relatedFiles.clear(); session.relatedDirectories.set(crypto.randomUUID(), dirname(parsed.path)); session.undoStack = []; session.redoStack = []; session.revision += 1;
    return { ...summary(session), coordinateLoad: { status: "ready", parser: `${parsed.format} coordinate parser`, atomCount: parsed.atoms.length }, viewerOpen: { mountState: "client-integration-required", renderState: "pending", exportRenderer: "ready" }, viewerReady: false };
  }

  private add(args: Record<string, unknown>, context: ScienceExecutionContext, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const path = sourcePath(args.path, context.packageRoot); if (typeof path !== "string") return path;
    const parsed = parseCoordinates(path); if (isFailure(parsed)) return parsed;
    const objectId = typeof args.objectId === "string" ? args.objectId : "";
    if (!/^[a-z][a-z0-9_-]*$/.test(objectId) || objectId === "primary") return failure("OBJECT_ID_INVALID", "add_structure requires a valid non-primary objectId.");
    if (session.objects.has(objectId)) return failure("OBJECT_ID_IN_USE", `Object ${objectId} already exists.`);
    parsed.id = objectId; parsed.atoms.forEach((atom) => { atom.objectId = objectId; }); parsed.baseAtoms.forEach((atom) => { atom.objectId = objectId; }); parsed.representation = typeof args.representation === "string" ? args.representation : "cartoon"; parsed.color = typeof args.color === "string" ? args.color : null; recordMutation(session); session.objects.set(objectId, parsed); session.revision += 1;
    return { ok: true, object: { id: objectId, atomCount: parsed.atoms.length, format: parsed.format }, appliedRevision: session.revision };
  }

  private loadData(args: Record<string, unknown>, context: ScienceExecutionContext, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    if (args.kind === "trajectory") {
      const objectId = typeof args.objectId === "string" ? args.objectId : "primary", object = session.objects.get(objectId);
      if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No loaded structure object named ${objectId}.`);
      if (typeof args.topologyPath !== "string" || typeof args.coordinatesPath !== "string") return failure("TRAJECTORY_SOURCE_REQUIRED", "Local trajectory loading requires explicit topologyPath and coordinatesPath.");
      const topology = sourcePath(args.topologyPath, context.packageRoot), coordinates = sourcePath(args.coordinatesPath, context.packageRoot);
      if (typeof topology !== "string") return topology; if (typeof coordinates !== "string") return coordinates;
      if (resolve(topology) !== resolve(object.path)) return failure("TRAJECTORY_TOPOLOGY_MISMATCH", "trajectory topologyPath must identify the already-loaded object source.", { objectId, loadedPath: relative(context.packageRoot, object.path) });
      const trajectory = parseTrajectoryFixture(coordinates, object.atoms.length); if (isFailure(trajectory)) return trajectory;
      recordMutation(session); object.trajectory = trajectory;
      const first = trajectory.frames[0]!; object.atoms.forEach((atom, index) => { const point = first[index]!; atom.x = point[0]; atom.y = point[1]; atom.z = point[2]; }); session.revision += 1;
      return { ok: true, kind: "trajectory", object: { id: objectId, atomCount: object.atoms.length }, trajectory: { format: trajectory.format, frameCount: trajectory.frames.length, currentFrame: trajectory.currentFrame, sourcePath: relative(context.packageRoot, coordinates) }, appliedRevision: session.revision, provenance: "Explicit local DSH trajectory fixture coordinates were checked against the loaded topology atom count." };
    }
    if (args.kind !== "structure") return failure("SOURCE_CAPABILITY_UNAVAILABLE", `Local load_data supports kind structure and an explicit JSON trajectory fixture. ${String(args.kind)} requires a decoder that is not installed.`);
    if (typeof args.path !== "string" || !args.path.trim()) return failure("SOURCE_PATH_REQUIRED", "load_data kind structure requires a local path.");
    const objectId = typeof args.objectId === "string" && args.objectId ? args.objectId : `secondary-${session.objects.size}`;
    const added = this.add({ path: args.path, objectId, representation: args.representation, color: args.color }, context, session);
    if (isFailure(added)) return added;
    return { ok: true, kind: "structure", object: added.object, appliedRevision: added.appliedRevision, provenance: "Parsed from a local in-package PDB or mmCIF coordinate file." };
  }

  private discoverDensity(args: Record<string, unknown>, context: ScienceExecutionContext, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const source = args.source && typeof args.source === "object" ? args.source as Record<string, unknown> : null;
    if (!source || source.kind !== "local-fixture" || typeof source.path !== "string") return failure("DENSITY_SOURCE_INVALID", "discover_density requires source.kind local-fixture and an explicit in-package OpenDX path.");
    const path = sourcePath(source.path, context.packageRoot); if (typeof path !== "string") return path;
    const density = parseDxDensity(path); if (isFailure(density)) return density;
    session.densityDiscoveries.set(density.id, density);
    return { ok: true, source: { kind: "local-fixture", path: relative(context.packageRoot, path) }, items: [{ densityId: density.id, format: density.format, dimensions: density.dimensions, voxelCount: density.voxelCount, statistics: { min: density.min, max: density.max, mean: density.mean } }], total: 1, provenance: "Parsed from an explicit local OpenDX test fixture. No public density service was contacted." };
  }

  private loadPublicDensity(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const densityId = typeof args.densityId === "string" ? args.densityId : "", discovered = session.densityDiscoveries.get(densityId);
    if (!discovered) return failure("DENSITY_DISCOVERY_NOT_FOUND", "load_public_density requires a densityId returned by discover_density for this session.", { densityId });
    const id = typeof args.objectId === "string" && args.objectId ? args.objectId : discovered.id;
    if (session.densityMaps.has(id)) return failure("DENSITY_ID_IN_USE", `A loaded density map named ${id} already exists.`);
    recordMutation(session); const map = { ...discovered, id, visible: args.visible !== false }; session.densityMaps.set(id, map); session.revision += 1;
    return { ok: true, density: { id, format: map.format, dimensions: map.dimensions, voxelCount: map.voxelCount, statistics: { min: map.min, max: map.max, mean: map.mean }, visible: map.visible }, appliedRevision: session.revision, provenance: "Loaded the exact local fixture discovered in this structure session; it was not downloaded from a public provider." };
  }

  private loadBackground(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    if (typeof args.callerId !== "string" || typeof args.commandId !== "string" || typeof args.fileToken !== "string") return failure("BACKGROUND_REQUEST_INVALID", "load_background requires the callerId, commandId, and image fileToken returned by browse_related_data.");
    const path = session.relatedFiles.get(args.fileToken); if (!path) return failure("BACKGROUND_TOKEN_INVALID", "The image fileToken is not retained by this structure session.");
    const format = imageFormat(path); if (!format || !imageHasExpectedSignature(path, format)) return failure("BACKGROUND_IMAGE_INVALID", "The selected token does not identify a valid local PNG or JPEG image.");
    const bytes = statSync(path).size;
    if (bytes > 32 * 1024 * 1024) return failure("BACKGROUND_IMAGE_LIMIT", "The selected local background exceeds the 32 MiB encoded image budget.", { bytes });
    recordMutation(session); session.backgroundImage = { token: args.fileToken, fileName: basename(path), format, bytes }; session.revision += 1;
    return { ok: true, background: { fileName: basename(path), format, bytes, appliedTo: "local-raster-export" }, appliedRevision: session.revision, provenance: "Admitted only from an opaque sibling-file token and validated by image signature." };
  }

  private setAssemblySymmetry(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const objectId = typeof args.objectId === "string" ? args.objectId : "", object = session.objects.get(objectId);
    if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No loaded structure object named ${objectId}.`);
    if (!object.symmetryRecords?.length) return failure("ASSEMBLY_NOT_LOADED", "Load matching local assembly metadata with assembly_symmetry before changing its display state.");
    const selectedIndex = args.selectedIndex === null || args.selectedIndex === undefined ? null : Number(args.selectedIndex);
    if (selectedIndex !== null && (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= object.symmetryRecords.length)) return failure("ASSEMBLY_INDEX_INVALID", "selectedIndex must identify one loaded assembly record or be null.", { recordCount: object.symmetryRecords.length });
    recordMutation(session); object.symmetryDisplay = { selectedIndex, axes: args.axes === true, cage: args.cage === true, clusterColors: args.clusterColors === true }; session.revision += 1;
    return { ok: true, objectId, display: { ...object.symmetryDisplay, assembly: selectedIndex === null ? null : object.symmetryRecords[selectedIndex] }, appliedRevision: session.revision, provenance: "Display controls target only PDB REMARK 350 assembly records parsed from the currently loaded local structure." };
  }

  private setTrajectoryState(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const input = args.state && typeof args.state === "object" ? args.state as Record<string, unknown> : args;
    const objectId = typeof input.objectId === "string" ? input.objectId : "primary", object = session.objects.get(objectId), trajectory = object?.trajectory;
    if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No loaded structure object named ${objectId}.`);
    if (!trajectory) return failure("TRAJECTORY_DATA_UNAVAILABLE", "No local trajectory fixture is loaded for this object.");
    const currentFrame = input.currentFrame === undefined ? trajectory.currentFrame : Number(input.currentFrame);
    if (!Number.isInteger(currentFrame) || currentFrame < 0 || currentFrame >= trajectory.frames.length) return failure("TRAJECTORY_FRAME_INVALID", "currentFrame must be an integer that exists in the loaded trajectory.", { frameCount: trajectory.frames.length });
    const speed = input.speed === undefined ? trajectory.speed : Number(input.speed), stride = input.stride === undefined ? trajectory.stride : Number(input.stride);
    if (!Number.isFinite(speed) || speed <= 0 || speed > 60 || !Number.isInteger(stride) || stride < 1 || stride > trajectory.frames.length) return failure("TRAJECTORY_STATE_INVALID", "speed must be positive (at most 60) and stride must be a valid positive frame interval.");
    recordMutation(session); trajectory.currentFrame = currentFrame; if (typeof input.playing === "boolean") trajectory.playing = input.playing; if (typeof input.loop === "boolean") trajectory.loop = input.loop; trajectory.speed = speed; trajectory.stride = stride;
    const coordinates = trajectory.frames[currentFrame]!; object.atoms.forEach((atom, index) => { const point = coordinates[index]!; atom.x = point[0]; atom.y = point[1]; atom.z = point[2]; }); session.revision += 1;
    return { ok: true, objectId, state: { currentFrame: trajectory.currentFrame, frameCount: trajectory.frames.length, playing: trajectory.playing, loop: trajectory.loop, speed: trajectory.speed, stride: trajectory.stride }, appliedRevision: session.revision, provenance: "The selected local fixture frame was applied to the loaded topology coordinates." };
  }

  private searchMotif(args: Record<string, unknown>, context: ScienceExecutionContext, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const source = args.source && typeof args.source === "object" ? args.source as Record<string, unknown> : null;
    if (!source || source.kind !== "local-fixture" || typeof source.path !== "string") return failure("MOTIF_SOURCE_INVALID", "search_motif requires source.kind local-fixture and an explicit local coordinate fixture; it does not upload the active structure.");
    const path = sourcePath(source.path, context.packageRoot); if (typeof path !== "string") return path;
    const target = parseCoordinates(path); if (isFailure(target)) return target;
    const residues = Array.isArray(args.residues) ? args.residues as Array<Record<string, unknown>> : [];
    if (residues.length < 2 || residues.length > 10 || residues.some((residue) => typeof residue.chain !== "string" || !Number.isInteger(residue.residue))) return failure("MOTIF_QUERY_INVALID", "A local motif query requires 2 through 10 exact {chain, residue} identities.");
    const tolerance = Number(args.toleranceAngstrom ?? 0.25); if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 5) return failure("MOTIF_TOLERANCE_INVALID", "toleranceAngstrom must be a finite value from 0 through 5.");
    const referenceObjectId = typeof args.referenceObjectId === "string" ? args.referenceObjectId : "primary", reference = session.objects.get(referenceObjectId);
    if (!reference) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No loaded structure object named ${referenceObjectId}.`);
    const centers = (atoms: Atom[], requested: Array<Record<string, unknown>>): Point[] | ScienceFailure => {
      const result: Point[] = [];
      for (const residue of requested) { const selected = atoms.filter((atom) => atom.chain === residue.chain && atom.residue === residue.residue); if (!selected.length) return failure("MOTIF_RESIDUE_NOT_FOUND", "One requested motif residue is missing from a compared local coordinate fixture.", { chain: residue.chain, residue: residue.residue }); result.push(centroid(selected)); }
      return result;
    };
    const referenceCenters = centers(reference.atoms, residues); if (isFailure(referenceCenters)) return referenceCenters;
    const targetCenters = centers(target.atoms, residues); if (isFailure(targetCenters)) return targetCenters;
    const pairDistances = (points: Point[]) => points.flatMap((point, left) => points.slice(left + 1).map((other, right) => ({ left, right: left + right + 1, distanceAngstrom: distance(point, other) })));
    const referenceDistances = pairDistances(referenceCenters), targetDistances = pairDistances(targetCenters), maximumDeviation = referenceDistances.reduce((maximum, entry, index) => Math.max(maximum, Math.abs(entry.distanceAngstrom - targetDistances[index]!.distanceAngstrom)), 0);
    const hit = maximumDeviation <= tolerance ? { source: { fileName: basename(path), format: target.format }, residues: residues.map((residue) => ({ chain: residue.chain, residue: residue.residue })), maximumPairDistanceDeviationAngstrom: maximumDeviation, pairDistancesAngstrom: targetDistances } : null;
    const queryHash = Buffer.from(JSON.stringify({ referenceObjectId, residues, tolerance })).toString("base64url");
    return { ok: true, queryHash, hits: hit ? [hit] : [], total: hit ? 1 : 0, nextCursor: null, provenance: "Geometric pair-distance comparison between an explicit local reference object and a declared local fixture. No remote motif provider or local-coordinate upload was used." };
  }

  private setSelection(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const result = selectAtoms(session, args.expression); if (isFailure(result)) return result;
    const mode = args.mode ?? "set"; if (!["set", "add", "subtract", "intersect"].includes(String(mode))) return failure("SELECTION_MODE_INVALID", "Selection mode is invalid.");
    recordMutation(session);
    if (mode === "add") session.selected = uniqueAtoms([...session.selected, ...result.atoms]);
    else if (mode === "subtract") { const ids = new Set(result.atoms.map(atomKey)); session.selected = session.selected.filter((atom) => !ids.has(atomKey(atom))); }
    else if (mode === "intersect") { const ids = new Set(result.atoms.map(atomKey)); session.selected = session.selected.filter((atom) => ids.has(atomKey(atom))); }
    else session.selected = result.atoms;
    if (args.focus === true) session.focus = [...session.selected]; if (typeof args.name === "string" && args.name) session.named.set(args.name, [...session.selected]); session.revision += 1;
    return { ok: true, applied: true, selectedAtomCount: session.selected.length, selectedResidueCount: new Set(session.selected.map(scopedResidueKey)).size, appliedRevision: session.revision };
  }

  private control(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const action = args.action, primary = session.objects.get("primary");
    if (action === "set_representation" && primary && typeof args.representation === "string") { if (!["cartoon", "ballStick", "stick", "surface", "sphere"].includes(args.representation)) return failure("REPRESENTATION_UNSUPPORTED", "The requested viewer representation is unsupported."); recordMutation(session); primary.representation = args.representation; session.layers = session.layers.map((layer) => layer.id === "primary-display" ? { ...layer, representation: args.representation } : layer); session.revision += 1; return { ok: true, applied: true, representation: primary.representation, appliedRevision: session.revision }; }
    if (action === "set_color" && primary && typeof args.color === "string") { if (!["bfactor", "chain", "element"].includes(args.color) && !/^#[0-9a-f]{6}$/i.test(args.color)) return failure("COLOR_MODE_UNSUPPORTED", "Color must be chain, element, bfactor, or a #rrggbb color."); recordMutation(session); primary.color = args.color; session.revision += 1; return { ok: true, applied: true, color: primary.color, appliedRevision: session.revision }; }
    if (action === "set_view_options") { recordMutation(session); if (args.background === "dark" || args.background === "light") session.background = args.background; if (typeof args.showHydrogens === "boolean") session.showHydrogens = args.showHydrogens; if (typeof args.showSideChains === "boolean") session.sideChains = args.showSideChains; if (typeof args.spinning === "boolean") session.workspace.spinning = args.spinning; if (typeof args.showMoleculeInspector === "boolean") session.workspace.measurementsVisible = args.showMoleculeInspector; session.revision += 1; return { ok: true, applied: true, display: summary(session).display, appliedRevision: session.revision }; }
    if (action === "set_display_mode") { if (args.displayMode !== "inline" && args.displayMode !== "fullscreen") return failure("DISPLAY_MODE_INVALID", "displayMode must be inline or fullscreen."); recordMutation(session); session.displayMode = args.displayMode; session.revision += 1; return { ok: true, applied: true, displayMode: session.displayMode, appliedRevision: session.revision }; }
    if (action === "set_toolbar_visibility") { if (typeof args.visible !== "boolean") return failure("TOOLBAR_VISIBILITY_REQUIRED", "visible must be boolean."); recordMutation(session); session.toolbarVisible = args.visible; session.revision += 1; return { ok: true, applied: true, toolbarVisible: session.toolbarVisible, appliedRevision: session.revision }; }
    if (action === "set_workspace_options") {
      const fields = ["explorerVisible", "sequenceVisible", "measurementsVisible", "commandConsoleVisible", "workbenchVisible", "renderPanelVisible", "selectionGranularity"] as const;
      if (!fields.some((field) => args[field] !== undefined)) return failure("WORKSPACE_OPTIONS_REQUIRED", "At least one workspace option is required.");
      if (args.selectionGranularity !== undefined && !["atom", "residue", "chain", "object"].includes(String(args.selectionGranularity))) return failure("SELECTION_GRANULARITY_INVALID", "selectionGranularity must be atom, residue, chain, or object.");
      recordMutation(session); for (const field of fields) if (typeof args[field] === "boolean") (session.workspace as Record<string, unknown>)[field] = args[field]; if (typeof args.selectionGranularity === "string") session.workspace.selectionGranularity = args.selectionGranularity as WorkspaceState["selectionGranularity"]; if (session.workspace.workbenchVisible && session.workspace.renderPanelVisible) session.workspace.renderPanelVisible = false; session.revision += 1; return { ok: true, applied: true, workspace: session.workspace, appliedRevision: session.revision };
    }
    if (action === "reset_view") { recordMutation(session); session.workspace.spinning = false; session.revision += 1; return { ok: true, applied: true, reset: "local-raster-projection", appliedRevision: session.revision }; }
    if (action === "cancel_analysis") return { ok: true, applied: false, cancelled: false, reason: "No background analysis is active in the local structure service.", sceneRevision: session.revision };
    if (action === "clear_selection") { recordMutation(session); session.selected = []; session.focus = []; session.revision += 1; return { ok: true, applied: true, appliedRevision: session.revision }; }
    if (action === "select_chain") return this.setSelection({ expression: { kind: "chain", chain: args.chain, objectId: args.objectId } }, session);
    if (["focus_residue", "select_residue_range", "select_residues", "focus_ligand"].includes(String(action))) {
      const expression = action === "focus_ligand" ? { kind: "ligand", compId: args.compId, chain: args.chain, objectId: args.objectId } : action === "focus_residue" ? { kind: "residue", chain: args.chain, residue: args.residue, objectId: args.objectId } : action === "select_residue_range" ? { kind: "residue_range", chain: args.chain, start: args.start, end: args.end, objectId: args.objectId } : { kind: "residues", residues: args.residues, objectId: args.objectId };
      return this.setSelection({ expression, focus: String(action).startsWith("focus") }, session);
    }
    if (action === "show_ligand_contacts") return this.contacts(session, [{ kind: "ligand", compId: args.compId, chain: args.chain, objectId: args.objectId }, { kind: "component", component: "polymer", objectId: args.objectId }], Number(args.thresholdAngstrom ?? 4));
    if (action === "measure_residue_distance") return this.measure({ kind: "distance", targets: [{ kind: "residue", chain: args.chain, residue: args.residue, objectId: args.objectId }, { kind: "residue", chain: args.chainB, residue: args.residueB, objectId: args.objectId }] }, session);
    return failure("UNSUPPORTED_VIEWER_ACTION", `Viewer action ${String(action)} is unavailable locally.`);
  }

  private query(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const selected = selectAtoms(session, args.expression); if (isFailure(selected)) return selected;
    const level = args.level ?? "atom"; if (!["atom", "residue", "chain", "object"].includes(String(level))) return failure("QUERY_LEVEL_INVALID", "Query level must be atom, residue, chain, or object.");
    const limit = args.limit === undefined ? 100 : Number(args.limit); if (!Number.isInteger(limit) || limit < 1 || limit > 500) return failure("QUERY_LIMIT_INVALID", "Query limit must be an integer from 1 through 500.");
    let offset = 0;
    if (args.cursor !== undefined) { if (typeof args.cursor !== "string" || !/^\d+:\d+$/.test(args.cursor)) return failure("QUERY_CURSOR_INVALID", "Query cursor is invalid."); const [revision, next] = args.cursor.split(":").map(Number); if (revision !== session.revision) return failure("QUERY_CURSOR_STALE", "Query cursor belongs to another scene revision."); offset = next!; }
    let rows: Array<Record<string, unknown>>;
    if (level === "atom") rows = selected.atoms.map((atom) => ({ atomId: atomKey(atom), objectId: atom.objectId, name: atom.name, element: atom.element, residue: { chain: atom.chain, name: atom.resName, sequence: atom.residue }, coordinates: { x: atom.x, y: atom.y, z: atom.z } }));
    else if (level === "residue") { const groups = new Map<string, Atom[]>(); for (const atom of selected.atoms) groups.set(scopedResidueKey(atom), [...groups.get(scopedResidueKey(atom)) ?? [], atom]); rows = [...groups.values()].map((atoms) => ({ objectId: atoms[0]!.objectId, chain: atoms[0]!.chain, name: atoms[0]!.resName, sequence: atoms[0]!.residue, atomCount: atoms.length })); }
    else if (level === "chain") { const groups = new Map<string, Atom[]>(); for (const atom of selected.atoms) { const key = `${atom.objectId}\0${atom.chain}`; groups.set(key, [...groups.get(key) ?? [], atom]); } rows = [...groups.values()].map((atoms) => ({ objectId: atoms[0]!.objectId, chain: atoms[0]!.chain, atomCount: atoms.length, residueCount: new Set(atoms.map(scopedResidueKey)).size })); }
    else rows = [...new Set(selected.atoms.map((atom) => atom.objectId))].map((objectId) => ({ objectId, atomCount: selected.atoms.filter((atom) => atom.objectId === objectId).length }));
    const items = rows.slice(offset, offset + limit); return { ok: true, level, total: rows.length, items, nextCursor: offset + items.length < rows.length ? `${session.revision}:${offset + items.length}` : null, sceneRevision: session.revision };
  }

  private measure(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const count = args.kind === "distance" ? 2 : args.kind === "angle" ? 3 : args.kind === "dihedral" ? 4 : 0;
    if (!count) return failure("MEASUREMENT_KIND_UNSUPPORTED", "Measurement kind must be distance, angle, or dihedral.");
    if (!Array.isArray(args.targets) || args.targets.length !== count) return failure("MEASUREMENT_TARGET_COUNT_INVALID", `${String(args.kind)} requires exactly ${count} targets.`);
    const resolved: Atom[][] = [];
    for (const target of args.targets) { const result = selectAtoms(session, target); if (isFailure(result)) return result; if (!result.atoms.length) return failure("MEASUREMENT_TARGET_EMPTY", "Every target must resolve to atoms."); resolved.push(result.atoms); }
    const points = resolved.map(centroid), value = args.kind === "distance" ? distance(points[0]!, points[1]!) : args.kind === "angle" ? angle(points[0]!, points[1]!, points[2]!) : dihedral(points[0]!, points[1]!, points[2]!, points[3]!);
    if (!Number.isFinite(value)) return failure("MEASUREMENT_GEOMETRY_DEGENERATE", "The target geometry does not define a finite value.");
    const units = args.kind === "distance" ? "angstrom" : "degree", targets = resolved.map((atoms) => atoms.length === 1 ? { source: "atom", atomId: atomKey(atoms[0]!), atomName: atoms[0]!.name, residue: residueKey(atoms[0]!), objectId: atoms[0]!.objectId, atomCount: 1 } : { source: "centroid", atomCount: atoms.length, objectIds: [...new Set(atoms.map((atom) => atom.objectId))] });
    const measurement: Record<string, unknown> = { id: typeof args.id === "string" ? args.id : crypto.randomUUID(), kind: args.kind, value, units, targets, provenance: "Cartesian geometry from the requested SelectionExpr targets" }; if (args.kind === "distance") measurement.distanceAngstrom = value; else measurement.angleDegrees = value;
    recordMutation(session); session.measurements.push(measurement); session.revision += 1; return { ok: true, measurement, appliedRevision: session.revision };
  }

  private contacts(session: StructureSession, selections: unknown[], cutoff: number): Record<string, unknown> | ScienceFailure {
    if (selections.length !== 2) return failure("ANALYSIS_SELECTION_COUNT_INVALID", "Contacts requires exactly two selections.");
    if (!Number.isFinite(cutoff) || cutoff < 0) return failure("ANALYSIS_OPTION_INVALID", "Contact distance must be non-negative and finite.");
    const a = selectAtoms(session, selections[0]), b = selectAtoms(session, selections[1]); if (isFailure(a)) return a; if (isFailure(b)) return b; if (!a.atoms.length || !b.atoms.length) return failure("CONTACT_TARGET_EMPTY", "Both contact selections must resolve to atoms.");
    const bIds = new Set(b.atoms.map(atomKey)), overlap = a.atoms.filter((atom) => bIds.has(atomKey(atom))); if (overlap.length) return failure("ANALYSIS_TARGET_OVERLAP", "Contact selections must be atom-disjoint.", { overlapAtomCount: overlap.length });
    let atomContactCount = 0; const residuePairs = new Map<string, { first: string; second: string; closestDistanceAngstrom: number }>(), contacts: Record<string, unknown>[] = [];
    for (const first of a.atoms) for (const second of b.atoms) { const separation = distance(first, second); if (separation > cutoff) continue; atomContactCount += 1; const key = `${scopedResidueKey(first)}|${scopedResidueKey(second)}`, prior = residuePairs.get(key); if (!prior || separation < prior.closestDistanceAngstrom) residuePairs.set(key, { first: scopedResidueKey(first), second: scopedResidueKey(second), closestDistanceAngstrom: separation }); if (contacts.length < 500) contacts.push({ first: { atomId: atomKey(first), atom: first.name }, second: { atomId: atomKey(second), atom: second.name }, distanceAngstrom: separation }); }
    return { ok: true, kind: "contacts", thresholdAngstrom: cutoff, atomContactCount, residuePairCount: residuePairs.size, residuePairs: [...residuePairs.values()], contacts, truncated: atomContactCount > 500, provenance: "All cross-selection atom pairs at Euclidean distance within the requested cutoff" };
  }

  private clashes(session: StructureSession, selections: unknown[], scale: number): Record<string, unknown> | ScienceFailure {
    if (selections.length !== 2) return failure("ANALYSIS_SELECTION_COUNT_INVALID", "Clashes requires exactly two selections.");
    if (!Number.isFinite(scale) || scale <= 0 || scale > 1.5) return failure("ANALYSIS_OPTION_INVALID", "clashScale must be a finite number from 0 through 1.5.");
    const first = selectAtoms(session, selections[0]), second = selectAtoms(session, selections[1]); if (isFailure(first)) return first; if (isFailure(second)) return second;
    const secondIds = new Set(second.atoms.map(atomKey)); if (first.atoms.some((atom) => secondIds.has(atomKey(atom)))) return failure("ANALYSIS_TARGET_OVERLAP", "Clash selections must be atom-disjoint.");
    let count = 0; const rows: Array<Record<string, unknown>> = [];
    for (const a of first.atoms) for (const b of second.atoms) { const threshold = (vdw(a) + vdw(b)) * scale, observed = distance(a, b); if (observed >= threshold) continue; count += 1; if (rows.length < 500) rows.push({ firstAtomId: atomKey(a), secondAtomId: atomKey(b), distanceAngstrom: observed, thresholdAngstrom: threshold, overlapAngstrom: threshold - observed }); }
    return { ok: true, kind: "clashes", clashCount: count, clashes: rows, truncated: count > rows.length, scale, provenance: "Cross-selection van der Waals overlap using element radii and the requested clash scale" };
  }

  private hydrogenBonds(session: StructureSession, selections: unknown[], cutoff: number): Record<string, unknown> | ScienceFailure {
    if (selections.length !== 2) return failure("ANALYSIS_SELECTION_COUNT_INVALID", "hydrogen_bonds requires exactly two selections.");
    if (!Number.isFinite(cutoff) || cutoff < 2 || cutoff > 4) return failure("ANALYSIS_OPTION_INVALID", "hydrogenBondDistanceAngstrom must be between 2 and 4.");
    const first = selectAtoms(session, selections[0]), second = selectAtoms(session, selections[1]); if (isFailure(first)) return first; if (isFailure(second)) return second;
    const secondIds = new Set(second.atoms.map(atomKey)); if (first.atoms.some((atom) => secondIds.has(atomKey(atom)))) return failure("ANALYSIS_TARGET_OVERLAP", "Hydrogen-bond selections must be atom-disjoint.");
    const donors = first.atoms.filter((atom) => ["N", "O", "S"].includes(atom.element.toUpperCase())), acceptors = second.atoms.filter((atom) => ["N", "O", "S"].includes(atom.element.toUpperCase())); const rows: Array<Record<string, unknown>> = [];
    for (const donor of donors) for (const acceptor of acceptors) { const separation = distance(donor, acceptor); if (separation < 2.4 || separation > cutoff) continue; if (rows.length < 500) rows.push({ donor: { atomId: atomKey(donor), element: donor.element, residue: residueKey(donor) }, acceptor: { atomId: atomKey(acceptor), element: acceptor.element, residue: residueKey(acceptor) }, distanceAngstrom: separation, geometry: "heavy-atom candidate; explicit hydrogens and donor angle are unavailable in this coordinate source" }); }
    return { ok: true, kind: "hydrogen_bonds", candidateCount: rows.length, hydrogenBonds: rows, truncated: false, assumption: "Candidate hydrogen bonds are identified by N/O/S heavy-atom chemistry and distance only; they are not valence- or angle-confirmed hydrogen bonds.", provenance: "Coordinate-derived donor/acceptor heavy-atom candidate screen" };
  }

  private rmsd(session: StructureSession, selections: unknown[]): Record<string, unknown> | ScienceFailure {
    if (selections.length !== 2) return failure("ANALYSIS_SELECTION_COUNT_INVALID", "RMSD requires exactly two selections.");
    const mobile = selectAtoms(session, selections[0]), reference = selectAtoms(session, selections[1]); if (isFailure(mobile)) return mobile; if (isFailure(reference)) return reference;
    const lookup = new Map(reference.atoms.map((atom) => [atomIdentity(atom), atom])); const pairs = mobile.atoms.map((atom) => ({ mobile: atom, reference: lookup.get(atomIdentity(atom)) })).filter((pair): pair is { mobile: Atom; reference: Atom } => Boolean(pair.reference));
    if (pairs.length < 3) return failure("RMSD_CORRESPONDENCE_INSUFFICIENT", "At least three stable atom identities are required for RMSD.", { matchedAtomCount: pairs.length });
    const fit = kabsch(pairs.map((pair) => pair.mobile), pairs.map((pair) => pair.reference)); return { ok: true, kind: "rmsd", rmsdAngstrom: fit.rmsd, matchedAtomCount: pairs.length, matrix: fit.matrix, provenance: "Least-squares RMSD over matching chain, residue, component, and atom identities; no transformation was applied." };
  }

  private sasa(session: StructureSession, selection: unknown, probe: number): Record<string, unknown> | ScienceFailure {
    const result = selectAtoms(session, selection); if (isFailure(result)) return result; if (!result.atoms.length) return failure("ANALYSIS_TARGET_EMPTY", "SASA selection is empty."); if (result.atoms.length > 2500) return failure("SASA_ATOM_LIMIT_EXCEEDED", "Local Shrake-Rupley analysis supports at most 2,500 selected atoms.", { atomCount: result.atoms.length, maximum: 2500 });
    let accessible = 0;
    for (let index = 0; index < result.atoms.length; index += 1) { const atom = result.atoms[index]!, radius = vdw(atom) + probe; for (const point of spherePoints) { const sample = { x: atom.x + point[0] * radius, y: atom.y + point[1] * radius, z: atom.z + point[2] * radius }; if (!result.atoms.some((other, otherIndex) => otherIndex !== index && distance(sample, other) < vdw(other) + probe)) accessible += 1; } }
    const area = result.atoms.reduce((sum, atom) => sum + 4 * Math.PI * (vdw(atom) + probe) ** 2, 0) * accessible / (result.atoms.length * spherePoints.length); return { ok: true, kind: "sasa", areaSquareAngstrom: area, atomCount: result.atoms.length, probeRadiusAngstrom: probe, samplesPerAtom: spherePoints.length, provenance: "Local Shrake-Rupley solvent-accessible surface area with deterministic Fibonacci sphere samples" };
  }

  private analyze(args: Record<string, unknown>, session: StructureSession, signal: AbortSignal): Record<string, unknown> | ScienceFailure {
    checkAbort(signal); const stale = revisionCheck(args, session); if (stale) return stale;
    if (typeof args.kind !== "string") return failure("ANALYSIS_KIND_REQUIRED", "Analysis kind is required.");
    if (!Array.isArray(args.selections)) return failure("ANALYSIS_SELECTIONS_REQUIRED", "Analysis selections must be supplied explicitly.");
    const options = args.options && typeof args.options === "object" ? args.options as Record<string, unknown> : {};
    if (args.kind === "contacts") return this.contacts(session, args.selections, Number(options.contactDistanceAngstrom ?? 4));
    if (args.kind === "clashes") return this.clashes(session, args.selections, Number(options.clashScale ?? .75));
    if (args.kind === "hydrogen_bonds") return this.hydrogenBonds(session, args.selections, Number(options.hydrogenBondDistanceAngstrom ?? 3.5));
    if (args.kind === "rmsd") return this.rmsd(session, args.selections);
    if (args.kind === "centroid") { if (args.selections.length !== 1) return failure("ANALYSIS_SELECTION_COUNT_INVALID", "Centroid requires exactly one selection."); const result = selectAtoms(session, args.selections[0]); if (isFailure(result)) return result; if (!result.atoms.length) return failure("ANALYSIS_TARGET_EMPTY", "Centroid selection is empty."); return { ok: true, kind: "centroid", atomCount: result.atoms.length, centroid: centroid(result.atoms), provenance: "Arithmetic centroid of the requested SelectionExpr" }; }
    if (args.kind === "principal_axes" || args.kind === "best_fit_plane") { if (args.selections.length !== 1) return failure("ANALYSIS_SELECTION_COUNT_INVALID", `${args.kind} requires exactly one selection.`); const result = selectAtoms(session, args.selections[0]); if (isFailure(result)) return result; if (result.atoms.length < 3) return failure("ANALYSIS_TARGET_EMPTY", `${args.kind} requires at least three atoms.`); const geometry = principalGeometry(result.atoms); return args.kind === "principal_axes" ? { ok: true, kind: "principal_axes", atomCount: result.atoms.length, centroid: centroid(result.atoms), eigenvalues: geometry.values, axes: geometry.axes, provenance: "Eigenvectors of the coordinate covariance matrix" } : { ok: true, kind: "best_fit_plane", atomCount: result.atoms.length, centroid: centroid(result.atoms), normal: geometry.axes[2], eigenvalues: geometry.values, provenance: "Least-variance covariance eigenvector as best-fit plane normal" }; }
    if (args.kind === "sasa") { if (args.selections.length !== 1) return failure("ANALYSIS_SELECTION_COUNT_INVALID", "SASA requires exactly one selection."); const probe = Number(options.probeRadiusAngstrom ?? 1.4); if (!Number.isFinite(probe) || probe <= 0 || probe > 5) return failure("ANALYSIS_OPTION_INVALID", "probeRadiusAngstrom must be a finite number from 0 through 5."); return this.sasa(session, args.selections[0], probe); }
    if (args.kind === "buried_area") { if (args.selections.length !== 2) return failure("ANALYSIS_SELECTION_COUNT_INVALID", "buried_area requires two atom-disjoint selections."); const first = selectAtoms(session, args.selections[0]), second = selectAtoms(session, args.selections[1]); if (isFailure(first)) return first; if (isFailure(second)) return second; const secondIds = new Set(second.atoms.map(atomKey)); if (first.atoms.some((atom) => secondIds.has(atomKey(atom)))) return failure("ANALYSIS_TARGET_OVERLAP", "buried_area selections must be atom-disjoint."); const probe = Number(options.probeRadiusAngstrom ?? 1.4); const firstSasa = this.sasa(session, { kind: "atom_ids", atomIds: first.atoms.map(atomKey) }, probe), secondSasa = this.sasa(session, { kind: "atom_ids", atomIds: second.atoms.map(atomKey) }, probe), combinedSasa = this.sasa(session, { kind: "atom_ids", atomIds: [...first.atoms, ...second.atoms].map(atomKey) }, probe); if (isFailure(firstSasa)) return firstSasa; if (isFailure(secondSasa)) return secondSasa; if (isFailure(combinedSasa)) return combinedSasa; const loss = Number(firstSasa.areaSquareAngstrom) + Number(secondSasa.areaSquareAngstrom) - Number(combinedSasa.areaSquareAngstrom); return { ok: true, kind: "buried_area", interfaceAreaSquareAngstrom: loss / 2, totalSasaLossSquareAngstrom: loss, componentSasaSquareAngstrom: { first: firstSasa.areaSquareAngstrom, second: secondSasa.areaSquareAngstrom, combined: combinedSasa.areaSquareAngstrom }, probeRadiusAngstrom: probe, samplesPerAtom: spherePoints.length, provenance: "Half of the Shrake-Rupley SASA loss across two explicit atom-disjoint selections" }; }
    return failure("ANALYSIS_ENGINE_UNAVAILABLE", `Analysis ${args.kind} is unavailable locally; no value was produced.`, { kind: args.kind, selectionCount: args.selections.length });
  }

  private applyScene(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    if (args.atomic !== undefined && args.atomic !== true) return failure("ATOMIC_SCENE_REQUIRED", "apply_scene supports only atomic=true.");
    if (args.dryRun !== undefined && typeof args.dryRun !== "boolean") return failure("DRY_RUN_INVALID", "dryRun must be boolean.");
    if (Array.isArray(args.layers)) for (const layer of args.layers) { if (!layer || typeof layer !== "object") return failure("SCENE_LAYER_INVALID", "Every layer must be an object."); const item = layer as Record<string, unknown>, expression = item.expression ?? item.selection; if (expression !== undefined) { const result = selectAtoms(session, expression); if (isFailure(result)) return result; } }
    if (args.dryRun === true) return { ok: true, dryRun: true, atomic: true, valid: true, sceneRevision: session.revision, wouldApply: { background: args.background ?? null, layerCount: Array.isArray(args.layers) ? args.layers.length : 0 } };
    recordMutation(session); const primary = session.objects.get("primary"); if (args.background === "dark" || args.background === "light") session.background = args.background; if (args.lighting === "flat" || args.lighting === "soft" || args.lighting === "studio") session.lighting = args.lighting;
    if (Array.isArray(args.layers)) { if (args.replaceLayers === true) session.layers = []; session.layers.push(...structuredClone(args.layers as Array<Record<string, unknown>>)); }
    if (Array.isArray(args.annotations)) { if (args.replaceAnnotations === true) session.annotations = []; session.annotations.push(...structuredClone(args.annotations as Array<Record<string, unknown>>)); }
    if (primary && Array.isArray(args.layers) && args.layers[0] && typeof args.layers[0] === "object" && typeof (args.layers[0] as Record<string, unknown>).representation === "string") primary.representation = (args.layers[0] as Record<string, unknown>).representation as string;
    if (Array.isArray(args.objectUpdates)) for (const update of args.objectUpdates) { if (!update || typeof update !== "object") continue; const item = update as Record<string, unknown>, object = typeof item.objectId === "string" ? session.objects.get(item.objectId) : undefined; if (!object) continue; if (typeof item.visible === "boolean") object.visible = item.visible; if (typeof item.color === "string") object.color = item.color; if (typeof item.representation === "string") object.representation = item.representation; }
    session.revision += 1; return { ok: true, applied: true, atomic: true, appliedRevision: session.revision, state: summary(session) };
  }

  private scene(operation: string, args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    if (operation === "list_scenes") return { ok: true, scenes: [...session.scenes.entries()].map(([name, scene]) => ({ name, scene })) };
    const stale = revisionCheck(args, session); if (stale) return stale;
    const name = typeof args.name === "string" ? args.name : ""; if (!name) return failure("SCENE_NAME_REQUIRED", "A scene name is required.");
    if (operation === "save_scene") { recordMutation(session); session.scenes.set(name, { savedRevision: session.revision, snapshot: takeSnapshot(session) }); session.revision += 1; return { ok: true, name, sceneRevision: session.revision, appliedRevision: session.revision }; }
    if (operation === "delete_scene") { if (!session.scenes.has(name)) return failure("SCENE_NOT_FOUND", `No saved scene named ${name}.`); recordMutation(session); session.scenes.delete(name); session.revision += 1; return { ok: true, name, deleted: true, appliedRevision: session.revision }; }
    const saved = session.scenes.get(name); if (!saved) return failure("SCENE_NOT_FOUND", `No saved scene named ${name}.`); const snapshot = saved.snapshot; if (!snapshot || typeof snapshot !== "object") return failure("SCENE_INVALID", `Saved scene ${name} does not contain a restorable scene state.`); recordMutation(session); restoreSnapshot(session, structuredClone(snapshot) as SessionSnapshot); session.scenes.set(name, saved); session.revision += 1; return { ok: true, name, restored: true, scene: summary(session), appliedRevision: session.revision };
  }

  private object(operation: string, args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    if (operation === "align_structures") return this.align(args, session);
    const objectId = typeof args.objectId === "string" ? args.objectId : "", object = session.objects.get(objectId); if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No object named ${objectId}.`);
    if (operation === "set_object_visibility") { if (typeof args.visible !== "boolean") return failure("VISIBILITY_REQUIRED", "visible must be boolean."); recordMutation(session); object.visible = args.visible; session.revision += 1; return { ok: true, objectId, visible: object.visible, appliedRevision: session.revision }; }
    if (objectId === "primary") return failure("PRIMARY_OBJECT_IMMUTABLE", "The primary object cannot be removed."); recordMutation(session); session.objects.delete(objectId); session.selected = session.selected.filter((atom) => atom.objectId !== objectId); session.focus = session.focus.filter((atom) => atom.objectId !== objectId); session.revision += 1; return { ok: true, objectId, removed: true, appliedRevision: session.revision };
  }

  private align(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    if (!args.mobile || typeof args.mobile !== "object" || !args.reference || typeof args.reference !== "object") return failure("ALIGNMENT_TARGETS_REQUIRED", "mobile and reference are required.");
    const mobile = args.mobile as Record<string, unknown>, reference = args.reference as Record<string, unknown>;
    if (typeof mobile.objectId !== "string" || typeof reference.objectId !== "string") return failure("ALIGNMENT_OBJECT_ID_REQUIRED", "Both targets must include objectId.");
    if (mobile.objectId === reference.objectId) return failure("ALIGNMENT_OBJECTS_MUST_DIFFER", "Mobile and reference objects must differ.");
    const method = args.method ?? "structure"; if (!["structure", "sequence", "atoms"].includes(String(method))) return failure("ALIGNMENT_METHOD_INVALID", "Alignment method is invalid.");
    const mobileSelection = selectAtoms(session, mobile, mobile.objectId), referenceSelection = selectAtoms(session, reference, reference.objectId); if (isFailure(mobileSelection)) return mobileSelection; if (isFailure(referenceSelection)) return referenceSelection;
    const mobileCandidates = method === "atoms" ? mobileSelection.atoms : mobileSelection.atoms.filter((atom) => atom.name === "CA"), referenceCandidates = method === "atoms" ? referenceSelection.atoms : referenceSelection.atoms.filter((atom) => atom.name === "CA");
    const lookup = new Map(referenceCandidates.map((atom) => [method === "atoms" ? atomIdentity(atom) : `${atom.chain}:${atom.residue}:${atom.resName}`, atom]));
    const pairs = mobileCandidates.map((atom) => ({ mobile: atom, reference: lookup.get(method === "atoms" ? atomIdentity(atom) : `${atom.chain}:${atom.residue}:${atom.resName}`) })).filter((pair): pair is { mobile: Atom; reference: Atom } => Boolean(pair.reference));
    if (pairs.length < 3) return failure("ALIGNMENT_ENGINE_UNAVAILABLE", "At least three stable coordinate correspondences are required; no transform was applied.", { mobileCandidateCount: mobileCandidates.length, referenceCandidateCount: referenceCandidates.length, matchedAtomCount: pairs.length, method });
    const fit = kabsch(pairs.map((pair) => pair.mobile), pairs.map((pair) => pair.reference)), object = session.objects.get(mobile.objectId)!; recordMutation(session); object.transform = multiplyMatrices(fit.matrix, object.transform ?? identityMatrix());
    for (const atom of object.atoms) { const x = fit.rotation[0]![0]! * atom.x + fit.rotation[0]![1]! * atom.y + fit.rotation[0]![2]! * atom.z + fit.translation[0]!, y = fit.rotation[1]![0]! * atom.x + fit.rotation[1]![1]! * atom.y + fit.rotation[1]![2]! * atom.z + fit.translation[1]!, z = fit.rotation[2]![0]! * atom.x + fit.rotation[2]![1]! * atom.y + fit.rotation[2]![2]! * atom.z + fit.translation[2]!; atom.x = x; atom.y = y; atom.z = z; }
    session.revision += 1;
    const d0 = Math.max(.5, 1.24 * Math.cbrt(Math.max(1, pairs.length) - 15) - 1.8), directionalMobile = pairs.reduce((sum, pair) => sum + 1 / (1 + (distance(pair.mobile, pair.reference) / d0) ** 2), 0) / Math.max(1, mobileCandidates.length), directionalReference = pairs.reduce((sum, pair) => sum + 1 / (1 + (distance(pair.mobile, pair.reference) / d0) ** 2), 0) / Math.max(1, referenceCandidates.length);
    return { ok: true, method, alignedResidueCount: method === "atoms" ? undefined : pairs.length, alignedAtomCount: pairs.length, rmsdAngstrom: fit.rmsd, matrix: fit.matrix, tmScore: method === "atoms" ? null : { mobileNormalized: directionalMobile, referenceNormalized: directionalReference, model: "TM-score coordinate formula over local correspondence; this is not an external TM-align execution" }, correspondence: { kind: method === "atoms" ? "stable-author-atom" : "stable-author-residue-C-alpha", count: pairs.length, mobileObjectId: mobile.objectId, referenceObjectId: reference.objectId, pairs: pairs.slice(0, 500).map((pair) => ({ mobileAtomId: atomKey(pair.mobile), referenceAtomId: atomKey(pair.reference), chain: pair.mobile.chain, residue: pair.mobile.residue, compId: pair.mobile.resName })), truncated: pairs.length > 500 }, implementation: { engine: "DSH-Rosalind local Kabsch", version: "1.1.0", scoreModel: method === "atoms" ? null : "TM-score coordinate formula" }, appliedRevision: session.revision, provenance: "Coordinate-derived least-squares superposition over explicit stable identities" };
  }

  private transform(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const objectId = typeof args.objectId === "string" ? args.objectId : "", object = session.objects.get(objectId);
    if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No object named ${objectId}.`);
    if (!args.transform || typeof args.transform !== "object") return failure("TRANSFORM_INVALID", "A typed transform is required.");
    const transform = args.transform as Record<string, unknown>, mode = args.mode ?? "relative";
    if (mode !== "relative" && mode !== "absolute") return failure("TRANSFORM_MODE_INVALID", "Transform mode must be relative or absolute.");
    const source = (mode === "absolute" ? object.baseAtoms : object.atoms).map((atom) => ({ ...atom }));
    let matrix: number[];
    if (transform.kind === "matrix") {
      if (!Array.isArray(transform.values) || transform.values.length !== 16 || transform.values.some((value) => typeof value !== "number" || !Number.isFinite(value))) return failure("TRANSFORM_INVALID", "Matrix transform requires 16 finite values.");
      matrix = [...transform.values] as number[];
      if (Math.abs(matrix[12]!) > 1e-12 || Math.abs(matrix[13]!) > 1e-12 || Math.abs(matrix[14]!) > 1e-12 || Math.abs(matrix[15]! - 1) > 1e-12) return failure("TRANSFORM_INVALID", "Only affine 4x4 matrices with final row 0,0,0,1 are supported.");
    } else if (transform.kind === "components") {
      const center = centroid(source), pivot = transform.pivot === undefined || transform.pivot === "object_center" ? [center.x, center.y, center.z] : transform.pivot;
      if (!Array.isArray(pivot) || pivot.length !== 3 || pivot.some((value) => typeof value !== "number" || !Number.isFinite(value))) return failure("TRANSFORM_INVALID", "Transform pivot must be object_center or three finite values.");
      const translation = transform.translation ?? [0, 0, 0], rawScale = transform.scale ?? 1, scale = typeof rawScale === "number" ? [rawScale, rawScale, rawScale] : rawScale;
      if (!Array.isArray(translation) || translation.length !== 3 || translation.some((value) => typeof value !== "number" || !Number.isFinite(value)) || !Array.isArray(scale) || scale.length !== 3 || scale.some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0)) return failure("TRANSFORM_INVALID", "Translation and scale components are invalid.");
      let rotation = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      if (transform.rotation !== undefined) {
        if (!transform.rotation || typeof transform.rotation !== "object") return failure("TRANSFORM_INVALID", "Rotation must contain axis and degrees.");
        const value = transform.rotation as Record<string, unknown>, axis = value.axis;
        if (!Array.isArray(axis) || axis.length !== 3 || axis.some((entry) => typeof entry !== "number" || !Number.isFinite(entry)) || typeof value.degrees !== "number" || !Number.isFinite(value.degrees) || norm(axis as number[]) < 1e-12) return failure("TRANSFORM_INVALID", "Rotation requires a non-zero finite axis and finite degrees.");
        const [x, y, z] = (axis as number[]).map((entry) => entry / norm(axis as number[])), angle = value.degrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), v = 1 - c;
        rotation = [[x! * x! * v + c, x! * y! * v - z! * s, x! * z! * v + y! * s], [y! * x! * v + z! * s, y! * y! * v + c, y! * z! * v - x! * s], [z! * x! * v - y! * s, z! * y! * v + x! * s, z! * z! * v + c]];
      }
      const rs = rotation.map((row) => row.map((value, column) => value * (scale as number[])[column]!));
      const offset = [0, 1, 2].map((row) => (pivot as number[])[row]! + (translation as number[])[row]! - rs[row]!.reduce((sum, value, column) => sum + value * (pivot as number[])[column]!, 0));
      matrix = [rs[0]![0]!, rs[0]![1]!, rs[0]![2]!, offset[0]!, rs[1]![0]!, rs[1]![1]!, rs[1]![2]!, offset[1]!, rs[2]![0]!, rs[2]![1]!, rs[2]![2]!, offset[2]!, 0, 0, 0, 1];
    } else return failure("TRANSFORM_INVALID", `Unsupported transform kind ${String(transform.kind)}.`);
    recordMutation(session);
    object.atoms = source.map((atom) => ({ ...atom, x: matrix[0]! * atom.x + matrix[1]! * atom.y + matrix[2]! * atom.z + matrix[3]!, y: matrix[4]! * atom.x + matrix[5]! * atom.y + matrix[6]! * atom.z + matrix[7]!, z: matrix[8]! * atom.x + matrix[9]! * atom.y + matrix[10]! * atom.z + matrix[11]! }));
    object.transform = mode === "absolute" ? matrix : multiplyMatrices(matrix, object.transform ?? identityMatrix()); session.revision += 1;
    return { ok: true, objectId, mode, matrix: object.transform, appliedMatrix: matrix, atomCount: object.atoms.length, appliedRevision: session.revision, implementation: { engine: "DSH-Rosalind affine coordinates", version: "1.0.0" } };
  }

  private derive(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const objectId = typeof args.objectId === "string" ? args.objectId : "", sourceId = typeof args.sourceObjectId === "string" ? args.sourceObjectId : "primary", source = session.objects.get(sourceId);
    if (!/^[a-z][a-z0-9_-]*$/.test(objectId) || objectId === "primary") return failure("OBJECT_ID_INVALID", "Derived objectId is invalid.");
    if (!source) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No source object named ${sourceId}.`); if (session.objects.has(objectId)) return failure("OBJECT_ID_IN_USE", `Object ${objectId} already exists.`);
    if (!Array.isArray(args.operations) || !args.operations.length) return failure("DERIVATION_OPERATIONS_REQUIRED", "At least one derivation operation is required.");
    const derived = cloneObject(source); derived.id = objectId; derived.label = typeof args.label === "string" ? args.label : objectId; derived.dirty = true; derived.operationLog = []; derived.atoms.forEach((atom) => { atom.objectId = objectId; }); derived.baseAtoms.forEach((atom) => { atom.objectId = objectId; });
    const temporary = { ...session, objects: new Map(session.objects).set(objectId, derived) };
    for (const rawOperation of args.operations) {
      if (!rawOperation || typeof rawOperation !== "object") return failure("DERIVATION_OPERATION_INVALID", "Every derivation operation must be typed.");
      const operation = rawOperation as Record<string, unknown>;
      if (operation.kind === "rename_chain") {
        if (typeof operation.from !== "string" || typeof operation.to !== "string") return failure("DERIVATION_OPERATION_INVALID", "rename_chain requires from and to.");
        derived.atoms.filter((atom) => atom.chain === operation.from).forEach((atom) => { atom.chain = operation.to as string; });
      } else if (["delete_atoms", "rename_residue", "translate"].includes(String(operation.kind))) {
        const selected = selectAtoms(temporary, operation.target, objectId); if (isFailure(selected)) return selected; const serials = new Set(selected.atoms.map((atom) => atom.serial));
        if (operation.kind === "delete_atoms") derived.atoms = derived.atoms.filter((atom) => !serials.has(atom.serial));
        else if (operation.kind === "rename_residue") { if (typeof operation.compId !== "string") return failure("DERIVATION_OPERATION_INVALID", "rename_residue requires compId."); derived.atoms.filter((atom) => serials.has(atom.serial)).forEach((atom) => { atom.resName = operation.compId as string; }); }
        else { if (!Array.isArray(operation.vector) || operation.vector.length !== 3 || operation.vector.some((value) => typeof value !== "number" || !Number.isFinite(value))) return failure("DERIVATION_OPERATION_INVALID", "translate requires three finite values."); derived.atoms.filter((atom) => serials.has(atom.serial)).forEach((atom) => { atom.x += (operation.vector as number[])[0]!; atom.y += (operation.vector as number[])[1]!; atom.z += (operation.vector as number[])[2]!; }); }
      } else return failure("DERIVATION_OPERATION_INVALID", `Unsupported derivation operation ${String(operation.kind)}.`);
      derived.operationLog.push(structuredClone(operation));
    }
    derived.baseAtoms = derived.atoms.map((atom) => ({ ...atom })); recordMutation(session); session.objects.set(objectId, derived); session.revision += 1;
    return { ok: true, object: { id: objectId, sourceObjectId: sourceId, label: derived.label, atomCount: derived.atoms.length, dirty: true, operationLog: derived.operationLog }, appliedRevision: session.revision };
  }

  private history(operation: string, args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const source = operation === "undo" ? session.undoStack : session.redoStack, destination = operation === "undo" ? session.redoStack : session.undoStack;
    const snapshot = source.pop(); if (!snapshot) return failure(operation === "undo" ? "UNDO_EMPTY" : "REDO_EMPTY", `There is no scene mutation to ${operation}.`);
    destination.push(takeSnapshot(session)); restoreSnapshot(session, snapshot); session.revision += 1;
    return { ok: true, action: operation, appliedRevision: session.revision, history: { undoCount: session.undoStack.length, redoCount: session.redoStack.length }, state: summary(session) };
  }

  private guides(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    if (!args.operation || typeof args.operation !== "object") return failure("GUIDE_OPERATION_INVALID", "A typed guide operation is required.");
    const operation = args.operation as Record<string, unknown>;
    if (operation.kind === "clear") { recordMutation(session); const removed = session.guides.size; session.guides.clear(); session.revision += 1; return { ok: true, cleared: removed, guides: [], appliedRevision: session.revision }; }
    if (operation.kind === "delete") { if (typeof operation.id !== "string" || !session.guides.has(operation.id)) return failure("GUIDE_NOT_FOUND", `No guide named ${String(operation.id)}.`); recordMutation(session); session.guides.delete(operation.id); session.revision += 1; return { ok: true, deleted: operation.id, guides: [...session.guides.values()], appliedRevision: session.revision }; }
    if (operation.kind === "update") {
      if (typeof operation.id !== "string") return failure("GUIDE_OPERATION_INVALID", "Guide update requires id."); const guide = session.guides.get(operation.id); if (!guide) return failure("GUIDE_NOT_FOUND", `No guide named ${operation.id}.`); recordMutation(session);
      if (typeof operation.label === "string") guide.label = operation.label; if (typeof operation.visible === "boolean") guide.visible = operation.visible; if (typeof operation.color === "string") guide.color = operation.color; if (typeof operation.opacity === "number") guide.opacity = operation.opacity; session.revision += 1; return { ok: true, guide, appliedRevision: session.revision };
    }
    if (operation.kind !== "create" || (operation.guideKind !== "label" && operation.guideKind !== "plane" && operation.guideKind !== "orientation")) return failure("GUIDE_OPERATION_INVALID", "Guide create requires label, plane, or orientation kind.");
    const selected = operation.target === undefined ? { atoms: [...session.selected] } : selectAtoms(session, operation.target); if (isFailure(selected)) return selected; if (!selected.atoms.length) return failure("GUIDE_TARGET_EMPTY", "Guide target resolved to no atoms.");
    const center = centroid(selected.atoms), id = typeof operation.id === "string" ? operation.id : `guide-${session.guides.size + 1}`; if (session.guides.has(id)) return failure("GUIDE_ID_IN_USE", `Guide ${id} already exists.`);
    let normal: number[] | undefined, axes: number[][] | undefined;
    if (operation.guideKind === "plane" || operation.guideKind === "orientation") {
      if (selected.atoms.length < 3) return failure("GUIDE_GEOMETRY_DEGENERATE", "Plane and orientation guides require at least three non-collinear atoms.");
      const geometry = principalGeometry(selected.atoms); if (geometry.values[1]! < 1e-10) return failure("GUIDE_GEOMETRY_DEGENERATE", "Plane and orientation guides require at least three non-collinear atoms.");
      if (operation.guideKind === "plane") normal = geometry.axes[2]; else axes = geometry.axes;
    }
    const guide: GuideState = { id, kind: operation.guideKind, label: typeof operation.label === "string" ? operation.label : null, visible: operation.visible !== false, color: typeof operation.color === "string" ? operation.color : "#33aaff", opacity: typeof operation.opacity === "number" ? operation.opacity : 1, targetAtomIds: selected.atoms.map(atomKey), centroid: center, ...(normal ? { normal } : {}), ...(axes ? { axes } : {}) };
    recordMutation(session); session.guides.set(id, guide); session.revision += 1; return { ok: true, guide: { id: guide.id, kind: guide.kind, label: guide.label, visible: guide.visible, color: guide.color, opacity: guide.opacity, atomCount: guide.targetAtomIds.length }, appliedRevision: session.revision, geometry: { computed: true, method: operation.guideKind === "label" ? "centroid" : operation.guideKind === "plane" ? "covariance-best-fit-plane" : "covariance-principal-axes", coordinatesExposed: false } };
  }

  private quality(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const objectId = typeof args.objectId === "string" ? args.objectId : "", object = session.objects.get(objectId); if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No object named ${objectId}.`);
    const source = args.source && typeof args.source === "object" ? args.source as Record<string, unknown> : null;
    if (!source || (source.kind !== "embedded" && source.kind !== "wwpdb")) return failure("QUALITY_SOURCE_INVALID", "Quality source must be embedded or wwpdb.");
    if (source.kind === "wwpdb") return failure("QUALITY_DATA_UNAVAILABLE", "The wwPDB validation provider is unavailable in this local session; no report was invented.", { objectId, source: source.kind });
    const byResidue = new Map<string, { chain: string; residue: number; resName: string; values: number[] }>();
    for (const atom of object.atoms) {
      if (!isPolymerAtom(atom) || !Number.isFinite(atom.bFactor)) continue;
      const key = residueKey(atom), entry = byResidue.get(key) ?? { chain: atom.chain, residue: atom.residue, resName: atom.resName, values: [] }; entry.values.push(atom.bFactor!); byResidue.set(key, entry);
    }
    if (!byResidue.size) return failure("QUALITY_DATA_UNAVAILABLE", "The local coordinates contain no parseable embedded B-factor values.", { objectId, source: source.kind });
    const items = [...byResidue.values()].map((entry, residueIndex) => ({ residueIndex, chain: entry.chain, residue: entry.residue, compId: entry.resName, value: entry.values.reduce((sum, value) => sum + value, 0) / entry.values.length }));
    const metricId = "bfactor", offset = Number(args.offset ?? 0), limit = Number(args.limit ?? 500);
    if (!Number.isInteger(offset) || !Number.isInteger(limit) || offset < 0 || limit < 1 || limit > 500) return failure("QUALITY_PAGINATION_INVALID", "offset must be nonnegative and limit must be an integer from 1 through 500.");
    return { ok: true, objectId, metricId, items: items.slice(offset, offset + limit), total: items.length, nextCursor: offset + limit < items.length ? String(offset + limit) : null, metrics: [{ id: metricId, label: "PDB B-factor", units: "Å²", source: "embedded-coordinate-field" }], provenance: "Residue means computed from the genuine PDB atom B-factor field; this metric is not pLDDT or a wwPDB validation report." };
  }

  private setQuality(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const objectId = typeof args.objectId === "string" ? args.objectId : "", object = session.objects.get(objectId); if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No object named ${objectId}.`);
    if (args.metricId !== null && args.metricId !== undefined && args.metricId !== "bfactor") return failure("QUALITY_METRIC_NOT_LOADED", `Quality metric ${String(args.metricId)} has not been loaded; only embedded B-factor is locally available.`);
    if (args.metricId === "bfactor" && !object.atoms.some((atom) => Number.isFinite(atom.bFactor))) return failure("QUALITY_METRIC_NOT_LOADED", "This object has no embedded B-factor values.");
    recordMutation(session); object.qualityMetricId = args.metricId === "bfactor" ? "bfactor" : null; object.displayClashes = typeof args.displayClashes === "boolean" ? args.displayClashes : false; session.revision += 1;
    return { ok: true, objectId, metricId: object.qualityMetricId, displayClashes: object.displayClashes, appliedRevision: session.revision };
  }

  private actionVocabulary(session: StructureSession): Record<string, unknown> {
    return { ok: true, sceneRevision: session.revision, selectionLanguage: "StructureSelectionExprV1", implementation: { engine: "DSH-Rosalind typed local scene actions", version: "1.1.0", pymolEngine: false, rasterExport: true }, supportedActions: ["select", "focus", "show", "show_as", "hide", "color", "label", "object_visibility", "save_scene", "restore_scene", "undo", "redo", "derive_object", "measure", "analyze", "align", "workspace"], representations: ["cartoon", "backbone", "surface", "ball_and_stick", "sticks", "lines", "points", "spheres"], unsupportedActions: ["density-map-actions", "trajectory-animation"], unsupportedReason: "Local coordinate sessions do not include authenticated density, trajectory, or interactive Mol* rendering providers." };
  }

  private directAction(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    if (!args.action || typeof args.action !== "object") return failure("PYMOL_ACTION_INVALID", "A typed action is required.");
    const action = args.action as Record<string, unknown>, revisionArgs = { expectedRevision: args.expectedRevision };
    if (action.kind === "select" || action.kind === "focus") return this.setSelection({ ...revisionArgs, expression: action.target, mode: action.mode === "add" || action.mode === "subtract" || action.mode === "intersect" ? action.mode : "set", focus: action.kind === "focus" }, session);
    if (action.kind === "show" || action.kind === "show_as" || action.kind === "hide") { const selected = selectAtoms(session, action.target ?? { kind: "current_selection" }); if (isFailure(selected)) return selected; if (!selected.atoms.length) return failure("PYMOL_ACTION_TARGET_EMPTY", "The action target resolved to no atoms."); const id = typeof action.id === "string" ? action.id : `layer-${session.layers.length + 1}`; recordMutation(session); if (action.kind === "hide") session.layers = session.layers.filter((layer) => layer.id !== id); else { const layer = { id, target: { atomIds: selected.atoms.map(atomKey) }, representation: typeof action.representation === "string" ? action.representation : "sticks", visible: true, color: typeof action.color === "string" ? action.color : "element" }; if (action.kind === "show_as") session.layers = session.layers.filter((existing) => existing.id !== id); session.layers.push(layer); } session.revision += 1; return { ok: true, action: action.kind, layerId: id, targetAtomCount: selected.atoms.length, appliedRevision: session.revision };
    }
    if (action.kind === "color") { const object = typeof action.objectId === "string" ? session.objects.get(action.objectId) : session.objects.get("primary"); if (!object || typeof action.color !== "string") return failure("PYMOL_ACTION_INVALID", "color requires an existing object and color."); recordMutation(session); object.color = action.color; session.revision += 1; return { ok: true, action: "color", objectId: object.id, color: object.color, appliedRevision: session.revision }; }
    if (action.kind === "label") { const selected = selectAtoms(session, action.target ?? { kind: "current_selection" }); if (isFailure(selected)) return selected; if (!selected.atoms.length || typeof action.text !== "string") return failure("PYMOL_ACTION_INVALID", "label requires text and a nonempty target."); recordMutation(session); const id = typeof action.id === "string" ? action.id : `annotation-${session.annotations.length + 1}`; session.annotations.push({ id, text: action.text, targetAtomIds: selected.atoms.map(atomKey), mode: action.mode ?? "residue", visible: action.visible !== false }); session.revision += 1; return { ok: true, action: "label", annotationId: id, targetAtomCount: selected.atoms.length, appliedRevision: session.revision }; }
    if (action.kind === "workspace") return this.control({ action: "set_workspace_options", ...action }, session);
    if (action.kind === "object_visibility") return this.object("set_object_visibility", { objectId: action.objectId, visible: action.visible }, session);
    if (action.kind === "save_scene") return this.scene("save_scene", { ...revisionArgs, name: action.name }, session);
    if (action.kind === "restore_scene") return this.scene("load_scene", { ...revisionArgs, name: action.name }, session);
    if (action.kind === "undo" || action.kind === "redo") return this.history(action.kind, revisionArgs, session);
    if (action.kind === "derive_object") return this.derive({ ...revisionArgs, objectId: action.objectId, sourceObjectId: action.sourceObjectId, label: action.label ?? action.objectId, operations: action.operations }, session);
    if (action.kind === "measure") return this.measure({ ...revisionArgs, kind: action.measurement, targets: action.targets }, session);
    if (action.kind === "analyze") return this.analyze({ ...revisionArgs, kind: action.analysis, selections: action.selections ?? [], options: action.options }, session, new AbortController().signal);
    if (action.kind === "align") return this.align({ method: action.method, mobile: { kind: "all", objectId: action.mobileObjectId }, reference: { kind: "all", objectId: action.referenceObjectId } }, session);
    return failure("PYMOL_ACTION_UNAVAILABLE", `Typed action ${String(action.kind)} requires the mounted molecular viewer and was not applied.`, { pymolEngine: false });
  }

  private validateRender(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const request = args.request; if (!request || typeof request !== "object") return failure("RENDER_REQUEST_REQUIRED", "validate_render requires a render request.");
    const input = request as Record<string, unknown>, width = Number(input.width ?? 1920), height = Number(input.height ?? 1080); if (!Number.isInteger(width) || !Number.isInteger(height) || width < 128 || height < 128 || width > 4096 || height > 4096) return failure("RENDER_DIMENSIONS_INVALID", "Render dimensions must be integers from 128 through 4096.");
    if (input.scene && typeof input.scene === "object" && Object.keys(input.scene as Record<string, unknown>).length) return failure("RENDER_SCENE_FEATURE_UNAVAILABLE", "The local raster exporter uses the active scene only. Apply a scene first with structure.apply_scene; declarative per-render camera, labels, and layers are not silently ignored.");
    return { ok: true, valid: true, renderer: "DSH-Rosalind local raster", dimensions: { width, height }, estimatedPixels: width * height, supportedFormats: ["png"], unsupportedFormats: ["jpeg", "webp", "mp4"], sceneRevision: session.revision, provenance: "Validation of local deterministic raster projection" };
  }

  private renderImage(args: Record<string, unknown>, context: ScienceExecutionContext, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const validation = this.validateRender({ request: args }, session); if (isFailure(validation)) return validation;
    const format = args.format ?? "png"; if (format !== "png") return failure("IMAGE_ENCODER_UNAVAILABLE", `Local image export currently supports PNG only; ${String(format)} encoding was not attempted.`);
    if (typeof args.outputPath !== "string" || !args.outputPath.trim()) return failure("EXPORT_DESTINATION_REQUIRED", "render_image requires outputPath.");
    const destination = args.destination && typeof args.destination === "object" ? args.destination as Record<string, unknown> : null; if (destination && typeof destination.relativePath === "string" && destination.relativePath !== args.outputPath) return failure("RENDER_DESTINATION_MISMATCH", "destination.relativePath must equal outputPath for local create-new rendering.");
    const target = sourcePath(args.outputPath, context.packageRoot); if (typeof target !== "string") return target;
    const sidecar = `${target}.render.json`;
    if ((existsSync(target) || existsSync(sidecar)) && args.overwrite !== true) return failure("EXPORT_DESTINATION_EXISTS", "Destination or rendering record exists and overwrite is false.", { outputPath: relative(context.packageRoot, target), sidecarPath: relative(context.packageRoot, sidecar) });
    const width = Number(args.width ?? 1920), height = Number(args.height ?? 1080), transparent = args.transparent === true;
    const job: Record<string, unknown> = { id: crypto.randomUUID(), kind: "image", state: "queued", outputPath: relative(context.packageRoot, target), createdAt: new Date().toISOString() };
    session.renderJobs.set(String(job.id), job);
    const complete = (): Record<string, unknown> | ScienceFailure => {
      if (job.state === "cancelled") return { ok: true, job };
      job.state = "running";
      try {
        checkAbort(context.signal);
        const raster = localRaster(session, width, height, transparent);
        mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, raster.png);
        writeFileSync(sidecar, `${JSON.stringify({ schemaVersion: 1, renderer: "DSH-Rosalind local raster", generatedAt: new Date().toISOString(), outputPath: relative(context.packageRoot, target), format: "png", dimensions: { width, height }, transparent, sceneRevision: session.revision, renderedAtomCount: raster.renderedAtomCount, projection: raster.projection, background: session.background, layers: session.layers, annotations: session.annotations, provenance: "Deterministic orthographic XY atom projection. It is a data-derived figure, not a Mol* WebGL viewport capture." }, null, 2)}\n`, "utf8");
        Object.assign(job, { state: "completed", sidecarPath: relative(context.packageRoot, sidecar), completedAt: new Date().toISOString(), bytes: statSync(target).size, renderedAtomCount: raster.renderedAtomCount, sceneRevision: session.revision });
        return { ok: true, job, artifact: { outputPath: job.outputPath, sidecarPath: job.sidecarPath, bytes: job.bytes, format: "png" }, renderedAtomCount: raster.renderedAtomCount, sceneRevision: session.revision, provenance: "DSH-Rosalind local raster projection" };
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        Object.assign(job, { state: "failed", failedAt: new Date().toISOString(), error: { code: "RENDER_WRITE_FAILED", message } });
        return failure("RENDER_WRITE_FAILED", message, { outputPath: relative(context.packageRoot, target) });
      }
    };
    if (args.waitForCompletion === false) {
      session.renderJobs.delete(String(job.id));
      return failure("ASYNC_IMAGE_UNAVAILABLE", "Local PNG rendering currently runs synchronously so its output and rendering record can be verified before return.");
    }
    return complete();
  }

  private async renderMovie(args: Record<string, unknown>, context: ScienceExecutionContext, session: StructureSession): Promise<Record<string, unknown> | ScienceFailure> {
    if (typeof args.outputPath !== "string" || !args.outputPath.trim()) return failure("EXPORT_DESTINATION_REQUIRED", "render_movie requires outputPath.");
    if (extname(args.outputPath).toLowerCase() !== ".mp4") return failure("MOVIE_FORMAT_INVALID", "Local movie rendering writes H.264 MP4 files and requires an .mp4 outputPath.");
    const target = sourcePath(args.outputPath, context.packageRoot); if (typeof target !== "string") return target;
    const sidecar = `${target}.render.json`;
    if ((existsSync(target) || existsSync(sidecar)) && args.overwrite !== true) return failure("EXPORT_DESTINATION_EXISTS", "Destination or rendering record exists and overwrite is false.", { outputPath: relative(context.packageRoot, target), sidecarPath: relative(context.packageRoot, sidecar) });
    const width = Number(args.width ?? 640), height = Number(args.height ?? 480), fps = Number(args.fps ?? 12);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 128 || height < 128 || width > 1920 || height > 1920 || !Number.isInteger(fps) || fps < 1 || fps > 30) return failure("MOVIE_REQUEST_INVALID", "Movie width/height must be 128–1920 and fps must be an integer from 1 through 30.");
    const timeline = Array.isArray(args.timeline) ? args.timeline as Array<Record<string, unknown>> : [];
    let durationSeconds = 0, totalRotationDegrees = 0;
    for (const step of timeline) {
      const duration = Number(step.durationSeconds ?? step.duration ?? 0); if (!Number.isFinite(duration) || duration < 0 || duration > 30) return failure("MOVIE_TIMELINE_INVALID", "Each timeline duration must be a finite value from 0 through 30 seconds.");
      durationSeconds += duration;
      if (["rotate", "camera_spin", "spin", "rock"].includes(String(step.kind))) { const degrees = Number(step.degrees ?? (step.kind === "rock" ? 30 : 360)); if (!Number.isFinite(degrees) || Math.abs(degrees) > 7_200) return failure("MOVIE_TIMELINE_INVALID", "Rotation degrees must be finite and at most 7,200 in magnitude."); totalRotationDegrees += degrees; }
      else if (!["hold", "time", "zoom", "focus", "camera", "visibility", "scene"].includes(String(step.kind))) return failure("MOVIE_TIMELINE_UNSUPPORTED", `The local movie renderer does not implement timeline step ${String(step.kind)}.`);
    }
    if (durationSeconds <= 0) durationSeconds = 1;
    const frameCount = Math.max(1, Math.ceil(durationSeconds * fps)); if (frameCount > 300) return failure("MOVIE_FRAME_LIMIT", "Local movie rendering is limited to 300 frames.", { frameCount });
    if (args.waitForCompletion === false) return failure("ASYNC_MOVIE_UNAVAILABLE", "Local H.264 movie encoding currently runs synchronously so its output and sidecar can be verified before return.");
    const job: Record<string, unknown> = { id: crypto.randomUUID(), kind: "movie", state: "queued", outputPath: relative(context.packageRoot, target), createdAt: new Date().toISOString(), frameCount, fps };
    session.renderJobs.set(String(job.id), job);
    const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "dsh-rosalind-movie-"));
    try {
      Object.assign(job, { state: "running", startedAt: new Date().toISOString() }); mkdirSync(dirname(target), { recursive: true });
      for (let frame = 0; frame < frameCount; frame += 1) {
        checkAbort(context.signal);
        const raster = localRaster(session, width, height, false, totalRotationDegrees * frame / Math.max(1, frameCount - 1));
        writeFileSync(resolve(temporaryDirectory, `frame-${String(frame + 1).padStart(5, "0")}.png`), raster.png);
      }
      await encodeMovieWithFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(fps), "-i", resolve(temporaryDirectory, "frame-%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", target], context.signal);
      const bytes = statSync(target).size;
      writeFileSync(sidecar, `${JSON.stringify({ schemaVersion: 1, renderer: "DSH-Rosalind local raster plus ffmpeg libx264", generatedAt: new Date().toISOString(), outputPath: relative(context.packageRoot, target), format: "mp4", dimensions: { width, height }, fps, frameCount, durationSeconds: frameCount / fps, sceneRevision: session.revision, timeline, totalRotationDegrees, provenance: "Every encoded frame is an orthographic local-coordinate raster. Rotation is a 2D camera-plane transform, not a Mol* viewport capture." }, null, 2)}\n`, "utf8");
      Object.assign(job, { state: "completed", completedAt: new Date().toISOString(), bytes, sidecarPath: relative(context.packageRoot, sidecar), sceneRevision: session.revision });
      return { ok: true, job, artifact: { outputPath: relative(context.packageRoot, target), sidecarPath: relative(context.packageRoot, sidecar), format: "mp4", bytes }, frameCount, fps, durationSeconds: frameCount / fps, sceneRevision: session.revision, provenance: "H.264 MP4 encoded locally with ffmpeg from data-derived coordinate frames." };
    } catch (cause) {
      if (context.signal.aborted) {
        rmSync(target, { force: true }); rmSync(`${target}.render.json`, { force: true });
        Object.assign(job, { state: "cancelled", cancelledAt: new Date().toISOString() });
        throw context.signal.reason instanceof Error ? context.signal.reason : new Error("Structure movie encoding cancelled.");
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      rmSync(target, { force: true }); rmSync(`${target}.render.json`, { force: true });
      Object.assign(job, { state: "failed", failedAt: new Date().toISOString(), error: { code: "MOVIE_RENDER_FAILED", message } });
      return failure("MOVIE_RENDER_FAILED", message, { outputPath: relative(context.packageRoot, target) });
    } finally { rmSync(temporaryDirectory, { recursive: true, force: true }); }
  }

  private renderStatus(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure { const jobId = typeof args.jobId === "string" ? args.jobId : ""; const job = session.renderJobs.get(jobId); return job ? { ok: true, job } : failure("RENDER_JOB_NOT_FOUND", `No local render job named ${jobId}.`); }
  private cancelRender(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const jobId = typeof args.jobId === "string" ? args.jobId : "", job = session.renderJobs.get(jobId);
    if (!job) return failure("RENDER_JOB_NOT_FOUND", `No local render job named ${jobId}.`);
    if (job.state === "queued") { Object.assign(job, { state: "cancelled", cancelledAt: new Date().toISOString() }); return { ok: true, cancellationAccepted: true, job, reason: "The queued local PNG render was cancelled before rasterization." }; }
    if (job.state === "running") return { ok: true, cancellationAccepted: false, job, reason: "The synchronous rasterizer has already started writing this small local image." };
    return { ok: true, cancellationAccepted: false, job, reason: "The render has already reached a terminal state and cannot be cancelled." };
  }

  private export(args: Record<string, unknown>, context: ScienceExecutionContext, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    if (typeof args.outputPath !== "string" || !args.outputPath.trim()) return failure("EXPORT_DESTINATION_REQUIRED", "outputPath is required.");
    const target = sourcePath(args.outputPath, context.packageRoot); if (typeof target !== "string") return target;
    if (existsSync(target) && args.overwrite !== true) return failure("EXPORT_DESTINATION_EXISTS", "Destination exists and overwrite is false.", { outputPath: relative(context.packageRoot, target) });
    const format = String(args.format); let content: string | Buffer; let selection: Atom[] = [];
    if (["selection-pdb", "selection-mmcif", "selection-bcif"].includes(format)) { const selected = selectAtoms(session, args.selection ?? { kind: "current_selection" }); if (isFailure(selected)) return selected; if (!selected.atoms.length) return failure("EXPORT_SELECTION_EMPTY", "The requested coordinate export selection is empty."); selection = selected.atoms; if (format === "selection-bcif") return failure("BINARYCIF_ENCODER_UNAVAILABLE", "BinaryCIF encoding is unavailable locally; request selection-mmcif for an identity-preserving text export."); content = format === "selection-pdb" ? pdbText(selection) : mmcifText(selection); }
    else if (format === "models-mmcif") content = mmcifText([...session.objects.values()].flatMap((object) => object.atoms));
    else if (format === "models-bcif") return failure("BINARYCIF_ENCODER_UNAVAILABLE", "BinaryCIF encoding is unavailable locally; request models-mmcif for an identity-preserving text export.");
    else if (format === "scene-json") content = `${JSON.stringify(summary(session), null, 2)}\n`;
    else if (format === "results-csv") content = `kind,value,units\r\n${session.measurements.map((item) => `${String(item.kind)},${String(item.value)},${String(item.units)}`).join("\r\n")}${session.measurements.length ? "\r\n" : ""}`;
    else if (format === "geometry-obj") { const atoms = [...session.objects.values()].filter((object) => object.visible).flatMap((object) => object.atoms); content = `# DSH-Rosalind coordinate point cloud; vertices do not encode bonds or a molecular surface.\n${atoms.map((atom) => `v ${atom.x.toFixed(5)} ${atom.y.toFixed(5)} ${atom.z.toFixed(5)}`).join("\n")}\n`; }
    else if (["geometry-stl", "geometry-glb", "geometry-usdz"].includes(format)) return failure("GEOMETRY_ENCODER_UNAVAILABLE", `Local geometry export does not encode ${format}; geometry-obj is available as a coordinate point cloud.`);
    else return failure("EXPORT_FORMAT_UNAVAILABLE", `Local export does not support ${format}.`);
    try { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content); } catch (cause) { return failure("EXPORT_WRITE_FAILED", cause instanceof Error ? cause.message : String(cause)); }
    return { ok: true, format, outputPath: relative(context.packageRoot, target), bytes: statSync(target).size, overwritten: args.overwrite === true, sceneRevision: session.revision, selectionAtomCount: selection.length || undefined, provenance: "DSH-Rosalind local structure service" };
  }
}
