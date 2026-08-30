import type { ToolCallOwnerProps } from "@deepseek-ai/dsh-client-ui-tool/client";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { LocalSlideCanvas, type SlideRectangle, type SlideTile } from "./viewers/slide/canvas.js";
import { LocalStructureCanvas, STRUCTURE_CANVAS_RENDER_LIMIT, type StructureCanvasAtom } from "./viewers/structure/canvas.js";

type JsonRecord = Record<string, unknown>;
type ViewerKind = "sequence" | "ngs" | "structure" | "slide";
export const SEQUENCE_RECORD_RENDER_LIMIT = 250;

interface ParsedScienceCall {
  args: JsonRecord;
  error: { code?: string; message: string } | null;
  payload: JsonRecord | null;
  running: boolean;
}

interface ArtifactLink {
  label: string;
  path: string;
}

export const SEQUENCE_TOOLS = [
  "sequence_acquire_public_example", "sequence_align", "sequence_cancel_job", "sequence_control_viewer",
  "sequence_edit_copy", "sequence_export_artifact", "sequence_load_track", "sequence_manage_annotations",
  "sequence_open_from_chat", "sequence_query_viewer", "sequence_restore_session", "sequence_run_analysis",
  "sequence_save_session",
] as const;

export const NGS_TOOLS = [
  "ngs_activate_workflow_version", "ngs_archive_workflow", "ngs_cancel_ngs_run", "ngs_check_nextflow_readiness",
  "ngs_check_snakemake_readiness", "ngs_execute_plan", "ngs_get_ngs_run", "ngs_get_runtime_environment",
  "ngs_list_ngs_run_lineages", "ngs_list_ngs_runs", "ngs_list_workflow_versions", "ngs_list_workflows",
  "ngs_observe_ngs_run", "ngs_plan_nextflow", "ngs_plan_snakemake", "ngs_restore_workflow",
  "ngs_save_workflow", "ngs_update_ngs_run_analysis_summary", "ngs_update_workflow", "ngs_configure_ssh_target",
  "ngs_inspect_compute_target", "ngs_list_compute_targets",
] as const;

export const STRUCTURE_TOOLS = [
  "structure_add_structure", "structure_align_structures", "structure_analyze", "structure_apply_scene",
  "structure_assembly_symmetry", "structure_browse_related_data", "structure_cancel_render", "structure_control_viewer",
  "structure_delete_scene", "structure_derive_object", "structure_discover_density", "structure_export",
  "structure_get_render_status", "structure_get_state", "structure_list_scenes", "structure_list_structures",
  "structure_load_background", "structure_load_data", "structure_load_public_density", "structure_load_scene",
  "structure_manage_guides", "structure_measure", "structure_open_from_chat", "structure_pymol_action",
  "structure_pymol_actions", "structure_quality_assessment", "structure_query", "structure_redo",
  "structure_remove_structure", "structure_render_image", "structure_render_movie", "structure_save_scene",
  "structure_search_motif", "structure_set_assembly_symmetry", "structure_set_object_visibility",
  "structure_set_quality_assessment", "structure_set_selection", "structure_set_trajectory_state",
  "structure_transform_object", "structure_undo", "structure_validate_render",
] as const;

export const SLIDE_TOOLS = [
  "slide_cancel_analysis_from_chat", "slide_cancel_pathology", "slide_cancel_scientific_layer_import",
  "slide_cancel_workflow", "slide_export_dicom_object", "slide_get_analysis_from_chat", "slide_get_capabilities",
  "slide_get_live_workflow", "slide_get_pathology", "slide_get_scientific_entity",
  "slide_get_scientific_layer_import", "slide_get_viewer_state", "slide_get_workflow",
  "slide_import_analysis_source_from_chat", "slide_import_dicom_object", "slide_import_scientific_layer",
  "slide_import_workflow_source", "slide_inspect_dicomweb_instance", "slide_list_scientific_layers",
  "slide_list_workflow_sources", "slide_list_workflows", "slide_open_dicom_series", "slide_open_dicomweb_wsi",
  "slide_open_from_chat", "slide_open_ome_tiff_series", "slide_open_ome_zarr", "slide_prepare_dicom_upload",
  "slide_query_dicomweb", "slide_query_viewer", "slide_read_dicomweb_object", "slide_read_live_workflow_artifact",
  "slide_read_workflow_artifact", "slide_renew_scientific_layer_authorization",
  "slide_renew_source_authorization", "slide_resume_pathology", "slide_resume_workflow", "slide_run_workflow",
  "slide_spatial_indexed", "slide_submit_dicom_upload", "slide_wait_for_render",
] as const;

export const SCIENCE_VIEWER_TOOL_NAMES = Object.freeze([
  ...SEQUENCE_TOOLS, ...NGS_TOOLS, ...STRUCTURE_TOOLS, ...SLIDE_TOOLS,
]);

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function prettyLabel(value: string): string {
  return value.replace(/^(sequence|ngs|structure|slide)_/, "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function domToken(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_-]/g, "");
}

function useNonPassiveWheel<T extends Element>(handler: (event: WheelEvent) => void) {
  const elementRef = useRef<T | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    const listener = (event: Event) => handlerRef.current(event as WheelEvent);
    element.addEventListener("wheel", listener, { passive: false });
    return () => element.removeEventListener("wheel", listener);
  }, []);
  return elementRef;
}

function jsonObject(raw: string | null | undefined): JsonRecord {
  if (!raw) return {};
  try { return record(JSON.parse(raw)); } catch { return {}; }
}

function parseCall(props: ToolCallOwnerProps): ParsedScienceCall {
  if (!("kind" in props.block)) {
    return { args: jsonObject(props.block.argsRaw), error: null, payload: null, running: true };
  }
  const args = jsonObject(props.block.call?.argsRaw);
  let payload: JsonRecord | null = null;
  for (const block of props.block.content) {
    const candidate = record(block);
    if (candidate.type !== "text" || typeof candidate.text !== "string") continue;
    const parsed = jsonObject(candidate.text);
    if (Object.keys(parsed).length) { payload = parsed; break; }
  }
  const resultError = props.block.error;
  const payloadError = record(payload?.error);
  const error = props.block.isError || payload?.ok === false
    ? {
        ...(text(resultError?.code ?? payloadError.code) ? { code: text(resultError?.code ?? payloadError.code)! } : {}),
        message: text(payloadError.message) ?? text(record(payload).message) ?? resultError?.name ?? "The scientific operation reported an error.",
      }
    : null;
  return { args, error, payload, running: false };
}

function viewerKind(toolName: string): ViewerKind {
  if (toolName.startsWith("sequence_")) return "sequence";
  if (toolName.startsWith("ngs_")) return "ngs";
  if (toolName.startsWith("structure_")) return "structure";
  return "slide";
}

function stateFrom(payload: JsonRecord | null): JsonRecord {
  if (!payload) return {};
  const nested = record(payload.state);
  return Object.keys(nested).length ? nested : payload;
}

function scalarFacts(source: JsonRecord, preferred: readonly string[], limit = 6): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();
  const add = (key: string, value: unknown) => {
    const display = text(value);
    if (!display || seen.has(key) || display.length > 72) return;
    facts.push({ label: prettyLabel(key), value: display }); seen.add(key);
  };
  for (const key of preferred) add(key, source[key]);
  for (const [key, value] of Object.entries(source)) {
    if (facts.length >= limit) break;
    add(key, value);
  }
  return facts.slice(0, limit);
}

function collectArtifacts(value: unknown, depth = 0, found = new Map<string, ArtifactLink>()): ArtifactLink[] {
  if (depth > 4 || value == null) return [...found.values()];
  if (Array.isArray(value)) {
    for (const item of value) collectArtifacts(item, depth + 1, found);
    return [...found.values()];
  }
  const candidate = record(value);
  for (const key of ["path", "filePath", "summary_path", "sourcePath", "run_dir"]) {
    const path = text(candidate[key]);
    if (path && (/[/\\]/.test(path) || /\.[A-Za-z0-9]{2,8}$/.test(path))) found.set(path, { label: prettyLabel(key), path });
  }
  for (const nested of Object.values(candidate)) if (nested && typeof nested === "object") collectArtifacts(nested, depth + 1, found);
  return [...found.values()].slice(0, 8);
}

function ToolHeader({ kind, operation, parsed, inspect, titleId }: { kind: ViewerKind; operation: string; parsed: ParsedScienceCall; inspect?: () => void; titleId: string }): JSX.Element {
  const titles: Record<ViewerKind, string> = { sequence: "Sequence & alignment", ngs: "NGS workbench", structure: "Molecular structure", slide: "Slide & spatial" };
  const state = parsed.running ? "running" : parsed.error ? "failed" : text(parsed.payload?.state ?? parsed.payload?.status) ?? "complete";
  return <header className="sv-head">
    <div className={`sv-app-mark sv-app-mark--${kind}`} aria-hidden="true">{kind === "sequence" ? "Aa" : kind === "ngs" ? "NG" : kind === "structure" ? "3D" : "WS"}</div>
    <div className="sv-head-copy"><strong id={titleId}>{titles[kind]}</strong><span>{prettyLabel(operation)}</span></div>
    <span className={`sv-state sv-state--${state.replaceAll(/[^a-z-]/gi, "").toLowerCase()}`}>{state}</span>
    {inspect ? <button className="sv-quiet-button" onClick={inspect} type="button">Inspect call</button> : null}
  </header>;
}

function TabStrip({ active, labels, onChange, ariaLabel, idPrefix, panelId }: { active: string; labels: readonly string[]; onChange: (value: string) => void; ariaLabel: string; idPrefix: string; panelId: string }): JSX.Element {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? labels.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + labels.length) % labels.length;
    const label = labels[next];
    if (label) {
      onChange(label);
      tabs.current[next]?.focus();
    }
  };
  return <div className="sv-tabs" role="tablist" aria-label={ariaLabel} aria-orientation="horizontal">{labels.map((label, index) => <button
    aria-controls={panelId}
    aria-selected={active === label}
    className="sv-tab"
    id={`${idPrefix}-${domToken(label.toLowerCase())}`}
    key={label}
    onClick={() => onChange(label)}
    onKeyDown={(event) => onKeyDown(event, index)}
    role="tab"
    ref={(element) => { tabs.current[index] = element; }}
    tabIndex={active === label ? 0 : -1}
    type="button"
  >{label}</button>)}</div>;
}

function FactGrid({ facts }: { facts: Array<{ label: string; value: string }> }): JSX.Element | null {
  if (!facts.length) return null;
  return <dl className="sv-facts">{facts.map((fact) => <div key={`${fact.label}:${fact.value}`}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>;
}

function ArtifactButtons({ artifacts, openFile }: { artifacts: ArtifactLink[]; openFile: (path: string) => void }): JSX.Element | null {
  if (!artifacts.length) return null;
  return <section className="sv-artifacts" aria-label="Scientific files"><h4>Files</h4><div>{artifacts.map((artifact) => <button key={artifact.path} onClick={() => openFile(artifact.path)} title={artifact.path} type="button"><span>{artifact.label}</span><code>{artifact.path.split(/[/\\]/).at(-1)}</code></button>)}</div></section>;
}

function EmptyResult({ children }: { children: ReactNode }): JSX.Element {
  return <div className="sv-empty">{children}</div>;
}

function findArray(payload: JsonRecord, state: JsonRecord, keys: readonly string[]): JsonRecord[] {
  for (const key of keys) {
    const direct = array(payload[key]); if (direct.length) return direct.map(record);
    const nested = array(state[key]); if (nested.length) return nested.map(record);
    const result = array(record(payload.result)[key]); if (result.length) return result.map(record);
  }
  return [];
}

function SequenceResult({ parsed, openFile }: { parsed: ParsedScienceCall; openFile: (path: string) => void }): JSX.Element {
  const tabIdPrefix = `sv-tabs-${domToken(useId())}`;
  const panelId = `${tabIdPrefix}-panel`;
  const payload = parsed.payload ?? {};
  const state = stateFrom(parsed.payload);
  const inferredMode = text(payload.viewer ?? state.viewer) === "alignment" || findArray(payload, state, ["records", "rows"]).length > 1 ? "Alignment" : "Sequence";
  const [active, setActive] = useState(inferredMode);
  const [filter, setFilter] = useState("");
  const records = findArray(payload, state, ["records", "rows"]);
  const result = record(payload.result);
  const columns = findArray(result, payload, ["columns"]);
  const matchingRecords = records.filter((item) => `${text(item.id) ?? ""} ${text(item.label) ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  const visibleRecords = matchingRecords.slice(0, SEQUENCE_RECORD_RENDER_LIMIT);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollPosition = useRef({ left: 0, top: 0 });
  const facts = scalarFacts({ ...state, ...result }, ["recordCount", "rowCount", "alignedLength", "meanIdentity", "meanConservationNormalized", "readCount", "bases", "q30Fraction"]);
  const artifacts = collectArtifacts(payload);
  const hasMetrics = columns.length > 0 || facts.some((fact) => /identity|conservation|q30/i.test(fact.label));
  const labels = hasMetrics ? [inferredMode, "Metrics"] : [inferredMode];
  const selectTab = (next: string) => {
    if (active === inferredMode && tableScrollRef.current) tableScrollPosition.current = { left: tableScrollRef.current.scrollLeft, top: tableScrollRef.current.scrollTop };
    setActive(next);
  };
  useLayoutEffect(() => {
    if (active !== inferredMode || !tableScrollRef.current) return;
    tableScrollRef.current.scrollLeft = tableScrollPosition.current.left;
    tableScrollRef.current.scrollTop = tableScrollPosition.current.top;
  }, [active, inferredMode]);
  let content: JSX.Element;
  if (active === "Metrics") {
    content = <>
      <FactGrid facts={facts} />
      {columns.length ? <div className="sv-metric-track" aria-label="Per-column metric track">{columns.slice(0, 96).map((column, index) => {
        const identity = number(column.identity ?? column.conservation ?? column.meanQuality) ?? 0;
        return <i key={text(column.column ?? column.cycle) ?? String(index)} style={{ height: `${Math.max(3, Math.min(100, identity <= 1 ? identity * 100 : identity))}%` }} title={`${text(column.column ?? column.cycle) ?? index + 1}: ${identity.toFixed(3)}`} />;
      })}</div> : <EmptyResult>The result contains summary metrics without per-column values.</EmptyResult>}
    </>;
  } else if (visibleRecords.length) {
    content = <div className="sv-sequence-table-wrap" ref={tableScrollRef}>
      <table className="sv-sequence-table">
        <thead><tr><th>Record</th><th>Type</th><th>Length</th><th>Result projection</th></tr></thead>
        <tbody>{visibleRecords.map((item, index) => {
          const sequence = text(item.sequence);
          const length = number(item.length) ?? (sequence ? sequence.replaceAll(/[-.\s]/g, "").length : 0);
          const barStyle = { "--sv-length": `${Math.max(8, Math.min(100, length / 2))}%` } as CSSProperties;
          return <tr key={text(item.id) ?? String(index)}>
            <th scope="row"><strong>{text(item.id) ?? `record-${index + 1}`}</strong><small>{text(item.label)}</small></th>
            <td>{text(item.moleculeType ?? item.type) ?? "—"}</td>
            <td>{length || "—"}</td>
            <td>{sequence ? <code className="sv-residues">{sequence.slice(0, 60)}</code> : <span className="sv-length-bar" style={barStyle}><i /></span>}</td>
          </tr>;
        })}</tbody>
      </table>
      {matchingRecords.length > visibleRecords.length ? <p className="sv-limit-note" role="status">Showing the first {visibleRecords.length.toLocaleString()} of {matchingRecords.length.toLocaleString()} matching records. Refine the filter to inspect another range.</p> : null}
      {visibleRecords.every((item) => !text(item.sequence)) ? <p className="sv-data-note">This tool result carries record identity and lengths; residue strings remain in the active viewer session or source file.</p> : null}
    </div>;
  } else {
    content = <EmptyResult>No sequence records are present in this tool result.</EmptyResult>;
  }
  return <div className="sv-sequence">
    <div className="sv-toolbar" data-sequence-toolbar-controls="dsh"><label><span className="rr-visually-hidden">Filter sequence records</span><input onChange={(event) => setFilter(event.target.value)} placeholder="Filter records" type="search" value={filter} /></label><span>{matchingRecords.length} record{matchingRecords.length === 1 ? "" : "s"}</span></div>
    <TabStrip active={active} ariaLabel="Sequence result views" idPrefix={tabIdPrefix} labels={labels} onChange={selectTab} panelId={panelId} />
    <div aria-labelledby={`${tabIdPrefix}-${domToken(active.toLowerCase())}`} className="sv-panel" id={panelId} role="tabpanel" tabIndex={0}>
      {content}
    </div>
    <ArtifactButtons artifacts={artifacts} openFile={openFile} />
  </div>;
}

function statusTone(status: string): string {
  if (/complete|ready|success/i.test(status)) return "complete";
  if (/fail|block|error|orphan/i.test(status)) return "failed";
  if (/cancel|stop/i.test(status)) return "cancelled";
  return "running";
}

function NgsResult({ parsed, openFile }: { parsed: ParsedScienceCall; openFile: (path: string) => void }): JSX.Element {
  const tabIdPrefix = `sv-tabs-${domToken(useId())}`;
  const panelId = `${tabIdPrefix}-panel`;
  const payload = parsed.payload ?? {};
  const [active, setActive] = useState("Runs");
  const workflows = findArray(payload, payload, ["workflows", "pipelines", "versions"]);
  const runs = findArray(payload, payload, ["runs", "lineages"]);
  const targets = findArray(payload, payload, ["targets"]);
  const singleRun = text(payload.registry_run_id) ? payload : null;
  const readiness = record(payload.readiness);
  const events = findArray(payload, singleRun ?? {}, ["events"]);
  const diagnostics = array(payload.diagnostics ?? readiness.diagnostics ?? record(payload.diagnostic).diagnostics).map(text).filter((item): item is string => Boolean(item));
  const artifacts = collectArtifacts(payload);
  const labels = ["Runs", "Workflows", "Compute"];
  const status = text(payload.state ?? payload.status ?? readiness.code) ?? (workflows.length ? "catalogued" : "complete");
  const runRows = singleRun ? [singleRun] : runs;
  let content: JSX.Element;
  if (active === "Runs") {
    content = runRows.length ? <div className="sv-run-layout">
      <section><p className="sv-section-label">Analysis and execution</p>{runRows.map((run, index) => {
        const runStatus = text(run.state ?? run.status) ?? status;
        const title = text(run.display_name ?? run.workflow_id ?? run.workflow) ?? `Run ${index + 1}`;
        return <article className="sv-run-card" key={text(run.registry_run_id ?? run.run_id) ?? String(index)}><div><strong>{title}</strong><code>{text(run.registry_run_id ?? run.run_id) ?? "recorded result"}</code></div><span className={`sv-run-state sv-run-state--${statusTone(runStatus)}`}>{runStatus}</span></article>;
      })}</section>
      <aside><p className="sv-section-label">Recorded events</p>{events.length ? <ol className="sv-timeline">{events.map((event, index) => <li key={text(event.at) ?? String(index)}><i /><div><strong>{text(event.state) ?? `Event ${index + 1}`}</strong><span>{text(event.message ?? event.at) ?? "Recorded by the NGS service"}</span></div></li>)}</ol> : <EmptyResult>No execution events were returned for this call.</EmptyResult>}</aside>
    </div> : <div><FactGrid facts={scalarFacts({ ...payload, ...readiness }, ["plan_id", "plan_name", "workflow_id", "engine", "ready", "code", "state"])} />{diagnostics.length ? <ul className="sv-diagnostics">{diagnostics.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div>;
  } else if (active === "Workflows") {
    content = workflows.length ? <div className="sv-pipeline-grid">{workflows.map((workflow, index) => <article key={text(workflow.workflow_id ?? workflow.id) ?? String(index)}><span>{text(workflow.engine) ?? "workflow"}</span><strong>{text(workflow.name ?? workflow.title ?? workflow.workflow_id) ?? `Pipeline ${index + 1}`}</strong><p>{text(workflow.description) ?? "Versioned workflow record returned by the NGS service."}</p><small>{text(workflow.version_count) ? `${text(workflow.version_count)} versions` : text(workflow.active_version_id)}</small></article>)}</div> : <EmptyResult>No workflow catalogue was included in this operation result.</EmptyResult>;
  } else {
    content = targets.length ? <div className="sv-target-list">{targets.map((target, index) => <article key={text(target.id) ?? String(index)}><i /><div><strong>{text(target.title ?? target.id) ?? `Target ${index + 1}`}</strong><span>{text(target.kind ?? target.status) ?? "compute target"}</span></div></article>)}</div> : <><FactGrid facts={scalarFacts(record(payload.runtime), ["platform", "node", "nextflow", "snakemake"])} /><EmptyResult>{diagnostics[0] ?? "No compute target list was included in this operation result."}</EmptyResult></>;
  }
  return <div className="sv-ngs">
    <TabStrip active={active} ariaLabel="NGS result views" idPrefix={tabIdPrefix} labels={labels} onChange={setActive} panelId={panelId} />
    <div aria-labelledby={`${tabIdPrefix}-${domToken(active.toLowerCase())}`} className="sv-panel sv-ngs-panel" id={panelId} role="tabpanel" tabIndex={0}>
      {content}
    </div>
    <ArtifactButtons artifacts={artifacts} openFile={openFile} />
  </div>;
}

function nestedNumber(source: JsonRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const direct = number(source[key]); if (direct != null) return direct;
    for (const value of Object.values(source)) {
      const nested = record(value); const candidate = number(nested[key]); if (candidate != null) return candidate;
    }
  }
  return null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function StructureResult({ parsed, openFile }: { parsed: ParsedScienceCall; openFile: (path: string) => void }): JSX.Element {
  const tabIdPrefix = `sv-tabs-${domToken(useId())}`;
  const panelId = `${tabIdPrefix}-panel`;
  const payload = parsed.payload ?? {};
  const state = stateFrom(parsed.payload);
  const [active, setActive] = useState("Scene");
  const objects = findArray(payload, state, ["objects", "structures", "structureObjects", "layers", "layerSummaries"]);
  const analyses = findArray(payload, state, ["analyses", "measurements", "results", "contacts", "hydrogenBonds", "clashes"]);
  const atoms = findArray(payload, state, ["atoms", "items"]);
  const atomCount = nestedNumber({ ...payload, ...state }, ["atomCount", "atoms"]);
  const residueCount = nestedNumber({ ...payload, ...state }, ["polymerResidueCount", "residueCount", "residues"]);
  const ligandCount = nestedNumber({ ...payload, ...state }, ["ligandCount", "ligands"]);
  const artifacts = collectArtifacts(payload);
  const scene = record(state.scene ?? payload.scene);
  const structure = record(payload.structure ?? state.structure);
  const viewerAtoms = useMemo(() => {
    const visible: StructureCanvasAtom[] = [];
    for (let index = 0; index < atoms.length && visible.length < STRUCTURE_CANVAS_RENDER_LIMIT; index += 1) {
      const atom = atoms[index];
      if (!atom) continue;
      const coordinates = record(atom.coordinates);
      const x = number(coordinates.x ?? atom.x), y = number(coordinates.y ?? atom.y), z = number(coordinates.z ?? atom.z);
      if (x == null || y == null || z == null) continue;
      visible.push({
        atomId: text(atom.atomId ?? atom.id ?? atom.key) ?? `atom-${index + 1}`,
        element: text(atom.element) ?? "C",
        ...(text(atom.objectId) ? { objectId: text(atom.objectId)! } : {}),
        x, y, z,
      });
    }
    return visible;
  }, [atoms]);
  const [renderedAtomCount, setRenderedAtomCount] = useState<number | null>(null);
  return <div className="sv-structure">
    <TabStrip active={active} ariaLabel="Molecular structure result views" idPrefix={tabIdPrefix} labels={["Scene", "Objects", "Analysis"]} onChange={setActive} panelId={panelId} />
    <div aria-labelledby={`${tabIdPrefix}-${domToken(active.toLowerCase())}`} className="sv-panel" id={panelId} role="tabpanel" tabIndex={0}>
      {active === "Scene" ? <div className="sv-structure-layout"><div className="sv-scene sv-scene--molstar" aria-label="Molecular scene state" data-client-render-ready={viewerAtoms.length > 0 && renderedAtomCount !== null ? "true" : "false"}><LocalStructureCanvas atoms={viewerAtoms} background="dark" onRenderReady={({ renderedAtomCount: count }) => setRenderedAtomCount(count)} /><div aria-live="polite" className="sv-scene-state">{viewerAtoms.length === 0 ? "Waiting for structure coordinates from the DSH session" : renderedAtomCount !== null ? `Local coordinate render confirmed · ${renderedAtomCount.toLocaleString()}${atoms.length > renderedAtomCount ? ` of ${atoms.length.toLocaleString()}` : ""} returned coordinates · drag, wheel, or arrow keys to inspect` : `Loading ${viewerAtoms.length.toLocaleString()}${atoms.length > viewerAtoms.length ? ` of ${atoms.length.toLocaleString()}` : ""} returned coordinates`}</div></div><aside><FactGrid facts={[{ label: "Atoms", value: atomCount == null ? "—" : atomCount.toLocaleString() }, { label: "Residues", value: residueCount == null ? "—" : residueCount.toLocaleString() }, { label: "Ligands", value: ligandCount == null ? "—" : ligandCount.toLocaleString() }, ...scalarFacts(scene, ["sceneRevision", "geometryRevision", "syncStatus"], 3)]} /></aside></div> : null}
      {active === "Objects" ? objects.length ? <div className="sv-object-list">{objects.map((item, index) => <article key={text(item.id ?? item.key) ?? String(index)}><i style={{ background: text(record(item.color).value ?? item.color) ?? `hsl(${index * 67} 45% 55%)` }} /><div><strong>{text(item.label ?? item.name ?? item.id) ?? `Object ${index + 1}`}</strong><span>{text(item.kind ?? item.representation ?? item.component) ?? "structure object"}</span></div><small>{item.visible === false ? "hidden" : "visible"}</small></article>)}</div> : <EmptyResult>No object list was included in this operation result.</EmptyResult> : null}
      {active === "Analysis" ? analyses.length ? <div className="sv-analysis-list">{analyses.slice(0, 30).map((item, index) => <article key={text(item.id) ?? String(index)}><strong>{text(item.type ?? item.kind ?? item.label) ?? `Result ${index + 1}`}</strong><FactGrid facts={scalarFacts(item, ["distanceAngstrom", "distance", "angle", "rmsd", "tmScore", "count"], 4)} /></article>)}</div> : <><FactGrid facts={scalarFacts(payload, ["rmsd", "tmScore", "contactCount", "pairCount", "sasa", "buriedArea"])} /><EmptyResult>No row-level analysis collection was included in this result.</EmptyResult></> : null}
    </div>
    <ArtifactButtons artifacts={artifacts} openFile={openFile} />
  </div>;
}

interface SlideView {
  panX: number;
  panY: number;
  zoom: number;
}

export function SlideResult({ parsed, openFile }: { parsed: ParsedScienceCall; openFile: (path: string) => void }): JSX.Element {
  const tabIdPrefix = `sv-tabs-${domToken(useId())}`;
  const panelId = `${tabIdPrefix}-panel`;
  const tissuePatternId = `sv-tissue-${domToken(useId())}`;
  const payload = parsed.payload ?? {};
  const state = stateFrom(parsed.payload);
  const [active, setActive] = useState("Slide");
  const source = record(payload.source ?? state.source);
  const width = number(source.width ?? payload.sourceWidth ?? state.sourceWidth ?? payload.width ?? state.width);
  const height = number(source.height ?? payload.sourceHeight ?? state.sourceHeight ?? payload.height ?? state.height);
  const bounds = record(payload.visibleBounds ?? state.visibleBounds);
  const regions = findArray(payload, state, ["selectedRegions", "regions", "annotations"]);
  const layers = findArray(payload, state, ["scientificLayers", "layers", "items"]);
  const spatial = record(payload.spatial ?? state.spatial ?? payload.result);
  const observations = number(spatial.observations ?? spatial.observationCount ?? source.observations);
  const genes = number(spatial.genes ?? source.genes);
  const artifacts = collectArtifacts(payload);
  const labels = observations != null ? ["Slide", "Spatial", "Layers"] : ["Slide", "Layers"];
  const viewBoxWidth = width ?? 1000; const viewBoxHeight = height ?? 700;
  const [view, setView] = useState<SlideView>({ panX: 0, panY: 0, zoom: 1 });
  const [tileView, setTileView] = useState({ panX: 0, panY: 0, zoom: 1 });
  const sourceRevision = text(payload.sourceRevision ?? state.sourceRevision ?? source.sourceRevision ?? source.revision);
  const [localRegions, setLocalRegions] = useState<SlideRectangle[]>([]);
  const tile = useMemo<SlideTile | null>(() => {
    const preview = record(payload.previewTile ?? state.previewTile ?? source.previewTile);
    const dataUrl = text(payload.dataUrl ?? state.dataUrl ?? preview.dataUrl);
    const tileWidth = number(payload.width ?? state.width ?? preview.width), tileHeight = number(payload.height ?? state.height ?? preview.height);
    const revision = text(payload.sourceRevision ?? state.sourceRevision ?? preview.sourceRevision ?? source.sourceRevision);
    if (!dataUrl || tileWidth == null || tileHeight == null || !revision) return null;
    return { dataUrl, x: number(payload.x ?? state.x ?? preview.x) ?? 0, y: number(payload.y ?? state.y ?? preview.y) ?? 0, width: tileWidth, height: tileHeight, sourceRevision: revision };
  }, [payload, state]);
  const canvasRegions = useMemo(() => regions.flatMap((region, index): SlideRectangle[] => {
    const x = number(region.x), y = number(region.y), regionWidth = number(region.width), regionHeight = number(region.height);
    if (x == null || y == null || regionWidth == null || regionHeight == null) return [];
    return [{ id: text(region.id) ?? `region-${index + 1}`, x, y, width: regionWidth, height: regionHeight, ...(text(region.label) ? { label: text(region.label)! } : {}) }];
  }), [regions]);
  const displayedCanvasRegions = useMemo(() => [...canvasRegions, ...localRegions], [canvasRegions, localRegions]);
  const addLocalRegion = (region: Omit<SlideRectangle, "id">) => setLocalRegions((current) => [
    ...current,
    { id: `local-region-${current.length + 1}`, label: "Local region draft", ...region },
  ]);
  useEffect(() => setLocalRegions([]), [sourceRevision]);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const resetView = () => { setView({ panX: 0, panY: 0, zoom: 1 }); setTileView({ panX: 0, panY: 0, zoom: 1 }); };
  const moveView = (x: number, y: number) => setView((current) => ({ ...current, panX: current.panX + x, panY: current.panY + y }));
  const zoomView = (delta: number) => setView((current) => ({ ...current, zoom: clamp(current.zoom + delta, .5, 8) }));
  const wheelRef = useNonPassiveWheel<SVGSVGElement>((event) => { event.preventDefault(); zoomView(event.deltaY < 0 ? .16 : -.16); });
  const onSlideKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const distance = Math.max(viewBoxWidth, viewBoxHeight) * .045 / view.zoom;
    if (event.key === "ArrowLeft") { event.preventDefault(); moveView(-distance, 0); }
    else if (event.key === "ArrowRight") { event.preventDefault(); moveView(distance, 0); }
    else if (event.key === "ArrowUp") { event.preventDefault(); moveView(0, -distance); }
    else if (event.key === "ArrowDown") { event.preventDefault(); moveView(0, distance); }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomView(.2); }
    else if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomView(-.2); }
    else if (event.key === "0" || event.key === "Home") { event.preventDefault(); resetView(); }
  };
  const onSlidePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onSlidePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const previous = drag.current;
    if (!previous || previous.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - previous.x) / Math.max(1, rect.width)) * viewBoxWidth / view.zoom;
    const y = ((event.clientY - previous.y) / Math.max(1, rect.height)) * viewBoxHeight / view.zoom;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    moveView(x, y);
  };
  const stopSlideDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  return <div className="sv-slide">
    <TabStrip active={active} ariaLabel="Slide and spatial result views" idPrefix={tabIdPrefix} labels={labels} onChange={setActive} panelId={panelId} />
    <div aria-labelledby={`${tabIdPrefix}-${domToken(active.toLowerCase())}`} className="sv-panel" id={panelId} role="tabpanel" tabIndex={0}>
      {active === "Slide" ? <div className="sv-slide-layout"><div className="sv-slide-map" aria-label="Interactive slide source view"><div className="sv-slide-controls" aria-label="Slide view controls"><button aria-label="Zoom slide in" onClick={() => tile ? setTileView((current) => ({ ...current, zoom: clamp(current.zoom * 1.2, .5, 8) })) : zoomView(.25)} type="button">+</button><button aria-label="Zoom slide out" onClick={() => tile ? setTileView((current) => ({ ...current, zoom: clamp(current.zoom / 1.2, .5, 8) })) : zoomView(-.25)} type="button">−</button><button aria-label="Reset slide view" onClick={resetView} type="button">Reset</button>{localRegions.length ? <button aria-label="Clear local slide regions" onClick={() => setLocalRegions([])} type="button">Clear regions</button> : null}</div>{tile && width && height && sourceRevision ? <><LocalSlideCanvas ariaLabel="Local slide source pixel workspace. Press Space to start a region, use arrow keys to size it, and press Enter to confirm." height={height} onCreateRegion={addLocalRegion} onViewportChange={setTileView} regions={displayedCanvasRegions} sourceRevision={sourceRevision} tile={tile} width={width} /><output aria-live="polite" className="sv-slide-position">{Math.round(tileView.zoom * 100)}% · x {Math.round(tileView.panX)} · y {Math.round(tileView.panY)}</output>{localRegions.length ? <output aria-live="polite" className="sv-data-note">{localRegions.length} local region draft{localRegions.length === 1 ? "" : "s"}; retained in this result view until cleared.</output> : null}</> : <><svg aria-label="Slide source extent and returned regions" data-slide-view="true" onKeyDown={onSlideKeyDown} onPointerCancel={stopSlideDrag} onPointerDown={onSlidePointerDown} onPointerMove={onSlidePointerMove} onPointerUp={stopSlideDrag} preserveAspectRatio="xMidYMid meet" ref={wheelRef} role="application" tabIndex={0} viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}><defs><pattern height={Math.max(12, viewBoxHeight / 24)} id={tissuePatternId} patternUnits="userSpaceOnUse" width={Math.max(12, viewBoxWidth / 32)}><rect fill="var(--sv-slide-tissue)" height="100%" width="100%" /><circle cx="35%" cy="45%" fill="var(--sv-slide-nucleus)" r="11%" /></pattern></defs><g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}><rect fill={`url(#${tissuePatternId})`} height={viewBoxHeight} rx={viewBoxHeight * .02} width={viewBoxWidth} />{number(bounds.x) != null && number(bounds.y) != null && number(bounds.width) != null && number(bounds.height) != null ? <rect className="sv-view-bounds" fill="none" height={number(bounds.height)!} width={number(bounds.width)!} x={number(bounds.x)!} y={number(bounds.y)!} /> : null}{regions.map((region, index) => <rect className="sv-region" fill="none" height={number(region.height) ?? 0} key={text(region.id) ?? String(index)} width={number(region.width) ?? 0} x={number(region.x) ?? 0} y={number(region.y) ?? 0} />)}</g></svg><output aria-live="polite" className="sv-slide-position">{Math.round(view.zoom * 100)}% · x {Math.round(view.panX)} · y {Math.round(view.panY)}</output></>}<span>{width && height ? `${width.toLocaleString()} × ${height.toLocaleString()} px` : "Source extent unavailable"}</span></div><aside><FactGrid facts={scalarFacts({ ...state, ...source }, ["fileName", "format", "displayMode", "sourceRevision", "stateRevision"], 6)} />{tile ? <p className="sv-data-note">This project-owned Canvas receives pixel data decoded from the authorized local source tile.</p> : !width || !height ? <p className="sv-data-note">Pixel dimensions were not included in this operation result.</p> : <p className="sv-data-note">This operation supplied source dimensions and regions without original pixels; the patterned area is a coordinate preview.</p>}</aside></div> : null}
      {active === "Spatial" ? <div className="sv-spatial-layout"><section><span className="sv-spatial-gene">{text(spatial.gene ?? spatial.selectedGene) ?? "Spatial matrix"}</span><strong>{observations?.toLocaleString() ?? "—"}</strong><small>observations</small></section><section><strong>{genes?.toLocaleString() ?? text(array(spatial.matrixShape)[1]) ?? "—"}</strong><small>genes</small></section><section><FactGrid facts={scalarFacts(spatial, ["nonzero", "min", "max", "mean", "valueScale", "matrixFormat"], 6)} /></section></div> : null}
      {active === "Layers" ? layers.length ? <><p className="sv-layer-note" role="note">Layer visibility is read-only in this recorded result. Change visibility in the connected slide viewer.</p><div className="sv-layer-list">{layers.map((layer, index) => { const layerId = text(layer.id ?? layer.name) ?? `layer-${index + 1}`; return <label className="sv-layer--readonly" key={layerId}><input aria-label={`${layerId} visibility (read-only)`} checked={layer.visible !== false} disabled readOnly type="checkbox" /><i /><span><strong>{layerId}</strong><small>{text(layer.kind) ?? "scientific layer"}{text(layer.featureCount) ? ` · ${text(layer.featureCount)} features` : ""}</small></span></label>; })}</div></> : <EmptyResult>No scientific layer collection was included in this result.</EmptyResult> : null}
    </div>
    <ArtifactButtons artifacts={artifacts} openFile={openFile} />
  </div>;
}

export function ScienceToolView(props: ToolCallOwnerProps): JSX.Element {
  const parsed = useMemo(() => parseCall(props), [props.block]);
  const kind = viewerKind(props.toolName);
  const titleId = `sv-title-${domToken(useId())}`;
  return <article aria-label={`${prettyLabel(props.toolName)} result`} aria-labelledby={titleId} className={`sv-root sv-root--${kind}`} data-science-viewer={kind} data-tool-name={props.toolName}>
    <ToolHeader {...(props.inspect ? { inspect: props.inspect } : {})} kind={kind} operation={props.toolName} parsed={parsed} titleId={titleId} />
    {parsed.running ? <div className="sv-loading" aria-live="polite" role="status"><i /><div><strong>Scientific operation in progress</strong><span>The viewer will use the durable tool result when it arrives.</span></div></div> : parsed.error ? <div className="sv-error" role="alert"><strong>{parsed.error.code ?? "Scientific operation failed"}</strong><p>{parsed.error.message}</p></div> : kind === "sequence" ? <SequenceResult openFile={props.openFile} parsed={parsed} /> : kind === "ngs" ? <NgsResult openFile={props.openFile} parsed={parsed} /> : kind === "structure" ? <StructureResult openFile={props.openFile} parsed={parsed} /> : <SlideResult openFile={props.openFile} parsed={parsed} />}
  </article>;
}
