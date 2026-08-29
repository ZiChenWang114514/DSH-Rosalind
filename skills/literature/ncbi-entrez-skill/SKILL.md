---
name: ncbi-entrez-skill
description: Use NCBI Entrez literature through DSH-Rosalind's typed public-service request tool.
---

# NCBI Entrez literature

Use `literature_request` with `provider: "ncbi-entrez"`. Select the source requested by the user. Do not silently replace a requested service with another provider, mirror, archive, or identifier resolver.

## Request and pagination

Use the typed fields accepted by the selected provider. Start with a narrow query and one modest page; retain the returned cursor, page token, offset, or HATEOAS link when more records are requested. Do not enlarge a request merely because the first response is incomplete. Request raw or machine-readable output only when the user asks for it, and report a saved artifact path instead of pasting a large payload.

## Evidence and reporting

Keep the provider, request parameters, identifiers, response time, official source URL, and returned record identifiers with the result. Link substantive claims only to returned source records. Separate returned observations from interpretation, describe empty or failed responses plainly, and refresh stale network results before relying on them in a long conversation.

## Authorization and cancellation

This Skill uses only the registered public-service provider. Respect any host prompt or user restriction on external access, and do not use a different service when the requested one is unavailable. A request inherits conversation cancellation; after cancellation, do not reissue it unless the user asks again.
