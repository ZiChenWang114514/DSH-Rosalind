# PMC open-access availability

This ready showcase verifies current article availability for one stable PMCID and preserves the identifier relationships needed for direct display.

![PMC availability summary](previews/pmc-availability.svg)

## Scientific question

Can one PMCID be resolved to its related PubMed and DOI records while reporting current open-access, license, status, and article-file metadata?

## Source observations

- `PMC3257301` resolves to PMID `22253597` and DOI `10.1371/journal.ppat.1002485`.
- The PMC Article Dataset lookup reported open-access status and a CC BY license.
- PDF, XML, and plain-text article files were present; 22 media URLs were reported.
- The compact record marked the article as neither retracted nor a manuscript submission.

## Result

Exact identifiers, status fields, and canonical links are in `outputs/results.json`. `outputs/sources.json` explains which source supports each claim. The preview translates these machine-readable fields into a compact display without analyzing the paper's scientific conclusions.

## Reproduce

1. Run the prompt in `prompt.md` with Life Sciences Literature 0.1.5.
2. Query the PMC Article Dataset by `PMC3257301`.
3. Record the PMCID, PMID, DOI, access flag, license, status flags, and available article-file types.
4. Open the canonical PMC, PubMed, and DOI links to verify article identity.

## Interpretation

The case demonstrates how Codex can turn one article identifier into a transparent availability report suitable for downstream reading or lawful artifact acquisition. Dataset status can change, so applications should refresh it when the current state matters.
