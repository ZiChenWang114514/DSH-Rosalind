# Snakemake readiness report

Check the bundled `oai_fastq_qc` workflow on the local target. Retain its exact catalogue identity and a minimal native Snakemake definition. Refresh runtime and readiness, then call `ngs-analysis-workbench.plan_snakemake` with the same workflow, target, runtime snapshot, configuration, and temporary run directory. Preserve the exact safe arguments, timestamps, and returned plan identity or error in `outputs/plan-snakemake-receipt.json`. Do not claim that a plan or run exists when the call fails. Execute the shared Python FASTQ reference computation separately on the public two-record fixture.

Call `mcp__rosalind__rosalind_open` for this case and retain its exact launcher response with UTC and local timestamps in `outputs/rosalind-open-observation.json`. State plainly that the operation opens only the Rosalind task chooser and provides no evidence that a scientific task ran.
