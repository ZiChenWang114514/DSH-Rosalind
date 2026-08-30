export const SCIENCE_VIEWER_CSS = String.raw`
.sv-root {
  --sv-accent: #557e72;
  --sv-accent-soft: color-mix(in srgb, var(--sv-accent) 12%, var(--rr-panel-solid));
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--rr-line);
  border-radius: 15px;
  background: var(--rr-panel-solid);
  color: var(--rr-ink);
  box-shadow: 0 8px 24px rgba(31, 44, 39, .08);
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.sv-root *, .sv-root *::before, .sv-root *::after { box-sizing: border-box; }
.sv-root button, .sv-root input { color: inherit; font: inherit; }
.sv-root button:focus-visible, .sv-root input:focus-visible, .sv-root [tabindex="0"]:focus-visible { outline: 2px solid color-mix(in srgb, var(--sv-accent) 58%, transparent); outline-offset: 2px; }
.sv-root--sequence { --sv-accent: #3d8190; }
.sv-root--ngs { --sv-accent: #7f64a8; }
.sv-root--structure { --sv-accent: #ba6b4f; }
.sv-root--slide { --sv-accent: #b0577b; --sv-slide-tissue: #e7b8c9; --sv-slide-nucleus: #92597d; }
.sv-head { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto auto; gap: 10px; align-items: center; min-height: 54px; padding: 9px 11px; border-bottom: 1px solid var(--rr-line); background: color-mix(in srgb, var(--sv-accent) 5%, var(--rr-panel-solid)); }
.sv-app-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--sv-accent-soft); color: var(--sv-accent); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; font-weight: 800; letter-spacing: -.03em; }
.sv-head-copy { min-width: 0; }
.sv-head-copy strong, .sv-head-copy span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-head-copy strong { font-size: 11.5px; font-weight: 720; }
.sv-head-copy span { margin-top: 2px; color: var(--rr-muted); font-size: 9.5px; }
.sv-state, .sv-run-state { display: inline-flex; align-items: center; width: max-content; min-height: 21px; padding: 3px 7px; border-radius: 999px; background: var(--rr-panel-muted); color: var(--rr-muted); font-size: 8.5px; font-weight: 720; letter-spacing: .045em; text-transform: uppercase; }
.sv-state::before, .sv-run-state::before { content: ""; width: 5px; height: 5px; margin-right: 5px; border-radius: 50%; background: currentColor; }
.sv-state--complete, .sv-state--completed, .sv-state--ready, .sv-run-state--complete { color: #4c8463; background: color-mix(in srgb, #62a77f 12%, var(--rr-panel-solid)); }
.sv-state--running, .sv-state--queued, .sv-run-state--running { color: #577ca7; background: color-mix(in srgb, #6696ca 13%, var(--rr-panel-solid)); }
.sv-state--failed, .sv-state--blocked, .sv-run-state--failed { color: #a44f51; background: color-mix(in srgb, #cf6769 12%, var(--rr-panel-solid)); }
.sv-state--cancelled, .sv-run-state--cancelled { color: #82766d; }
.sv-quiet-button { min-height: 29px; padding: 0 9px; border: 1px solid var(--rr-line); border-radius: 8px; background: var(--rr-panel-solid); color: var(--rr-muted); cursor: pointer; font-size: 9px; font-weight: 650; }
.sv-quiet-button:hover { border-color: color-mix(in srgb, var(--sv-accent) 35%, var(--rr-line)); color: var(--rr-ink); }
.sv-tabs { display: flex; min-width: 0; padding: 5px 9px 0; overflow-x: auto; border-bottom: 1px solid var(--rr-line); background: color-mix(in srgb, var(--rr-panel-muted) 46%, var(--rr-panel-solid)); scrollbar-width: thin; }
.sv-tab { position: relative; flex: 0 0 auto; min-height: 32px; padding: 0 10px; border: 0; background: transparent; color: var(--rr-muted); cursor: pointer; font-size: 9.5px; font-weight: 650; }
.sv-tab[aria-selected="true"] { color: var(--rr-ink); }
.sv-tab[aria-selected="true"]::after { content: ""; position: absolute; right: 8px; bottom: -1px; left: 8px; height: 2px; border-radius: 2px 2px 0 0; background: var(--sv-accent); }
.sv-panel { min-height: 142px; padding: 10px; }
.sv-toolbar { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-bottom: 1px solid var(--rr-line); background: var(--rr-panel-solid); }
.sv-toolbar label { min-width: 0; flex: 1; }
.sv-toolbar input { width: 100%; height: 30px; padding: 0 10px; border: 1px solid var(--rr-line); border-radius: 8px; background: var(--rr-panel-muted); font-size: 9.5px; }
.sv-toolbar > span { color: var(--rr-muted); font-size: 9px; white-space: nowrap; }
.sv-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 6px; width: 100%; margin: 0; }
.sv-facts > div { min-width: 0; padding: 8px; border: 1px solid var(--rr-line); border-radius: 9px; background: color-mix(in srgb, var(--rr-panel-muted) 58%, transparent); }
.sv-facts dt { overflow: hidden; color: var(--rr-muted); font-size: 8px; font-weight: 650; letter-spacing: .045em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.sv-facts dd { margin: 4px 0 0; overflow: hidden; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10.5px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.sv-empty { display: grid; min-height: 86px; place-items: center; padding: 18px; border: 1px dashed var(--rr-line); border-radius: 10px; color: var(--rr-muted); text-align: center; font-size: 9.5px; line-height: 1.5; }
.sv-loading { display: flex; align-items: center; gap: 12px; min-height: 104px; padding: 17px; }
.sv-loading > i { width: 25px; height: 25px; border: 3px solid color-mix(in srgb, var(--sv-accent) 20%, transparent); border-top-color: var(--sv-accent); border-radius: 50%; animation: sv-spin 1s linear infinite; }
.sv-loading strong, .sv-loading span { display: block; }
.sv-loading strong { font-size: 11px; }
.sv-loading span { margin-top: 3px; color: var(--rr-muted); font-size: 9.5px; }
.sv-error { margin: 10px; padding: 12px; border: 1px solid color-mix(in srgb, #bc5659 28%, var(--rr-line)); border-radius: 10px; background: color-mix(in srgb, #bc5659 8%, var(--rr-panel-solid)); }
.sv-error strong { color: #a44f51; font-size: 9.5px; letter-spacing: .04em; text-transform: uppercase; }
.sv-error p { margin: 5px 0 0; color: var(--rr-ink); font-size: 10px; line-height: 1.5; }
.sv-data-note { margin: 8px 2px 0; color: var(--rr-muted); font-size: 8.5px; line-height: 1.45; }
.sv-artifacts { padding: 0 10px 10px; }
.sv-artifacts h4 { margin: 0 0 6px; color: var(--rr-muted); font-size: 8px; letter-spacing: .05em; text-transform: uppercase; }
.sv-artifacts > div { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 1px; }
.sv-artifacts button { display: grid; flex: 0 0 min(210px, 70vw); grid-template-columns: auto minmax(0, 1fr); gap: 7px; align-items: center; min-height: 31px; padding: 5px 8px; border: 1px solid var(--rr-line); border-radius: 8px; background: var(--rr-panel-solid); cursor: pointer; text-align: left; }
.sv-artifacts button span { color: var(--sv-accent); font-size: 8px; font-weight: 720; text-transform: uppercase; }
.sv-artifacts button code { overflow: hidden; font-size: 8.5px; text-overflow: ellipsis; white-space: nowrap; }

.sv-sequence-table-wrap { overflow-x: auto; }
.sv-sequence-table { width: 100%; border-collapse: collapse; font-size: 9px; }
.sv-sequence-table th, .sv-sequence-table td { padding: 7px 8px; border-bottom: 1px solid var(--rr-line); text-align: left; white-space: nowrap; }
.sv-sequence-table thead th { color: var(--rr-muted); font-size: 7.5px; font-weight: 650; letter-spacing: .045em; text-transform: uppercase; }
.sv-sequence-table tbody th strong, .sv-sequence-table tbody th small { display: block; max-width: 130px; overflow: hidden; text-overflow: ellipsis; }
.sv-sequence-table tbody th small { margin-top: 2px; color: var(--rr-muted); font-weight: 400; }
.sv-residues { color: var(--sv-accent); font-size: 8.5px; letter-spacing: .08em; }
.sv-length-bar { display: block; width: 116px; height: 12px; padding: 3px; border-radius: 999px; background: var(--rr-panel-muted); }
.sv-length-bar i { display: block; width: var(--sv-length); height: 100%; border-radius: 999px; background: linear-gradient(90deg, color-mix(in srgb, var(--sv-accent) 68%, white), var(--sv-accent)); }
.sv-metric-track { display: flex; align-items: end; gap: 2px; height: 82px; margin-top: 9px; padding: 7px; overflow: hidden; border: 1px solid var(--rr-line); border-radius: 9px; background: repeating-linear-gradient(to top, transparent 0 19px, var(--rr-line) 20px); }
.sv-metric-track i { flex: 1 1 3px; min-width: 2px; max-width: 7px; border-radius: 2px 2px 0 0; background: var(--sv-accent); opacity: .78; }

.sv-ngs-panel { background: color-mix(in srgb, var(--sv-accent) 2.5%, var(--rr-panel-solid)); }
.sv-section-label { margin: 0 0 7px; color: var(--rr-muted); font-size: 8px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.sv-run-layout { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(150px, .7fr); gap: 10px; }
.sv-run-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; border: 1px solid var(--rr-line); border-radius: 9px; background: var(--rr-panel-solid); }
.sv-run-card div { min-width: 0; }
.sv-run-card strong, .sv-run-card code { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-run-card strong { font-size: 10px; }
.sv-run-card code { margin-top: 3px; color: var(--rr-muted); font-size: 8px; }
.sv-timeline { display: grid; gap: 7px; margin: 0; padding: 2px 0; list-style: none; }
.sv-timeline li { display: grid; grid-template-columns: 9px minmax(0, 1fr); gap: 7px; }
.sv-timeline li > i { position: relative; width: 7px; height: 7px; margin-top: 3px; border: 2px solid var(--sv-accent); border-radius: 50%; }
.sv-timeline li > i::after { content: ""; position: absolute; top: 6px; left: 1px; width: 1px; height: 19px; background: var(--rr-line); }
.sv-timeline li:last-child > i::after { display: none; }
.sv-timeline strong, .sv-timeline span { display: block; }
.sv-timeline strong { font-size: 8.5px; }
.sv-timeline span { margin-top: 2px; color: var(--rr-muted); font-size: 7.8px; line-height: 1.35; }
.sv-diagnostics { margin: 8px 0 0; padding: 0; list-style: none; }
.sv-diagnostics li { position: relative; padding: 5px 7px 5px 17px; color: var(--rr-muted); font-size: 9px; line-height: 1.4; }
.sv-diagnostics li::before { content: "!"; position: absolute; left: 4px; color: #a6743c; font-weight: 800; }
.sv-pipeline-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 7px; }
.sv-pipeline-grid article { min-width: 0; padding: 10px; border: 1px solid var(--rr-line); border-radius: 9px; background: var(--rr-panel-solid); }
.sv-pipeline-grid article > span { color: var(--sv-accent); font-size: 7.5px; font-weight: 750; text-transform: uppercase; }
.sv-pipeline-grid strong { display: block; margin-top: 4px; font-size: 10px; }
.sv-pipeline-grid p { display: -webkit-box; margin: 4px 0; overflow: hidden; color: var(--rr-muted); font-size: 8.5px; line-height: 1.38; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.sv-pipeline-grid small { color: var(--rr-faint); font-size: 7.5px; }
.sv-target-list { display: grid; gap: 6px; }
.sv-target-list article { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid var(--rr-line); border-radius: 8px; }
.sv-target-list article > i { width: 7px; height: 7px; border-radius: 50%; background: #62a77f; box-shadow: 0 0 0 3px color-mix(in srgb, #62a77f 12%, transparent); }
.sv-target-list strong, .sv-target-list span { display: block; }
.sv-target-list strong { font-size: 9.5px; }
.sv-target-list span { margin-top: 2px; color: var(--rr-muted); font-size: 8px; }

.sv-structure-layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(130px, .6fr); gap: 8px; }
.sv-scene { position: relative; min-height: 180px; overflow: hidden; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; background: radial-gradient(circle at 52% 42%, #26353b 0, #11191d 52%, #090d10 100%); color: #e8f0ed; }
.sv-scene::before { content: ""; position: absolute; inset: 0; opacity: .12; background-image: linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px); background-size: 24px 24px; transform: perspective(180px) rotateX(58deg) scale(1.7); transform-origin: center bottom; }
.sv-scene-toolbar { position: absolute; z-index: 3; top: 7px; left: 7px; display: flex; flex-wrap: wrap; gap: 4px; max-width: calc(100% - 14px); }
.sv-scene-toolbar span, .sv-scene-toolbar button, .sv-colour-toggle button { min-height: 20px; padding: 3px 6px; border: 1px solid rgba(255,255,255,.11); border-radius: 999px; background: rgba(5,9,11,.54); color: rgba(255,255,255,.7); cursor: pointer; font-size: 7px; text-transform: uppercase; }
.sv-scene-toolbar button:hover, .sv-colour-toggle button:hover, .sv-colour-toggle button[aria-pressed="true"] { border-color: rgba(208,231,225,.58); background: rgba(55,92,87,.74); color: white; }
.sv-colour-toggle { position: absolute; z-index: 3; top: 7px; right: 7px; display: flex; gap: 3px; }
.sv-colour-toggle button { text-transform: capitalize; }
.sv-scene svg { position: relative; z-index: 1; width: 100%; height: 180px; cursor: grab; touch-action: none; }
.sv-scene svg:active { cursor: grabbing; }
.sv-scene--canvas::before { display: none; }
.sv-structure-canvas { position: relative; z-index: 1; display: block; width: 100%; height: 180px; background: color-mix(in srgb, var(--rr-panel-muted) 72%, transparent); color: var(--rr-muted); cursor: grab; touch-action: none; }
.sv-structure-canvas:active { cursor: grabbing; }
.sv-atom { cursor: pointer; opacity: .92; stroke: rgba(11,18,22,.35); stroke-width: .65px; vector-effect: non-scaling-stroke; }
.sv-atom:hover, .sv-atom--selected { stroke: white; stroke-width: 1.5px; opacity: 1; }
.sv-scene-state { position: absolute; z-index: 2; right: 7px; bottom: 7px; max-width: calc(100% - 14px); overflow: hidden; padding: 3px 6px; border-radius: 6px; background: rgba(5,9,11,.65); color: rgba(255,255,255,.74); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }
.sv-scene-summary { position: absolute; z-index: 1; inset: 0; display: grid; place-items: center; padding: 28px; text-align: center; }
.sv-scene-summary div { max-width: 260px; }
.sv-scene-summary strong { font-size: 10px; }
.sv-scene-summary p { margin: 5px 0 0; color: rgba(232,240,237,.62); font-size: 8px; line-height: 1.45; }
.sv-axis { position: absolute; bottom: 12px; left: 17px; color: rgba(255,255,255,.55); font-family: ui-monospace, monospace; font-size: 7px; }
.sv-axis::after { content: ""; position: absolute; bottom: 3px; left: 10px; width: 26px; height: 1px; background: currentColor; transform-origin: left; }
.sv-axis--y { bottom: 37px; }.sv-axis--y::after { transform: rotate(-90deg); }
.sv-axis--z { bottom: 28px; left: 31px; }.sv-axis--z::after { transform: rotate(-38deg); }
.sv-object-list, .sv-analysis-list { display: grid; gap: 6px; }
.sv-object-list article { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 8px; border: 1px solid var(--rr-line); border-radius: 8px; }
.sv-object-list article > i { width: 8px; height: 23px; border-radius: 4px; }
.sv-object-list strong, .sv-object-list span { display: block; }
.sv-object-list strong { font-size: 9.5px; }.sv-object-list span, .sv-object-list small { color: var(--rr-muted); font-size: 8px; }
.sv-analysis-list { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.sv-analysis-list article { padding: 9px; border: 1px solid var(--rr-line); border-radius: 9px; }
.sv-analysis-list article > strong { display: block; margin-bottom: 6px; font-size: 9.5px; }

.sv-slide-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(135px, .5fr); gap: 8px; }
.sv-slide-map { position: relative; display: grid; min-height: 188px; place-items: center; overflow: hidden; border: 1px solid var(--rr-line); border-radius: 10px; background: #f1e7e9; }
.sv-slide-map svg { width: calc(100% - 18px); height: 160px; cursor: grab; filter: saturate(.72); touch-action: none; }
.sv-slide-map svg:active { cursor: grabbing; }
.sv-slide-canvas { display: block; width: calc(100% - 18px); height: 160px; border-radius: 7px; cursor: crosshair; touch-action: none; }
.sv-slide-controls { position: absolute; z-index: 2; top: 7px; left: 7px; display: flex; gap: 3px; }
.sv-slide-controls button { min-height: 21px; padding: 2px 6px; border: 1px solid rgba(50,36,42,.24); border-radius: 6px; background: rgba(255,255,255,.84); color: #5e4150; cursor: pointer; font-size: 8px; font-weight: 700; }
.sv-slide-controls button:hover { border-color: color-mix(in srgb, var(--sv-accent) 55%, transparent); color: var(--sv-accent); }
.sv-slide-map > span { position: absolute; right: 7px; bottom: 7px; padding: 3px 6px; border-radius: 6px; background: rgba(35,31,33,.72); color: white; font-size: 7px; }
.sv-slide-position { position: absolute; bottom: 7px; left: 7px; padding: 3px 6px; border-radius: 6px; background: rgba(35,31,33,.72); color: white; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 7px; }
.sv-view-bounds { stroke: #4f8fab; stroke-width: max(2px, .3%); vector-effect: non-scaling-stroke; }
.sv-region { stroke: #f2c94c; stroke-width: max(2px, .3%); vector-effect: non-scaling-stroke; }
.sv-spatial-layout { display: grid; grid-template-columns: repeat(2, minmax(100px, .55fr)) minmax(180px, 1fr); gap: 7px; }
.sv-spatial-layout > section { display: flex; min-height: 92px; flex-direction: column; justify-content: center; padding: 10px; border: 1px solid var(--rr-line); border-radius: 9px; background: color-mix(in srgb, var(--sv-accent) 6%, var(--rr-panel-solid)); }
.sv-spatial-layout > section > strong { font-family: Georgia, "Times New Roman", serif; font-size: 25px; font-weight: 500; }
.sv-spatial-layout > section > small { color: var(--rr-muted); font-size: 8px; text-transform: uppercase; }
.sv-spatial-gene { margin-bottom: 4px; color: var(--sv-accent); font-size: 8px; font-weight: 750; text-transform: uppercase; }
.sv-layer-list { display: grid; gap: 6px; }
.sv-layer-list label { display: grid; grid-template-columns: auto 4px minmax(0, 1fr); gap: 8px; align-items: center; padding: 8px; border: 1px solid var(--rr-line); border-radius: 8px; cursor: pointer; }
.sv-layer-list label:has(input:disabled) { cursor: default; }
.sv-layer-list input:disabled { opacity: .72; }
.sv-layer-list label > i { width: 4px; height: 26px; border-radius: 3px; background: var(--sv-accent); }
.sv-layer-list strong, .sv-layer-list small { display: block; }
.sv-layer-list strong { font-size: 9.5px; }.sv-layer-list small { margin-top: 2px; color: var(--rr-muted); font-size: 8px; }
.sv-layer-note { margin: 0 0 7px; padding: 7px 8px; border: 1px solid var(--rr-line); border-radius: 8px; color: var(--rr-muted); font-size: 8px; line-height: 1.45; }

@keyframes sv-spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .sv-head { grid-template-columns: 32px minmax(0, 1fr) auto; }
  .sv-quiet-button { grid-column: 2 / -1; justify-self: start; }
  .sv-run-layout, .sv-structure-layout, .sv-slide-layout { grid-template-columns: 1fr; }
  .sv-spatial-layout { grid-template-columns: repeat(2, 1fr); }
  .sv-spatial-layout > section:last-child { grid-column: 1 / -1; }
  .sv-scene, .sv-scene svg, .sv-structure-canvas { min-height: 160px; height: 160px; }
}
@media (prefers-reduced-motion: reduce) { .sv-loading > i { animation: none; } }
:root[data-theme="dark"] .sv-root--slide, :root[style*="color-scheme: dark"] .sv-root--slide, [data-theme="dark"] .sv-root--slide { --sv-slide-tissue: #5c3f4c; --sv-slide-nucleus: #b7799f; }
:root[data-theme="dark"] .sv-slide-map, :root[style*="color-scheme: dark"] .sv-slide-map, [data-theme="dark"] .sv-slide-map { background: #2d2529; }
`;
