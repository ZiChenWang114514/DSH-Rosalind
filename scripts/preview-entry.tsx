import { useState } from "react";
import { createRoot } from "react-dom/client";

import { ShowcaseDetailOverlay, Workbench } from "../src/client/components.js";
import { SCIENCE_VIEWER_CSS } from "../src/client/science-viewers.css.js";
import { ScienceToolView } from "../src/client/science-viewers.js";
import { WORKBENCH_CSS } from "../src/client/styles.js";
import { publishConversationNodes } from "../src/client/session-evidence.js";

const chromeCss = `
html, body, #root { min-height: 100%; margin: 0; }
body { background: var(--rr-bg); color: var(--rr-ink); }
.preview-shell { box-sizing: border-box; min-height: 100vh; padding: 48px 0 24px; background: radial-gradient(circle at 50% -10%, color-mix(in srgb, var(--rr-accent-soft) 58%, transparent), transparent 34%), var(--rr-bg); }
.preview-context { width: min(1100px, calc(100vw - 52px)); margin: 0 auto 12px; display: flex; justify-content: space-between; color: var(--rr-faint); font: 600 10px/1.4 Inter, ui-sans-serif, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.preview-draft { position: fixed; z-index: 900; right: 18px; bottom: 18px; width: min(390px, calc(100vw - 36px)); max-height: 104px; padding: 11px 13px; overflow: auto; border: 1px solid var(--rr-line); border-radius: 12px; background: var(--rr-panel-solid); box-shadow: var(--rr-shadow); color: var(--rr-muted); font: 11px/1.45 ui-monospace, monospace; }
.preview-draft:empty { display: none; }
@media (max-width: 840px) { .preview-shell { padding-top: 28px; } .preview-context { width: min(680px, calc(100vw - 28px)); } }
.science-preview-shell { box-sizing: border-box; min-height: 100vh; padding: 58px 24px; background: radial-gradient(circle at 50% -8%, color-mix(in srgb, var(--rr-accent-soft) 64%, transparent), transparent 38%), var(--rr-bg); }
.science-preview-frame { width: min(1060px, 100%); margin: 0 auto; }
.science-preview-heading { margin: 0 0 18px; color: var(--rr-faint); font: 700 11px/1.4 Inter, ui-sans-serif, sans-serif; letter-spacing: .09em; text-transform: uppercase; }
@media (max-width: 760px) { .science-preview-shell { padding: 20px 12px; } }
`;

type SciencePreview = "sequence" | "ngs" | "structure" | "slide";
type ToolCardPreview = SciencePreview;

const scienceFixtures: Record<ToolCardPreview, { toolName: string; payload: Record<string, unknown> }> = {
  sequence: {
    toolName: "sequence_query_viewer",
    payload: {
      viewer: "alignment",
      state: {
        viewer: "alignment",
        recordCount: 3,
        source: { path: "showcases/sequence/ras-alignment/human-RAS-UniProt-SV1.aln-fasta", format: "aligned-fasta" },
        records: [
          { id: "P01116", label: "KRAS", length: 189, moleculeType: "protein" },
          { id: "P01111", label: "NRAS", length: 189, moleculeType: "protein" },
          { id: "P01112", label: "HRAS", length: 189, moleculeType: "protein" },
        ],
        analysis: { meanIdentity: 0.9284467713787081, meanConservationNormalized: 0.64534 },
      },
      result: {
        rowCount: 3,
        alignedLength: 191,
        meanIdentity: 0.9284467713787081,
        columns: [
          { column: 1, identity: 1 }, { column: 2, identity: 1 }, { column: 3, identity: 0.667 },
          { column: 4, identity: 1 }, { column: 5, identity: 0.667 }, { column: 6, identity: 1 },
          { column: 7, identity: 1 }, { column: 8, identity: 1 }, { column: 9, identity: 0.667 },
        ],
      },
    },
  },
  ngs: {
    toolName: "ngs_observe_ngs_run",
    payload: {
      serviceId: "ngs",
      operation: "observe_ngs_run",
      status: "completed",
      registry_run_id: "preview-local-run",
      plan_id: "preview-plan",
      workflow_id: "oai_bulk_rnaseq_counts_qc",
      state: "completed",
      created_at: "2026-08-30T08:00:00.000Z",
      updated_at: "2026-08-30T08:12:00.000Z",
      command: ["snakemake", "--cores", "4"],
      process_id: null,
      exit_code: 0,
      stdout_summary: "Finished 3 of 3 local jobs.",
      stderr_summary: "",
      cancellation_requested: false,
      execution_settled: true,
      events: [
        { at: "2026-08-30T08:00:00.000Z", state: "queued", message: "Run accepted" },
        { at: "2026-08-30T08:00:22.000Z", state: "running", message: "Local engine launched" },
        { at: "2026-08-30T08:12:00.000Z", state: "completed", message: "Quantification processes finished" },
      ],
      summary_path: null,
      diagnostic: {},
    },
  },
  structure: {
    toolName: "structure_get_state",
    payload: {
      viewerSessionId: "preview-structure-session",
      sceneRevision: 4,
      status: "completed",
      atoms: [
        { atomId: "primary:A:1:N", atomName: "N", chain: "A", element: "N", objectId: "primary", residue: 1, residueName: "GLY", x: 11.25, y: -2.5, z: 0.75 },
        { atomId: "primary:A:1:CA", atomName: "CA", chain: "A", element: "C", objectId: "primary", residue: 1, residueName: "GLY", x: 12.5, y: -1.75, z: 1.25 },
        { atomId: "primary:A:1:C", atomName: "C", chain: "A", element: "C", objectId: "primary", residue: 1, residueName: "GLY", x: 13.25, y: -0.5, z: 0.5 },
        { atomId: "primary:A:1:O", atomName: "O", chain: "A", element: "O", objectId: "primary", residue: 1, residueName: "GLY", x: 14.45, y: -0.5, z: 0.25 },
      ],
      coordinatePreview: { atomCount: 4, totalAtomCount: 4, truncated: false, provenance: "Browser preview receives coordinates from this completed tool-result fixture." },
      structure: { atomCount: 4, polymerResidueCount: 1, ligandCount: 0, source: { fileName: "returned-tool-result.pdb", format: "pdb" } },
      state: {
        structure: { atomCount: 4, polymerResidueCount: 1, ligandCount: 0, source: { fileName: "returned-tool-result.pdb", format: "pdb" } },
        display: { representation: "cartoon", colorMode: "chain", background: "light" },
        scene: { sceneRevision: 4, geometryRevision: 2, syncStatus: "synced" },
        objects: [{ id: "primary", label: "1EMA.pdb", kind: "structure", visible: true }],
        analyses: [{ id: "contacts-cro", type: "contacts", status: "complete", residueCount: 18 }],
      },
    },
  },
  slide: {
    toolName: "slide_get_viewer_state",
    payload: {
      fileName: "CMU-1-JP2K-33005.svs",
      format: "svs",
      source: { width: 46000, height: 32893, observations: 684, genes: 18078 },
      visibleBounds: { x: 1000, y: 800, width: 12000, height: 8000 },
      selectedRegions: [{ id: "roi-1", x: 2000, y: 1500, width: 4000, height: 2600 }],
      spatial: { observations: 684, genes: 18078, selectedGene: "Slc17a7", matrixFormat: "csr" },
      scientificLayers: [{ id: "segmentation", kind: "segmentation", featureCount: 245, visible: true }],
      artifacts: [{ path: "exports/spatial-expression.csv", role: "table" }],
    },
  },
};

function SciencePreviewPage({ kind }: { kind: ToolCardPreview }): JSX.Element {
  const fixture = scienceFixtures[kind];
  const liveSlide = kind === "slide" && new URLSearchParams(location.search).get("live") === "1";
  const payload = liveSlide ? {
    ...fixture.payload,
    sourceRevision: "preview:decoded-slide-tile",
    source: {
      ...(fixture.payload.source as Record<string, unknown>),
      sourceRevision: "preview:decoded-slide-tile",
      previewTile: {
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlW9h8AAAAASUVORK5CYII=",
        height: 1,
        mimeType: "image/png",
        sourceRevision: "preview:decoded-slide-tile",
        width: 1,
        x: 0,
        y: 0,
      },
    },
  } : fixture.payload;
  const block = {
    kind: "tool-result" as const,
    seq: 2,
    time: 2,
    callId: `preview-${kind}`,
    call: { name: fixture.toolName, argsRaw: "{}" },
    callTime: 1,
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    isError: false,
    meta: null,
    callView: null,
    resultView: null,
    subCalls: [],
  };
  return <main className="science-preview-shell"><div className="science-preview-frame">
    <p className="science-preview-heading">DSH-Rosalind scientific result · {kind}</p>
    <ScienceToolView callId={`preview-${kind}`} toolName={fixture.toolName} block={block} cwd="C:/work" home="C:/Users/test" openFile={() => undefined} inspect={() => undefined} />
  </div></main>;
}

function Preview(): JSX.Element {
  const [draft, setDraft] = useState("");
  return <div className="preview-shell">
    <div className="preview-context"><span>DSH Web · Rosalind</span><span>Interactive release preview</span></div>
    <Workbench hero inputActions={{ setDraft }} />
    <ShowcaseDetailOverlay />
    <output id="preview-draft" className="preview-draft" aria-label="Prepared DSH prompt">{draft}</output>
  </div>;
}

document.documentElement.dataset.theme = new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light";
const style = document.createElement("style");
style.textContent = `${WORKBENCH_CSS}\n${SCIENCE_VIEWER_CSS}\n${chromeCss}`;
document.head.append(style);
const scienceKinds = ["sequence", "ngs", "structure", "slide"] as const;
const science = new URLSearchParams(location.search).get("science");
const scienceKind = scienceKinds.find((kind) => kind === science) ?? null;
if (scienceKind === "structure") {
  // Seed the app's evidence store with the same completed tool-result the
  // card below renders, so the local Canvas receives real returned
  // coordinates instead of reporting an unavailable host source.
  const fixture = scienceFixtures.structure;
  const payload = fixture.payload;
  publishConversationNodes([{
    kind: "tool-result",
    seq: 2,
    time: 2,
    callId: "preview-structure",
    call: { name: fixture.toolName, argsRaw: "{}" },
    callTime: 1,
    content: [{ type: "text", text: JSON.stringify({ ...payload, serviceId: "structure", operation: "get_state", status: "completed" }) }],
    isError: false,
  }]);
}
createRoot(document.getElementById("root")!).render(
  scienceKind ? <SciencePreviewPage kind={scienceKind} /> : <Preview />,
);
