# Reproduce the EGFR T790M comparison

Analyze the retained 5XDK and 6JX0 experimental coordinates. List every EGFR residue within 4.0 Å of rociletinib or osimertinib, preserve the deposited Cys797 `LINK` records, compare the contact sets, and recompute common descriptors from PubChem CIDs 57335384 and 71496458 with RDKit. Keep source observations, local calculations, and interpretation separate; state that no new docking or efficacy experiment was run.

Invoke `mcp__rosalind__rosalind_open` with `task_context` set to "Document the EGFR T790M inhibitor-pose showcase; open the task chooser only and do not start a scientific job." Save its exact response in `outputs/rosalind-open-observation.json` and state that the call opened only the chooser and did not perform a scientific analysis.
