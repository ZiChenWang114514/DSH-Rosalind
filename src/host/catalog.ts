import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SHOWCASES } from "../generated/catalog.js";
import type { ShowcaseDefinition } from "../shared/types.js";

export function findPackageRoot(start = dirname(fileURLToPath(import.meta.url))): string {
  let current = resolve(start);
  while (true) {
    if (existsSync(resolve(current, "package.json")) && existsSync(resolve(current, "showcases", "catalog.json"))) return current;
    const parent = dirname(current);
    if (parent === current) throw new Error(`Could not locate DSH-Rosalind package root from ${start}`);
    current = parent;
  }
}

function isInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

function nearestExisting(path: string): string {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) throw new Error(`Could not resolve an existing parent for ${path}`);
    current = parent;
  }
  return current;
}

/** Resolve a path and reject lexical escapes and existing symlink ancestors outside the root. */
export function resolveInside(root: string, relativePath: string): string {
  if (relativePath.trim() === "") throw new Error("artifact path must not be empty");
  const absoluteRoot = resolve(root);
  const absolute = resolve(absoluteRoot, relativePath);
  if (!isInside(absoluteRoot, absolute)) throw new Error(`path leaves the selected directory: ${relativePath}`);
  if (existsSync(absoluteRoot)) {
    const realRoot = realpathSync.native(absoluteRoot);
    const realExisting = realpathSync.native(nearestExisting(absolute));
    if (!isInside(realRoot, realExisting)) throw new Error(`path resolves outside the selected directory: ${relativePath}`);
  }
  return absolute;
}

export function resolveArtifactFile(root: string, relativePath: string): string {
  const absolute = resolveInside(root, relativePath);
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) throw new Error(`artifact file is unavailable: ${relativePath}`);
  const realRoot = realpathSync.native(resolve(root));
  const realFile = realpathSync.native(absolute);
  if (!isInside(realRoot, realFile)) throw new Error(`artifact file resolves outside the package: ${relativePath}`);
  return realFile;
}

export class ShowcaseCatalog {
  readonly packageRoot: string;
  readonly entries: ShowcaseDefinition[];
  readonly byId: ReadonlyMap<string, ShowcaseDefinition>;

  constructor(packageRoot = findPackageRoot()) {
    this.packageRoot = resolve(packageRoot);
    this.entries = SHOWCASES.map((entry) => structuredClone(entry));
    this.byId = new Map(this.entries.map((entry) => [entry.id, entry]));
  }

  get(id: string): ShowcaseDefinition {
    const entry = this.byId.get(id);
    if (!entry) throw new Error(`Unknown showcase: ${id}`);
    return structuredClone(entry);
  }

  list(options: { query?: string; categoryId?: string; runnableOnly?: boolean } = {}): ShowcaseDefinition[] {
    const query = options.query?.trim().toLowerCase();
    return this.entries.filter((entry) => {
      if (entry.status !== "ready") return false;
      if (options.categoryId && entry.categoryId !== options.categoryId) return false;
      if (query && !entry.searchText.includes(query)) return false;
      if (options.runnableOnly && !entry.modes.includes("reproduce")) return false;
      return true;
    }).map((entry) => structuredClone(entry));
  }
}
