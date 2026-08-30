# SSH probe plan

Probe the authorized SSH compute target without requesting credentials and retain only nonsecret operational facts.

1. Use OpenSSH `BatchMode=yes` and `ConnectTimeout=15`.
2. Read the operating-system label, architecture, CPU count, total memory, and writable-state booleans for the home and temporary directories.
3. Check command availability on the noninteractive `PATH` and collect short version strings.
4. Query Docker server metadata and GPU model/count without listing containers, images, files, processes, users, addresses, or environment variables.
5. Register only a case-owned neutral target reference with a temporary workspace and the local-process executor.
6. Inspect the registered target and retain safe runtime states without exposing credentials, private addresses, usernames, host fingerprints, or host-specific executable paths.
