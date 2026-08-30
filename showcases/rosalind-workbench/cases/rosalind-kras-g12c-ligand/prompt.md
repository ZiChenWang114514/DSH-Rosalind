# Reproduce the KRAS G12C pose comparison

Use the retained 6OIM and 6USZ experimental coordinate files to enumerate KRAS residues within 4.0 Å of the deposited sotorasib and adagrasib ligand forms. Preserve and report the PDB `LINK` records to Cys12, compare the contact sets, and recompute common descriptors from PubChem CIDs 137278711 and 138611145 with RDKit. State that the structures contain experimental poses and that no new docking, reaction simulation, or efficacy experiment was run.

Invoke `mcp__rosalind__rosalind_open` with `task_context` set to "Document the KRAS G12C ligand-pose showcase; open the task chooser only and do not start a scientific job." Retain its exact response in `outputs/rosalind-open-observation.json` and present it only as evidence that the chooser opened, never as evidence of a scientific calculation.
