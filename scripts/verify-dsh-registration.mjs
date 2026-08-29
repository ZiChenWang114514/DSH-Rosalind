#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Context } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";

const SLIDE_COMPATIBILITY_NAMES = [
  "slide_control_viewer", "slide_run_analysis_from_chat",
  "slide_run_pathology", "slide_query_scientific_layer",
];
const SKILL_ADAPTER_TOOL_NAMES = ["literature_request", "database_request", ...SLIDE_COMPATIBILITY_NAMES];
const ROSALIND_TOOL_NAMES = [
  "rosalind_catalog_list", "rosalind_showcase_get", "rosalind_provider_status",
  "rosalind_showcase_import", "rosalind_plan", "rosalind_approve", "rosalind_run",
  "rosalind_status", "rosalind_cancel", "rosalind_artifact_list",
  "rosalind_artifact_open", "rosalind_export", "rosalind_review",
];

function packageVersion(name) {
  const path = fileURLToPath(new URL(`../node_modules/@deepseek-ai/${name}/package.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")).version;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function valueSummary(result) {
  if (result.isError) return { isError: true, code: result.error.info?.code ?? null, message: result.error.message };
  const value = result.value && typeof result.value === "object" && !Array.isArray(result.value) ? result.value : {};
  const error = value.error && typeof value.error === "object" && !Array.isArray(value.error) ? value.error : {};
  return {
    isError: false,
    status: typeof value.status === "string" ? value.status : null,
    scientificErrorCode: typeof error.code === "string" ? error.code : null,
    total: typeof value.total === "number" ? value.total : null,
  };
}

async function main() {
  const bundle = await import("../lib/index.js");
  const ctx = new Context();
  const serviceFibers = [];
  let bundleFiber;
  const priorLiveNetwork = process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;
  delete process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;
  try {
    const systemPromptFiber = ctx.plugin(SystemPrompt, {}); await systemPromptFiber; serviceFibers.push(systemPromptFiber);
    const toolsFiber = ctx.plugin(ToolRuntime, { mode: "native" }); await toolsFiber; serviceFibers.push(toolsFiber);
    const skillsFiber = ctx.plugin(SkillRegistry, {}); await skillsFiber; serviceFibers.push(skillsFiber);
    bundleFiber = ctx.plugin(bundle); await bundleFiber;

    const registry = new bundle.CapabilityRegistry();
    const schemas = ctx.tools.schemas();
    const names = new Set(schemas.map((schema) => schema.name));
    const operationNames = registry.operations.map((operation) => operation.registeredName);
    const skills = await ctx.skills.list({ cwd: process.cwd() });

    assert(schemas.length === 136, `Expected 136 registered tools, received ${schemas.length}`);
    assert(operationNames.length === 117, `Expected 117 fixed operations, received ${operationNames.length}`);
    assert(operationNames.every((name) => names.has(name)), "At least one fixed operation is absent from ToolRuntime");
    assert(SKILL_ADAPTER_TOOL_NAMES.every((name) => names.has(name)), "A Skill adapter tool is absent from ToolRuntime");
    assert(SLIDE_COMPATIBILITY_NAMES.every((name) => names.has(name)), "A Slide compatibility tool is absent from ToolRuntime");
    assert(ROSALIND_TOOL_NAMES.every((name) => names.has(name)), "A Rosalind tool is absent from ToolRuntime");
    assert(skills.length === 55, `Expected 55 skills, received ${skills.length}`);

    const presentation = {
      rendered: 0,
      presentCallFunctions: 0,
      presentCallViews: 0,
      presentResultFunctions: 0,
      presentResultViews: 0,
    };
    const nullArgumentDispatch = { successfulStructuredResults: 0, errorCodes: {} };
    for (const schema of schemas) {
      const definition = ctx.tools.get(schema.name);
      assert(definition, `ToolRuntime cannot resolve ${schema.name}`);
      const blocks = definition.output.render({}, {});
      assert(Array.isArray(blocks) && blocks.length > 0, `${schema.name} did not render output`);
      presentation.rendered += 1;
      assert(typeof definition.presentCall === "function", `${schema.name} has no call presenter`);
      presentation.presentCallFunctions += 1;
      const callView = definition.presentCall({});
      if (callView !== undefined) {
        assert(callView.card === "generic", `${schema.name} returned an unexpected call view`);
        presentation.presentCallViews += 1;
      }
      assert(typeof definition.presentResult === "function", `${schema.name} has no result presenter`);
      presentation.presentResultFunctions += 1;
      const resultView = definition.presentResult({}, { content: blocks, isError: false });
      if (resultView !== undefined) {
        assert(resultView.card === "generic", `${schema.name} returned an unexpected result view`);
        presentation.presentResultViews += 1;
      }
      const result = await ctx.tools.execute({
        callId: `registration-${schema.name}`,
        name: schema.name,
        arguments: null,
        signal: new AbortController().signal,
      });
      if (result.isError) {
        const code = result.error.info?.code ?? "UNCLASSIFIED";
        nullArgumentDispatch.errorCodes[code] = (nullArgumentDispatch.errorCodes[code] ?? 0) + 1;
      } else {
        assert(result.value && typeof result.value === "object", `${schema.name} returned a non-object value`);
        nullArgumentDispatch.successfulStructuredResults += 1;
      }
    }

    async function call(name, args, signal = new AbortController().signal) {
      return ctx.tools.execute({ callId: `representative-${name}`, name, arguments: args, signal });
    }

    const representativeResults = {};
    for (const [key, name, args] of [
      ["rosalind_catalog_list", "rosalind_catalog_list", {}],
      ["rosalind_open", "rosalind_open", {}],
      ["ngs_list_workflows", "ngs_list_workflows", {}],
      ["sequence_query_viewer", "sequence_query_viewer", { sessionId: "missing-session", target: "records" }],
      ["structure_get_state", "structure_get_state", { sessionId: "missing-session" }],
      ["slide_get_viewer_state", "slide_get_viewer_state", { sessionId: "missing-session" }],
      ["slide_control_viewer", "slide_control_viewer", { sessionId: "missing-session", action: "fit_view" }],
      ["slide_run_analysis_from_chat", "slide_run_analysis_from_chat", { sessionId: "missing-session", analysis: "spatial-summary" }],
      ["slide_run_pathology", "slide_run_pathology", { sessionId: "missing-session", workflow: "tissue-segmentation" }],
      ["slide_query_scientific_layer", "slide_query_scientific_layer", { sessionId: "missing-session", layerId: "missing-layer" }],
      ["literature_biorxiv", "literature_request", { provider: "biorxiv", action: "details", allowNetwork: false }],
      ["literature_pmc_article_dataset", "literature_request", {
        provider: "ncbi-pmc", action: "article-dataset", identifier: "PMC3257301",
        params: { id: "PMC3257301", max_items: 10 }, allowNetwork: false,
      }],
      ["database_uniprot", "database_request", { provider: "uniprot", query: "P01116", allowNetwork: false }],
      ["database_gtex_eqtl", "database_request", {
        provider: "gtex-eqtl", action: "variant", operation: "variant", identifier: "1:154454494-A-C",
        variant: "1:154454494-A-C", gene: "ENSG00000160712",
        params: { variantId: "chr1_154454494_A_C_b38" }, allowNetwork: false,
      }],
      ["database_clinvar_variation", "database_request", {
        provider: "clinvar-variation", action: "search", operation: "search", identifier: "rs7903146",
        terms: "rs7903146", params: { terms: "rs7903146", maxList: 10 }, allowNetwork: false,
      }],
      ["database_ukb_topmed_phewas", "database_request", {
        provider: "ukb-topmed-phewas", action: "variant", operation: "variant", identifier: "10:112998590-C-T",
        variant: "10:112998590-C-T", params: { max_results: 10 }, allowNetwork: false,
      }],
      ["database_gnomad_graphql", "database_request", {
        provider: "gnomad-graphql", action: "query", operation: "variant", identifier: "10-112998590-C-T",
        dataset: "gnomad_r4", variables: { variantId: "10-112998590-C-T", dataset: "gnomad_r4" },
        params: { max_items: 5 }, allowNetwork: false,
      }],
    ]) {
      representativeResults[key] = valueSummary(await call(name, args));
    }
    assert(representativeResults.rosalind_catalog_list.total === 23, "Catalogue call did not return 23 showcases");
    for (const key of [
      "literature_biorxiv", "literature_pmc_article_dataset", "database_uniprot",
      "database_gtex_eqtl", "database_clinvar_variation", "database_ukb_topmed_phewas", "database_gnomad_graphql",
    ]) {
      assert(representativeResults[key].scientificErrorCode === "NETWORK_NOT_AUTHORIZED", `${key} did not dispatch through the offline network authorization check`);
    }

    const controller = new AbortController();
    controller.abort(new Error("cancelled by registration verifier"));
    const cancellation = valueSummary(await call("ngs_list_workflows", {}, controller.signal));
    assert(cancellation.code === "ABORTED_BEFORE_DISPATCH", "Pre-dispatch cancellation was not preserved");

    const beforeDispose = { tools: ctx.tools.schemas().length, skills: (await ctx.skills.list()).length };
    await bundleFiber.dispose();
    bundleFiber = undefined;
    const afterDispose = { tools: ctx.tools.schemas().length, skills: (await ctx.skills.list()).length };
    assert(afterDispose.tools === 0 && afterDispose.skills === 0, "Bundle disposal left registrations active");

    process.stdout.write(`${JSON.stringify({
      ok: true,
      versions: {
        cordis: packageVersion("cordis"),
        dshTools: packageVersion("dsh-tools"),
        dshSkill: packageVersion("dsh-skill"),
      },
      registration: {
        totalTools: schemas.length,
        fixedOperations: operationNames.length,
        skillAdapterTools: SKILL_ADAPTER_TOOL_NAMES.length,
        slideCompatibilityTools: SLIDE_COMPATIBILITY_NAMES.length,
        rosalindTools: ROSALIND_TOOL_NAMES.length,
        skills: skills.length,
      },
      presentation,
      nullArgumentDispatch,
      representativeResults,
      cancellation,
      lifecycle: { beforeDispose, afterDispose },
      network: { liveRequestsEnabled: false, deepSeekApiCalled: false },
    }, null, 2)}\n`);
  } finally {
    if (bundleFiber) await bundleFiber.dispose();
    for (const fiber of serviceFibers.reverse()) await fiber.dispose();
    if (priorLiveNetwork === undefined) delete process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;
    else process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK = priorLiveNetwork;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
