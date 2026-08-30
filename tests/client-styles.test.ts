// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { installWorkbenchStyles } from "../src/client/styles.js";

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
});
