# Reproduce the MDM2 pocket-occupancy comparison

Analyze the retained 1YCR MDM2–p53 peptide and 4HG7 MDM2–Nutlin-3a experimental structures. Enumerate MDM2 residues within 4.0 Å of the peptide or small molecule, retain each nearest partner residue and atom, compare the MDM2 contact sets, and recompute common Nutlin-3a descriptors from PubChem CID 11433190 with RDKit. Report the engineered 4HG7 construct and state that no docking, binding assay, or efficacy experiment was run.

Invoke `mcp__rosalind__rosalind_open` with `task_context` set to "Document the MDM2-p53 inhibitor showcase; open the task chooser only and do not start a scientific job." Preserve its exact response in `outputs/rosalind-open-observation.json` and identify it only as a chooser-readiness observation; all scientific claims must come from the retained public inputs and local computation.
