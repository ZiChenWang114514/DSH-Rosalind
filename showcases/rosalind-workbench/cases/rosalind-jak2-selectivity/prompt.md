# Reproduce the JAK pocket comparison

Analyze the retained 3EYG, 3FUP, and 3KRR experimental structures. Enumerate all protein residues within 4.0 Å of the deposited ligand, align JAK1 and JAK2 protein-chain sequences before comparing homologous contact positions, and separately compare the two JAK2 contact sets. Recompute standard descriptors for PubChem CIDs 9926791 and 46398810 with RDKit. Keep published selectivity evidence distinct from local geometry, and do not claim that ligand design or docking was executed.

Invoke `mcp__rosalind__rosalind_open` with `task_context` set to "Document the JAK2 selectivity showcase; open the task chooser only and do not start a scientific job." Store the exact response in `outputs/rosalind-open-observation.json` and describe it only as a task-chooser readiness observation. It does not show that the official `design-jak2-binders` task or another scientific service ran.
