# Public source and demonstration scope

- Nextflow CLI reference: `https://www.nextflow.io/docs/latest/reference/cli.html`
- Scientific question: how can a cancellation request be followed by direct observation of a terminal state without risking a scientific dataset or registered run?
- Demonstration rule: start only a case-owned disposable Python child in a temporary directory, terminate that same process, confirm that it is no longer running, and allow the temporary directory to be removed automatically.

The retained local demonstration tests process-cancellation mechanics. It is not a Nextflow, Snakemake, or NGS Analysis Workbench engine run and produces no scientific result.
