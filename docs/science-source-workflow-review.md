# Science source and workflow review checklist

Use this checklist when reviewing source-service or scientific-workflow changes. Record the exact commit under review and repeat the review after any new commit.

## Shared science contract

- Confirm the service ID, operation name, registered DSH tool name, fixed input schema, and operation-specific output schema agree.
- Confirm every result includes `serviceId`, `operation`, and an allowed `status`; failures include a stable error code and message.
- Reject undeclared top-level output fields and values whose type differs from the operation contract.
- Confirm tool registration, `output.render`, `presentCall`, `presentResult`, and presentation metadata through DSH ToolRuntime tests.
- Confirm artifact IDs and claim IDs are unique, claim references resolve, and `scientificAssertions` exactly reproduce the observation and computed claims.
- If a client-visible field changes, record its previous value, new value, affected tools, and tests, then notify the experience lead before integration.

## Literature and database sources

- Map every supported provider action to its official HTTPS origin, HTTP method, path, identifier fields, query parameters, request body, response format, and record path.
- Verify provider-specific pagination. Do not assume generic `page` and `pageSize` parameters match the public API.
- Verify identifiers are transmitted for fetch, summary, link, and lookup actions, not only for search.
- Keep caller headers restricted to documented public-source headers; reject ambient credentials and sensitive authentication headers.
- Require explicit network authorization for live requests. Offline calls should return the typed `NETWORK_NOT_AUTHORIZED` result with the planned request visible.
- Test the configured timeout, caller cancellation, HTTP errors, malformed responses, empty results, and unknown provider or action behavior.
- Preserve request provenance: method, final URL, response format, retrieval time, source name, and source URL. An empty result must remain distinct from a transport or parsing failure.
- When raw response saving is requested, require an approved package-relative path, refuse overwrite, and report the written path. Do not save raw data unless requested.
- Use mocked provider responses for routine tests. A public-network check must be free, explicitly authorized, narrow, and reported separately.

## Scientific workflows

- Keep workflow ID, version ID, source checksum, engine, run directory, declared inputs, scientific inputs, target, and command stable from planning through execution.
- Bind a plan to the exact selected files and configuration. Recheck file identity before execution and reject changed inputs or parameter files.
- Verify readiness reports the requested engine and executable, bundled workflow source availability, target availability, input paths, and precise diagnostics.
- Require the exact plan ID, name, and checksum when human confirmation is needed; model arguments alone cannot approve execution or workspace writes.
- Reuse a stable DSH session identity for persistent NGS records. Verify a reconstructed session can observe the same registered run without creating a duplicate.
- Exercise the lifecycle states relevant to the change: planned, queued, running, stopping, completed, failed, cancelled, termination failure, and restored orphan records.
- Verify cancellation records whether a request was accepted and whether execution has settled. Do not report a settled run as actively cancelled.
- Keep summary and report updates associated with the durable registry run ID and reject references to a different plan or workflow.
- Local smoke tests may use small retained fixtures. SSH, GPU, paid services, external uploads, and experimental work require separate authorization.

## Review report

Include the member ID, task ID, commit SHA, files inspected, exact tests and results, browser or DSH results, items not checked, and `APPROVE` or `REQUEST_CHANGES`. A PR link alone is not review evidence.
