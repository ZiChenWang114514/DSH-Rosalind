import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import { describe, expect, it } from "vitest";

import { inject } from "../src/client/index.js";
import { createRosalindWorkbenchClientModule } from "../src/client/workflow-modules.js";

describe("DSH client composition", () => {
  it("leaves the native WorkspaceBrowser registered and exposes Science as a conversation view", () => {
    const registrations: Array<Record<string, unknown>> = [];
    const boundNamespaces: string[] = [];
    const ctx = {
      slots: {
        register(spec: Record<string, unknown>) {
          registrations.push(spec);
          return () => undefined;
        },
      },
      settingsScope: {
        bind(spec: { namespace: string }) {
          boundNamespaces.push(spec.namespace);
          return {
            getSnapshot: () => ({ status: "loading", value: undefined, base: undefined, user: undefined, revision: undefined, writable: false, mode: "host" }),
            subscribe: () => () => undefined,
            set: async () => undefined,
            unset: async () => undefined,
          };
        },
      },
      effect(setup: () => void | (() => void)) { setup(); },
    } as unknown as ClientContext;

    const plugin = createRosalindWorkbenchClientModule() as { apply(context: ClientContext): void };
    plugin.apply(ctx);

    expect(inject).toEqual(["slots"]);
    expect(registrations.some((spec) => spec.name === "sidebar.workspaces")).toBe(false);
    expect(registrations.some((spec) => spec.name === "shell.overlay")).toBe(false);
    expect(registrations).toContainEqual(expect.objectContaining({ name: "conversation.view", label: "Science" }));
    expect(registrations).toContainEqual(expect.objectContaining({ name: "settings.section", id: "dsh-rosalind" }));
    expect(boundNamespaces).toEqual(["dsh-rosalind-modules"]);
  });
});
