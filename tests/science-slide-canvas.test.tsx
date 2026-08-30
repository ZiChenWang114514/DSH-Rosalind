// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalSlideCanvas } from "../src/client/viewers/slide/canvas.js";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("LocalSlideCanvas", () => {
  it("redraws its backing buffer when the workspace changes size", () => {
    const context = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    let width = 240;
    let height = 160;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => height);
    let notifyResize: ResizeObserverCallback | undefined;
    class WorkspaceResizeObserver {
      constructor(callback: ResizeObserverCallback) { notifyResize = callback; }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", WorkspaceResizeObserver);

    const { getByRole } = render(<LocalSlideCanvas width={1000} height={500} sourceRevision="local:test" tile={null} regions={[]} />);
    const canvas = getByRole("img") as HTMLCanvasElement;
    expect(canvas.width).toBe(240);
    expect(canvas.height).toBe(160);

    width = 420;
    height = 210;
    act(() => notifyResize?.([], {} as ResizeObserver));
    expect(canvas.width).toBe(420);
    expect(canvas.height).toBe(210);
  });

  it("keeps ROI interaction in base-slide coordinates", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    const created: Array<{ x: number; y: number; width: number; height: number }> = [];
    const { getByRole } = render(<LocalSlideCanvas width={1000} height={500} sourceRevision="local:test" tile={null} regions={[]} onCreateRegion={(region) => created.push(region)} />);
    const canvas = getByRole("img");
    Object.defineProperty(canvas, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 500, height: 250 }) });
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, clientX: 50, clientY: 25 })); fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 250, clientY: 125 })); fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 250, clientY: 125 }));
    expect(created).toEqual([{ x: 100, y: 50, width: 400, height: 200 }]);
  });

  it("keeps the tile path keyboard-operable and reports its viewport", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    const viewports: Array<{ zoom: number; panX: number; panY: number }> = [];
    const { getByRole } = render(<LocalSlideCanvas width={1000} height={500} sourceRevision="local:test" tile={null} regions={[]} onViewportChange={(viewport) => viewports.push(viewport)} />);
    const canvas = getByRole("img");
    fireEvent.keyDown(canvas, { key: "+" });
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    expect(viewports.at(-1)).toMatchObject({ zoom: 1.2, panX: 20, panY: 0 });
    fireEvent.keyDown(canvas, { key: "Home" });
    expect(viewports.at(-1)).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it("creates a slide region with keyboard controls", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    const created: Array<{ x: number; y: number; width: number; height: number }> = [];
    const { getByRole } = render(<LocalSlideCanvas width={1000} height={500} sourceRevision="local:test" tile={null} regions={[]} onCreateRegion={(region) => created.push(region)} />);
    const canvas = getByRole("img");
    fireEvent.keyDown(canvas, { key: " " });
    fireEvent.keyDown(canvas, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(canvas, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(canvas, { key: "Enter" });
    expect(created).toEqual([{ x: 500, y: 250, width: 10, height: 10 }]);
  });

  it("ignores an old Image load after a newer source tile replaces it", () => {
    const context = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const images: Array<{ decoding: string; loading: string; onload: null | (() => void); onerror: null | (() => void); src: string }> = [];
    class DeferredImage {
      decoding = "auto"; loading = "auto";
      onload: null | (() => void) = null; onerror: null | (() => void) = null; private value = "";
      set src(value: string) { this.value = value; images.push(this); }
      get src() { return this.value; }
    }
    vi.stubGlobal("Image", DeferredImage);
    const tileA = { dataUrl: "data:image/png;base64,AAAA", x: 0, y: 0, width: 5, height: 5, sourceRevision: "source-a" };
    const tileB = { dataUrl: "data:image/png;base64,BBBB", x: 0, y: 0, width: 5, height: 5, sourceRevision: "source-b" };
    const rendered = render(<LocalSlideCanvas width={10} height={10} sourceRevision="source-a" tile={tileA} regions={[]} />);
    rendered.rerender(<LocalSlideCanvas width={10} height={10} sourceRevision="source-b" tile={tileB} regions={[]} />);
    expect(images).toHaveLength(2);
    expect(images[1]).toMatchObject({ decoding: "async", loading: "eager" });
    act(() => images[0]!.onload?.());
    expect(context.drawImage).not.toHaveBeenCalled();
    act(() => images[1]!.onload?.());
    expect(context.drawImage).toHaveBeenCalledWith(images[1], 0, 0, expect.any(Number), expect.any(Number));
    vi.unstubAllGlobals();
  });
});
