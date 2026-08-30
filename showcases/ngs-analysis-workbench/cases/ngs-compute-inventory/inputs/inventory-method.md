# Inventory method

The inventory was observed on 2026-08-29 UTC with read-only operations.

- `ngs-compute.list_compute_targets` supplied the registered Workbench targets.
- `ngs-analysis-workbench.get_runtime_environment(target_id="local")` supplied the local runtime snapshot.
- `ngs-compute.inspect_compute_target` was attempted for the registered SSH target and returned an unreachable-host error.
- The authorized SSH compute target was probed with `BatchMode=yes` and a 15-second connection timeout, then registered and inspected through Workbench. The retained output omits aliases, hostnames, usernames, addresses, fingerprints, SSH configuration, and credential material.

Registration, reachability, runtime availability, and workflow readiness are reported separately.
