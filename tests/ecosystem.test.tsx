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
    expect(screen.getByText("117")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Life Sciences Literature");
  });

  it("supports tab keyboard navigation, panel changes, and a skill switch", () => {
    render(<ScienceEcosystemPanel />);
    const tabs = screen.getAllByRole("tab");
    fireEvent.keyDown(tabs[0]!, { key: "ArrowDown" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Life Sciences Databases");
    const toggle = screen.getByRole("switch", { name: "Toggle Life Sciences Databases skills" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("makes each example task an actionable button", () => {
    const onExample = vi.fn();
    render(<ScienceEcosystemPanel onExample={onExample} />);
    const panel = screen.getByRole("tabpanel");
    fireEvent.click(within(panel).getByRole("button", { name: /Find TREM2 papers/ }));
    expect(onExample).toHaveBeenCalledWith(expect.objectContaining({ label: "Find TREM2 papers" }), expect.objectContaining({ id: "literature" }));
  });
});
