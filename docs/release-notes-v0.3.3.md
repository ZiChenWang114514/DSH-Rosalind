# DSH-Rosalind 0.3.3

DSH-Rosalind 0.3.3 is a focused correctness and performance update for the scientific workbench introduced in 0.3.2.

## Improvements

- Prevents viewer wheel gestures from scrolling the surrounding Harness page and keeps keyboard and tab state usable.
- Bounds large Structure and Sequence visualizations, improves weak text contrast, adds missing read-only styles and avoids duplicate DOM/SVG identifiers.
- Uses the newest retained scientific session evidence and resets evidence signatures when the active DSH session changes.
- Distinguishes the 23 recorded fresh-run Showcase routes from the full set of 100 lesson-and-replay projects and rejects unavailable reproduction routes before planning.
- Tightens scientific output identity and operation schemas, isolates calls without a DSH session, throttles NGS persistence and requires authorized Sequence export paths.
- Makes Structure movie encoding asynchronous and cancellable, adds small in-memory TTL caches for eligible public source requests, resolves Rosalind export paths from the active workspace and preserves scientific error codes and messages.
- Connects research-task creation to the selected DSH workspace and its real blank session, then submits through that session's conversation service.
- Makes Science mode reversible, creates and selects a real locally managed `Rosalind Science` agent preset, and remains usable on DSH builds that do not yet expose the companion sidebar-view service.
- Adds the companion Harness workspace-sidebar implementation at Harness commit `eb0da321e2ce9aad83704177f45b01cee5e8e011`; the Release includes its small `git format-patch` file, and the standard Harness session browser remains intact while Rosalind registers a separate Science view.

## Verification

- `npm run validate`: passed, including 52 Vitest files and 493 tests.
- Playwright: 57 passed; 7 live-profile cases were skipped because `DSH_PROFILE_URL` was not supplied.
- The rebuilt Harness and installed 0.3.3 archive passed four additional live-profile browser checks at wide, HiDPI and narrow sizes.
- Companion Harness source: 13 focused test files and 195 tests passed; Host/client libraries and the production Web frontend built successfully.
- The published archive is inspected as a packed bundle and installed into a clean DSH `0.1.1-rc.2` profile for explicit registration and representative module checks.
