export const WORKBENCH_CSS = String.raw`
:root {
  --rr-bg: #f5f3ee;
  --rr-panel: rgba(255, 255, 255, .82);
  --rr-panel-solid: #fffefa;
  --rr-panel-muted: #efede7;
  --rr-ink: #242b29;
  --rr-muted: #68716d;
  --rr-faint: #929995;
  --rr-line: rgba(46, 60, 54, .12);
  --rr-accent: #537d70;
  --rr-accent-ink: #2d584b;
  --rr-accent-soft: #dfe9e4;
  --rr-shadow: 0 22px 60px rgba(32, 45, 39, .13), 0 3px 14px rgba(32, 45, 39, .06);
  --rr-radius: 18px;
}

:root[data-theme="dark"], :root[style*="color-scheme: dark"], [data-theme="dark"] {
  --rr-bg: #171c1a;
  --rr-panel: rgba(31, 38, 35, .88);
  --rr-panel-solid: #202724;
  --rr-panel-muted: #29312e;
  --rr-ink: #edf1ef;
  --rr-muted: #aab3af;
  --rr-faint: #7f8a85;
  --rr-line: rgba(222, 235, 228, .12);
  --rr-accent: #8eb5a7;
  --rr-accent-ink: #b9d8cd;
  --rr-accent-soft: #2a423a;
  --rr-shadow: 0 22px 70px rgba(0, 0, 0, .38), 0 3px 14px rgba(0, 0, 0, .2);
}

.rr-root, .rr-overlay, .rr-tool-card, .rr-settings { box-sizing: border-box; color: var(--rr-ink); font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.rr-root *, .rr-overlay *, .rr-tool-card *, .rr-settings * { box-sizing: border-box; }
.sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
.rr-root button, .rr-root input, .rr-root select, .rr-overlay button, .rr-settings button { font: inherit; }
.rr-root button, .rr-overlay button { color: inherit; }
.rr-root { width: min(1100px, calc(100vw - 52px)); margin: 0 auto; padding: 18px 0 48px; }
.rr-root--hero { width: 100%; max-height: min(560px, calc(100vh - 320px)); min-height: 360px; padding: 18px 14px 34px; overflow-x: hidden; overflow-y: auto; scrollbar-gutter: stable; border: 1px solid var(--rr-line); border-radius: 18px; background: var(--rr-panel); }
.rr-root--session { width: 100%; max-width: 1220px; padding: 28px 30px 90px; }
.rr-hero-head { text-align: center; max-width: 680px; margin: 0 auto 25px; }
.rr-kicker { display: inline-flex; align-items: center; gap: 7px; padding: 5px 10px; border: 1px solid var(--rr-line); border-radius: 999px; background: var(--rr-panel); color: var(--rr-muted); font-size: 11px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
.rr-kicker-dot { width: 6px; height: 6px; border-radius: 50%; background: #6f9b8c; box-shadow: 0 0 0 3px rgba(111, 155, 140, .13); }
.rr-title { margin: 13px 0 8px; font-family: Georgia, "Times New Roman", serif; font-weight: 500; font-size: clamp(27px, 3vw, 42px); letter-spacing: -.035em; line-height: 1.03; }
.rr-subtitle { margin: 0 auto; max-width: 590px; color: var(--rr-muted); font-size: 14px; line-height: 1.55; }
.rr-toolbar { display: grid; grid-template-columns: minmax(230px, 1fr) auto auto; gap: 10px; align-items: center; margin: 0 0 17px; }
.rr-search { min-width: 0; position: relative; }
.rr-search svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--rr-faint); pointer-events: none; }
.rr-search input, .rr-select { width: 100%; height: 42px; border: 1px solid var(--rr-line); border-radius: 12px; background: var(--rr-panel); color: var(--rr-ink); outline: none; transition: border-color .15s, box-shadow .15s; }
.rr-search input { padding: 0 14px 0 40px; }
.rr-select { min-width: 150px; padding: 0 31px 0 12px; }
.rr-search input:focus, .rr-select:focus { border-color: rgba(83,125,112,.55); box-shadow: 0 0 0 3px rgba(83,125,112,.12); }
.rr-count { display: flex; align-items: center; gap: 8px; color: var(--rr-muted); white-space: nowrap; font-size: 12px; }
.rr-count strong { color: var(--rr-ink); font-size: 13px; }
.rr-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.rr-card { position: relative; display: grid; grid-template-columns: 48px minmax(0,1fr) auto; gap: 13px; align-items: center; height: 105px; min-height: 105px; padding: 15px 15px 15px 16px; border: 1px solid var(--rr-line); border-radius: 16px; background: var(--rr-panel); text-align: left; cursor: pointer; overflow: hidden; transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease, background .16s ease; }
.rr-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--category-color); opacity: .7; }
.rr-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--category-color) 48%, var(--rr-line)); box-shadow: 0 12px 32px rgba(38,50,45,.09); background: var(--rr-panel-solid); }
.rr-card:focus-visible { outline: 3px solid rgba(83,125,112,.28); outline-offset: 2px; }
.rr-card-icon { display: grid; place-items: center; width: 45px; height: 45px; border-radius: 13px; color: var(--category-color); background: color-mix(in srgb, var(--category-color) 12%, transparent); }
.rr-card-body { min-width: 0; }
.rr-card-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; color: var(--rr-muted); font-size: 10px; font-weight: 650; letter-spacing: .055em; text-transform: uppercase; }
.rr-ready-dot { width: 5px; height: 5px; border-radius: 50%; background: #6ca083; }
.rr-card-title { margin: 0 0 5px; color: var(--rr-ink); font-size: 14px; font-weight: 680; line-height: 1.25; letter-spacing: -.01em; }
.rr-card-summary { display: -webkit-box; margin: 0; overflow: hidden; color: var(--rr-muted); font-size: 11.5px; line-height: 1.42; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.rr-card-arrow { color: var(--rr-faint); transition: transform .16s, color .16s; }
.rr-card:hover .rr-card-arrow { color: var(--category-color); transform: translateX(2px); }
.rr-empty { grid-column: 1 / -1; padding: 54px 20px; border: 1px dashed var(--rr-line); border-radius: 16px; color: var(--rr-muted); text-align: center; }
.rr-workspace-row { display: flex; justify-content: center; align-items: center; gap: 9px; margin: 17px auto 0; color: var(--rr-muted); font-size: 12px; }
.rr-workspace-row .rr-select { width: min(360px, 60vw); }
.rr-source-note { display: flex; justify-content: space-between; gap: 20px; margin-top: 15px; color: var(--rr-faint); font-size: 10.5px; }
.rr-source-note code { font-size: 10px; }

.rr-brand-mark { display: grid; place-items: center; color: var(--rr-ink); filter: drop-shadow(0 7px 13px rgba(43,70,60,.12)); }
.rr-overlay-backdrop { position: fixed; z-index: 1200; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(20,27,24,.42); backdrop-filter: blur(5px); animation: rr-fade .14s ease-out; pointer-events: auto; }
.rr-overlay-panel { width: min(920px, 100%); max-height: min(790px, calc(100vh - 48px)); display: grid; grid-template-rows: auto auto 1fr auto; overflow: hidden; border: 1px solid var(--rr-line); border-radius: 22px; background: var(--rr-panel-solid); box-shadow: var(--rr-shadow); animation: rr-rise .18s ease-out; }
.rr-detail-head { display: grid; grid-template-columns: 154px minmax(0,1fr) auto; gap: 20px; padding: 21px 22px 16px; border-bottom: 1px solid var(--rr-line); }
.rr-preview { width: 154px; height: 104px; object-fit: cover; border: 1px solid var(--rr-line); border-radius: 12px; background: var(--rr-panel-muted); }
.rr-preview-fallback { display: grid; place-items: center; width: 154px; height: 104px; border-radius: 12px; color: var(--category-color); background: color-mix(in srgb, var(--category-color) 11%, var(--rr-panel-muted)); }
.rr-detail-category { display: flex; align-items: center; gap: 7px; color: var(--category-color); font-size: 11px; font-weight: 700; letter-spacing: .055em; text-transform: uppercase; }
.rr-detail-title { margin: 7px 0 6px; font-family: Georgia, "Times New Roman", serif; font-size: 25px; font-weight: 500; letter-spacing: -.025em; line-height: 1.08; }
.rr-detail-summary { margin: 0; color: var(--rr-muted); font-size: 12.5px; line-height: 1.48; }
.rr-close { display: grid; place-items: center; width: 35px; height: 35px; border: 0; border-radius: 10px; background: transparent; color: var(--rr-muted); cursor: pointer; }
.rr-close:hover { background: var(--rr-panel-muted); color: var(--rr-ink); }
.rr-tabs { display: flex; gap: 3px; padding: 9px 22px 0; border-bottom: 1px solid var(--rr-line); }
.rr-tab { position: relative; padding: 9px 12px 11px; border: 0; background: transparent; color: var(--rr-muted); cursor: pointer; font-size: 12px; font-weight: 600; }
.rr-tab[aria-selected="true"] { color: var(--rr-ink); }
.rr-tab[aria-selected="true"]::after { content: ""; position: absolute; left: 9px; right: 9px; bottom: -1px; height: 2px; border-radius: 2px 2px 0 0; background: var(--category-color); }
.rr-detail-body { overflow: auto; padding: 20px 22px 24px; }
.rr-section-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 13px; }
.rr-info-block { min-width: 0; padding: 14px; border: 1px solid var(--rr-line); border-radius: 13px; background: color-mix(in srgb, var(--rr-panel-muted) 66%, transparent); }
.rr-info-block--wide { grid-column: 1 / -1; }
.rr-info-title { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; color: var(--rr-muted); font-size: 10px; font-weight: 720; letter-spacing: .07em; text-transform: uppercase; }
.rr-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.rr-list li { position: relative; padding-left: 13px; color: var(--rr-ink); font-size: 12px; line-height: 1.46; }
.rr-list li::before { content: ""; position: absolute; top: .57em; left: 0; width: 5px; height: 5px; border-radius: 50%; background: var(--category-color); opacity: .72; }
.rr-question { margin: 0; color: var(--rr-ink); font-family: Georgia, "Times New Roman", serif; font-size: 17px; line-height: 1.45; }
.rr-artifacts { display: grid; gap: 7px; }
.rr-artifact { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 9px; align-items: center; padding: 8px 9px; border-radius: 9px; background: var(--rr-panel-solid); }
.rr-artifact-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10.5px; }
.rr-artifact-role { color: var(--rr-faint); font-size: 9px; text-transform: uppercase; }
.rr-recipe { display: grid; gap: 12px; }
.rr-recipe-head { display: flex; flex-wrap: wrap; gap: 7px; }
.rr-chip { display: inline-flex; align-items: center; min-height: 25px; padding: 4px 8px; border-radius: 999px; background: var(--rr-accent-soft); color: var(--rr-accent-ink); font-size: 10.5px; font-weight: 650; }
.rr-mode-picker { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; padding: 5px; border-radius: 13px; background: var(--rr-panel-muted); }
.rr-mode { display: grid; gap: 2px; padding: 9px; border: 1px solid transparent; border-radius: 10px; background: transparent; cursor: pointer; text-align: left; }
.rr-mode strong { font-size: 11px; }
.rr-mode span { color: var(--rr-muted); font-size: 9.5px; }
.rr-mode[aria-pressed="true"] { border-color: var(--rr-line); background: var(--rr-panel-solid); box-shadow: 0 2px 7px rgba(40,55,49,.07); }
.rr-detail-foot { display: flex; justify-content: space-between; align-items: center; gap: 16px; min-height: 69px; padding: 12px 22px; border-top: 1px solid var(--rr-line); background: color-mix(in srgb, var(--rr-panel-muted) 55%, var(--rr-panel-solid)); }
.rr-notice { color: var(--rr-accent-ink); font-size: 11.5px; }
.rr-actions { display: flex; gap: 8px; margin-left: auto; }
.rr-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 0 14px; border: 1px solid var(--rr-line); border-radius: 10px; background: var(--rr-panel-solid); cursor: pointer; font-size: 11.5px; font-weight: 650; }
.rr-button:hover { border-color: rgba(83,125,112,.38); }
.rr-overlay .rr-button--primary { border-color: var(--rr-accent); background: var(--rr-accent); color: #fff; }
.rr-button--primary:hover { background: #466e62; }

.rr-settings { padding: 25px; }
.rr-settings h2 { margin: 0 0 8px; font-family: Georgia, "Times New Roman", serif; font-size: 25px; font-weight: 500; }
.rr-settings > p { margin: 0 0 22px; max-width: 680px; color: var(--rr-muted); font-size: 12.5px; line-height: 1.55; }
.rr-provider-groups { display: grid; gap: 14px; }
.rr-provider-group { padding: 16px; border: 1px solid var(--rr-line); border-radius: 14px; background: var(--rr-panel); }
.rr-provider-group h3 { margin: 0 0 4px; font-size: 13px; }
.rr-provider-group p { margin: 0 0 11px; color: var(--rr-muted); font-size: 11px; }
.rr-provider-list { display: flex; flex-wrap: wrap; gap: 7px; }
.rr-provider { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid var(--rr-line); border-radius: 999px; background: var(--rr-panel-solid); font-size: 10.5px; }
.rr-provider::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #8fa29a; }
.rr-settings-note { margin-top: 16px; padding: 12px 14px; border-left: 3px solid var(--rr-accent); background: var(--rr-accent-soft); color: var(--rr-accent-ink); font-size: 11.5px; line-height: 1.5; }

.rr-tool-card { display: grid; gap: 7px; width: 100%; padding: 11px 12px; border: 1px solid var(--rr-line); border-radius: 12px; background: var(--rr-panel); }
.rr-tool-head { display: flex; align-items: center; gap: 8px; }
.rr-tool-mark { display: grid; place-items: center; width: 25px; height: 25px; border-radius: 8px; background: var(--rr-accent-soft); color: var(--rr-accent-ink); }
.rr-tool-name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 680; }
.rr-tool-state { color: var(--rr-muted); font-size: 9.5px; text-transform: uppercase; }
.rr-tool-summary { margin: 0; overflow: hidden; color: var(--rr-muted); font-size: 10.5px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }

@keyframes rr-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes rr-rise { from { opacity: 0; transform: translateY(9px) scale(.985) } to { opacity: 1; transform: translateY(0) scale(1) } }
@media (max-width: 840px) {
  .rr-root { width: min(680px, calc(100vw - 28px)); }
  .rr-root--hero { width: 100%; min-height: 320px; max-height: min(520px, calc(100vh - 300px)); padding-inline: 10px; }
  .rr-grid { grid-template-columns: 1fr; }
  .rr-toolbar { grid-template-columns: 1fr 1fr; }
  .rr-search { grid-column: 1 / -1; }
  .rr-count { justify-self: end; }
  .rr-detail-head { grid-template-columns: 100px minmax(0,1fr) auto; gap: 13px; }
  .rr-preview, .rr-preview-fallback { width: 100px; height: 78px; }
}
@media (max-width: 560px) {
  .rr-root--session { padding: 20px 13px 75px; }
  .rr-toolbar { grid-template-columns: 1fr; }
  .rr-search { grid-column: auto; }
  .rr-count { justify-self: start; }
  .rr-source-note { display: block; }
  .rr-source-note span { display: block; margin-top: 4px; }
  .rr-overlay-backdrop { padding: 0; align-items: end; }
  .rr-overlay-panel { max-height: 94vh; border-radius: 20px 20px 0 0; }
  .rr-detail-head { grid-template-columns: minmax(0,1fr) auto; }
  .rr-preview, .rr-preview-fallback { display: none; }
  .rr-section-grid { grid-template-columns: 1fr; }
  .rr-info-block--wide { grid-column: auto; }
  .rr-detail-foot { align-items: flex-start; flex-direction: column; }
  .rr-actions { width: 100%; margin: 0; }
  .rr-actions .rr-button { flex: 1; }
  .rr-mode-picker { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .rr-card, .rr-card-arrow, .rr-overlay-backdrop, .rr-overlay-panel { animation: none; transition: none; } }
`;
