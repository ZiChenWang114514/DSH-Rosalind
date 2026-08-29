import { accessSync, constants } from "node:fs";
import { delimiter, extname, join } from "node:path";

import type { ProviderKind, ProviderStatus } from "../shared/types.js";

export interface ProviderEnvironment {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  path: string;
  checkedAt?: () => string;
}

interface ProviderDefinition {
  id: string;
  label: string;
  kind: ProviderKind;
  command?: string;
  credentialEnv?: string;
  enableEnv?: string;
  targetEnv?: string;
  estimatedCostUsd?: { min: number; max: number };
}

const PUBLIC_APIS = [
  ["ncbi-entrez", "NCBI Entrez"],
  ["ncbi-pmc", "NCBI PubMed Central"],
  ["biorxiv", "bioRxiv / medRxiv"],
  ["opentargets", "Open Targets"],
  ["gwas-catalog", "GWAS Catalog"],
  ["gtex", "GTEx"],
  ["clinvar", "ClinVar"],
  ["ensembl", "Ensembl"],
  ["uniprot", "UniProt"],
  ["chembl", "ChEMBL"],
  ["rcsb-pdb", "RCSB PDB"],
  ["reactome", "Reactome"],
  ["public-dataset", "Authorized public dataset"],
] as const;

const PROVIDERS: ProviderDefinition[] = [
  { id: "local-replay", label: "Repository replay", kind: "local" },
  { id: "local-sequence", label: "Local sequence validator", kind: "local" },
  { id: "local-structure", label: "Local structure validator", kind: "local" },
  { id: "local-slide", label: "Local slide and spatial validator", kind: "local" },
  { id: "local-workbench", label: "Local Rosalind Workbench replay", kind: "local" },
  ...PUBLIC_APIS.map(([id, label]) => ({
    id,
    label,
    kind: "public-api" as const,
    enableEnv: "DSH_ROSALIND_ENABLE_LIVE_NETWORK",
  })),
  { id: "local-container", label: "Local container runtime", kind: "container", command: "docker" },
  { id: "ssh-hpc", label: "SSH / HPC", kind: "ssh", command: "ssh", targetEnv: "DSH_ROSALIND_SSH_HOST" },
  { id: "boltz", label: "Boltz-2", kind: "gpu", command: "boltz", estimatedCostUsd: { min: 0, max: 50 } },
  { id: "biohub-esm", label: "Biohub ESM", kind: "paid-api", credentialEnv: "BIOHUB_ESM_API_KEY", estimatedCostUsd: { min: 0, max: 100 } },
  { id: "modal", label: "Modal", kind: "paid-api", command: "modal", credentialEnv: "MODAL_TOKEN_ID", estimatedCostUsd: { min: 0, max: 100 } },
  { id: "runpod", label: "Runpod", kind: "paid-api", credentialEnv: "RUNPOD_API_KEY", estimatedCostUsd: { min: 0, max: 100 } },
];

function commandExists(command: string, environment: ProviderEnvironment): boolean {
  const pathSegments = environment.path.split(delimiter).filter(Boolean);
  const windowsExtensions = environment.platform === "win32"
    ? (environment.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")
    : [""];
  const candidates = extname(command) === "" ? windowsExtensions.map((extension) => `${command}${extension}`) : [command];
  for (const directory of pathSegments) {
    for (const candidate of candidates) {
      try {
        accessSync(join(directory, candidate), constants.X_OK);
        return true;
      } catch {
        // Continue through the finite PATH candidates.
      }
    }
  }
  return false;
}

export function providerRequiresConfirmation(status: Pick<ProviderStatus, "kind">): boolean {
  return status.kind === "paid-api" || status.kind === "gpu" || status.kind === "ssh";
}

export class ProviderRegistry {
  readonly environment: ProviderEnvironment;

  constructor(environment: Partial<ProviderEnvironment> = {}) {
    const env = environment.env ?? process.env;
    this.environment = {
      env,
      platform: environment.platform ?? process.platform,
      path: environment.path ?? env.PATH ?? "",
      ...(environment.checkedAt ? { checkedAt: environment.checkedAt } : {}),
    };
  }

  list(ids?: readonly string[]): ProviderStatus[] {
    const selected = ids ? PROVIDERS.filter((provider) => ids.includes(provider.id)) : PROVIDERS;
    return selected.map((provider) => this.status(provider));
  }

  get(id: string): ProviderStatus {
    const definition = PROVIDERS.find((provider) => provider.id === id);
    if (!definition) {
      return {
        id,
        label: id,
        kind: "local",
        installed: false,
        credentialRequired: false,
        credentialConfigured: false,
        runnable: false,
        diagnostics: [`Provider ${id} is not registered.`],
        checkedAt: this.now(),
      };
    }
    return this.status(definition);
  }

  private now(): string {
    return this.environment.checkedAt?.() ?? new Date().toISOString();
  }

  private status(provider: ProviderDefinition): ProviderStatus {
    const diagnostics: string[] = [];
    const credentialRequired = provider.credentialEnv !== undefined;
    const credentialConfigured = !credentialRequired || Boolean(this.environment.env[provider.credentialEnv!]?.trim());
    const commandReady = provider.command === undefined || commandExists(provider.command, this.environment);
    const explicitlyEnabled = provider.enableEnv === undefined || Boolean(this.environment.env[provider.enableEnv]?.trim());
    const targetReady = provider.targetEnv === undefined || Boolean(this.environment.env[provider.targetEnv]?.trim());
    const installed = commandReady && (provider.kind !== "public-api" || explicitlyEnabled);
    const runnable = installed && credentialConfigured && targetReady;

    if (!commandReady) diagnostics.push(`Required command is unavailable: ${provider.command}.`);
    if (!explicitlyEnabled && provider.enableEnv) {
      diagnostics.push(`Live source is not authorized; configure ${provider.enableEnv} to enable it.`);
    }
    if (!credentialConfigured && provider.credentialEnv) diagnostics.push(`Credential is not configured: ${provider.credentialEnv}.`);
    if (!targetReady && provider.targetEnv) diagnostics.push(`Remote target is not configured: ${provider.targetEnv}.`);
    if (runnable) diagnostics.push("Provider prerequisites are available.");

    return {
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      installed,
      credentialRequired,
      credentialConfigured,
      runnable,
      ...(provider.estimatedCostUsd ? { estimatedCostUsd: provider.estimatedCostUsd } : {}),
      diagnostics,
      checkedAt: this.now(),
    };
  }
}
