# Public packaging specification

- RO-Crate Metadata Specification 1.1: https://www.researchobject.org/ro-crate/1.1/
- RO-Crate project source: https://github.com/ResearchObject/ro-crate

This case uses the RO-Crate 1.1 JSON-LD context, a root dataset, file entities, case datasets, and a create action. It adds a simple `additionalType` value to classify each retained artifact as a source observation, computed result, experimental plan, workflow plan, or provenance record.

The archive is generated locally with lexicographically ordered member paths and a fixed ZIP timestamp. Structural validation checks JSON parsing, file presence, declared content size, inventory membership, and preservation of plan labels. These checks establish package consistency; they do not establish biological correctness.
