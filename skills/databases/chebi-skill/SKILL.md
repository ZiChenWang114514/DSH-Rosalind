---
name: chebi-skill
description: Use ChEBI through the fixed DSH-Rosalind service contract.
---

# ChEBI

## When to use

Use this Skill for a ChEBI compound, chemical name search, or ontology relationship. Its fixed reference is `life-sciences-databases-0.1.5/skills/chebi-skill/SKILL.md`; the DSH mapping below preserves that source workflow while routing execution through the registered DSH service.

## Fixed provider contract

The registered provider is `chebi` (ChEBI) at `https://www.ebi.ac.uk`. Its default relative route is `chebi/backend/api/public/es_search/`; named `operation` values are `compound`, `search`; pagination mode is `page-size`. Use only a named operation or an official relative path accepted by that provider.

## Tool call sequence

1. Confirm that the requested scientific source matches `chebi` and identify the smallest relevant question.
2. Call `database_request` with `provider: "chebi"`, `allowNetwork: true`, and search with a text query or compound with a CHEBI identifier. Start with `search` unless the requested record needs another documented operation.
3. Keep one bounded page at a time. Use the returned pagination cursor or page only when the user asks for more.
4. Read the returned `status`, `records`, `sources`, `request`, and `pagination` before presenting a scientific conclusion.

## Success and interpretation

On `status: "completed"`, report compound properties or ontology terms. Cite only returned `sources`; distinguish source observations from analysis. For raw or machine-readable output, request it explicitly and provide the generated artifact path rather than pasting an unbounded payload.

## Failure, authorization, and cancellation

Live public requests need the host approval produced by `allowNetwork: true`. If approval is denied or the service returns `NETWORK_NOT_AUTHORIZED`, say that the selected source was not contacted; do not query a mirror or another provider. Preserve source-specific validation, HTTP, rate-limit, and empty-result diagnostics. The call receives the conversation cancellation signal; after cancellation, do not reissue it unless the user asks again.

## Provenance and viewer handoff

Keep provider, operation, identifiers, typed parameters, request URL or method, checked time, returned record IDs, pagination state, and source URLs with the result. This Skill has no embedded viewer: if a returned accession is later opened in a Sequence, Structure, or Slide session, record that viewer session separately instead of treating a search result as viewer evidence.
