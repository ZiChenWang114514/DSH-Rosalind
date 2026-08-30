/**
 * Live tool audit: mounts the real DSH stack (Cordis + ToolRuntime +
 * SkillRegistry + this bundle) and exercises representative tools across
 * registration, schemas, session state, approval gates, failure shapes,
 * and cancellation. Read-only against the repository.
 */
import { Context } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.DSH_ROSALIND_STATE_DIR = mkdtempSync(join(tmpdir(), "dsh-audit-ngs-"));

const bundle = await import("../lib/index.js");

const out = { registered: [], checks: [] };
const note = (name, pass, detail) => {
  out.checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ctx = new Context();
await ctx.plugin(SystemPrompt, {});
await ctx.plugin(ToolRuntime, { mode: "native" });
await ctx.plugin(SkillRegistry, {});
const bundleFiber = ctx.plugin(bundle);
await bundleFiber;

const schemas = ctx.tools.schemas();
out.registered = schemas.map((schema) => schema.name);
note("tool count", schemas.length === 140, `${schemas.length} schemas`);
const names = new Set(out.registered);
for (const expected of ["literature_request", "database_request", "rosalind_catalog_list", "ngs_execute_plan", "structure_render_image", "slide_open_from_chat", "sequence_open_from_chat"]) {
  note(`registered: ${expected}`, names.has(expected));
}

const auditAgent = { id: "audit-agent" };
const otherAgent = { id: "other-agent" };

async function execute(name, args, options = {}) {
  const signal = options.signal ?? new AbortController().signal;
  const agent = options.agent ?? auditAgent;
  const result = await ctx.tools.execute({ callId: `audit-${name}-${Math.random().toString(36).slice(2, 8)}`, name, arguments: args, signal, agent });
  let payload = null;
  const textBlock = Array.isArray(result.content) ? result.content.find((block) => block.type === "text") : null;
  if (textBlock && typeof textBlock.text === "string" && textBlock.text.trim().startsWith("{")) {
    try { payload = JSON.parse(textBlock.text); } catch { payload = null; }
  }
  return { raw: result, payload };
}

// --- Skills ---
const skills = await ctx.skills.list({ cwd: process.cwd() });
note("skill count 55", skills.length === 55, `${skills.length}`);
const skillNames = new Set(skills.map((skill) => skill.name));
for (const expected of ["rosalind-literature-biorxiv", "rosalind-databases-uniprot", "rosalind-sequence-biological-sequence-viewer", "rosalind-ngs-run-ngs-analysis", "rosalind-structure-structure-viewer", "rosalind-slide-slide-viewer"]) {
  note(`skill registered: ${expected}`, skillNames.has(expected));
}
const uniprot = await ctx.skills.get("rosalind-databases-uniprot", { cwd: process.cwd() });
note("uniprot skill readback", Boolean(uniprot?.content?.includes("UniProt")), `${uniprot?.content?.length ?? 0} chars`);

// --- Rosalind catalogue ---
const catalogue = await execute("rosalind_catalog_list", {});
note("rosalind_catalog_list", catalogue.payload?.total === 23, `total=${catalogue.payload?.total}, commit=${String(catalogue.payload?.showcaseSourceCommit ?? "").slice(0, 8)}`);
const unknownShowcase = await execute("rosalind_showcase_get", { showcase_id: "does-not-exist" });
note("rosalind_showcase_get unknown → typed failure", unknownShowcase.raw.isError === true || unknownShowcase.payload?.status === "failed", JSON.stringify(unknownShowcase.payload ?? unknownShowcase.raw.error ?? {}).slice(0, 90));

// --- Offline network gate ---
const literature = await execute("literature_request", { provider: "biorxiv", action: "details", doi: "10.1101/2024.01.01.000001" });
note("literature_request offline gate", literature.payload?.error?.code === "NETWORK_NOT_AUTHORIZED", `code=${literature.payload?.error?.code}`);
const database = await execute("database_request", { provider: "uniprot", accession: "P01116" });
note("database_request offline gate", database.payload?.error?.code === "NETWORK_NOT_AUTHORIZED", `code=${database.payload?.error?.code}`);

// --- Sequence session state (same agent sees state; other agent does not) ---
const rasPath = resolve("showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta");
const opened = await execute("sequence_open_from_chat", { path: rasPath });
note("sequence_open_from_chat", opened.payload?.viewerSessionId != null, `session=${String(opened.payload?.viewerSessionId ?? JSON.stringify(opened.payload ?? opened.raw.error ?? {})).slice(0, 80)}`);
const sessionId = opened.payload?.viewerSessionId;
const queried = await execute("sequence_query_viewer", { sessionId, query: "records" });
const recordCount = queried.payload?.records?.length ?? queried.payload?.recordCount ?? queried.payload?.rows?.length;
note("sequence_query_viewer session-bound", queried.raw.isError !== true, `records=${recordCount ?? "?"}`);
const crossAgent = await execute("sequence_query_viewer", { sessionId, query: "records" }, { agent: otherAgent });
note("sequence session isolated per DSH agent", crossAgent.raw.isError === true || crossAgent.payload?.status === "failed" || crossAgent.payload?.ok === false, `detail=${JSON.stringify(crossAgent.payload ?? crossAgent.raw.error ?? {}).slice(0, 90)}`);
const analysis = await execute("sequence_run_analysis", { sessionId, analysis: "quality-report" });
note("sequence_run_analysis", analysis.raw.isError !== true && analysis.payload?.status !== "failed", `fields=${Object.keys(analysis.payload ?? {}).slice(0, 6).join(",")}`);

// --- Structure local fixture + query ---
const pdb = resolve("showcases/molecular-structure-viewer/cases/structure-gfp-figure/inputs/1EMA.pdb");
const structureOpen = await execute("structure_open_from_chat", { path: pdb });
note("structure_open_from_chat", structureOpen.payload?.viewerSessionId != null, `session=${String(structureOpen.payload?.viewerSessionId ?? JSON.stringify(structureOpen.payload ?? structureOpen.raw.error ?? {})).slice(0, 80)}`);
const structureQuery = await execute("structure_query", { sessionId: structureOpen.payload?.viewerSessionId, expression: "all" });
note("structure_query", structureQuery.raw.isError !== true, `atomCount=${structureQuery.payload?.atomCount ?? structureQuery.payload?.atoms?.length ?? "?"}`);

// --- Approval gate ---
const renderAttempt = await execute("structure_render_image", { sessionId: structureOpen.payload?.viewerSessionId, destination: { kind: "workspace", base: "opened-source", relativePath: "audit-figure.png" } });
const renderDenied = renderAttempt.raw.isError === true && /approval|denied/i.test(renderAttempt.raw.error?.message ?? "");
note("structure_render_image gated by approval", renderDenied, String(renderAttempt.raw.error?.message ?? JSON.stringify(renderAttempt.payload ?? {})).slice(0, 90));

// --- Cancellation: pre-aborted signal ---
const controller = new AbortController();
controller.abort("user cancelled");
const cancelled = await execute("sequence_query_viewer", { sessionId, query: "records" }, { signal: controller.signal });
note("pre-aborted dispatch refused", cancelled.raw.isError === true && /ABORTED|cancel/i.test(JSON.stringify(cancelled.raw.error ?? {})), JSON.stringify(cancelled.raw.error ?? {}).slice(0, 110));

// --- Slide: loopback DICOMweb refuses non-local endpoints (typed failure) ---
const slideBad = await execute("slide_query_dicomweb", { endpoint: "https://pacs.example.com", query: "studies" });
const slideBadBody = JSON.stringify(slideBad.payload ?? slideBad.raw);
note("slide_query_dicomweb typed refusal without session", slideBadBody.includes('\"code\"') && slideBadBody.includes('SESSION_ID_REQUIRED'), slideBadBody.slice(0, 140));

// --- NGS readiness (snakemake/nextflow availability is environment truth) ---
const readiness = await execute("ngs_check_snakemake_readiness", { workflow_id: "oai_fastq_qc", run_dir: process.cwd() });
note("ngs_check_snakemake_readiness", readiness.raw.isError !== true && readiness.payload?.status !== "failed", `ready=${JSON.stringify(readiness.payload?.ready ?? readiness.payload?.blockers ?? "?").slice(0, 100)}`);

await bundleFiber.dispose();
note("dispose removes all tools", ctx.tools.schemas().length === 0, `${ctx.tools.schemas().length} remain`);

// --- Output-schema battery: run representative successful operations through
// ToolRuntime with science tools registered directly (no approval
// interceptor) so every top-level result field is validated against the
// generated output schema. Any INVALID_TOOL_OUTPUT here is a real contract
// defect that fixture-only testing misses.
const shapeCtx = new Context();
const shapePrompt = shapeCtx.plugin(SystemPrompt, {}); await shapePrompt;
const shapeTools = shapeCtx.plugin(ToolRuntime, { mode: "native" }); await shapeTools;
const shapeRuntime = new bundle.ScienceRuntime();
for (const tool of bundle.createScienceTools(shapeRuntime)) shapeCtx.tools.register(tool);

async function shapeExecute(name, args) {
  const result = await shapeCtx.tools.execute({ callId: `shape-${name}-${Math.random().toString(36).slice(2, 8)}`, name, arguments: args, signal: new AbortController().signal, agent: shapeAgent });
  const textBlock = Array.isArray(result.content) ? result.content.find((block) => block.type === "text") : null;
  let payload = null;
  if (textBlock && typeof textBlock.text === "string" && textBlock.text.trim().startsWith("{")) {
    try { payload = JSON.parse(textBlock.text); } catch { payload = null; }
  }
  return { raw: result, payload };
}

const fastqPath = resolve("showcases/biological-sequence-viewer/cases/sequence-fastq-qc/inputs/DRR037765.first500.fastq");
const rasPath2 = resolve("showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta");
const pdb2 = resolve("showcases/molecular-structure-viewer/cases/structure-gfp-figure/inputs/1EMA.pdb");

const shapeChecks = [
  ["sequence_open_from_chat", { path: fastqPath }],
  ["sequence_run_analysis", { sessionId: "@seqFastq", analysis: "quality-report" }],
  ["sequence_open_from_chat", { path: rasPath2 }],
  ["sequence_run_analysis", { sessionId: "@seqAln", analysis: "distance-matrix" }],
  ["sequence_align", { sessionId: "@seqAln", algorithm: "builtin-center-star" }],
  ["sequence_save_session", { sessionId: "@seqAln", name: "audit-alignment" }],
  ["ngs_list_workflows", {}],
  ["ngs_get_runtime_environment", {}],
  ["ngs_check_snakemake_readiness", { workflow_id: "oai_fastq_qc", run_dir: process.cwd() }],
  ["ngs_save_workflow", { workflow_id: "audit-wf", name: "Audit workflow", engine: "snakemake", source: { kind: "local", root: "workflows/fastq_qc", entrypoint: "workflow/Snakefile" } }],
  ["ngs_list_ngs_runs", {}],
  ["structure_open_from_chat", { path: pdb2 }],
  ["structure_query", { sessionId: "@structure", expression: "all", limit: 50 }],
  ["structure_analyze", { sessionId: "@structure", kind: "principal_axes", selections: [{ kind: "residue", chain: "A", residue: 64 }] }],
  ["structure_get_state", { sessionId: "@structure" }],
  ["structure_list_scenes", { sessionId: "@structure" }],
  ["slide_get_capabilities", {}],
];

const sessionIds = {};
const shapeAgent = { id: "shape-agent" };
let shapeFailures = 0;
for (const [name, args] of shapeChecks) {
  const resolvedArgs = { ...args };
  for (const [key, value] of Object.entries(resolvedArgs)) {
    if (typeof value === "string" && value.startsWith("@")) {
      const kind = value.slice(1);
      if (!sessionIds[kind]) {
        const opener = kind === "structure" ? "structure_open_from_chat" : "sequence_open_from_chat";
        const openerPath = kind === "structure" ? pdb2 : kind === "seqFastq" ? fastqPath : rasPath2;
        const openedShape = await shapeExecute(opener, { path: openerPath });
        sessionIds[kind] = openedShape.payload?.viewerSessionId ?? null;
      }
      resolvedArgs[key] = sessionIds[kind];
    }
  }
  const outcome = await shapeExecute(name, resolvedArgs);
  const invalid = outcome.raw.isError === true && outcome.raw.error?.info?.code === "INVALID_TOOL_OUTPUT";
  const pass = outcome.raw.isError !== true;
  if (!pass) shapeFailures += 1;
  note(`shape: ${name}`, pass, invalid ? String(outcome.raw.error?.message ?? "").slice(0, 160) : `ok`);
}
await shapeRuntime.dispose();

const failures = out.checks.filter((check) => !check.pass);
console.log(`\n${out.checks.length - failures.length}/${out.checks.length} checks passed`);
process.exit(failures.length ? 1 : 0);
