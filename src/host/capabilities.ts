import { readFileSync } from "node:fs";

import { assertObjectJsonSchema, type ObjectJsonSchema } from "@deepseek-ai/dsh-tools";

import { findPackageRoot, resolveInside } from "./catalog.js";

export type CapabilityStatus = "missing" | "implemented" | "verified";

export interface CapabilityServiceRecord {
  id: string;
  pluginId: string;
  pluginVersion: string;
  mcpServer: string;
  originalMcpServer: string | null;
  implementationPath: string | null;
  fixtureTest: string | null;
  liveTest: string | null;
  status: CapabilityStatus;
}

export interface CapabilitySkillRecord {
  id: string;
  name: string;
  serviceId: string;
  implementationPath: string | null;
  triggerTest: string | null;
  workflowTest: string | null;
  status: CapabilityStatus;
}

export interface CapabilityOperationRecord {
  id: string;
  serviceId: string;
  pluginVersion: string;
  operation: string;
  inputSchema: { $ref: string };
  dshInputSchema: { $ref: string };
  outputSchema: Record<string, unknown>;
  relatedShowcases: string[];
  implementationPath: string | null;
  fixtureTest: string | null;
  liveTest: string | null;
  status: CapabilityStatus;
}

export interface CapabilityManifest {
  schemaVersion: string;
  generatedAt: string;
  target: {
    dshVersion: string;
    showcaseCount: number;
    serviceCount: number;
    skillCount: number;
    requiredOperationCount: number;
  };
  evidencePolicy: string;
  services: CapabilityServiceRecord[];
  skills: CapabilitySkillRecord[];
  operations: CapabilityOperationRecord[];
}

interface ContractTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  dshInputSchema: Record<string, unknown>;
  annotations: Record<string, unknown>;
  execution: Record<string, unknown>;
}

interface ContractFile {
  schemaVersion: number;
  serviceId: string;
  tools: ContractTool[];
}

export interface RuntimeOperationContract {
  record: CapabilityOperationRecord;
  tool: ContractTool;
  registeredName: string;
  parameters: ObjectJsonSchema;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function registeredOperationName(serviceId: string, operation: string): string {
  const normalized = operation.replaceAll(/[^a-zA-Z0-9_]+/g, "_").replaceAll(/_+/g, "_").replace(/^_|_$/g, "");
  return normalized.startsWith(`${serviceId}_`) ? normalized : `${serviceId}_${normalized}`;
}

export class CapabilityRegistry {
  readonly packageRoot: string;
  readonly manifest: CapabilityManifest;
  readonly operations: RuntimeOperationContract[];

  constructor(packageRoot = findPackageRoot()) {
    this.packageRoot = packageRoot;
    this.manifest = readJson(resolveInside(packageRoot, "capabilities/capability-manifest.json"));
    const contractFiles = new Map<string, ContractFile>();
    for (const service of this.manifest.services) {
      const path = resolveInside(packageRoot, `capabilities/contracts/${service.id}.json`);
      try {
        contractFiles.set(service.id, readJson(path));
      } catch (cause) {
        if (service.id !== "literature" && service.id !== "databases") throw cause;
      }
    }
    this.operations = this.manifest.operations.map((record) => {
      const contract = contractFiles.get(record.serviceId);
      const tool = contract?.tools.find((candidate) => candidate.name === record.operation);
      if (!tool) throw new Error(`Missing fixed-version contract for ${record.id}`);
      assertObjectJsonSchema(tool.dshInputSchema);
      return {
        record,
        tool,
        registeredName: registeredOperationName(record.serviceId, record.operation),
        parameters: tool.dshInputSchema,
      };
    });
    const names = new Set(this.operations.map((item) => item.registeredName));
    if (names.size !== this.operations.length) throw new Error("Scientific operation names are not unique after DSH normalization.");
  }

  operation(name: string): RuntimeOperationContract {
    const result = this.operations.find((item) => item.registeredName === name || item.record.id === name || item.record.operation === name);
    if (!result) throw new Error(`Unknown scientific operation: ${name}`);
    return result;
  }
}
