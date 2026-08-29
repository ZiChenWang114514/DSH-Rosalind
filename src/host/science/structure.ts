import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";

export interface ScienceExecutionContext { session: object; signal: AbortSignal; packageRoot: string }
export interface ScienceFailure { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }

type Atom = { objectId: string; serial: number; name: string; resName: string; chain: string; residue: number; x: number; y: number; z: number; element: string; record: "ATOM" | "HETATM" };
type ObjectState = { id: string; path: string; format: string; atoms: Atom[]; baseAtoms: Atom[]; representation: string; color: string | null; visible: boolean; label?: string; dirty?: boolean; operationLog?: Array<Record<string, unknown>>; transform?: number[]; qualityMetricId?: string | null; displayClashes?: boolean };
type GuideState = { id: string; kind: "label" | "plane" | "orientation"; label: string | null; visible: boolean; color: string; opacity: number; targetAtomIds: string[]; centroid: Point; normal?: number[]; axes?: number[][] };
type SessionSnapshot = { objects: ObjectState[]; selected: string[]; focus: string[]; named: Array<[string, string[]]>; background: "light" | "dark"; showHydrogens: boolean; sideChains: boolean; measurements: Array<Record<string, unknown>>; scenes: Array<[string, Record<string, unknown>]>; guides: GuideState[] };
type StructureSession = { id: string; revision: number; objects: Map<string, ObjectState>; selected: Atom[]; focus: Atom[]; named: Map<string, Atom[]>; background: "light" | "dark"; showHydrogens: boolean; sideChains: boolean; measurements: Array<Record<string, unknown>>; scenes: Map<string, Record<string, unknown>>; guides: Map<string, GuideState>; undoStack: SessionSnapshot[]; redoStack: SessionSnapshot[] };
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
    atoms.push({ objectId: "primary", serial: Number.parseInt(line.slice(6, 11), 10) || atoms.length + 1, name, resName: line.slice(17, 20).trim() || "UNK", chain: line.slice(21, 22).trim() || "_", residue, x, y, z, element: line.slice(76, 78).trim() || name.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() || "?", record: record as "ATOM" | "HETATM" });
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
  return failure("SELECTION_EXPR_UNSUPPORTED", `SelectionExpr kind ${kind} is not supported by the local parser.`, { supportedKinds: ["all", "object", "chain", "residue", "residue_range", "atom", "atom_ids", "component", "anyOf", "current", "named"] });
}

function summary(session: StructureSession): Record<string, unknown> {
  const primary = session.objects.get("primary");
  return { ok: true, viewerSessionId: session.id, sessionReady: true, viewerReady: false, sceneRevision: session.revision, load: { status: primary ? "coordinates-ready" : "empty", error: null }, interaction: { renderer: "unavailable", rendered: false }, structure: primary ? { atomCount: primary.atoms.length, chainCount: new Set(primary.atoms.map((atom) => atom.chain)).size, residueCount: new Set(primary.atoms.map(scopedResidueKey)).size, polymerResidueCount: new Set(primary.atoms.filter(isPolymerAtom).map(scopedResidueKey)).size, ligandCount: new Set(primary.atoms.filter((atom) => atom.record === "HETATM" && atom.resName !== "HOH" && !isPolymerAtom(atom)).map(scopedResidueKey)).size, source: { fileName: basename(primary.path), format: primary.format } } : null, display: { background: session.background, representation: primary?.representation ?? null, showHydrogens: session.showHydrogens, showSideChains: session.sideChains }, selection: { atomCount: session.selected.length, residueCount: new Set(session.selected.map(scopedResidueKey)).size }, focus: { atomCount: session.focus.length, residueCount: new Set(session.focus.map(scopedResidueKey)).size }, objects: [...session.objects.values()].map((object) => ({ id: object.id, label: object.label ?? null, fileName: basename(object.path), format: object.format, atomCount: object.atoms.length, representation: object.representation, color: object.color, visible: object.visible, dirty: object.dirty ?? false, operationLog: object.operationLog ?? [], transform: object.transform, qualityMetricId: object.qualityMetricId ?? null, displayClashes: object.displayClashes ?? false })), measurements: session.measurements, guides: [...session.guides.values()].map((guide) => ({ id: guide.id, kind: guide.kind, label: guide.label, visible: guide.visible, color: guide.color, opacity: guide.opacity, atomCount: guide.targetAtomIds.length })), history: { undoCount: session.undoStack.length, redoCount: session.redoStack.length } };
}

const cloneObject = (object: ObjectState): ObjectState => ({ ...object, atoms: object.atoms.map((atom) => ({ ...atom })), baseAtoms: object.baseAtoms.map((atom) => ({ ...atom })), ...(object.operationLog ? { operationLog: object.operationLog.map((entry) => ({ ...entry })) } : {}), ...(object.transform ? { transform: [...object.transform] } : {}) });
function takeSnapshot(session: StructureSession): SessionSnapshot {
  return { objects: [...session.objects.values()].map(cloneObject), selected: session.selected.map(atomKey), focus: session.focus.map(atomKey), named: [...session.named.entries()].map(([name, atoms]) => [name, atoms.map(atomKey)]), background: session.background, showHydrogens: session.showHydrogens, sideChains: session.sideChains, measurements: structuredClone(session.measurements), scenes: [...session.scenes.entries()].map(([name, scene]) => [name, structuredClone(scene)]), guides: structuredClone([...session.guides.values()]) };
}
function restoreSnapshot(session: StructureSession, snapshot: SessionSnapshot): void {
  session.objects = new Map(snapshot.objects.map((object) => [object.id, cloneObject(object)]));
  const atoms = new Map([...session.objects.values()].flatMap((object) => object.atoms).map((atom) => [atomKey(atom), atom]));
  session.selected = snapshot.selected.flatMap((id) => atoms.get(id) ?? []); session.focus = snapshot.focus.flatMap((id) => atoms.get(id) ?? []);
  session.named = new Map(snapshot.named.map(([name, ids]) => [name, ids.flatMap((id) => atoms.get(id) ?? [])])); session.background = snapshot.background; session.showHydrogens = snapshot.showHydrogens; session.sideChains = snapshot.sideChains; session.measurements = structuredClone(snapshot.measurements); session.scenes = new Map(snapshot.scenes.map(([name, scene]) => [name, structuredClone(scene)])); session.guides = new Map(snapshot.guides.map((guide) => [guide.id, structuredClone(guide)]));
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
    if (name === "assembly_symmetry" || name === "set_assembly_symmetry") { const stale = revisionCheck(args, session); return stale ?? failure("ASSEMBLY_SYMMETRY_DATA_UNAVAILABLE", `${operation} requires retained RCSB assembly-symmetry metadata; local coordinates alone do not establish it.`); }
    if (name === "set_trajectory_state") { const stale = revisionCheck(args, session); return stale ?? failure("TRAJECTORY_DATA_UNAVAILABLE", "No loaded object has trajectory frames, so playback state was not changed."); }
    if (name === "search_motif") return failure("MOTIF_PROVIDER_UNAVAILABLE", "Geometric motif search requires the RCSB public provider; no local-coordinate substitute was used.");
    if (name === "browse_related_data") return failure("WORKSPACE_BROWSER_UNAVAILABLE", "The active local coordinate source has no authenticated opaque-token workspace browser.");
    if (name === "pymol_actions") return this.actionVocabulary(session);
    if (name === "pymol_action") return this.directAction(args, session);
    if (name === "export") return this.export(args, context, session);
    if (["validate_render", "render_image", "render_movie", "get_render_status", "cancel_render"].includes(name)) return failure("RENDERER_UNAVAILABLE", `${operation} requires an authenticated renderer; no job or artifact was created.`);
    if (["discover_density", "load_background", "load_data", "load_public_density"].includes(name)) return failure("SOURCE_CAPABILITY_UNAVAILABLE", `${operation} requires an unavailable source or density provider.`);
    return failure("OPERATION_NOT_IMPLEMENTED", `${operation} has no local implementation; no scene or result was changed.`, { operation });
  }

  private requireSession(owner: object, requested: unknown): StructureSession | ScienceFailure {
    if (typeof requested !== "string" || !requested.trim()) return failure("SESSION_ID_REQUIRED", "sessionId is required after open_from_chat.");
    const session = this.sessions.get(owner);
    return session?.id === requested ? session : failure("SESSION_NOT_FOUND", "The requested structure session is not active for this caller.", { requestedSessionId: requested });
  }

  private open(args: Record<string, unknown>, context: ScienceExecutionContext): Record<string, unknown> | ScienceFailure {
    const path = sourcePath(args.path, context.packageRoot); if (typeof path !== "string") return path;
    const parsed = parseCoordinates(path); if (isFailure(parsed)) return parsed;
    let session = this.sessions.get(context.session);
    if (!session) { session = { id: crypto.randomUUID(), revision: 0, objects: new Map(), selected: [], focus: [], named: new Map(), background: "light", showHydrogens: false, sideChains: false, measurements: [], scenes: new Map(), guides: new Map(), undoStack: [], redoStack: [] }; this.sessions.set(context.session, session); }
    parsed.atoms.forEach((atom) => { atom.objectId = "primary"; }); parsed.baseAtoms.forEach((atom) => { atom.objectId = "primary"; }); session.objects.clear(); session.objects.set("primary", parsed); session.selected = []; session.focus = []; session.named.clear(); session.measurements = []; session.scenes.clear(); session.guides.clear(); session.undoStack = []; session.redoStack = []; session.revision += 1;
    return { ...summary(session), coordinateLoad: { status: "ready", parser: `${parsed.format} coordinate parser`, atomCount: parsed.atoms.length }, viewerOpen: { mountState: "not-mounted", renderState: "error", errorCode: "INTERACTIVE_RENDERER_UNAVAILABLE" }, viewerReady: false };
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
    if (action === "set_representation" && primary && typeof args.representation === "string") { recordMutation(session); primary.representation = args.representation; session.revision += 1; return { ok: true, applied: true, representation: primary.representation, appliedRevision: session.revision }; }
    if (action === "set_color" && primary && typeof args.color === "string") { recordMutation(session); primary.color = args.color; session.revision += 1; return { ok: true, applied: true, color: primary.color, appliedRevision: session.revision }; }
    if (action === "set_view_options") { recordMutation(session); if (args.background === "dark" || args.background === "light") session.background = args.background; if (typeof args.showHydrogens === "boolean") session.showHydrogens = args.showHydrogens; if (typeof args.showSideChains === "boolean") session.sideChains = args.showSideChains; session.revision += 1; return { ok: true, applied: true, display: summary(session).display, appliedRevision: session.revision }; }
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

  private analyze(args: Record<string, unknown>, session: StructureSession, signal: AbortSignal): Record<string, unknown> | ScienceFailure {
    checkAbort(signal); const stale = revisionCheck(args, session); if (stale) return stale;
    if (typeof args.kind !== "string") return failure("ANALYSIS_KIND_REQUIRED", "Analysis kind is required.");
    if (!Array.isArray(args.selections)) return failure("ANALYSIS_SELECTIONS_REQUIRED", "Analysis selections must be supplied explicitly.");
    const options = args.options && typeof args.options === "object" ? args.options as Record<string, unknown> : {};
    if (args.kind === "contacts") return this.contacts(session, args.selections, Number(options.contactDistanceAngstrom ?? 4));
    if (args.kind === "centroid") { if (args.selections.length !== 1) return failure("ANALYSIS_SELECTION_COUNT_INVALID", "Centroid requires exactly one selection."); const result = selectAtoms(session, args.selections[0]); if (isFailure(result)) return result; if (!result.atoms.length) return failure("ANALYSIS_TARGET_EMPTY", "Centroid selection is empty."); return { ok: true, kind: "centroid", atomCount: result.atoms.length, centroid: centroid(result.atoms), provenance: "Arithmetic centroid of the requested SelectionExpr" }; }
    return failure("ANALYSIS_ENGINE_UNAVAILABLE", `Analysis ${args.kind} is unavailable locally; no value was produced.`, { kind: args.kind, selectionCount: args.selections.length });
  }

  private applyScene(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    if (args.atomic !== undefined && args.atomic !== true) return failure("ATOMIC_SCENE_REQUIRED", "apply_scene supports only atomic=true.");
    if (args.dryRun !== undefined && typeof args.dryRun !== "boolean") return failure("DRY_RUN_INVALID", "dryRun must be boolean.");
    if (Array.isArray(args.layers)) for (const layer of args.layers) { if (!layer || typeof layer !== "object") return failure("SCENE_LAYER_INVALID", "Every layer must be an object."); const item = layer as Record<string, unknown>, expression = item.expression ?? item.selection; if (expression !== undefined) { const result = selectAtoms(session, expression); if (isFailure(result)) return result; } }
    if (args.dryRun === true) return { ok: true, dryRun: true, atomic: true, valid: true, sceneRevision: session.revision, wouldApply: { background: args.background ?? null, layerCount: Array.isArray(args.layers) ? args.layers.length : 0 } };
    recordMutation(session); const primary = session.objects.get("primary"); if (args.background === "dark" || args.background === "light") session.background = args.background;
    if (primary && Array.isArray(args.layers) && args.layers[0] && typeof args.layers[0] === "object" && typeof (args.layers[0] as Record<string, unknown>).representation === "string") primary.representation = (args.layers[0] as Record<string, unknown>).representation as string;
    session.revision += 1; return { ok: true, applied: true, atomic: true, appliedRevision: session.revision, state: summary(session) };
  }

  private scene(operation: string, args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    if (operation === "list_scenes") return { ok: true, scenes: [...session.scenes.entries()].map(([name, scene]) => ({ name, scene })) };
    const stale = revisionCheck(args, session); if (stale) return stale;
    const name = typeof args.name === "string" ? args.name : ""; if (!name) return failure("SCENE_NAME_REQUIRED", "A scene name is required.");
    if (operation === "save_scene") { recordMutation(session); session.scenes.set(name, summary(session)); session.revision += 1; return { ok: true, name, sceneRevision: session.revision, appliedRevision: session.revision }; }
    if (operation === "delete_scene") { if (!session.scenes.has(name)) return failure("SCENE_NOT_FOUND", `No saved scene named ${name}.`); recordMutation(session); session.scenes.delete(name); session.revision += 1; return { ok: true, name, deleted: true, appliedRevision: session.revision }; }
    const saved = session.scenes.get(name); if (!saved) return failure("SCENE_NOT_FOUND", `No saved scene named ${name}.`); recordMutation(session); session.revision += 1; return { ok: true, name, scene: saved, appliedRevision: session.revision };
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
    if (method !== "structure") return failure("ALIGNMENT_ENGINE_UNAVAILABLE", `Local ${String(method)} alignment is unavailable; no transform was applied.`);
    const mobileSelection = selectAtoms(session, mobile, mobile.objectId), referenceSelection = selectAtoms(session, reference, reference.objectId); if (isFailure(mobileSelection)) return mobileSelection; if (isFailure(referenceSelection)) return referenceSelection;
    const mobileCa = mobileSelection.atoms.filter((atom) => atom.name === "CA"), referenceCa = referenceSelection.atoms.filter((atom) => atom.name === "CA"), lookup = new Map(referenceCa.map((atom) => [`${atom.chain}:${atom.residue}:${atom.resName}`, atom]));
    const pairs = mobileCa.map((atom) => ({ mobile: atom, reference: lookup.get(`${atom.chain}:${atom.residue}:${atom.resName}`) })).filter((pair): pair is { mobile: Atom; reference: Atom } => Boolean(pair.reference));
    if (pairs.length < 3) return failure("ALIGNMENT_ENGINE_UNAVAILABLE", "At least three stable C-alpha correspondences are required; no transform was applied.", { mobileCAlphaCount: mobileCa.length, referenceCAlphaCount: referenceCa.length, matchedCAlphaCount: pairs.length });
    const fit = kabsch(pairs.map((pair) => pair.mobile), pairs.map((pair) => pair.reference)), object = session.objects.get(mobile.objectId)!; recordMutation(session); object.transform = multiplyMatrices(fit.matrix, object.transform ?? identityMatrix());
    for (const atom of object.atoms) { const x = fit.rotation[0]![0]! * atom.x + fit.rotation[0]![1]! * atom.y + fit.rotation[0]![2]! * atom.z + fit.translation[0]!, y = fit.rotation[1]![0]! * atom.x + fit.rotation[1]![1]! * atom.y + fit.rotation[1]![2]! * atom.z + fit.translation[1]!, z = fit.rotation[2]![0]! * atom.x + fit.rotation[2]![1]! * atom.y + fit.rotation[2]![2]! * atom.z + fit.translation[2]!; atom.x = x; atom.y = y; atom.z = z; }
    session.revision += 1;
    return { ok: true, method: "structure", alignedResidueCount: pairs.length, rmsdAngstrom: fit.rmsd, matrix: fit.matrix, correspondence: { kind: "stable-author-residue-C-alpha", count: pairs.length, mobileObjectId: mobile.objectId, referenceObjectId: reference.objectId, pairs: pairs.slice(0, 500).map((pair) => ({ mobileAtomId: atomKey(pair.mobile), referenceAtomId: atomKey(pair.reference), chain: pair.mobile.chain, residue: pair.mobile.residue, compId: pair.mobile.resName })), truncated: pairs.length > 500 }, implementation: { engine: "DSH-Rosalind CA Kabsch", version: "1.0.0", scoreModel: null }, appliedRevision: session.revision, provenance: "Coordinate-derived least-squares superposition; no filename-specific metrics or TM-score estimates" };
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
    return { ok: true, operation, appliedRevision: session.revision, history: { undoCount: session.undoStack.length, redoCount: session.redoStack.length }, state: summary(session) };
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
    const objectId = typeof args.objectId === "string" ? args.objectId : ""; if (!session.objects.has(objectId)) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No object named ${objectId}.`);
    const source = args.source && typeof args.source === "object" ? args.source as Record<string, unknown> : null;
    if (!source || (source.kind !== "embedded" && source.kind !== "wwpdb")) return failure("QUALITY_SOURCE_INVALID", "Quality source must be embedded or wwpdb.");
    return failure("QUALITY_DATA_UNAVAILABLE", source.kind === "embedded" ? "The loaded coordinate parser retained no genuine embedded quality metrics; B-factors were not substituted." : "The wwPDB validation provider is unavailable in this local session; no report was invented.", { objectId, source: source.kind });
  }

  private setQuality(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    const objectId = typeof args.objectId === "string" ? args.objectId : "", object = session.objects.get(objectId); if (!object) return failure("STRUCTURE_OBJECT_NOT_FOUND", `No object named ${objectId}.`);
    if (args.metricId !== null && args.metricId !== undefined) return failure("QUALITY_METRIC_NOT_LOADED", `Quality metric ${String(args.metricId)} has not been loaded; B-factors were not substituted.`);
    recordMutation(session); object.qualityMetricId = null; object.displayClashes = typeof args.displayClashes === "boolean" ? args.displayClashes : false; session.revision += 1;
    return { ok: true, objectId, metricId: null, displayClashes: object.displayClashes, appliedRevision: session.revision };
  }

  private actionVocabulary(session: StructureSession): Record<string, unknown> {
    return { ok: true, sceneRevision: session.revision, selectionLanguage: "StructureSelectionExprV1", implementation: { engine: "DSH-Rosalind typed local scene actions", version: "1.0.0", pymolEngine: false }, supportedActions: ["select", "focus", "object_visibility", "save_scene", "restore_scene", "undo", "redo", "derive_object", "measure", "analyze", "align"], representations: ["cartoon"], unsupportedReason: "Scoped molecular representations and rendering require the authenticated viewer engine." };
  }

  private directAction(args: Record<string, unknown>, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    if (!args.action || typeof args.action !== "object") return failure("PYMOL_ACTION_INVALID", "A typed action is required.");
    const action = args.action as Record<string, unknown>, revisionArgs = { expectedRevision: args.expectedRevision };
    if (action.kind === "select" || action.kind === "focus") return this.setSelection({ ...revisionArgs, expression: action.target, mode: action.mode === "add" || action.mode === "subtract" || action.mode === "intersect" ? action.mode : "set", focus: action.kind === "focus" }, session);
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

  private export(args: Record<string, unknown>, context: ScienceExecutionContext, session: StructureSession): Record<string, unknown> | ScienceFailure {
    const stale = revisionCheck(args, session); if (stale) return stale;
    if (typeof args.outputPath !== "string" || !args.outputPath.trim()) return failure("EXPORT_DESTINATION_REQUIRED", "outputPath is required.");
    const target = sourcePath(args.outputPath, context.packageRoot); if (typeof target !== "string") return target;
    if (existsSync(target) && args.overwrite !== true) return failure("EXPORT_DESTINATION_EXISTS", "Destination exists and overwrite is false.", { outputPath: relative(context.packageRoot, target) });
    if (args.format !== "scene-json" && args.format !== "results-csv") return failure("EXPORT_FORMAT_UNAVAILABLE", `Local export does not support ${String(args.format)}.`);
    if (args.selection !== undefined) return failure("EXPORT_SELECTION_UNSUPPORTED_FOR_FORMAT", `Selection is not valid for ${String(args.format)}.`);
    const text = args.format === "scene-json" ? `${JSON.stringify(summary(session), null, 2)}\n` : `kind,value,units\n${session.measurements.map((item) => `${String(item.kind)},${String(item.value)},${String(item.units)}`).join("\n")}${session.measurements.length ? "\n" : ""}`;
    try { writeFileSync(target, text, "utf8"); } catch (cause) { return failure("EXPORT_WRITE_FAILED", cause instanceof Error ? cause.message : String(cause)); }
    return { ok: true, format: args.format, outputPath: relative(context.packageRoot, target), bytes: statSync(target).size, overwritten: args.overwrite === true, sceneRevision: session.revision, provenance: "DSH-Rosalind local structure service" };
  }
}
