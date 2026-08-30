import type { ClientContext, SettingsScope } from "@deepseek-ai/dsh-client-runtime/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";

import { SHOWCASES } from "../generated/catalog.js";
import {
  MODULE_SETTING_IDS,
  MODULE_SETTINGS_NAMESPACE_VALUE,
  type ModuleSettingId,
  type ModuleSettingsView,
} from "../shared/module-settings-contract.js";

export interface ModuleDetails {
  id: ModuleSettingId;
  configuration: readonly string[];
  tools: readonly string[];
  skills: readonly string[];
  showcases: readonly string[];
}

const TOOL_EXAMPLES: Record<ModuleSettingId, readonly string[]> = {
  literature: ["literature_request"],
  databases: ["database_request"],
  sequence: ["sequence_open_from_chat", "sequence_align", "sequence_export_artifact"],
  ngs: ["ngs_list_workflows", "ngs_check_readiness", "ngs_execute_plan"],
  structure: ["structure_open_from_chat", "structure_get_state", "structure_render_image"],
  slide: ["slide_open_from_chat", "slide_get_viewer_state", "slide_control_viewer"],
  rosalind: ["rosalind_plan", "rosalind_approve", "rosalind_run", "rosalind_status"],
};

const CONFIGURATION: Record<ModuleSettingId, readonly string[]> = {
  literature: ["实时公共文献检索：DSH_ROSALIND_ENABLE_LIVE_NETWORK"],
  databases: ["实时公共数据库检索：DSH_ROSALIND_ENABLE_LIVE_NETWORK"],
  sequence: ["本地序列校验器，无必需凭据"],
  ngs: ["本地工作流需要与计划相符的 Nextflow 或 Snakemake 环境"],
  structure: ["本地结构校验器，无必需凭据"],
  slide: ["本地切片与空间数据校验器，无必需凭据"],
  rosalind: ["本地研究工作台，无必需凭据"],
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function categoryId(id: ModuleSettingId): string {
  return id === "rosalind" ? "workbench" : id;
}

export const MODULE_DETAILS: readonly ModuleDetails[] = MODULE_SETTING_IDS.map((id) => {
  const showcases = SHOWCASES.filter((showcase) => showcase.status === "ready" && showcase.categoryId === categoryId(id));
  return {
    id,
    configuration: CONFIGURATION[id],
    tools: TOOL_EXAMPLES[id],
    skills: unique(showcases.flatMap((showcase) => showcase.requiredSkills)),
    showcases: showcases.map((showcase) => showcase.title),
  };
});

export function bindModuleSettingsScope(ctx: ClientContext): SettingsScope<ModuleSettingsView> {
  return ctx.settingsScope.bind<ModuleSettingsView>({ namespace: MODULE_SETTINGS_NAMESPACE_VALUE });
}
