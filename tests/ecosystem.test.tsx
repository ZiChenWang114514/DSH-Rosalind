// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SCIENCE_ECOSYSTEMS, ScienceEcosystemPanel } from "../src/client/ecosystem.js";

afterEach(cleanup);

describe("ScienceEcosystemPanel", () => {
  it("renders seven scientific ecosystems and the documented skill total", () => {
    render(<ScienceEcosystemPanel />);
    expect(screen.getAllByRole("tab")).toHaveLength(7);
    expect(SCIENCE_ECOSYSTEMS.reduce((sum, item) => sum + item.skillCount, 0)).toBe(55);
    expect(screen.getByText("Declared operations")).toBeInTheDocument();
    expect(screen.getByText("121")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Life Sciences Literature");
  });

  it("supports tab keyboard navigation and reports services and Skills without a non-functional switch", () => {
    render(<ScienceEcosystemPanel />);
    const tabs = screen.getAllByRole("tab");
    fireEvent.keyDown(tabs[0]!, { key: "ArrowDown" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Life Sciences Databases");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("declared in bundle");
    expect(screen.getByText(/Installation or registration does not confirm that a provider is ready/)).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("DSH Settings → Rosalind");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "0");
  });

  it("makes each example task an actionable button", () => {
    const onExample = vi.fn();
    render(<ScienceEcosystemPanel onExample={onExample} />);
    const panel = screen.getByRole("tabpanel");
    fireEvent.click(within(panel).getByRole("button", { name: /Find TREM2 papers/ }));
    expect(onExample).toHaveBeenCalledWith(expect.objectContaining({ label: "Find TREM2 papers" }), expect.objectContaining({ id: "literature" }));
  });

  it("reports horizontal tab semantics when the narrow layout uses a scrolling tab row", () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 600 });
    render(<ScienceEcosystemPanel />);
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "horizontal");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  });

  it("keeps tab ids and keyboard focus within each panel instance", () => {
    render(<><ScienceEcosystemPanel /><ScienceEcosystemPanel /></>);
    const tabs = screen.getAllByRole("tab");
    const ids = tabs.map((tab) => tab.id);
    expect(new Set(ids)).toHaveLength(ids.length);
    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    expect(tabs[1]).toHaveFocus();
    expect(tabs[8]).not.toHaveFocus();
  });
});
