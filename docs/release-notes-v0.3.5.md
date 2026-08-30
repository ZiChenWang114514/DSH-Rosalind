# DSH-Rosalind 0.3.5

DSH-Rosalind 0.3.5 refines the scientific workbench after an independent Kimi review and three focused engineering reviews.

## Frontend and interaction

- Sequence, Structure, and Slide client registrations now release their Cordis ToolViews during unload and hot reload.
- PNG showcase previews use the generated preview data keyed by showcase ID; SVG and empty-preview behavior remain compact.
- Workbench, ecosystem, and settings identifiers are instance-safe, and keyboard navigation stays within the active component.
- Detail tabs preserve their mounted content and local state.
- Settings use theme-aware CSS classes with readable light and dark surfaces.
- Rosalind Science supplies light and dark themes and follows the Harness active color scheme, including a system preference.
- The scientific interface now has shared motion timing, numeric alignment, focus styling, and reduced-motion behavior.

## Scientific viewers and evidence

- Slide tile and coordinate views expose consistent zoom, pan, location feedback, and keyboard guidance.
- Structure rendering uses one instrument-style scene and removes the unused legacy projection.
- Conversation evidence compares only scientific tool results, so ordinary or streaming messages do not refresh unchanged scientific projections.
- Bundled Skill compatibility hashes use canonical line endings for consistent Windows and Linux verification.

## Verification

- The release candidate retains one DSH-Rosalind plugin containing seven Cordis science modules, 55 Skills, 100 ready Showcases, and the 140-tool contract.
- Full validation, browser checks, packaging, and clean DSH installation are performed against the final release commit.
