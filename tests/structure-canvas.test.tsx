// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalStructureCanvas } from "../src/client/viewers/structure/canvas.js";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function canvasContext(): CanvasRenderingContext2D {
  return { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillText: vi.fn() } as unknown as CanvasRenderingContext2D;
}

function mount(onSelectAtom = vi.fn()) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(canvasContext());
  const rendered = render(<LocalStructureCanvas atoms={[{ atomId: "primary:1", element: "C", x: 0, y: 0, z: 0 }]} selectedAtomIds={["primary:1"]} onSelectAtom={onSelectAtom} />);
  const canvas = rendered.getByRole("application");
  Object.defineProperty(canvas, "clientWidth", { configurable: true, value: 200 });
  Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 160 });
  Object.defineProperty(canvas, "getBoundingClientRect", { configurable: true, value: () => ({ left: 0, top: 0, width: 200, height: 160 }) });
  return { canvas, onSelectAtom };
}

describe("LocalStructureCanvas", () => {
  it("redraws its backing buffer when the workspace changes size", () => {
    const context = canvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    let width = 200;
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

    const { getByRole } = render(<LocalStructureCanvas atoms={[{ atomId: "primary:1", element: "C", x: 0, y: 0, z: 0 }]} />);
    const canvas = getByRole("application") as HTMLCanvasElement;
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(160);

    width = 360;
    height = 220;
    act(() => notifyResize?.([], {} as ResizeObserver));
    expect(canvas.width).toBe(360);
    expect(canvas.height).toBe(220);
  });

  it("selects a clicked atom and supports Escape and Home", () => {
    const { canvas, onSelectAtom } = mount();
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 80 }));
    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 100, clientY: 80 }));
    expect(onSelectAtom).toHaveBeenCalledWith(expect.objectContaining({ atomId: "primary:1" }));
    fireEvent.wheel(canvas, { deltaY: -1 });
    expect(Number(canvas.dataset.viewScale)).toBeGreaterThan(1);
    fireEvent.keyDown(canvas, { key: "Home" });
    expect(canvas.dataset.viewScale).toBe("1");
    fireEvent.keyDown(canvas, { key: "Escape" });
    expect(onSelectAtom).toHaveBeenLastCalledWith(null);
  });

  it("does not turn a long drag ending with a tiny move into an atom selection", () => {
    const { canvas, onSelectAtom } = mount();
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 80 }));
    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 30, clientY: 30 }));
    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 31, clientY: 31 }));
    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 31, clientY: 31 }));
    expect(onSelectAtom).not.toHaveBeenCalled();
  });

  it("clears pointer interaction on pointercancel without selecting", () => {
    const { canvas, onSelectAtom } = mount();
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 80 }));
    fireEvent(canvas, new MouseEvent("pointercancel", { bubbles: true, clientX: 100, clientY: 80 }));
    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 100, clientY: 80 }));
    expect(onSelectAtom).not.toHaveBeenCalled();
    expect(canvas.getAttribute("aria-label")).toContain("Local molecular coordinate view");
  });
});
