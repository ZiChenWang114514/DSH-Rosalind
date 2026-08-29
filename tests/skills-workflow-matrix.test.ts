import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Context, type Fiber } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as bundle from "../src/index.js";
import { CapabilityRegistry } from "../src/host/capabilities.js";
import { DATABASE_PROVIDERS } from "../src/host/science/databases.js";
import { createScienceSkills, SCIENCE_SKILL_SPECS } from "../src/host/skills.js";

interface SkillEvidence {
  id: string;
  serviceId: "literature" | "databases" | "sequence" | "ngs" | "structure" | "slide";
  sourceName: string;
  tool?: string;
  executionMode?: "reasoning-only" | "routing" | "inspection-guided";
  semanticEvidence?: RegExp;
  providers?: readonly string[];
  fixtureTest?: string;
  fixtureLocator?: string;
}

const DATABASE_SKILLS = [
  ["rosalind-databases-alphafold", "alphafold"],
  ["rosalind-databases-bgee", "bgee"],
  ["rosalind-databases-bindingdb", "bindingdb"],
  ["rosalind-databases-biobankjapan-phewas", "biobankjapan-phewas"],
  ["rosalind-databases-biostudies-arrayexpress", "biostudies-arrayexpress"],
  ["rosalind-databases-cbioportal", "cbioportal"],
  ["rosalind-databases-cellxgene", "cellxgene"],
  ["rosalind-databases-chebi", "chebi"],
  ["rosalind-databases-chembl", "chembl"],
  ["rosalind-databases-civic", "civic"],
  ["rosalind-databases-clinicaltrials", "clinicaltrials"],
  ["rosalind-databases-clinvar-variation", "clinvar-variation"],
  ["rosalind-databases-efo-ontology", "efo-ontology"],
  ["rosalind-databases-encode", "encode"],
  ["rosalind-databases-ensembl", "ensembl"],
  ["rosalind-databases-epigraphdb", "epigraphdb"],
  ["rosalind-databases-eqtl-catalogue", "eqtl-catalogue"],
  ["rosalind-databases-eva", "eva"],
  ["rosalind-databases-finngen-phewas", "finngen-phewas"],
  ["rosalind-databases-genebass-gene-burden", "genebass-gene-burden"],
  ["rosalind-databases-gnomad-graphql", "gnomad-graphql"],
  ["rosalind-databases-gtex-eqtl", "gtex-eqtl"],
  ["rosalind-databases-gwas-catalog", "gwas-catalog"],
  ["rosalind-databases-human-protein-atlas", "human-protein-atlas"],
  ["rosalind-databases-ipd", "ipd"],
  ["rosalind-databases-metabolights", "metabolights"],
  ["rosalind-databases-mgnify", "mgnify"],
  ["rosalind-databases-ncbi-clinicaltables", "ncbi-clinicaltables"],
  ["rosalind-databases-ncbi-datasets", "ncbi-datasets"],
  ["rosalind-databases-ncbi-entrez", "ncbi-entrez"],
  ["rosalind-databases-opentargets", "opentargets"],
  ["rosalind-databases-pharmgkb", "pharmgkb"],
  ["rosalind-databases-pride", "pride"],
  ["rosalind-databases-proteomexchange", "proteomexchange"],
  ["rosalind-databases-pubchem-pug", "pubchem-pug"],
  ["rosalind-databases-quickgo", "quickgo"],
  ["rosalind-databases-rcsb-pdb", "rcsb-pdb"],
  ["rosalind-databases-reactome", "reactome"],
  ["rosalind-databases-rhea", "rhea"],
  ["rosalind-databases-rnacentral", "rnacentral"],
  ["rosalind-databases-string", "string"],
  ["rosalind-databases-tpmi-phewas", "tpmi-phewas"],
  ["rosalind-databases-ukb-topmed-phewas", "ukb-topmed-phewas"],
  ["rosalind-databases-uniprot", "uniprot"],
] as const;

const SKILL_WORKFLOW_MATRIX: readonly SkillEvidence[] = [
  {
    id: "rosalind-literature-biorxiv",
    serviceId: "literature",
    sourceName: "biorxiv-skill",
    tool: "literature_request",
    providers: ["biorxiv", "medrxiv"],
    fixtureTest: "tests/science-literature-databases.test.ts",
    fixtureLocator: 'execute("biorxiv.request"',
  },
  {
    id: "rosalind-literature-ncbi-entrez",
    serviceId: "literature",
    sourceName: "ncbi-entrez-skill",
    tool: "literature_request",
    providers: ["ncbi-entrez"],
    fixtureTest: "tests/science-literature-databases.test.ts",
    fixtureLocator: 'execute("entrez.request"',
  },
  {
    id: "rosalind-literature-ncbi-pmc",
    serviceId: "literature",
    sourceName: "ncbi-pmc-skill",
    tool: "literature_request",
    providers: ["ncbi-pmc"],
    fixtureTest: "tests/science-literature-databases.test.ts",
    fixtureLocator: 'execute("pmc.request"',
  },
  ...DATABASE_SKILLS.map(([id, provider]) => ({
    id,
    serviceId: "databases" as const,
    sourceName: `${provider}-skill`,
    tool: "database_request",
    providers: [provider],
    fixtureTest: "tests/database-provider-matrix.test.ts",
    fixtureLocator: provider,
  })),
  {
    id: "rosalind-sequence-biological-sequence-viewer",
    serviceId: "sequence",
    sourceName: "biological-sequence-viewer",
    tool: "sequence_open_from_chat",
    fixtureTest: "tests/sequence-ngs-operation-matrix.test.ts",
    fixtureLocator: 'execute("sequence.open_from_chat"',
  },
  {
    id: "rosalind-ngs-design-ngs-analysis",
    serviceId: "ngs",
    sourceName: "design-ngs-analysis",
    executionMode: "reasoning-only",
    semanticEvidence: /read-only and does not register or execute a workflow/,
  },
  {
    id: "rosalind-ngs-ngs-analysis-workbench",
    serviceId: "ngs",
    sourceName: "ngs-analysis-workbench",
    executionMode: "routing",
    semanticEvidence: /Route a concrete goal directly to its focused skill/,
  },
  {
    id: "rosalind-ngs-run-ngs-analysis",
    serviceId: "ngs",
    sourceName: "run-ngs-analysis",
    tool: "ngs_execute_plan",
    fixtureTest: "tests/sequence-ngs-operation-matrix.test.ts",
    fixtureLocator: 'execute("execute_plan"',
  },
  {
    id: "rosalind-ngs-understand-ngs-data",
    serviceId: "ngs",
    sourceName: "understand-ngs-data",
    executionMode: "inspection-guided",
    semanticEvidence: /without choosing a workflow, installing software,\s+transforming inputs, or creating an execution plan/,
  },
  {
    id: "rosalind-ngs-understand-ngs-results",
    serviceId: "ngs",
    sourceName: "understand-ngs-results",
    tool: "ngs_get_ngs_run",
    fixtureTest: "tests/sequence-ngs-operation-matrix.test.ts",
    fixtureLocator: 'execute("get_ngs_run"',
  },
  {
    id: "rosalind-structure-structure-viewer",
    serviceId: "structure",
    sourceName: "structure-viewer",
    tool: "structure_get_state",
    fixtureTest: "tests/structure-operation-matrix.test.ts",
    fixtureLocator: 'call("structure.get_state"',
  },
  {
    id: "rosalind-slide-slide-viewer",
    serviceId: "slide",
    sourceName: "slide-viewer",
    tool: "slide_get_viewer_state",
    fixtureTest: "tests/science-slide-parity.test.ts",
    fixtureLocator: 'verify("slide.get_viewer_state"',
  },
];

const repositoryRoot = resolve(import.meta.dirname, "..");
const databaseProviderIds = new Set(DATABASE_PROVIDERS.map((provider) => provider.id));
const localRegistrations = new Map(createScienceSkills(repositoryRoot).map((skill) => [skill.name, skill]));
const capabilityRegistry = new CapabilityRegistry(repositoryRoot);
const capabilityToolNames = new Set(capabilityRegistry.operations.map((operation) => operation.registeredName));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let ctx: Context;
let bundleFiber: Fiber;
let serviceFibers: Fiber[];
let registeredToolNames: Set<string>;

beforeAll(async () => {
  ctx = new Context();
  const systemPromptFiber = ctx.plugin(SystemPrompt, {});
  await systemPromptFiber;
  const toolsFiber = ctx.plugin(ToolRuntime, { mode: "native" });
  await toolsFiber;
  const skillsFiber = ctx.plugin(SkillRegistry, {});
  await skillsFiber;
  bundleFiber = ctx.plugin(bundle);
  await bundleFiber;
  serviceFibers = [skillsFiber, toolsFiber, systemPromptFiber];
  registeredToolNames = new Set(ctx.tools.schemas().map((schema) => schema.name));
}, 30_000);

afterAll(async () => {
  await bundleFiber.dispose();
  for (const fiber of serviceFibers) await fiber.dispose();
});

describe("55-Skill executable workflow evidence", () => {
  it("declares exactly the same 55 IDs as the production Skill specifications", () => {
    expect(SKILL_WORKFLOW_MATRIX).toHaveLength(55);
    expect(new Set(SKILL_WORKFLOW_MATRIX.map((item) => item.id)).size).toBe(55);
    expect(new Set(SKILL_WORKFLOW_MATRIX.map((item) => item.id))).toEqual(new Set(localRegistrations.keys()));
    expect(SCIENCE_SKILL_SPECS).toHaveLength(55);
    expect(SKILL_WORKFLOW_MATRIX.filter((item) => item.tool)).toHaveLength(52);
    expect(SKILL_WORKFLOW_MATRIX.filter((item) => item.executionMode)).toHaveLength(3);
  });

  it.each(SKILL_WORKFLOW_MATRIX)("$id is registered from its source document with a resolvable tool and fixture", async (evidence) => {
    const spec = SCIENCE_SKILL_SPECS.find((item) => item.serviceId === evidence.serviceId && item.sourceName === evidence.sourceName);
    expect(spec, `${evidence.id}: production specification`).toBeDefined();
    expect(spec?.tool, `${evidence.id}: main tool`).toBe(evidence.tool);
    expect(spec?.executionMode, `${evidence.id}: execution mode`).toBe(evidence.executionMode);

    const registration = localRegistrations.get(evidence.id);
    const registered = await ctx.skills.get(evidence.id, { cwd: repositoryRoot });
    expect(registration, `${evidence.id}: local registration`).toBeDefined();
    expect(registered, `${evidence.id}: DSH Skill service registration`).toBeDefined();
    expect(registered?.content, `${evidence.id}: registered content`).toBe(registration?.content);
    expect(registered?.path, `${evidence.id}: registered SKILL.md path`).toBe(registration?.path);
    expect(registered?.path?.endsWith("SKILL.md"), evidence.id).toBe(true);
    expect(existsSync(registered!.path!), `${evidence.id}: source file exists`).toBe(true);
    expect(statSync(registered!.path!).isFile(), `${evidence.id}: source is a file`).toBe(true);
    expect(readFileSync(registered!.path!, "utf8"), `${evidence.id}: source is a real Skill document`).toMatch(/^---\r?\n[\s\S]*?\bname:/);
    expect(registered?.resourceBase?.kind, `${evidence.id}: directory resource base`).toBe("directory");
    if (registered?.resourceBase?.kind === "directory") {
      expect(existsSync(registered.resourceBase.path), `${evidence.id}: resource directory exists`).toBe(true);
      expect(statSync(registered.resourceBase.path).isDirectory(), `${evidence.id}: resource base is a directory`).toBe(true);
      expect(registered.resourceBase.path, `${evidence.id}: resource base owns SKILL.md`).toBe(dirname(registered.path!));
    }

    if (evidence.tool) {
      expect(registeredToolNames.has(evidence.tool), `${evidence.id}: main tool is registered in DSH`).toBe(true);
      expect(registered?.content.includes(evidence.tool), `${evidence.id}: document names its main DSH tool`).toBe(true);
      if (!evidence.tool.endsWith("_request")) {
        expect(capabilityToolNames.has(evidence.tool), `${evidence.id}: main tool resolves through CapabilityRegistry`).toBe(true);
        expect(capabilityRegistry.operation(evidence.tool).record.fixtureTest, `${evidence.id}: manifest fixture mapping`).toBe(evidence.fixtureTest);
      }
    } else {
      expect(evidence.executionMode, `${evidence.id}: explicit tool-free execution mode`).toBeDefined();
      expect(evidence.semanticEvidence, `${evidence.id}: source semantic evidence`).toBeDefined();
      expect(registered?.content, `${evidence.id}: execution mode agrees with the source document`).toMatch(evidence.semanticEvidence!);
    }

    for (const provider of evidence.providers ?? []) {
      expect(registered?.content.includes(`provider: "${provider}"`), `${evidence.id}: provider ${provider} documented`).toBe(true);
      if (evidence.serviceId === "databases") expect(databaseProviderIds.has(provider), `${evidence.id}: database provider ${provider}`).toBe(true);
      if (evidence.serviceId === "literature") expect(JSON.stringify(ctx.tools.get("literature_request")?.parameters).includes(`"${provider}"`), `${evidence.id}: literature provider ${provider}`).toBe(true);
    }

    if (!evidence.fixtureTest) return;
    const fixturePath = resolve(repositoryRoot, evidence.fixtureTest);
    expect(existsSync(fixturePath), `${evidence.id}: fixture test exists`).toBe(true);
    const fixtureSource = readFileSync(fixturePath, "utf8");
    if (evidence.serviceId === "databases") {
      const provider = evidence.providers![0]!;
      const fixtureKey = provider.includes("-") ? `"${provider}"` : provider;
      expect(fixtureSource, `${evidence.id}: provider-specific fixture`).toMatch(new RegExp(`^\\s{2}${escapeRegExp(fixtureKey)}: \\{`, "m"));
      expect(fixtureSource, `${evidence.id}: provider fixture is parameterized and executed`).toContain("it.each(DATABASE_PROVIDERS.map");
    } else {
      expect(fixtureSource.includes(evidence.fixtureLocator!), `${evidence.id}: operation-specific fixture locator ${evidence.fixtureLocator}`).toBe(true);
    }
  });
});
