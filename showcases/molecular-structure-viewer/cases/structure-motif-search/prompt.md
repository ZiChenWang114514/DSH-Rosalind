# Geometric motif search

Use the retained RCSB 3PTB coordinates to verify author chain A His57, Asp102, and Ser195 and calculate their deposited catalytic-atom geometry. Prepare the exact public RCSB motif request with SIDE_CHAIN pairing, KRUSKAL pruning, a 2.0 Å RMSD cutoff, 1.0 Å distance tolerances, and a 20° angle tolerance. Save public hits only if the Molecular Structure Viewer acknowledges the request and returns a query hash and result page.

Inspect `outputs/rosalind-open-observation.json` as a separate launcher-availability observation. It records only that Rosalind Workbench was ready; do not describe it as a Rosalind scientific calculation or as execution of the public motif request.
