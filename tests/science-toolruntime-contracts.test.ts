import { Context } from "@deepseek-ai/cordis";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { afterEach, describe, expect, it } from "vitest";

import { ScienceRuntime } from "../src/host/science/runtime.js";
import { createScienceTools } from "../src/host/science-tools.js";

const fastqPath = "showcases/rosalind-workbench/cases/rosalind-nextflow-snakemake/inputs/DRR037765-first-500.fastq";
const rasAlignmentPath = "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta";

function callId(value: string): ToolExecutionInput["callId"] { return value as ToolExecutionInput["callId"]; }

describe("NGS and Sequence tools through the strict DSH ToolRuntime contract", () => {
  let context: Context | undefined;
  let runtimeFiber: { dispose(): Promise<void> } | undefined;
  let promptFiber: { dispose(): Promise<void> } | undefined;
  let unregister: Array<() => void> = [];

  afterEach(async () => {
    for (const dispose of unregister.reverse()) dispose(); unregister = [];
    await runtimeFiber?.dispose(); await promptFiber?.dispose();
    context = undefined; runtimeFiber = undefined; promptFiber = undefined;
  });

  async function mount(): Promise<void> {
    context = new Context(); promptFiber = context.plugin(SystemPrompt, {}); await promptFiber;
    runtimeFiber = context.plugin(ToolRuntime, { mode: "native" }); await runtimeFiber;
    unregister = createScienceTools(new ScienceRuntime()).map((tool) => context!.tools.register(tool));
  }

  it("reports snakemake readiness without INVALID_TOOL_OUTPUT", async () => {
    await mount();
    const call = (name: string, arguments_: Record<string, unknown>) => context!.tools.execute({ callId: callId(`ngs-runtime-${name}`), name, arguments: arguments_, signal: new AbortController().signal });
    const readiness = await call("ngs_check_snakemake_readiness", { workflow_id: "oai_fastq_qc", run_dir: process.cwd() });
    expect(readiness.isError, JSON.stringify(readiness)).toBe(false);
    if (!readiness.isError) {
      expect(readiness.value).toMatchObject({ serviceId: "ngs", operation: "check_snakemake_readiness", checkedAt: expect.any(String) });
    }
  });

  it("runs the contract-named quality-report analysis on an opened FASTQ session", async () => {
    await mount();
    const call = (name: string, arguments_: Record<string, unknown>) => context!.tools.execute({ callId: callId(`sequence-runtime-${name}`), name, arguments: arguments_, signal: new AbortController().signal });
    const opened = await call("sequence_open_from_chat", { path: fastqPath });
    expect(opened.isError, JSON.stringify(opened)).toBe(false);
    if (opened.isError) return;
    const sessionId = (opened.value as Record<string, unknown>).viewerSessionId as string;
    const analysis = await call("sequence_run_analysis", { sessionId, analysis: "quality-report" });
    expect(analysis.isError, JSON.stringify(analysis)).toBe(false);
    if (!analysis.isError) {
      expect(analysis.value).toMatchObject({ serviceId: "sequence", operation: "sequence.run_analysis", status: "completed", analysis: "quality-report", result: expect.objectContaining({ readCount: expect.any(Number) }) });
    }
  });

  it("keeps explicit typed unavailability for contract analyses with no local implementation", async () => {
    await mount();
    const call = (name: string, arguments_: Record<string, unknown>) => context!.tools.execute({ callId: callId(`sequence-runtime-${name}`), name, arguments: arguments_, signal: new AbortController().signal });
    const opened = await call("sequence_open_from_chat", { path: rasAlignmentPath });
    expect(opened.isError, JSON.stringify(opened)).toBe(false);
    if (opened.isError) return;
    const sessionId = (opened.value as Record<string, unknown>).viewerSessionId as string;
    const restricted = await call("sequence_run_analysis", { sessionId, analysis: "restriction-analysis" });
    expect(restricted.isError, JSON.stringify(restricted)).toBe(false);
    if (!restricted.isError) {
      expect(restricted.value).toMatchObject({ status: "failed", error: { code: "SEQUENCE_OPERATION_FAILED", message: expect.stringContaining("restriction-analysis") } });
    }
  });
});
