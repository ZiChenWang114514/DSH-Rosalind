# Capability generation sources

`required-operations.json` is the repository copy of the operation-selection input. It was reduced from `showcases/coverage.json` at commit `12d79ecd112ddfd55c1575adfc94c033a368bdc1` of [rosalind-science-showcases](https://github.com/ZiChenWang114514/rosalind-science-showcases). The reduction retains group identifiers, recorded plugin versions, operation identifiers, and only cases present in DSH-Rosalind's 23-showcase catalogue.

The JSON files in `../contracts/` are the public fixed-contract inputs. They retain the selected `tools/list` title, description, input schema, annotations, and execution metadata for the 117 required operations. Raw process output and machine-specific paths are excluded. `dshInputSchema` is derived from each retained input schema by `scripts/generate-capability-manifest.mjs`; the generator checks that the stored derivation still agrees before writing output.

The contract snapshots record the plugin/tool versions represented by the capability manifest: Rosalind `0.2.2-research-preview`, biological sequence viewer `0.1.43`, molecular structure viewer `0.1.80`, slide viewer `0.1.56`, and the NGS operation groups recorded by the source coverage input. They are historical contract records, not evidence of a current live service or a successful external execution.
