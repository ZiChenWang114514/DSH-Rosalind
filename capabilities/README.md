# Capability evidence

`capability-manifest.json` is the implementation ledger for DSH-Rosalind. It records seven service ecosystems, 55 runtime Skills, and the 117 model-visible operations required by the retained 23-showcase catalogue.

The manifest begins conservatively: a catalogue reference is not implementation evidence. An item becomes `implemented` only after its DSH code path exists. `verified` means that the recorded fixture contract passed with meaningful input and an asserted successful local result, mixed success/diagnostic behavior, or an exact unavailable diagnostic. It does not mean that every capability produced a successful scientific result, ran through a clean DSH profile, or reached a public service. Read `verificationScope`, `fixtureOutcome`, and the `live` evidence record before making an availability claim. Exact fixed-version input contracts are stored under `contracts/`; the DSH output contract is recorded separately because the original MCP tool lists expose input schemas but do not publish output schemas. These contract files are the public, path-free snapshots used by the generator. They contain only the selected tool metadata and schemas needed by DSH-Rosalind; raw audit process output is deliberately excluded. `sources/required-operations.json` is a reduced copy of the public showcase coverage record at the cited source commit, limited to operation identifiers, plugin versions, and cases retained by this repository.

A clean clone can reproduce the manifest and contract set without a sibling repository or ignored audit artifacts:

```powershell
npm run generate:capabilities
npm run check:capability-generation
```

The generator checks the 7/55/117 totals, validates each stored DSH input schema against its fixed input schema, and fails when an operation cannot be matched to the recorded contract. `ROSALIND_COVERAGE_PATH`, `ROSALIND_CAPABILITY_CONTRACT_DIR`, and `ROSALIND_CAPABILITY_OUTPUT_DIR` remain available for an explicit snapshot refresh or isolated output; none is required for the default generation path. The generation check copies only the required repository files into a temporary checkout, removes external-path overrides, and compares JSON meaning while excluding only the run timestamp.
