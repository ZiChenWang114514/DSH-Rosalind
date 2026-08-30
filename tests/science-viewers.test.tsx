// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { ToolCallOwnerProps } from "@deepseek-ai/dsh-client-ui-tool/client";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCIENCE_VIEWER_TOOL_NAMES, ScienceToolView } from "../src/client/science-viewers.js";
import { ScienceToolCard } from "../src/client/toolview.js";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(), fillText: vi.fn(), save: vi.fn(), restore: vi.fn(),
    setLineDash: vi.fn(), strokeRect: vi.fn(), drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function settled(toolName: string, payload: Record<string, unknown>, overrides: { isError?: boolean; error?: { name: string; code: string } } = {}): ToolCallOwnerProps {
  const block = {
    kind: "tool-result" as const,
    seq: 2,
    time: 2,
    callId: "call-1",
    call: { name: toolName, argsRaw: JSON.stringify({ path: "fixtures/input.dat" }) },
    callTime: 1,
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    isError: overrides.isError ?? false,
    ...(overrides.error ? { error: overrides.error } : {}),
    meta: null,
    callView: null,
    resultView: null,
    subCalls: [],
  };
  return { callId: "call-1", toolName, block, cwd: "C:/work", home: "C:/Users/test", openFile: vi.fn(), inspect: vi.fn() };
}

function running(toolName: string): ToolCallOwnerProps {
  return {
    callId: "call-1",
    toolName,
    block: { callId: "call-1", name: toolName, argsRaw: "{}", turn: 1, step: 1, time: 1, callView: null, subCalls: [] },
    openFile: vi.fn(),
  };
}

describe("science ToolViews", () => {
  it("owns all fixed-version sequence, NGS, structure, and slide operations without duplicate names", () => {
    expect(SCIENCE_VIEWER_TOOL_NAMES).toHaveLength(116);
    expect(new Set(SCIENCE_VIEWER_TOOL_NAMES).size).toBe(116);
    expect(SCIENCE_VIEWER_TOOL_NAMES).toContain("sequence_query_viewer");
    expect(SCIENCE_VIEWER_TOOL_NAMES).toContain("ngs_observe_ngs_run");
    expect(SCIENCE_VIEWER_TOOL_NAMES).toContain("structure_set_selection");
    expect(SCIENCE_VIEWER_TOOL_NAMES).toContain("slide_spatial_indexed");
  });

  it("shows a durable running state before scientific output exists", () => {
    render(<ScienceToolView {...running("sequence_run_analysis")} />);
    expect(screen.getByRole("status")).toHaveTextContent("Scientific operation in progress");
    expect(screen.getByLabelText("Run Analysis result")).toHaveAttribute("data-science-viewer", "sequence");
  });

  it("loads the science result through the registered ToolView wrapper", async () => {
    render(<ScienceToolCard {...settled("sequence_query_viewer", { viewer: "sequence", state: { recordCount: 1 } })} />);
    expect(await screen.findByLabelText("Query Viewer result")).toHaveAttribute("data-science-viewer", "sequence");
  });

  it("renders returned alignment records and metrics with keyboard-operable tabs", () => {
    const props = settled("sequence_query_viewer", {
      viewer: "alignment",
      state: {
        viewer: "alignment",
        recordCount: 3,
        source: { path: "showcases/ras.aln-fasta", format: "aligned-fasta" },
        records: [
          { id: "P01116", label: "KRAS", length: 189, moleculeType: "protein" },
          { id: "P01111", label: "NRAS", length: 189, moleculeType: "protein" },
          { id: "P01112", label: "HRAS", length: 189, moleculeType: "protein" },
        ],
        analysis: { meanIdentity: 0.9284467713787081, meanConservationNormalized: 0.64534 },
      },
      result: { rowCount: 3, alignedLength: 191, meanIdentity: 0.9284467713787081, columns: [{ column: 1, identity: 1 }, { column: 2, identity: 0.667 }] },
    });
    render(<ScienceToolView {...props} />);
    expect(screen.getByRole("table")).toHaveTextContent("P01116");
    expect(screen.getByText(/residue strings remain in the active viewer session/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("showcases/ras.aln-fasta"));
    expect(props.openFile).toHaveBeenCalledWith("showcases/ras.aln-fasta");
    fireEvent.change(screen.getByPlaceholderText("Filter records"), { target: { value: "NRAS" } });
    expect(screen.getByRole("table")).toHaveTextContent("P01111");
    expect(screen.getByRole("table")).not.toHaveTextContent("P01116");
    const alignment = screen.getByRole("tab", { name: "Alignment" });
    fireEvent.keyDown(alignment, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Metrics" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Metrics" })).toHaveFocus();
    expect(screen.getByLabelText("Per-column metric track").querySelectorAll("i")).toHaveLength(2);
  });

  it("uses NGS workflow and run records for the catalogue and timeline views", () => {
    const props = settled("ngs_list_workflows", {
      state: "running",
      registry_run_id: "run-123",
      workflow_id: "nf_core_rnaseq",
      events: [{ at: "2026-08-30T08:00:00Z", state: "queued", message: "Run accepted" }, { at: "2026-08-30T08:01:00Z", state: "running", message: "Workflow started" }],
      workflows: [{ workflow_id: "nf_core_rnaseq", name: "Bulk RNA-seq", engine: "nextflow", description: "Expression quantification", version_count: 2 }],
      targets: [{ id: "local", title: "Local DSH host", kind: "local" }],
    });
    render(<ScienceToolView {...props} />);
    expect(screen.getByText("Run accepted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Workflows" }));
    expect(screen.getByText("Bulk RNA-seq")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Compute" }));
    expect(screen.getByText("Local DSH host")).toBeInTheDocument();
  });

  it("summarizes a molecular scene without inventing geometry when coordinates were not returned", () => {
    const props = settled("structure_get_state", {
      status: "completed",
      state: {
        structure: { atomCount: 1866, polymerResidueCount: 225, ligandCount: 1 },
        display: { representation: "cartoon", colorMode: "chain" },
        scene: { sceneRevision: 4, geometryRevision: 2, syncStatus: "synced" },
        objects: [{ id: "primary", label: "1EMA.pdb", kind: "structure", visible: true }],
      },
    });
    render(<ScienceToolView {...props} />);
    expect(screen.getByLabelText("Molecular scene state")).toHaveTextContent("Waiting for structure coordinates from the DSH session");
    expect(screen.getByRole("application", { name: /local molecular coordinate view/i })).toBeInTheDocument();
    expect(screen.getByText("1,866")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Objects" }));
    expect(screen.getByText("1EMA.pdb")).toBeInTheDocument();
  });

  it("passes returned molecular coordinates to the project-owned Canvas", () => {
    const props = settled("structure_query", {
      state: {
        atoms: [
          { id: "C1", x: -2, y: 1, z: 0, element: "C", chain: "A" },
          { id: "N2", x: 2, y: -1, z: 2, element: "N", chain: "B" },
          { id: "O3", x: 1, y: 2, z: -2, element: "O", chain: "A" },
        ],
        structure: { atomCount: 3, polymerResidueCount: 1 },
      },
    });
    render(<ScienceToolView {...props} />);
    expect(screen.getByRole("application", { name: /local molecular coordinate view/i })).toBeInTheDocument();
    expect(screen.getByText("Local coordinate render confirmed · 3 returned coordinates")).toBeInTheDocument();
    expect(screen.getByLabelText("Molecular scene state")).toHaveAttribute("data-client-render-ready", "true");
  });

  it("mounts the project-owned Canvas from an open structure coordinate preview", () => {
    render(<ScienceToolView {...settled("structure_open_from_chat", {
      viewerReady: false,
      structure: { atomCount: 2, polymerResidueCount: 1 },
      coordinatePreview: { atomCount: 2, totalAtomCount: 2, truncated: false },
      atoms: [{ atomId: "primary:1", x: 0, y: 0, z: 0, element: "C" }, { atomId: "primary:2", x: 2, y: 1, z: 1, element: "O" }],
    })} />);
    expect(screen.getByRole("application", { name: /local molecular coordinate view/i })).toBeInTheDocument();
    expect(screen.getByText("Local coordinate render confirmed · 2 returned coordinates")).toBeInTheDocument();
  });

  it("renders a host-decoded local slide tile in the Canvas ToolView", () => {
    render(<ScienceToolView {...settled("slide_query_viewer", {
      ok: true,
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      x: 0,
      y: 0,
      width: 64,
      height: 32,
      sourceWidth: 1000,
      sourceHeight: 500,
      sourceRevision: "local:test",
    })} />);
    expect(screen.getByLabelText("Local slide source pixel workspace")).toBeInTheDocument();
    expect(screen.getByText("1,000 × 500 px")).toBeInTheDocument();
    expect(screen.getByText(/receives pixel data decoded from the authorized local source tile/i)).toBeInTheDocument();
  });

  it("uses the decoded preview carried by a local slide open result", () => {
    render(<ScienceToolView {...settled("slide_open_from_chat", {
      sourceRevision: "local:slide-preview",
      source: { format: "tiff", width: 80, height: 40, sourceRevision: "local:slide-preview", previewTile: { dataUrl: "data:image/png;base64,iVBORw0KGgo=", mimeType: "image/png", x: 0, y: 0, width: 80, height: 40, sourceRevision: "local:slide-preview" } },
      viewerReady: false,
      renderState: "awaiting-viewer",
    })} />);
    expect(screen.getByLabelText("Local slide source pixel workspace")).toBeInTheDocument();
    expect(screen.getByText(/receives pixel data decoded from the authorized local source tile/i)).toBeInTheDocument();
  });

  it("projects returned slide dimensions, regions, spatial matrix, and layer state", () => {
    const props = settled("slide_get_viewer_state", {
      fileName: "CMU-1-JP2K-33005.svs",
      format: "svs",
      source: { width: 46000, height: 32893, observations: 684, genes: 18078 },
      visibleBounds: { x: 1000, y: 800, width: 12000, height: 8000 },
      selectedRegions: [{ id: "roi-1", x: 2000, y: 1500, width: 4000, height: 2600 }],
      spatial: { observations: 684, genes: 18078, selectedGene: "Slc17a7", matrixFormat: "csr" },
      scientificLayers: [{ id: "segmentation", kind: "segmentation", featureCount: 245, visible: true }],
    });
    render(<ScienceToolView {...props} />);
    expect(screen.getByText("46,000 × 32,893 px")).toBeInTheDocument();
    expect(screen.getByLabelText("Slide source extent and returned regions").querySelectorAll(".sv-region")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Spatial" }));
    expect(screen.getAllByText("Slc17a7")).toHaveLength(2);
    expect(screen.getByText("18,078")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Layers" }));
    expect(screen.getByText("segmentation")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("mounts the production ScienceToolView with local navigation and read-only layer state", () => {
    render(<ScienceToolView {...settled("slide_get_viewer_state", {
      source: { width: 46000, height: 32893 },
      scientificLayers: [{ id: "segmentation", kind: "segmentation", visible: true }],
    })} />);
    const map = screen.getByLabelText("Slide source extent and returned regions");
    fireEvent.keyDown(map, { key: "+" });
    expect(screen.getByText(/120%/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Reset slide view"));
    expect(screen.getByText(/100%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Layers" }));
    const visibility = screen.getByRole("checkbox", { name: /segmentation visibility/i });
    expect(visibility).toBeDisabled();
    expect(visibility).toBeChecked();
    expect(screen.getByRole("note")).toHaveTextContent(/read-only.*connected slide viewer/i);
  });

  it("shows host and scientific failures verbatim", () => {
    render(<ScienceToolView {...settled("slide_open_dicomweb_wsi", { ok: false, error: { code: "REMOTE_SOURCE_UNAVAILABLE", message: "Authorized DICOMweb transport is not configured." } })} />);
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("REMOTE_SOURCE_UNAVAILABLE")).toBeInTheDocument();
    expect(alert).toHaveTextContent("Authorized DICOMweb transport is not configured.");
  });
});
