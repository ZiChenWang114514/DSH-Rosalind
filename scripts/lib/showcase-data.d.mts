import type { ShowcaseDefinition } from "../../src/shared/types.js";

export const SOURCE_COMMIT: string;
export const SOURCE_REPOSITORY: string;
export function toPosix(value: string): string;
export function mediaTypeFor(filePath: string): string;
export function markdownSections(markdown: string): Map<string, string>;
export function buildCatalogue(repositoryRoot: string): Promise<ShowcaseDefinition[]>;
export function caseFiles(repositoryRoot: string): Promise<string[]>;
export function parseCsv(text: string): string[][];
export function parseFasta(text: string): Array<{ id: string; sequence: string }>;
export function validateFileBuffer(relativePath: string, buffer: Buffer): string;

export interface ScientificAcceptance {
  lambda: { codingBases: number; residues: number; translationMatches: boolean };
  ras: { rows: number; alignedLength: number; meanIdentity: number; distances: number[][]; newick: string };
  fastq: { reads: number; bases: number; q30Percent: number };
  mdm2: { atomContacts: number; residuePairs: number };
  gfp: { residues: number; atoms: number; contactResidues: number };
  slide: { width: number; height: number };
  spatial: { observations: number; genes: number; exportedRows: number };
  pdl1: { candidates: number; topFiveRows: number; ensemblePredictions: number; firstCandidate: string };
}

export function scientificAcceptance(repositoryRoot: string): Promise<ScientificAcceptance>;
export function validateShowcases(repositoryRoot: string): Promise<{
  ok: boolean;
  errors: string[];
  pluginCount: number;
  showcaseCount: number;
  fileCount: number;
  parsedByType: Record<string, number>;
  acceptance: ScientificAcceptance;
}>;
