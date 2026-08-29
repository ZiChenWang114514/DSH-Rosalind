// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShowcaseDetailOverlay, Workbench } from "../src/client/components.js";
import { closeShowcase } from "../src/client/state.js";

afterEach(() => {
  closeShowcase();
  cleanup();
});

describe("Workbench catalogue", () => {
  it("renders all 23 projects and all seven category choices", () => {
    render(<Workbench />);
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(23);
    const category = screen.getByRole("combobox", { name: "Filter by scientific area" });
    expect(within(category).getAllByRole("option")).toHaveLength(8);
    expect(screen.getByText("148 manifest-referenced files · seven scientific areas")).toBeInTheDocument();
  });

  it("uses a height-limited catalogue inside the blank-session hero", () => {
    const { container } = render(<Workbench hero />);
    expect(container.querySelector(".rr-root--hero")).toBeInTheDocument();
  });

  it("searches scientific content and filters by category", () => {
    render(<Workbench />);
    fireEvent.change(screen.getByPlaceholderText("Search a scientific question or method"), { target: { value: "nanobody" } });
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Open.*PD-L1/i })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search a scientific question or method"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by scientific area" }), { target: { value: "structure" } });
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(3);
  });

  it("opens details, changes use mode, and prepares a conversation prompt", () => {
    const setDraft = vi.fn();
    render(<><Workbench inputActions={{ setDraft }} /><ShowcaseDetailOverlay /></>);
    fireEvent.click(screen.getByRole("button", { name: "Open Human RAS protein alignment" }));
    const dialog = screen.getByRole("dialog", { name: "Human RAS protein alignment" });
    expect(within(dialog).getByText("Scientific question")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Reproduce/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Add to conversation/ }));
    expect(setDraft).toHaveBeenCalledTimes(1);
    expect(setDraft.mock.calls[0]?.[0]).toContain("reproduce");
    expect(setDraft.mock.calls[0]?.[0]).toContain("sequence-ras-alignment");
  });

  it("closes project details with Escape", () => {
    render(<><Workbench /><ShowcaseDetailOverlay /></>);
    fireEvent.click(screen.getByRole("button", { name: "Open Provenance-bearing GFP figure" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
