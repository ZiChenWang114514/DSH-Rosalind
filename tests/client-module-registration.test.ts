import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import { describe, expect, it } from "vitest";

import { registerSequenceClientModule, SEQUENCE_CLIENT_MODULE } from "../src/client/modules/sequence.js";
import { registerSlideClientModule, SLIDE_CLIENT_MODULE } from "../src/client/modules/slide.js";
import { registerStructureClientModule, STRUCTURE_CLIENT_MODULE } from "../src/client/modules/structure.js";

type RegisterModule = (context: ClientContext) => void;

function exerciseRegistration(registerModule: RegisterModule, toolNames: readonly string[]): void {
  const registered = new Set<string>();
  const cleanups: Array<() => void> = [];
  const context = {
    slots: {
      register(spec: { key: string }) {
        registered.add(spec.key);
        return () => { registered.delete(spec.key); };
      },
    },
    effect(setup: () => void | (() => void)) {
      const cleanup = setup();
      if (cleanup) cleanups.push(cleanup);
    },
  } as unknown as ClientContext;

  registerModule(context);
  expect(registered).toEqual(new Set(toolNames));
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
  expect(registered).toEqual(new Set());

  registerModule(context);
  expect(registered).toEqual(new Set(toolNames));
}

describe("scientific client module registration", () => {
  it("removes Sequence, Structure, and Slide tool views before a hot reload registers them again", () => {
    exerciseRegistration(registerSequenceClientModule, SEQUENCE_CLIENT_MODULE.toolNames);
    exerciseRegistration(registerStructureClientModule, STRUCTURE_CLIENT_MODULE.toolNames);
    exerciseRegistration(registerSlideClientModule, SLIDE_CLIENT_MODULE.toolNames);
  });
});
