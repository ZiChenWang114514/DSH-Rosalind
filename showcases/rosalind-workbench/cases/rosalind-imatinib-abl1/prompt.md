# Reproduce the ABL1 pose comparison

Using the retained 1IEP and 3CS9 coordinate files, compute all ABL1 residues whose minimum heavy-atom distance to imatinib or nilotinib is at most 4.0 Å. Compare the two contact sets, recompute standard molecular descriptors from the retained PubChem CID records with RDKit, and keep the distance table, descriptor table, summary, and preview. Treat the coordinates as experimental poses and state explicitly that no new docking was run.

Also invoke `mcp__rosalind__rosalind_open` with `task_context` set to "Document the Imatinib-ABL1 experimental-pose showcase; open the task chooser only and do not start a scientific job." Preserve the exact launcher response in `outputs/rosalind-open-observation.json`. Treat it only as evidence that the task chooser opened; it does not show that a scientific job ran, and the scientific evidence must remain the retained structures and local calculations.
