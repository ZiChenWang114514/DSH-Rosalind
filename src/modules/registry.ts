import type { Context, Fiber } from "@deepseek-ai/cordis";

import { MODULE_IDS, type ModuleDefinition, type ModuleEnabledState, type ModuleId, type ModuleStatus } from "./types.js";

export interface ModuleRegistryOptions {
  persist?: (enabled: ModuleEnabledState) => Promise<void>;
  disposeShared?: () => void | Promise<void>;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function enabledRecord(source: ReadonlyMap<ModuleId, boolean>): ModuleEnabledState {
  return Object.fromEntries(MODULE_IDS.map((id) => [id, source.get(id) === true])) as ModuleEnabledState;
}

export class ModuleRegistry {
  private readonly definitions = new Map<ModuleId, ModuleDefinition>();
  private readonly fibers = new Map<ModuleId, Fiber>();
  private readonly enabled = new Map<ModuleId, boolean>();
  private readonly active = new Set<ModuleId>();
  private readonly errors = new Map<ModuleId, string>();
  private readonly persist: ((enabled: ModuleEnabledState) => Promise<void>) | undefined;
  private readonly disposeShared: (() => void | Promise<void>) | undefined;
  private queue: Promise<void> = Promise.resolve();
  private destroyed = false;
  private persistenceIssue: string | undefined;

  constructor(private readonly ctx: Context, definitions: readonly ModuleDefinition[], options: ModuleRegistryOptions = {}) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.id)) throw new Error(`Duplicate module definition: ${definition.id}`);
      this.definitions.set(definition.id, definition);
      this.enabled.set(definition.id, false);
    }
    const missing = MODULE_IDS.filter((id) => !this.definitions.has(id));
    if (missing.length > 0) throw new Error(`Missing module definitions: ${missing.join(", ")}`);
    this.persist = options.persist;
    this.disposeShared = options.disposeShared;
  }

  list(): ModuleStatus[] {
    return MODULE_IDS.map((id) => this.status(id));
  }

  status(id: ModuleId): ModuleStatus {
    const definition = this.definition(id);
    const isEnabled = this.enabled.get(id) === true;
    const providers = definition.checkProviders();
    const providerIssues = providers
      .filter((provider) => !provider.runnable)
      .flatMap((provider) => provider.diagnostics.map((diagnostic) => `${provider.label}: ${diagnostic}`));
    const issues = [
      ...providerIssues,
      ...(this.persistenceIssue ? [this.persistenceIssue] : []),
    ];
    const startupError = this.errors.get(id);
    if (startupError) issues.unshift(startupError);

    const status = !isEnabled
      ? "disabled"
      : startupError
        ? "error"
        : this.active.has(id) && providers.length > 0 && !providers.some((provider) => provider.runnable)
          ? "needs_setup"
          : this.active.has(id)
            ? "active"
            : "error";
    if (status === "error" && issues.length === 0) issues.push("The module Fiber is not active.");

    return {
      id,
      name: definition.name,
      status,
      enabled: isEnabled,
      version: definition.version,
      toolCount: definition.toolCount,
      skillCount: definition.skillCount,
      showcaseCount: definition.showcaseCount,
      providers,
      issues,
    };
  }

  selection(): ModuleEnabledState {
    return enabledRecord(this.enabled);
  }

  isActive(id: ModuleId): boolean {
    return this.enabled.get(id) === true && this.active.has(id) && !this.errors.has(id);
  }

  start(initial: Partial<ModuleEnabledState> = {}): Promise<void> {
    return this.serial(async () => {
      this.assertAlive();
      for (const id of MODULE_IDS) {
        const shouldEnable = initial[id] ?? true;
        if (shouldEnable) await this.enableOne(id);
        else await this.disableOne(id);
      }
    });
  }

  enable(id: ModuleId): Promise<void> {
    return this.serial(async () => {
      this.assertAlive();
      await this.enableOne(id);
      await this.persistSelection();
    });
  }

  disable(id: ModuleId): Promise<void> {
    return this.serial(async () => {
      this.assertAlive();
      await this.disableOne(id);
      await this.persistSelection();
    });
  }

  reconcile(next: Readonly<Partial<ModuleEnabledState>>): Promise<void> {
    return this.serial(async () => {
      this.assertAlive();
      for (const id of MODULE_IDS) {
        const shouldEnable = next[id] ?? true;
        if (shouldEnable === (this.enabled.get(id) === true)) continue;
        if (shouldEnable) await this.enableOne(id);
        else await this.disableOne(id);
      }
    });
  }

  destroy(): Promise<void> {
    return this.serial(async () => {
      if (this.destroyed) return;
      this.destroyed = true;
      for (const id of [...MODULE_IDS].reverse()) {
        this.enabled.set(id, false);
        await this.disposeFiber(id);
      }
      await this.disposeShared?.();
    });
  }

  private definition(id: ModuleId): ModuleDefinition {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`Unknown module: ${id}`);
    return definition;
  }

  private async enableOne(id: ModuleId): Promise<void> {
    this.enabled.set(id, true);
    if (this.active.has(id)) return;
    await this.disposeFiber(id);
    this.errors.delete(id);
    const definition = this.definition(id);
    const fiber = this.ctx.plugin(definition.plugin);
    this.fibers.set(id, fiber);
    try {
      await fiber;
      this.active.add(id);
    } catch (cause) {
      this.errors.set(id, `Module startup failed: ${errorMessage(cause)}`);
    }
  }

  private async disableOne(id: ModuleId): Promise<void> {
    this.enabled.set(id, false);
    this.errors.delete(id);
    await this.disposeFiber(id);
  }

  private async disposeFiber(id: ModuleId): Promise<void> {
    const fiber = this.fibers.get(id);
    this.fibers.delete(id);
    this.active.delete(id);
    if (fiber) await fiber.dispose();
  }

  private async persistSelection(): Promise<void> {
    if (!this.persist) return;
    try {
      await this.persist(this.selection());
      this.persistenceIssue = undefined;
    } catch (cause) {
      this.persistenceIssue = `Module settings could not be saved: ${errorMessage(cause)}`;
      throw cause;
    }
  }

  private serial(operation: () => Promise<void>): Promise<void> {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => {});
    return result;
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error("The module registry has been destroyed.");
  }
}
