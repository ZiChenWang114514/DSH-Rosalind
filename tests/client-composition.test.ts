import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import { describe, expect, it } from "vitest";

import { inject } from "../src/client/index.js";
import { createRosalindWorkbenchClientModule } from "../src/client/workflow-modules.js";

describe("DSH client composition", () => {
  it("leaves the native WorkspaceBrowser registered and exposes Science as a conversation view", () => {
    const registrations: Array<Record<string, unknown>> = [];
    const boundNamespaces: string[] = [];
    const sidebarEntries: Array<Record<string, unknown>> = [];
    const themes: Array<Record<string, unknown>> = [];
    const services: Record<string, unknown> = {
      workspaceSidebar: {
        register(entry: Record<string, unknown>) { sidebarEntries.push(entry); return () => undefined; },
        select() {},
      },
      theme: {
        register(theme: Record<string, unknown>) { themes.push(theme); return () => undefined; },
        setTheme() {},
      },
      connection: { api: { agentPresets: { select: async () => ({ result: { ok: true, value: { agentPreset: "standard" } } }) } } },
      sessions: {
        list: { getSnapshot: () => ({ current: undefined, byId: {} }) },
        scope: () => undefined,
        noteAgentPreset() {},
      },
    };
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
      get(name: string) { return services[name]; },
    } as unknown as ClientContext;

    const plugin = createRosalindWorkbenchClientModule() as { apply(context: ClientContext): void };
    plugin.apply(ctx);

    expect(inject).toEqual(["slots"]);
    expect(registrations.some((spec) => spec.name === "sidebar.workspaces")).toBe(false);
    expect(registrations.some((spec) => spec.name === "shell.overlay")).toBe(false);
    expect(registrations.some((spec) => spec.name === "conversation.hero.workspace")).toBe(false);
    expect(registrations).toContainEqual(expect.objectContaining({ name: "conversation.view", label: "Science" }));
    expect(registrations).toContainEqual(expect.objectContaining({ name: "settings.section", id: "dsh-rosalind" }));
    expect(boundNamespaces).toEqual(["dsh-rosalind-modules"]);
    expect(sidebarEntries).toContainEqual(expect.objectContaining({ id: "science", label: "科学" }));
    expect(themes).toContainEqual(expect.objectContaining({ id: "rosalind-science" }));
  });
});
