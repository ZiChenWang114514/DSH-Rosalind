import { describe, expect, it } from "vitest";

import { SEQUENCE_CLIENT_MODULE } from "../src/client/modules/sequence.js";
import { SLIDE_CLIENT_MODULE } from "../src/client/modules/slide.js";
import { STRUCTURE_CLIENT_MODULE } from "../src/client/modules/structure.js";
import { CapabilityRegistry } from "../src/host/capabilities.js";
import { SEQUENCE_HOST_MODULE } from "../src/host/modules/sequence.js";
import { SLIDE_HOST_MODULE } from "../src/host/modules/slide.js";
import { STRUCTURE_HOST_MODULE } from "../src/host/modules/structure.js";
import { createScienceTools, type ScienceExecutor } from "../src/host/science-tools.js";

const executor: ScienceExecutor = {
  async execute() { return {}; },
};

describe("independent science viewer module registration", () => {
  it("keeps Sequence, Structure, and Slide host registrations disjoint", () => {
    const registry = new CapabilityRegistry();
    const sequence = createScienceTools(executor, registry, [SEQUENCE_HOST_MODULE.id]);
    const structure = createScienceTools(executor, registry, [STRUCTURE_HOST_MODULE.id]);
    const slide = createScienceTools(executor, registry, [SLIDE_HOST_MODULE.id]);
    expect(sequence).toHaveLength(13);
    expect(structure).toHaveLength(41);
    expect(slide).toHaveLength(40);
    expect(sequence.every((tool) => tool.name.startsWith(SEQUENCE_HOST_MODULE.toolPrefix))).toBe(true);
    expect(structure.every((tool) => tool.name.startsWith(STRUCTURE_HOST_MODULE.toolPrefix))).toBe(true);
    expect(slide.every((tool) => tool.name.startsWith(SLIDE_HOST_MODULE.toolPrefix))).toBe(true);
    expect(new Set([...sequence, ...structure, ...slide].map((tool) => tool.name)).size).toBe(94);
  });

  it("maps every host viewer tool to its matching client module", () => {
    const registry = new CapabilityRegistry();
    for (const [serviceId, clientNames] of [
      [SEQUENCE_HOST_MODULE.id, SEQUENCE_CLIENT_MODULE.toolNames],
      [STRUCTURE_HOST_MODULE.id, STRUCTURE_CLIENT_MODULE.toolNames],
      [SLIDE_HOST_MODULE.id, SLIDE_CLIENT_MODULE.toolNames],
    ] as const) {
      const hostNames = createScienceTools(executor, registry, [serviceId]).map((tool) => tool.name).sort();
      expect([...clientNames].sort()).toEqual(hostNames);
    }
  });
});
