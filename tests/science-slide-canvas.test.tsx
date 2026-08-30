// @vitest-environment jsdom

import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocalSlideCanvas } from "../src/client/viewers/slide/canvas.js";

describe("LocalSlideCanvas", () => {
  it("keeps ROI interaction in base-slide coordinates", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    const created: Array<{ x: number; y: number; width: number; height: number }> = [];
    const { getByRole } = render(<LocalSlideCanvas width={1000} height={500} sourceRevision="local:test" tile={null} regions={[]} onCreateRegion={(region) => created.push(region)} />);
    const canvas = getByRole("application");
    Object.defineProperty(canvas, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 500, height: 250 }) });
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, clientX: 50, clientY: 25 })); fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 250, clientY: 125 })); fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 250, clientY: 125 }));
    expect(created).toEqual([{ x: 100, y: 50, width: 400, height: 200 }]);
  });

  it("ignores an old Image load after a newer source tile replaces it", () => {
    const context = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const images: Array<{ onload: null | (() => void); onerror: null | (() => void); src: string }> = [];
    class DeferredImage {
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
    act(() => images[0]!.onload?.());
    expect(context.drawImage).not.toHaveBeenCalled();
    act(() => images[1]!.onload?.());
    expect(context.drawImage).toHaveBeenCalledWith(images[1], 0, 0, expect.any(Number), expect.any(Number));
    vi.unstubAllGlobals();
  });
});
