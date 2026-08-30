// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { installWorkbenchStyles, WORKBENCH_CSS } from "../src/client/styles.js";
import { SETTINGS_CSS } from "../src/client/settings-styles.js";

afterEach(() => { document.getElementById("dsh-rosalind-styles")?.remove(); });

describe("client style lifecycle", () => {
  it("keeps shared styles until the final client instance unmounts", () => {
    const disposeFirst = installWorkbenchStyles(".first { color: green; }");
    const disposeSecond = installWorkbenchStyles(".second { color: blue; }");
    expect(document.querySelectorAll("#dsh-rosalind-styles")).toHaveLength(1);
    disposeFirst();
    expect(document.getElementById("dsh-rosalind-styles")).not.toBeNull();
    disposeSecond();
    expect(document.getElementById("dsh-rosalind-styles")).toBeNull();
    disposeSecond();
  });

  it("gives settings cards theme-aware surfaces without undefined variables", () => {
    expect(SETTINGS_CSS).toContain("background: var(--rr-panel-solid)");
    expect(SETTINGS_CSS).not.toContain("--rr-surface");
    expect(SETTINGS_CSS).toContain(".rr-settings__card");
  });

  it("keeps accessibility and motion rules on the live scientific interface", () => {
    expect(WORKBENCH_CSS).toContain(".rr-visually-hidden");
    expect(WORKBENCH_CSS).not.toMatch(/(^|[,{\s])\.sr-only\b/);
    expect(WORKBENCH_CSS).toContain(".drr-ecosystem__read-only");
    expect(WORKBENCH_CSS).toContain("@media (prefers-reduced-motion: reduce)");
    expect(WORKBENCH_CSS).toContain("--rr-motion-fast");
    expect(WORKBENCH_CSS).toContain("font-variant-numeric: tabular-nums");
  });
});
