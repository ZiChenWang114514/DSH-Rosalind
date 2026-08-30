---
name: human-protein-atlas-skill
description: Use Human Protein Atlas through the fixed DSH-Rosalind service contract.
---

# Human Protein Atlas

## When to use

Use this Skill for Human Protein Atlas gene expression, tissue, or cell-line information. Its fixed reference is `life-sciences-databases-0.1.5/skills/human-protein-atlas-skill/SKILL.md`; the DSH mapping below preserves that source workflow while routing execution through the registered DSH service.

## Fixed provider contract

The registered provider is `human-protein-atlas` (Human Protein Atlas) at `https://www.proteinatlas.org`. Its default relative route is `search_download.php`; named `operation` values are `gene`, `tissue`, `cellline`; pagination mode is `none`. Use only a named operation or an official relative path accepted by that provider.

## Tool call sequence

1. Confirm that the requested scientific source matches `human-protein-atlas` and identify the smallest relevant question.
2. Call `database_request` with `provider: "human-protein-atlas"`, `allowNetwork: true`, and gene, tissue, or cellline with a gene symbol or concise search term. Use the explicit action requested by the source contract.
3. Keep one bounded page at a time. Use the returned pagination cursor or page only when the user asks for more.
4. Read the returned `status`, `records`, `sources`, `request`, and `pagination` before presenting a scientific conclusion.

## Success and interpretation

On `status: "completed"`, report expression-oriented source records or downloadable tabular metadata. Cite only returned `sources`; distinguish source observations from analysis. For raw or machine-readable output, request it explicitly and provide the generated artifact path rather than pasting an unbounded payload.

## Failure, authorization, and cancellation

Live public requests need the host approval produced by `allowNetwork: true`. If approval is denied or the service returns `NETWORK_NOT_AUTHORIZED`, say that the selected source was not contacted; do not query a mirror or another provider. Preserve source-specific validation, HTTP, rate-limit, and empty-result diagnostics. The call receives the conversation cancellation signal; after cancellation, do not reissue it unless the user asks again.

## Provenance and viewer handoff

Keep provider, operation, identifiers, typed parameters, request URL or method, checked time, returned record IDs, pagination state, and source URLs with the result. This Skill has no embedded viewer: if a returned accession is later opened in a Sequence, Structure, or Slide session, record that viewer session separately instead of treating a search result as viewer evidence.
