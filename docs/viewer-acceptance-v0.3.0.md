# Scientific viewer acceptance checklist for v0.3.0

Use this checklist when reviewing changes to the shared science ToolView, Sequence, Structure, or Slide clients. Record the exact commit under review. A previous screenshot, test run, or review does not establish the result for a newer commit.

## Review record

- [ ] Member ID and task ID are recorded.
- [ ] Feature branch, target branch, and exact commit SHA are recorded.
- [ ] Changed files and inspected supporting files are listed.
- [ ] Focused unit tests are listed with their observed result.
- [ ] Browser or DSH checks are listed with viewport, theme, profile, and observed result.
- [ ] Checks not performed are stated plainly.
- [ ] The review ends with `APPROVE` or `REQUEST_CHANGES` and describes any required correction.

## Shared ToolView behavior

- [ ] Every registered scientific operation resolves to the intended Sequence, NGS, Structure, or Slide ToolView without duplicate names.
- [ ] Running, completed, and failed calls remain distinguishable; scientific error codes and messages are preserved.
- [ ] `Inspect call` opens the host inspection surface, and artifact buttons call the shared file-opening callback with the recorded path.
- [ ] ToolView tabs expose `tab`, `tablist`, `tabpanel`, `aria-selected`, and a single tab stop; Left, Right, Home, and End move focus and selection.
- [ ] Project-detail dialogs keep keyboard focus within the dialog, close with Escape, restore prior focus, and associate each tab with its content.
- [ ] Light and dark themes retain readable text, controls, status indicators, and visible focus.
- [ ] The ToolView stays within 720 px, 1280 px, 1440 px, and 2048 px viewports without document-level horizontal scrolling.
- [ ] CSS 200% zoom leaves search, project opening, dialog content, and primary actions usable. This check does not claim browser-interface zoom or full accessibility conformance.

## Sequence

- [ ] The result identifies the active viewer type and displays only records returned by the tool result.
- [ ] Record filtering preserves the original identifiers, labels, molecule type, and length.
- [ ] Alignment and Metrics tabs retain state and remain keyboard operable.
- [ ] Metrics use returned values and columns; missing residue strings or metrics are described without fabricated sequence content.
- [ ] Session identity and revisions shown in the client match the latest durable tool result.

## Structure

- [ ] Returned coordinates reach the project-owned Canvas, and the rendered-coordinate count matches the supplied coordinate array.
- [ ] When coordinates are absent, the client reports that state and does not draw inferred molecular geometry.
- [ ] Atom, residue, ligand, object, analysis, scene, and geometry values come from the latest result and preserve their units.
- [ ] Pointer pan, wheel zoom, atom selection, Escape, and Home behavior are checked; selection and view state remain understandable to keyboard users.
- [ ] `viewerSessionId`, scene revision, geometry revision, and synchronization status remain consistent with the host result.

## Slide

- [ ] Authorized decoded pixel data is rendered only when the result supplies the data URL, dimensions, and source revision.
- [ ] Dimension-only results are identified as coordinate previews and do not imply that source pixels were inspected.
- [ ] Pan, zoom, reset, pointer cancellation, and keyboard controls preserve a coherent view state.
- [ ] Source dimensions, visible bounds, regions, spatial values, and layer state match the latest tool result.
- [ ] Read-only layer visibility is disabled and explained; the client does not present it as an active viewer control.
- [ ] `viewerSessionId`, source revision, state revision, and authorization-dependent state remain consistent with the host result.

## v0.3.0 evidence to compare

- [ ] Repository Playwright references for Sequence, NGS, Structure, and Slide were compared at the viewports affected by the change.
- [ ] The dark Structure reference and narrow Slide result were compared when styles or layout changed.
- [ ] The release screenshots for the DSH catalogue, dark project detail, and narrow layout were compared when shared client styles changed.
- [ ] The isolated-profile record is interpreted according to its `archiveKind`; source smoke evidence is not described as an installed release archive.
- [ ] Scientific Canvas output is described as a local client rendering of returned data. It is not presented as native-viewer scientific validation.

## Release-level checks assigned separately

The engineering quality owner or coordinator schedules the complete `npm run validate`, the full Playwright matrix, archive packing, and clean-profile DSH installation. A focused review must list these as unperformed until their recorded results are available for the exact release commit.
