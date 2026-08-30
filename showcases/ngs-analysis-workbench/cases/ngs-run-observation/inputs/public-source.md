# Observation input

The observation uses the local execution case's retained summary and tables plus `outputs/local-run-timeline.jsonl`. Each JSONL record was written during the direct Python run. The sequence `prepared → running → completed` is a local state-machine rehearsal and has no Workbench registry identity.
