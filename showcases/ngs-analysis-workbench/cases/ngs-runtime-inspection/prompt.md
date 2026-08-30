# Runtime environment inspection

Inspect the current local Workbench runtime and compare it with the runtime visible through the authorized SSH compute target. Report command state, versions, Docker server reachability, controller candidates, and inspection limitations without claiming workflow readiness. Use neutral public labels and omit aliases, usernames, addresses, fingerprints, and environment-specific paths.

Call `mcp__rosalind__rosalind_open` for this case and retain its exact launcher response with UTC and local timestamps in `outputs/rosalind-open-observation.json`. State plainly that the operation opens only the Rosalind task chooser and provides no evidence that a scientific task ran.
