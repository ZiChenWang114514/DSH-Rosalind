import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ScienceRuntime } from "../src/host/science/runtime.js";

describe("Rosalind operation contract", () => {
  it("opens the molecular-design workbench from the real catalogue context and retained artifacts", async () => {
    const catalog = JSON.parse(readFileSync("showcases/catalog.json", "utf8")) as {
      plugins: Array<{ id: string; showcases: Array<{ id: string; status: string; case_path: string }> }>;
    };
    const showcase = catalog.plugins.find((plugin) => plugin.id === "rosalind-workbench")
      ?.showcases.find((item) => item.id === "rosalind-molecular-design");
    expect(showcase).toMatchObject({
      id: "rosalind-molecular-design",
      status: "ready",
      case_path: "showcases/rosalind-workbench/cases/rosalind-molecular-design",
    });

    const runtime = new ScienceRuntime();
    const value = await runtime.execute(
      "rosalind",
      "rosalind.open",
      { area: showcase!.id.replace(/^rosalind-/, ""), providerId: "local-replay" },
      { session: {}, packageRoot: process.cwd(), signal: new AbortController().signal },
    );

    expect(value).toMatchObject({
      serviceId: "rosalind",
      operation: "rosalind.open",
      status: "completed",
      viewer: "rosalind-workbench",
      area: "molecular-design",
      providerId: "local-replay",
      availableServices: ["literature", "databases", "sequence", "ngs", "structure", "slide", "rosalind"],
      skillCount: 55,
      operationCount: 121,
      retainedDesign: {
        candidateCount: 20,
        topFiveCount: 5,
        firstCandidate: "NB13_E104Q",
        rankingIsOrdered: true,
        rankedCandidatesExist: true,
        sequencesHaveExpectedLength: true,
        severeClashFreeLeader: true,
        bestModelPath: "showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/NB13_E104Q_best_model.cif",
        provenance: expect.stringContaining("retained CSV artifacts"),
      },
    });
  });
});
