// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SCIENCE_ECOSYSTEMS } from "../src/client/ecosystem.js";
import { ProviderSettings } from "../src/client/settings.js";

afterEach(cleanup);

describe("ProviderSettings", () => {
  it("keeps capability discovery in a compact, collapsible settings reference", () => {
    render(<ProviderSettings />);
    expect(screen.getByRole("heading", { name: /Scientific providers/ })).toBeInTheDocument();
    const reference = screen.getByRole("group", { name: "Scientific capabilities reference" });
    expect(reference).toHaveTextContent("Scientific capabilities");
    expect(reference).toHaveTextContent("Capability reference");
    for (const plugin of SCIENCE_ECOSYSTEMS) expect(reference).toHaveTextContent(plugin.name);
  });

  it("states that declared or registered services are not proof of provider readiness", () => {
    render(<ProviderSettings />);
    expect(screen.getByText(/installed or registered services are not necessarily ready to run/)).toBeInTheDocument();
    expect(screen.getByText(/review readiness and resource requirements/)).toBeInTheDocument();
  });
});
