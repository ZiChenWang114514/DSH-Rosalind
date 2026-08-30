import { Context, type Fiber } from "@deepseek-ai/cordis";
import SkillRegistry from "@deepseek-ai/dsh-skill";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolExecutionInput } from "@deepseek-ai/dsh-tools";
import { afterEach, describe, expect, it } from "vitest";

import * as bundle from "../src/index.js";

interface Fixture { ctx: Context; fibers: Fiber[] }
const fixtures: Fixture[] = [];

function callId(value: string): ToolExecutionInput["callId"] {
  return value as ToolExecutionInput["callId"];
}

async function mount(): Promise<Fixture> {
  const ctx = new Context();
  const system = ctx.plugin(SystemPrompt, {}); await system;
  const tools = ctx.plugin(ToolRuntime, { mode: "native" }); await tools;
  const skills = ctx.plugin(SkillRegistry, {}); await skills;
  const plugin = ctx.plugin(bundle); await plugin;
  const fixture = { ctx, fibers: [plugin, skills, tools, system] };
  fixtures.push(fixture);
  return fixture;
}

async function dispose(fixture: Fixture): Promise<void> {
  const index = fixtures.indexOf(fixture);
  if (index >= 0) fixtures.splice(index, 1);
  for (const fiber of fixture.fibers) await fiber.dispose();
}

async function execute(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({ callId: callId(`approval-policy-${name}`), name, arguments: args, signal: new AbortController().signal });
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0).reverse()) await dispose(fixture);
});

describe("DSH host approval policy", () => {
  it("does not let model arguments authorize plan approval or workspace writes", async () => {
    const { ctx } = await mount();
    const requests = [
      ["rosalind_approve", { run_id: "run-model-supplied", acknowledgements: [] }],
      ["rosalind_export", { showcase_id: "sequence-ras-alignment", format: "review-json", output_path: "artifacts/approval-denied.json", approved: true }],
      ["sequence_export_artifact", { sessionId: "missing", format: "json" }],
      ["structure_export", { sessionId: "missing", format: "scene-json", outputPath: "artifacts/approval-denied-scene.json", overwrite: true }],
      ["structure_render_image", { sessionId: "missing", outputPath: "artifacts/approval-denied.png", overwrite: true }],
      ["structure_render_movie", { sessionId: "missing", outputPath: "artifacts/approval-denied.mp4", overwrite: true }],
      ["slide_control_viewer", { sessionId: "missing", action: "save_project" }],
      ["slide_export_dicom_object", { path: "input.dcm", outputPath: "output.dcm" }],
      ["slide_prepare_dicom_upload", { paths: ["input.dcm"], endpoint: "https://example.invalid/dicomweb" }],
      ["slide_submit_dicom_upload", { sessionId: "missing", preparedOperation: "model-supplied" }],
    ] as const;

    for (const [name, args] of requests) {
      const result = await execute(ctx, name, args);
      expect(result.isError, name).toBe(true);
      if (result.isError) expect(result.error.message, name).toMatch(/approval|unavailable|denied/i);
    }
  });

  it("allows non-writing Slide controls and non-writing export previews to reach their scientific diagnostics", async () => {
    const { ctx } = await mount();
    const slide = await execute(ctx, "slide_control_viewer", { sessionId: "missing", action: "set_theme", mode: "dark" });
    expect(slide.isError).toBe(false);
    if (!slide.isError) expect(slide.value).toMatchObject({ status: "failed", error: { code: "SESSION_NOT_FOUND" } });

    const preview = await execute(ctx, "rosalind_export", { showcase_id: "sequence-ras-alignment", format: "review-json", output_path: "artifacts/approval-preview.json", approved: false });
    expect(preview.isError).toBe(false);
    if (!preview.isError) expect(preview.value).toMatchObject({ status: "awaiting_confirmation" });
  });
});
