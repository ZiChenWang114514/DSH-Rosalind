import { readFileSync } from "node:fs";

import { Context, type Fiber } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { afterEach, describe, expect, it } from "vitest";

import {
  DATABASE_REQUEST_PARAMETERS,
  DATABASE_SHOWCASES,
  DATABASE_SKILL_SPECS,
  createDatabaseModule,
} from "../src/modules/life-sciences-databases.js";
import {
  LITERATURE_REQUEST_PARAMETERS,
  LITERATURE_SHOWCASES,
  LITERATURE_SKILL_SPECS,
  createLiteratureModule,
} from "../src/modules/life-sciences-literature.js";
import type { ModuleDefinition } from "../src/modules/module-definition.js";

interface Fixture {
  ctx: Context;
  modules: Fiber[];
  services: Fiber[];
}

const fixtures: Fixture[] = [];

function callId(value: string): ToolExecutionInput["callId"] {
  return value as ToolExecutionInput["callId"];
}

async function setup(): Promise<Fixture> {
  const ctx = new Context();
  const systemPrompt = ctx.plugin(SystemPrompt, {}); await systemPrompt;
  const tools = ctx.plugin(ToolRuntime, { mode: "native" }); await tools;
  const skills = ctx.plugin(SkillRegistry, {}); await skills;
  const fixture = { ctx, modules: [], services: [skills, tools, systemPrompt] };
  fixtures.push(fixture);
  return fixture;
}

async function mount(fixture: Fixture, definition: ModuleDefinition): Promise<Fiber> {
  const fiber = fixture.ctx.plugin({
    name: definition.name,
    inject: [...definition.inject],
    apply: (ctx: Context) => definition.apply(ctx),
  });
  await fiber;
  fixture.modules.push(fiber);
  return fiber;
}

async function execute(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({ callId: callId(`source-module-${name}`), name, arguments: args, signal: new AbortController().signal });
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0).reverse()) {
    for (const fiber of fixture.modules.splice(0).reverse()) await fiber.dispose();
    for (const fiber of fixture.services) await fiber.dispose();
  }
});

describe("independent Life Sciences source modules", () => {
  it("declares the exact provider, Skill, tool, and Showcase contracts", () => {
    expect(LITERATURE_SKILL_SPECS).toHaveLength(3);
    expect(DATABASE_SKILL_SPECS).toHaveLength(44);
    expect(LITERATURE_REQUEST_PARAMETERS.provider.enum).toEqual(["biorxiv", "medrxiv", "entrez", "ncbi-entrez", "pmc", "ncbi-pmc"]);
    expect(DATABASE_REQUEST_PARAMETERS.response_format.enum).toEqual(["json", "xml", "text", "tsv", "fasta", "auto"]);

    const catalogue = JSON.parse(readFileSync("showcases/catalog.json", "utf8")) as {
      plugins: Array<{ id: string; showcases: Array<{ id: string }> }>;
    };
    for (const ownership of [LITERATURE_SHOWCASES, DATABASE_SHOWCASES]) {
      const entry = catalogue.plugins.find((plugin) => plugin.id === ownership.pluginId);
      expect(entry?.showcases.map((showcase) => showcase.id)).toEqual([...ownership.showcaseIds]);
    }
  });

  it("mounts and disposes Literature without changing Database registrations", async () => {
    const fixture = await setup();
    const literature = createLiteratureModule({ packageRoot: process.cwd() });
    const databases = createDatabaseModule({ packageRoot: process.cwd() });
    const literatureFiber = await mount(fixture, literature);
    await mount(fixture, databases);

    expect(fixture.ctx.tools.get("literature_request")).toBeDefined();
    expect(fixture.ctx.tools.get("database_request")).toBeDefined();
    expect(await fixture.ctx.skills.get("rosalind-literature-biorxiv", { cwd: process.cwd() })).toBeDefined();
    expect(await fixture.ctx.skills.get("rosalind-databases-uniprot", { cwd: process.cwd() })).toBeDefined();

    await literatureFiber.dispose();
    fixture.modules.splice(fixture.modules.indexOf(literatureFiber), 1);
    expect(fixture.ctx.tools.get("literature_request")).toBeUndefined();
    expect(fixture.ctx.tools.get("database_request")).toBeDefined();
    expect(await fixture.ctx.skills.get("rosalind-literature-biorxiv", { cwd: process.cwd() })).toBeUndefined();
    expect(await fixture.ctx.skills.get("rosalind-databases-uniprot", { cwd: process.cwd() })).toBeDefined();

    await expect(literature.adapter.execute("literature", "literature.request", { provider: "biorxiv" }, {
      session: {}, signal: new AbortController().signal, packageRoot: process.cwd(),
    })).resolves.toMatchObject({ status: "failed", error: { code: "SOURCE_ADAPTER_DISPOSED" } });
  });

  it("keeps validation and public-network failure behavior within each module", async () => {
    const fixture = await setup();
    await mount(fixture, createLiteratureModule({ packageRoot: process.cwd() }));
    await mount(fixture, createDatabaseModule({ packageRoot: process.cwd() }));

    const invalidLiterature = await execute(fixture.ctx, "literature_request", { provider: "unknown" });
    expect(invalidLiterature.isError).toBe(true);
    const missingDatabaseProvider = await execute(fixture.ctx, "database_request", {});
    expect(missingDatabaseProvider.isError).toBe(true);

    const literature = await execute(fixture.ctx, "literature_request", { provider: "biorxiv", allowNetwork: false });
    expect(literature).toMatchObject({ isError: false, value: { status: "failed", error: { code: "NETWORK_NOT_AUTHORIZED" } } });
    const databases = await execute(fixture.ctx, "database_request", { provider: "uniprot", allowNetwork: false });
    expect(databases).toMatchObject({ isError: false, value: { status: "failed", error: { code: "NETWORK_NOT_AUTHORIZED" } } });
  });
});
