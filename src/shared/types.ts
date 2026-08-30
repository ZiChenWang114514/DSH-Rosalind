export const RUN_STATES = [
  "draft",
  "awaiting_confirmation",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RunState = (typeof RUN_STATES)[number];
export type ShowcaseMode = "lesson" | "replay" | "reproduce";
export type ProviderKind = "local" | "public-api" | "container" | "ssh" | "gpu" | "paid-api";

export interface ArtifactRef {
  id: string;
  role: "input" | "output" | "preview" | "provenance" | "export" | "log";
  mediaType: string;
  source?: string;
  generatedAt?: string;
  path?: string;
  resourceUri?: string;
  bytes?: number;
  sha256?: string;
}
export interface ScientificClaim {
  id: string;
  statement: string;
  kind: "observation" | "computed" | "interpretation";
  artifactIds: string[];
}

export interface ReproductionRecipe {
  adapter: string;
  providerIds: string[];
  strategy: "local" | "network" | "container" | "remote" | "conditional";
  command?: string;
  requiredInputs: string[];
  expectedOutputs: string[];
  checks: string[];
}

export interface ShowcaseDefinition {
  id: string;
  pluginId: string;
  pluginVersion: string;
  categoryId: string;
  domain: string;
  caseType: string;
  difficulty: string;
  evidenceLevel: string;
  capabilities: string[];
  rosalindTasks: string[];
  execution: {
    actualTools: string[];
    device: string;
    implementation: string;
    status: string;
  };
  title: string;
  summary: string;
  question: string;
  status: "ready" | "planned" | "blocked";
  runDate: string;
  readmePath: string;
  promptPath: string;
  preview: ArtifactRef | null;
  artifacts: ArtifactRef[];
  sources: string[];
  observations: string[];
  computedResults: string[];
  interpretation: string[];
  limitations: string[];
  claims: ScientificClaim[];
  requiredMcpServers: string[];
  requiredOperations: string[];
  requiredSkills: string[];
  fixtures: string[];
  expectedArtifacts: string[];
  scientificAssertions: ScientificClaim[];
  visualAssertions: Array<{ id: string; artifactId: string; requirement: string }>;
  provenance: {
    sourceCommit: string;
    sources: string[];
    runDate: string;
    records: Array<{
      sources?: string[];
      inputs?: string[];
      outputs?: string[];
      previews?: string[];
      note?: string;
    }>;
  };
  reproductionSteps: string[];
  recipe: ReproductionRecipe;
  modes: ShowcaseMode[];
  searchText: string;
}

export interface ShowcaseCategory {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  icon: "literature" | "database" | "sequence" | "ngs" | "structure" | "slide" | "workbench";
}

export interface ProviderStatus {
  id: string;
  label: string;
  kind: ProviderKind;
  installed: boolean;
  credentialRequired: boolean;
  credentialConfigured: boolean;
  runnable: boolean;
  estimatedCostUsd?: { min: number; max: number };
  diagnostics: string[];
  checkedAt: string;
}

export interface PlanStep {
  id: string;
  label: string;
  adapter: string;
  providerId: string;
  requiresNetwork: boolean;
  requiresConfirmation: boolean;
  estimatedSeconds?: number;
}

export interface ExecutionPlan {
  id: string;
  showcaseId: string;
  mode: ShowcaseMode;
  createdAt: string;
  steps: PlanStep[];
  inputs: ArtifactRef[];
  providerIds: string[];
  resources: string[];
  estimatedCostUsd: { min: number; max: number };
  confirmationReasons: string[];
}

/**
 * User-selected scientific inputs for an NGS showcase. These paths are kept
 * with the DSH run so that planning, approval, execution, and later status
 * all describe the same proposed workflow invocation.
 */
export interface NgsReproductionInputs {
  runDirectory: string;
  configFile: string;
  inputPaths: readonly string[];
}

export type ReproductionConfigValue =
  | null
  | boolean
  | number
  | string
  | ReproductionConfigValue[]
  | { [key: string]: ReproductionConfigValue };

/**
 * User-authorized files and settings for a non-NGS scientific reproduction.
 * The immutable copy retained on the run is also the filesystem allow-list
 * used by the selected local science service.
 */
export interface ShowcaseReproductionInputs {
  runDirectory: string;
  sourcePaths: readonly string[];
  config?: Readonly<Record<string, ReproductionConfigValue>>;
}

export interface ShowcaseRunProgress {
  inputs: ShowcaseReproductionInputs;
}

/** The three immutable identifiers returned by the NGS planner. */
export interface NgsPlanIdentity {
  planId: string;
  planName: string;
  planChecksum: string;
}

/** NGS-specific state exposed with a Rosalind run snapshot. */
export interface NgsRunProgress {
  inputs: NgsReproductionInputs;
  pendingPlan?: NgsPlanIdentity;
  approvedPlan?: NgsPlanIdentity;
  registryRunId?: string;
}

export interface RunEvent {
  at: string;
  state: RunState;
  stepId?: string;
  message: string;
}

export interface RunSnapshot {
  id: string;
  showcaseId: string;
  mode: ShowcaseMode;
  state: RunState;
  plan: ExecutionPlan;
  createdAt: string;
  updatedAt: string;
  progress: number;
  currentStepId?: string;
  artifacts: ArtifactRef[];
  events: RunEvent[];
  error?: { code: string; message: string };
  ngs?: NgsRunProgress;
  reproduction?: ShowcaseRunProgress;
}

export interface ReviewReport {
  showcaseId: string;
  generatedAt: string;
  sourceObservations: string[];
  computedResults: string[];
  scientificInterpretation: string[];
  limitations: string[];
  citationChecks: Array<{ source: string; valid: boolean; note: string }>;
  artifactChecks: Array<{ artifactId: string; present: boolean; note: string }>;
}

export interface ImportBundle {
  showcaseId: string;
  title: string;
  prompt: string;
  caseIndex: Array<{ role: string; path: string; mediaType: string }>;
  adapter: string;
  suggestedMode: ShowcaseMode;
}
