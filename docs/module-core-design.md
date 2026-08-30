# Cordis module core design

## Purpose

DSH-Rosalind is composed as seven independently managed modules: literature,
databases, sequence, NGS, structure, slide, and the Rosalind workbench. The
package plugin remains the single public composition point, while each module
runs in its own Cordis Fiber.

## Public contracts

- `ModuleDefinition` describes stable identity, display metadata, capability
  counts, provider requirements, and the Cordis plugin used to mount a module.
- `ModuleStatus` reports `active`, `disabled`, `needs_setup`, or `error`, plus
  version, Tool/Skill/Showcase counts, provider observations, and actionable
  issues.
- `ModuleRegistry` owns module Fibers and serializes enable, disable, settings
  reconciliation, and full disposal operations.

The registry is available from the root Cordis context as `rosalindModules`
and is also exported for programmatic use.

## Composition and lifecycle

The package constructs the existing science runtimes once. Module Fibers own
only their Tool and Skill registrations. Disabling a module disposes its Fiber
and removes its active registrations, while runtime session data and completed
results remain in memory. Re-enabling creates a fresh Fiber over the same
runtime objects. Full package disposal stops every Fiber before disposing the
shared runtimes.

Provider checks are observational. An enabled module with no runnable required
provider reports `needs_setup`; it still remains mounted so configuration and
diagnostics stay available. Fiber startup failures report `error` without
preventing other modules from starting.

## Settings

The `dsh-rosalind-modules` DSH settings namespace stores one boolean for each
module. Schema defaults enable all seven modules. A settings change is applied
live by reconciling only modules whose desired state changed. Registry calls
persist the complete seven-module selection through the DSH settings service
when it is present; deployments without that optional service keep process-local
state.

## Verification

Core tests cover independent Fiber creation, capability counts, disable and
re-enable behavior, settings restoration and persistence, retained Rosalind run
state, provider-derived `needs_setup`, startup errors, and full disposal.
