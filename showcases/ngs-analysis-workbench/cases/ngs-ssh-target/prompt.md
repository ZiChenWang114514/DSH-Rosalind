# Saved SSH target inspection

Inspect the authorized SSH compute target with a bounded, read-only BatchMode probe, then call `ngs-compute.configure_ssh_target` for a case-owned neutral target reference. Retain the exact non-identifying registration arguments, response fields, and timestamps in `outputs/configure-ssh-target-receipt.json`; omit aliases, credentials, private addresses, usernames, host fingerprints, host-specific executable paths, and environment-specific workspace paths. Inspect the registered target and state whether its temporary workspace and workflow controllers are available.

Call `mcp__rosalind__rosalind_open` for this case and retain its exact launcher response with UTC and local timestamps in `outputs/rosalind-open-observation.json`. State plainly that the operation opens only the Rosalind task chooser and provides no evidence that a scientific task ran.
