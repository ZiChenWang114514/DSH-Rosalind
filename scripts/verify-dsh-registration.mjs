#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
const PROFILE_PROBE_MARKER = "__DSH_ROSALIND_PROFILE_PROBE__";
const SOURCE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

function commandResult(command, args, options) {
  try {
    return {
      status: 0,
      stdout: execFileSync(command, args, { ...options, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
      stderr: "",
    };
  } catch (error) {
    return {
      status: typeof error.status === "number" ? error.status : 1,
      stdout: typeof error.stdout === "string" ? error.stdout : "",
      stderr: typeof error.stderr === "string" ? error.stderr : String(error),
    };
  }
}

function commandFailure(label, result) {
  return `${label} failed (exit ${result.status}).\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}

function npmResult(args, options) {
  if (process.platform !== "win32") return commandResult("npm", args, options);
  const quote = (value) => /[\s&|<>^]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value);
  const command = ["npm", ...args].map(quote).join(" ");
  return commandResult(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], options);
}

function installedDsh() {
  const requested = process.env.DSH_ROSALIND_DSH_PACKAGE;
  let packageRoot;
  if (requested) {
    packageRoot = resolve(requested);
    if (basename(packageRoot) === "package.json") packageRoot = dirname(packageRoot);
  } else {
    const globalRoot = npmResult(["root", "-g"], { cwd: SOURCE_ROOT, timeout: 30_000 });
    assert(globalRoot.status === 0, commandFailure("npm global-root lookup for DSH", globalRoot));
    packageRoot = join(globalRoot.stdout.trim(), "@deepseek-ai", "dsh");
  }
  const anchor = join(packageRoot, "package.json");
  assert(existsSync(anchor), "Cannot locate the installed @deepseek-ai/dsh package. Set DSH_ROSALIND_DSH_PACKAGE to its package directory if it is not globally installed.");
  const manifest = JSON.parse(readFileSync(anchor, "utf8"));
  assert(manifest.version === "0.1.1-rc.2", `Expected @deepseek-ai/dsh 0.1.1-rc.2, received ${String(manifest.version)}`);
  assert(typeof manifest.bin?.dsh === "string", "The installed DSH package does not declare a dsh CLI binary");
  const bin = join(packageRoot, manifest.bin.dsh);
  const appBoot = join(packageRoot, "node_modules", "@deepseek-ai", "dsh-app-boot", "lib", "index.js");
  assert(existsSync(bin) && existsSync(appBoot), "The installed DSH package lacks its CLI binary or dsh-app-boot runtime");
  return { anchor, bin, appBoot, version: manifest.version };
}

const INSTALLED_DSH = installedDsh();

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function bundleArchive(root) {
  const requested = process.env.DSH_ROSALIND_PROFILE_ARCHIVE;
  if (requested) {
    const archive = resolve(requested);
    assert(readFileSync(archive).byteLength > 0, `Profile evidence archive is unavailable or empty: ${archive}`);
    return { archive, source: "DSH_ROSALIND_PROFILE_ARCHIVE", sha256: sha256(archive) };
  }
  const archiveDir = join(root, "archive");
  mkdirSync(archiveDir, { recursive: true });
  const { npm_config_cache, NPM_CONFIG_CACHE, npm_config_offline, NPM_CONFIG_OFFLINE, ...packEnvironment } = process.env;
  const pack = npmResult(["pack", "--ignore-scripts", "--pack-destination", archiveDir], {
    cwd: SOURCE_ROOT,
    env: { ...packEnvironment, NPM_CONFIG_CACHE: join(root, "npm-cache"), NPM_CONFIG_OFFLINE: "true" },
    timeout: 120_000,
  });
  assert(pack.status === 0, commandFailure("current-worktree npm pack", pack));
  const archives = readdirSync(archiveDir).filter((name) => name.endsWith(".tgz"));
  assert(archives.length === 1, `Expected one current-worktree archive, received ${archives.join(", ") || "none"}`);
  const archive = join(archiveDir, archives[0]);
  assert(readFileSync(archive).byteLength > 0, `Profile evidence archive is unavailable or empty: ${archive}`);
  return { archive, source: "current-worktree npm pack --ignore-scripts", sha256: sha256(archive) };
}

function createPnpmShim(root) {
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  const corepack = join(dirname(process.execPath), process.platform === "win32" ? "corepack.cmd" : "corepack");
  assert(readFileSync(corepack).byteLength > 0, `Cannot create an isolated profile because Corepack is unavailable at ${corepack}`);
  if (process.platform === "win32") {
    const shim = join(bin, "pnpm.cmd");
    writeFileSync(shim, `@echo off\r\n"${corepack}" pnpm %*\r\n`);
  } else {
    const shim = join(bin, "pnpm");
    writeFileSync(shim, `#!/usr/bin/env sh\nexec "${corepack}" pnpm "$@"\n`, { mode: 0o755 });
  }
  return bin;
}

function profileProbeSource() {
  return `
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { boot, healProfilesModuleFallback, loadProfile } from ${JSON.stringify(pathToFileURL(INSTALLED_DSH.appBoot).href)};

const marker = ${JSON.stringify(PROFILE_PROBE_MARKER)};
const expectedRosalindTools = ${JSON.stringify(ROSALIND_TOOL_NAMES)};
const config = JSON.parse(process.env.DSH_ROSALIND_PROFILE_PROBE_CONFIG ?? "{}");
delete process.env.DSH_ROSALIND_ENABLE_LIVE_NETWORK;

function summary(result) {
  if (result.isError) return { host: "error", code: result.error.info?.code ?? null, message: result.error.message };
  const value = result.value && typeof result.value === "object" && !Array.isArray(result.value) ? result.value : {};
  const failure = value.error && typeof value.error === "object" && !Array.isArray(value.error) ? value.error : {};
  return {
    host: "success",
    status: typeof value.status === "string" ? value.status : null,
    scientificErrorCode: typeof failure.code === "string" ? failure.code : null,
    total: typeof value.total === "number" ? value.total : null,
  };
}

async function run() {
  healProfilesModuleFallback(config.dshAnchor, config.dshHome);
  const profile = loadProfile("dsh-rosalind-profile-evidence", config.profileName, config.dshAnchor, config.dshHome);
  const rootConfig = join(profile.dir, "cordis.yml");
  writeFileSync(rootConfig, "[]\\n");
  const ctx = await boot(
    "dsh-rosalind-profile-evidence",
    rootConfig,
    [...profile.layers.flatMap((layer) => layer.patches), ...profile.patches],
  );
  try {
    const schemas = ctx.tools.schemas();
    const toolNames = new Set(schemas.map((schema) => schema.name));
    const skills = await ctx.skills.list({ cwd: config.cwd });
    const readBack = [];
    for (const skill of skills) {
      const loaded = await ctx.skills.get(skill.name, { cwd: config.cwd });
      readBack.push({ name: skill.name, loaded: loaded?.name === skill.name, contentBytes: loaded?.content.length ?? 0 });
    }
    const calls = [
      ["rosalind", "rosalind_catalog_list", {}],
      ["ngs", "ngs_list_workflows", {}],
      ["sequence", "sequence_query_viewer", { sessionId: "profile-evidence-missing-session", target: "records" }],
      ["structure", "structure_get_state", { sessionId: "profile-evidence-missing-session" }],
      ["slide", "slide_get_viewer_state", { sessionId: "profile-evidence-missing-session" }],
      ["literature", "literature_request", { provider: "biorxiv", action: "details", allowNetwork: false }],
      ["databases", "database_request", { provider: "uniprot", query: "P01116", allowNetwork: false }],
    ];
    const representatives = {};
    for (const [ecosystem, name, args] of calls) {
      const result = await ctx.tools.execute({
        callId: "profile-evidence-" + ecosystem,
        name,
        arguments: args,
        signal: new AbortController().signal,
      });
      representatives[ecosystem] = { tool: name, result: summary(result) };
    }
    const cancelled = new AbortController();
    cancelled.abort(new Error("profile evidence cancellation"));
    const cancellation = summary(await ctx.tools.execute({
      callId: "profile-evidence-cancelled",
      name: "ngs_list_workflows",
      arguments: {},
      signal: cancelled.signal,
    }));
    if (schemas.length < 136) throw new Error("Expected the profile to expose at least the 136 Rosalind tools, received " + schemas.length);
    if (expectedRosalindTools.some((name) => !toolNames.has(name))) throw new Error("A Rosalind orchestration tool was absent from the profile ToolRuntime");
    if (skills.length !== 55 || readBack.some((skill) => !skill.loaded || skill.contentBytes === 0)) {
      throw new Error("Expected 55 readable profile-mounted Skills, received " + skills.length);
    }
    if (representatives.rosalind.result.total !== 23) throw new Error("Rosalind profile call did not return 23 showcases");
    for (const ecosystem of ["literature", "databases"]) {
      if (representatives[ecosystem].result.scientificErrorCode !== "NETWORK_NOT_AUTHORIZED") {
        throw new Error(ecosystem + " did not stop at the offline authorization check");
      }
    }
    if (cancellation.code !== "ABORTED_BEFORE_DISPATCH") throw new Error("Profile cancellation was not preserved");
    process.stdout.write(marker + JSON.stringify({
      profile: { name: profile.name, bundles: profile.layers.map((layer) => layer.packageName) },
      registration: { totalTools: schemas.length, rosalindTools: expectedRosalindTools.length, skillsListed: skills.length, skillsReadBack: readBack.length },
      skills: readBack,
      representatives,
      cancellation,
      execution: {
        localProfileMount: true,
        fixtureOrLocalExecution: true,
        publicServiceExecution: { attempted: false, reason: "network is disabled for this verifier" },
      },
    }) + "\\n");
  } finally {
    await ctx.fiber.dispose();
  }
}

run().catch((error) => {
  process.stderr.write(error instanceof Error ? error.stack + "\\n" : String(error) + "\\n");
  process.exitCode = 1;
});
`;
}

function runIsolatedProfileEvidence() {
  const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-profile-evidence-"));
  try {
    const archiveRecord = bundleArchive(root);
    const archive = archiveRecord.archive;
    const pnpmBin = createPnpmShim(root);
    const profileName = "evidence";
    const environment = {
      ...process.env,
      DSH_HOME: join(root, "dsh-home"),
      DSH_TELEMETRY_DISABLED: "1",
      DSH_ROSALIND_ENABLE_LIVE_NETWORK: "",
      npm_config_offline: "true",
      PATH: `${pnpmBin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
    };
    const install = commandResult(process.execPath, [INSTALLED_DSH.bin, "plugin", "--profile", profileName, "add", "--offline", "--ignore-scripts", archive], {
      cwd: SOURCE_ROOT,
      env: environment,
      timeout: 120_000,
    });
    assert(install.status === 0, commandFailure("dsh plugin profile installation", install));

    const manifestPath = join(environment.DSH_HOME, "profiles", profileName, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const layers = manifest.dsh?.profile?.bundles ?? [];
    assert(manifest.dependencies?.["@zichenwang114514/dsh-rosalind"], "The isolated profile did not install the Rosalind bundle dependency");
    assert(layers.includes("@zichenwang114514/dsh-rosalind"), "The isolated profile did not register the Rosalind bundle layer");

    const dump = commandResult(process.execPath, [INSTALLED_DSH.bin, "--profile", profileName, "--dump-config"], {
      cwd: SOURCE_ROOT,
      env: environment,
      timeout: 60_000,
    });
    assert(dump.status === 0, commandFailure("dsh isolated profile config dump", dump));
    assert(dump.stdout.includes("dsh-rosalind"), "The isolated DSH profile dump did not contain the Rosalind patch row");

    const probePath = join(root, "profile-probe.mjs");
    writeFileSync(probePath, profileProbeSource());
    const probe = commandResult(process.execPath, [probePath], {
      cwd: SOURCE_ROOT,
      env: {
        ...environment,
        DSH_ROSALIND_PROFILE_PROBE_CONFIG: JSON.stringify({
          dshHome: environment.DSH_HOME,
          dshAnchor: INSTALLED_DSH.anchor,
          profileName,
          cwd: SOURCE_ROOT,
        }),
      },
      timeout: 120_000,
    });
    assert(probe.status === 0, commandFailure("isolated DSH ToolRuntime/SkillRegistry profile probe", probe));
    const markerAt = probe.stdout.lastIndexOf(PROFILE_PROBE_MARKER);
    assert(markerAt >= 0, `The isolated profile probe produced no evidence marker.\n${probe.stdout}`);
    const evidence = JSON.parse(probe.stdout.slice(markerAt + PROFILE_PROBE_MARKER.length).trim());
    assert(evidence.registration?.totalTools >= 136 && evidence.registration?.rosalindTools === ROSALIND_TOOL_NAMES.length, "The isolated profile probe did not report the Rosalind ToolRuntime contribution");
    assert(evidence.registration?.skillsListed === 55 && evidence.registration?.skillsReadBack === 55, "The isolated profile probe did not read back all 55 Skills");
    return {
      installation: {
        archive: basename(archive),
        archiveSha256: archiveRecord.sha256,
        archiveSource: archiveRecord.source,
        dshVersion: INSTALLED_DSH.version,
        profileBundles: layers,
        configIncludedRosalind: true,
        pluginCommand: { status: install.status },
      },
      mount: evidence,
      cleanup: { removed: true },
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

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
      assert(representativeResults[key].isError === false, `${key} escaped the scientific result contract`);
    }
    assert(representativeResults.literature_biorxiv.scientificErrorCode === "NETWORK_NOT_AUTHORIZED", "The literature request did not stop at the offline authorization check");
    assert(representativeResults.database_uniprot.scientificErrorCode === "NETWORK_NOT_AUTHORIZED", "The database request did not stop at the offline authorization check");

    const controller = new AbortController();
    controller.abort(new Error("cancelled by registration verifier"));
    const cancellation = valueSummary(await call("ngs_list_workflows", {}, controller.signal));
    assert(cancellation.code === "ABORTED_BEFORE_DISPATCH", "Pre-dispatch cancellation was not preserved");

    const beforeDispose = { tools: ctx.tools.schemas().length, skills: (await ctx.skills.list()).length };
    await bundleFiber.dispose();
    bundleFiber = undefined;
    const afterDispose = { tools: ctx.tools.schemas().length, skills: (await ctx.skills.list()).length };
    assert(afterDispose.tools === 0 && afterDispose.skills === 0, "Bundle disposal left registrations active");

    const isolatedProfileEvidence = runIsolatedProfileEvidence();

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
      network: { liveRequestsEnabled: false, deepSeekApiCalled: false, publicServiceExecution: "not-attempted" },
      isolatedProfileEvidence,
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
