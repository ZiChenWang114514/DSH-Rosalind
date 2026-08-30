# Compute target inventory

Inventory the compute contexts visible to NGS Analysis Workbench and compare them with the authorized SSH compute target. Report registration, reachability, runtime observation, and workflow readiness as distinct facts. Use neutral labels and do not retain aliases, hostnames, usernames, addresses, fingerprints, SSH configuration, or credentials.

Call `mcp__rosalind__rosalind_open` for this case and retain its exact launcher response with UTC and local timestamps in `outputs/rosalind-open-observation.json`. State plainly that the operation opens only the Rosalind task chooser and provides no evidence that a scientific task ran.
