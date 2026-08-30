# Capability evidence

`capability-manifest.json` is the implementation ledger for DSH-Rosalind. It records seven service ecosystems, 55 runtime Skills, and the 121 model-visible operations required by the retained 23-showcase catalogue.

The manifest begins conservatively: a catalogue reference is not implementation evidence. An item becomes `implemented` only after its DSH code path exists. An operation becomes `verified` only when an executed operation-specific fixture asserts a successful local scientific result, or equivalent live DSH evidence is recorded. Exact unavailable diagnostics and combined mixed fixtures remain `implemented`. Services and Skills remain `implemented` until a real DSH profile executes them. Read `verificationScope`, `fixtureOutcome`, and the `live` evidence record before making an availability claim. Exact fixed-version input contracts are stored under `contracts/`; the DSH output contract is recorded separately because the original MCP tool lists expose input schemas but do not publish output schemas. These contract files are the public, path-free snapshots used by the generator. They contain only the selected tool metadata and schemas needed by DSH-Rosalind; raw audit process output is deliberately excluded. `sources/required-operations.json` is a reduced copy of the public showcase coverage record at the cited source commit, limited to operation identifiers, plugin versions, and cases retained by this repository.

A clean clone can reproduce the manifest and contract set without a sibling repository or ignored audit artifacts:

```powershell
npm run generate:capabilities
npm run check:capability-generation
```

The generator checks the 7/55/121 totals, validates each stored DSH input schema against its fixed input schema, and fails when an operation cannot be matched to the recorded contract. `ROSALIND_COVERAGE_PATH`, `ROSALIND_CAPABILITY_CONTRACT_DIR`, and `ROSALIND_CAPABILITY_OUTPUT_DIR` remain available for an explicit snapshot refresh or isolated output; none is required for the default generation path. The generation check copies the package manifest, recorder, generator, full source and Skill trees, fixed catalogue and retained CSV inputs, contracts, fixtures, and machine record into a temporary checkout. It compares JSON meaning while excluding only the run timestamp, then confirms that changing either a fixed CSV input or source file makes recorded execution unavailable.
