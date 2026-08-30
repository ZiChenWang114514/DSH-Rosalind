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

.rr-root, .rr-portal, .rr-detail-panel, .rr-tool-card, .rr-settings { box-sizing: border-box; color: var(--rr-ink); font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.rr-root *, .rr-portal *, .rr-detail-panel *, .rr-tool-card *, .rr-settings * { box-sizing: border-box; }
.sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
.rr-root button, .rr-root input, .rr-root select, .rr-portal button, .rr-detail-panel button, .rr-settings button { font: inherit; }
.rr-root button, .rr-portal button, .rr-detail-panel button { color: inherit; }
.rr-portal { container-type: inline-size; position: relative; width: 100%; min-height: 520px; max-height: min(650px, calc(100vh - 270px)); padding: 22px 25px 19px; overflow: hidden; isolation: isolate; border: 1px solid var(--rr-line); border-radius: 24px; background: linear-gradient(145deg, color-mix(in srgb, var(--rr-panel-solid) 92%, #dfece6), color-mix(in srgb, var(--rr-panel-solid) 88%, #e6ddd0)); box-shadow: 0 28px 75px rgba(28, 45, 38, .11); }
.rr-portal::before { content: ""; position: absolute; z-index: -1; width: 410px; height: 410px; right: -165px; top: -225px; border-radius: 50%; background: color-mix(in srgb, var(--rr-accent) 17%, transparent); filter: blur(4px); }
.rr-portal::after { content: ""; position: absolute; z-index: -1; width: 290px; height: 290px; left: -190px; bottom: -220px; border-radius: 50%; background: color-mix(in srgb, #b7805f 14%, transparent); }
.rr-portal-nav { display: flex; align-items: center; justify-content: space-between; min-height: 34px; }
.rr-portal-brand { display: inline-flex; align-items: center; gap: 9px; font-family: Georgia, "Times New Roman", serif; font-size: 19px; letter-spacing: -.02em; }
.rr-portal-brand svg { filter: drop-shadow(0 7px 13px rgba(43,70,60,.13)); }
.rr-portal-edition { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--rr-line); border-radius: 999px; background: color-mix(in srgb, var(--rr-panel-solid) 70%, transparent); color: var(--rr-muted); font-size: 9px; font-weight: 730; letter-spacing: .09em; text-transform: uppercase; }
.rr-portal-main { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(310px, .92fr); gap: clamp(28px, 5vw, 72px); align-items: center; min-height: 400px; padding: 25px 14px 18px; }
.rr-portal-copy { max-width: 590px; }
.rr-portal-eyebrow { display: block; margin-bottom: 14px; color: var(--rr-accent-ink); font-size: 10px; font-weight: 750; letter-spacing: .105em; text-transform: uppercase; }
.rr-portal-copy h1 { max-width: 570px; margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(36px, 4.6vw, 62px); font-weight: 500; letter-spacing: -.052em; line-height: .99; text-wrap: balance; }
.rr-portal-copy > p { max-width: 560px; margin: 18px 0 0; color: var(--rr-muted); font-size: 14px; line-height: 1.65; }
.rr-portal-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 23px; }
.rr-portal-primary, .rr-portal-secondary { min-height: 45px; border-radius: 12px; cursor: pointer; font-size: 11.5px; font-weight: 700; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
.rr-portal-primary { display: inline-flex; align-items: center; justify-content: center; gap: 13px; padding: 0 17px 0 19px; border: 1px solid #315f52; background: #315f52; color: #fff !important; box-shadow: 0 9px 23px rgba(36,79,66,.2); }
.rr-portal-primary svg { transition: transform .18s ease; }
.rr-portal-primary:hover { transform: translateY(-2px); background: #294f45; box-shadow: 0 13px 28px rgba(36,79,66,.25); }
.rr-portal-primary:hover svg { transform: translateX(3px); }
.rr-portal-secondary { padding: 0 16px; border: 1px solid var(--rr-line); background: color-mix(in srgb, var(--rr-panel-solid) 72%, transparent); color: var(--rr-ink); }
.rr-portal-secondary:hover { border-color: color-mix(in srgb, var(--rr-accent) 52%, var(--rr-line)); background: var(--rr-panel-solid); }
.rr-portal-primary:focus-visible, .rr-portal-secondary:focus-visible, .rr-workspace-back:focus-visible { outline: 3px solid color-mix(in srgb, var(--rr-accent) 34%, transparent); outline-offset: 3px; }
.rr-portal-metrics { display: flex; gap: 0; margin: 25px 0 0; }
.rr-portal-metrics div { display: flex; align-items: baseline; gap: 7px; min-width: 95px; padding-right: 20px; margin-right: 20px; border-right: 1px solid var(--rr-line); }
.rr-portal-metrics div:last-child { border: 0; margin: 0; padding: 0; }
.rr-portal-metrics dt { order: 2; color: var(--rr-muted); font-size: 9px; letter-spacing: .04em; text-transform: uppercase; }
.rr-portal-metrics dd { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 22px; }
.rr-portal-path { overflow: hidden; border: 1px solid var(--rr-line); border-radius: 19px; background: color-mix(in srgb, var(--rr-panel-solid) 82%, transparent); box-shadow: 0 21px 45px rgba(31,48,41,.09); transform: rotate(.7deg); }
.rr-portal-path-head { display: flex; justify-content: space-between; padding: 13px 15px; border-bottom: 1px solid var(--rr-line); color: var(--rr-faint); font-size: 8.5px; font-weight: 720; letter-spacing: .08em; text-transform: uppercase; }
.rr-portal-path ol { margin: 0; padding: 7px; list-style: none; }
.rr-portal-path li { display: grid; grid-template-columns: 29px minmax(0,1fr) auto; gap: 11px; align-items: center; min-height: 76px; padding: 10px; border-radius: 13px; }
.rr-portal-path li + li { border-top: 1px solid var(--rr-line); border-radius: 0; }
.rr-portal-path li > span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 9px; background: var(--rr-accent-soft); color: var(--rr-accent-ink); font: 700 9px/1 ui-monospace, monospace; }
.rr-portal-path strong, .rr-portal-path small { display: block; }
.rr-portal-path strong { margin-bottom: 4px; font-size: 11.5px; }
.rr-portal-path small { color: var(--rr-muted); font-size: 9.5px; line-height: 1.42; }
.rr-portal-path i { padding: 4px 7px; border-radius: 999px; background: var(--rr-panel-muted); color: var(--rr-faint); font-size: 8px; font-style: normal; white-space: nowrap; }
.rr-portal-path i.is-ready { background: var(--rr-accent-soft); color: var(--rr-accent-ink); }
.rr-portal-path-foot { display: flex; align-items: center; gap: 7px; padding: 11px 15px; border-top: 1px solid var(--rr-line); color: var(--rr-muted); font-size: 8.5px; }
.rr-portal-pulse { width: 6px; height: 6px; border-radius: 50%; background: #67a37c; box-shadow: 0 0 0 4px rgba(103,163,124,.12); }
.rr-portal-capabilities { display: flex; justify-content: center; gap: 7px; overflow: hidden; white-space: nowrap; }
.rr-portal-capabilities span { padding: 5px 9px; border: 1px solid var(--rr-line); border-radius: 999px; color: var(--rr-muted); font-size: 8.5px; }
.rr-root { container-type: inline-size; width: 100%; max-width: 1100px; min-width: 0; margin: 0 auto; padding: 18px 0 48px; overflow-wrap: anywhere; }
.rr-root--hero { container-type: inline-size; width: 100%; max-height: min(650px, calc(100vh - 270px)); min-height: 390px; padding: 15px 14px 30px; overflow-x: hidden; overflow-y: auto; scrollbar-gutter: stable; border: 1px solid var(--rr-line); border-radius: 22px; background: color-mix(in srgb, var(--rr-panel) 92%, transparent); }
.rr-root--session { width: 100%; max-width: 1220px; min-width: 0; padding: 24px clamp(12px, 4cqw, 30px) 90px; }
.rr-session-project { display: grid; gap: 12px; max-width: 820px; padding: 17px 18px; border: 1px solid var(--rr-line); border-radius: 16px; background: linear-gradient(130deg, color-mix(in srgb, var(--rr-accent-soft) 46%, var(--rr-panel-solid)), var(--rr-panel-solid)); }
.rr-session-project .rr-kicker { width: max-content; padding: 0; border: 0; background: transparent; font-size: 8.5px; }
.rr-session-project h2 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 22px; font-weight: 500; letter-spacing: -.02em; }
.rr-session-project > p { max-width: 630px; margin: 0; color: var(--rr-muted); font-size: 11.5px; line-height: 1.5; }
.rr-session-project__body { display: flex; align-items: end; justify-content: space-between; gap: 24px; }
.rr-session-project__facts { margin: 6px 0 0; color: var(--rr-muted); font-size: 10px; line-height: 1.45; }
.rr-session-project__next { display: grid; gap: 3px; max-width: 280px; margin: 0; color: var(--rr-muted); font-size: 10.5px; line-height: 1.45; }
.rr-session-project__next strong { color: var(--rr-accent-ink); font-size: 8.5px; letter-spacing: .07em; text-transform: uppercase; }
.rr-session-flow { display: grid; gap: 12px; margin-top: 5px; padding-top: 14px; border-top: 1px solid var(--rr-line); }
.rr-session-flow__modules { display: flex; flex-wrap: wrap; gap: 7px; color: var(--rr-muted); font-size: 9px; }
.rr-session-flow__modules span { padding: 4px 7px; border: 1px solid var(--rr-line); border-radius: 999px; background: var(--rr-panel-solid); }
.rr-session-flow__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.rr-session-flow__section { min-width: 0; padding: 10px; border: 1px solid var(--rr-line); border-radius: 11px; background: color-mix(in srgb, var(--rr-panel-solid) 88%, transparent); }
.rr-session-flow__section:last-child { grid-column: 1 / -1; }
.rr-session-flow__section h3 { margin: 0 0 7px; color: var(--rr-accent-ink); font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
.rr-session-flow__section ul { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.rr-session-flow__section li { display: grid; gap: 2px; min-width: 0; font-size: 9.5px; }
.rr-session-flow__section li strong { overflow: hidden; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
.rr-session-flow__section li span, .rr-session-flow__section p { margin: 0; color: var(--rr-muted); font-size: 9px; line-height: 1.4; }
.rr-launch { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 13px; align-items: center; margin: 0 0 16px; padding: 13px 15px; border: 1px solid var(--rr-line); border-radius: 15px; background: linear-gradient(130deg, color-mix(in srgb, var(--rr-accent-soft) 72%, var(--rr-panel-solid)), var(--rr-panel-solid)); }
.rr-launch-mark { display: grid; place-items: center; width: 43px; height: 43px; border-radius: 13px; color: var(--rr-accent-ink); background: color-mix(in srgb, var(--rr-accent-soft) 72%, transparent); }
.rr-launch .rr-kicker { padding: 0; border: 0; background: transparent; font-size: 8.5px; }
.rr-launch h1 { margin: 5px 0 3px; font-family: Georgia, "Times New Roman", serif; font-size: 23px; font-weight: 500; letter-spacing: -.025em; }
.rr-launch p { margin: 0; color: var(--rr-muted); font-size: 10.5px; line-height: 1.45; }
.rr-launch-count { padding: 6px 8px; border-radius: 999px; background: var(--rr-panel-solid); color: var(--rr-muted); font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.rr-hero-head { height: 136px; text-align: center; max-width: 680px; margin: 0 auto 25px; }
.rr-workspace-head { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 16px; align-items: center; min-height: 66px; margin-bottom: 10px; padding: 4px 3px 12px; border-bottom: 1px solid var(--rr-line); }
.rr-workspace-back { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 10px; border: 1px solid var(--rr-line); border-radius: 10px; background: var(--rr-panel-solid); color: var(--rr-muted) !important; cursor: pointer; font-size: 10px; font-weight: 650; }
.rr-workspace-back svg { transform: rotate(180deg); }
.rr-workspace-back:hover { color: var(--rr-ink) !important; border-color: color-mix(in srgb, var(--rr-accent) 45%, var(--rr-line)); }
.rr-workspace-title > span { display: block; margin-bottom: 2px; color: var(--rr-accent-ink); font-size: 8.5px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.rr-workspace-title h1 { margin: 0; outline: none; font-family: Georgia, "Times New Roman", serif; font-size: 22px; font-weight: 500; letter-spacing: -.025em; }
.rr-workspace-title p { margin: 2px 0 0; color: var(--rr-muted); font-size: 9.5px; }
.rr-workspace-status { display: inline-flex; align-items: center; gap: 7px; color: var(--rr-muted); font-size: 8.5px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase; }
.rr-workbench-nav { display: flex; width: max-content; margin: -8px auto 17px; padding: 4px; border: 1px solid var(--rr-line); border-radius: 999px; background: var(--rr-panel-muted); }
.rr-workbench-nav button { min-height: 30px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--rr-muted); cursor: pointer; font-size: 11px; font-weight: 650; }
.rr-workbench-nav button[aria-pressed="true"] { background: var(--rr-panel-solid); color: var(--rr-ink); box-shadow: 0 2px 8px rgba(34,49,42,.08); }
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

.rr-project { display: grid; gap: 17px; }
.rr-science-view { display: grid; gap: 14px; }
.rr-science-view__head { min-width: 0; padding: 4px 2px; }
.rr-science-view__head h1 { margin: 8px 0 4px; font-family: Georgia, "Times New Roman", serif; font-size: clamp(25px, 7cqw, 34px); font-weight: 500; letter-spacing: -.035em; }
.rr-science-view__head p { margin: 0; color: var(--rr-muted); font-size: 11.5px; line-height: 1.5; }
.rr-project__mast { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 19px 20px; border: 1px solid var(--rr-line); border-radius: 18px; background: linear-gradient(135deg, color-mix(in srgb, var(--rr-accent-soft) 55%, var(--rr-panel-solid)), var(--rr-panel-solid)); }
.rr-project__identity { display: flex; align-items: center; gap: 15px; min-width: 0; }
.rr-project__mast h1 { margin: 5px 0 4px; font-family: Georgia, "Times New Roman", serif; font-size: clamp(24px, 3vw, 34px); font-weight: 500; letter-spacing: -.035em; }
.rr-project__mast p { max-width: 680px; margin: 0; color: var(--rr-muted); font-size: 11.5px; line-height: 1.5; }
.rr-project .rr-button--primary { flex: none; border-color: var(--rr-accent); background: var(--rr-accent); color: #fff; }
.rr-project__grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(230px, .65fr); gap: 13px; }
.rr-project__primary, .rr-project__summary, .rr-project__modules { border: 1px solid var(--rr-line); border-radius: 17px; background: var(--rr-panel); }
.rr-project__primary { padding: 20px; }
.rr-project__label { display: block; color: var(--rr-accent-ink); font-size: 8.5px; font-weight: 760; letter-spacing: .09em; text-transform: uppercase; }
.rr-project__primary h2, .rr-project__section-head h2 { margin: 6px 0; font-family: Georgia, "Times New Roman", serif; font-size: 23px; font-weight: 500; letter-spacing: -.025em; }
.rr-project__primary > p, .rr-project__section-head > p { margin: 0; color: var(--rr-muted); font-size: 11px; line-height: 1.5; }
.rr-project__steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin: 18px 0 0; padding: 0; list-style: none; }
.rr-project__steps li { display: grid; gap: 9px; min-width: 0; padding: 11px; border: 1px solid var(--rr-line); border-radius: 11px; background: var(--rr-panel-solid); }
.rr-project__steps li > span { color: var(--rr-accent-ink); font: 700 9px/1 ui-monospace, monospace; }
.rr-project__steps strong, .rr-project__steps small { display: block; }
.rr-project__steps strong { font-size: 11px; }
.rr-project__steps small { margin-top: 4px; color: var(--rr-muted); font-size: 9px; line-height: 1.4; }
.rr-project__summary { display: grid; padding: 7px 15px; }
.rr-project__summary > div { display: grid; align-content: center; padding: 11px 0; border-bottom: 1px solid var(--rr-line); }
.rr-project__summary > div:last-child { border: 0; }
.rr-project__summary span, .rr-project__summary small { color: var(--rr-muted); font-size: 9px; }
.rr-project__summary strong { margin: 3px 0; font-size: 17px; }
.rr-project__modules { padding: 17px; }
.rr-project__section-head { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 13px; }
.rr-project__section-head > p { max-width: 390px; text-align: right; }
.rr-project__module-strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; }
.rr-project__module-strip button { display: grid; align-content: start; gap: 9px; min-width: 0; min-height: 102px; padding: 11px; border: 1px solid var(--rr-line); border-radius: 11px; background: var(--rr-panel-solid); color: var(--rr-ink); text-align: left; cursor: pointer; }
.rr-project__module-strip button:hover { border-color: color-mix(in srgb, var(--rr-accent) 46%, var(--rr-line)); background: var(--rr-panel-muted); }
.rr-project__module-strip strong, .rr-project__module-strip small { display: block; }
.rr-project__module-strip strong { font-size: 10px; line-height: 1.3; }
.rr-project__module-strip small { display: -webkit-box; margin-top: 4px; overflow: hidden; color: var(--rr-muted); font-size: 8.5px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.drr-ecosystem__showcases { margin-top: 15px; }
.drr-ecosystem__showcases h4 { margin: 0 0 8px; color: var(--rr-muted); font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
.drr-ecosystem__showcases > div { display: grid; gap: 7px; }
.drr-ecosystem__showcases article { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 11px; border: 1px solid var(--rr-line); border-radius: 10px; background: var(--rr-panel-solid); }
.drr-ecosystem__showcases article strong { font-size: 10.5px; }
.drr-ecosystem__showcases article p { margin-top: 3px; font-size: 9.5px; }
.drr-ecosystem__showcases article > div:last-child { display: flex; gap: 5px; }
.drr-ecosystem__showcases button { padding: 6px 8px; border: 1px solid var(--rr-line); border-radius: 8px; background: var(--rr-panel-muted); color: var(--rr-ink); cursor: pointer; font-size: 9px; }

.rr-brand-mark { display: grid; place-items: center; color: var(--rr-ink); filter: drop-shadow(0 7px 13px rgba(43,70,60,.12)); }
.rr-detail-panel { width: 100%; min-width: 0; display: grid; grid-template-rows: auto auto auto auto; overflow: hidden; border: 1px solid var(--rr-line); border-radius: 18px; background: var(--rr-panel-solid); box-shadow: 0 12px 35px rgba(32,45,39,.08); }
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
.rr-detail-body { min-width: 0; padding: 20px 22px 24px; }
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
.rr-detail-panel .rr-button--primary { border-color: var(--rr-accent); background: var(--rr-accent); color: #fff; }
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

.drr-ecosystem { padding: 0 0 10px; color: var(--rr-ink); }
.drr-ecosystem__header { display: flex; justify-content: space-between; gap: 24px; align-items: end; margin-bottom: 14px; padding: 18px; border-radius: 16px; background: linear-gradient(135deg, color-mix(in srgb, #7664bc 15%, var(--rr-panel-solid)), color-mix(in srgb, #4c9aaa 12%, var(--rr-panel-solid))); }
.drr-ecosystem__eyebrow { margin: 0 0 5px; color: var(--rr-muted); font-size: 10px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.drr-ecosystem__header h2, .drr-ecosystem__detail h3 { margin: 0 0 5px; font-family: Georgia, "Times New Roman", serif; font-weight: 500; }
.drr-ecosystem__header h2 { font-size: 24px; }
.drr-ecosystem__header p, .drr-ecosystem__detail p { margin: 0; color: var(--rr-muted); font-size: 11.5px; line-height: 1.5; }
.drr-ecosystem__metrics { display: flex; gap: 18px; margin: 0; }
.drr-ecosystem__metrics div { text-align: right; }
.drr-ecosystem__metrics dt { color: var(--rr-muted); font-size: 9px; text-transform: uppercase; }
.drr-ecosystem__metrics dd { margin: 2px 0 0; font-size: 19px; font-weight: 700; }
.drr-ecosystem__body { display: grid; grid-template-columns: 275px minmax(0,1fr); gap: 12px; }
.drr-ecosystem__tabs, .drr-ecosystem__detail { border: 1px solid var(--rr-line); border-radius: 16px; background: var(--rr-panel); }
.drr-ecosystem__tabs { padding: 7px; }
.drr-ecosystem__tab { display: grid; grid-template-columns: 11px minmax(0,1fr); gap: 11px; width: 100%; padding: 10px; border: 0; border-radius: 11px; background: transparent; color: var(--rr-ink); text-align: left; cursor: pointer; }
.drr-ecosystem__tab.is-active { background: var(--rr-panel-muted); }
.drr-ecosystem__mark { width: 9px; height: 9px; margin-top: 4px; border-radius: 3px; }
.drr-ecosystem__tab strong, .drr-ecosystem__tab small { display: block; }
.drr-ecosystem__tab strong { font-size: 11.5px; }
.drr-ecosystem__tab small { margin-top: 3px; color: var(--rr-muted); font-size: 9px; }
.drr-ecosystem__detail { padding: 19px; }
.drr-ecosystem__detail-head { display: flex; gap: 14px; align-items: center; }
.drr-ecosystem__large-mark { display: grid; place-items: center; flex: 0 0 44px; height: 44px; border-radius: 13px; color: white; }
.drr-ecosystem__detail h3 { font-size: 21px; }
.drr-ecosystem__status-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 9px; margin-top: 16px; }
.drr-ecosystem__status-grid section { min-width: 0; padding: 12px; border: 1px solid var(--rr-line); border-radius: 11px; background: var(--rr-panel-muted); }
.drr-ecosystem__status-grid h4, .drr-ecosystem__examples h4 { margin: 0 0 8px; color: var(--rr-muted); font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
.drr-ecosystem__status-grid ul { margin: 0; padding: 0; list-style: none; }
.drr-ecosystem__status-grid li { display: flex; align-items: center; gap: 6px; font-size: 10.5px; }
.drr-ecosystem__status-grid li small { margin-left: auto; color: var(--rr-muted); font-size: 8.5px; }
.drr-ecosystem__ready { width: 6px; height: 6px; border-radius: 50%; background: #67a37c; }
.drr-ecosystem__status-grid strong { color: var(--rr-ink); font-size: 18px; }
.drr-ecosystem__switch { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px; padding: 6px 8px; border: 1px solid var(--rr-line); border-radius: 8px; background: var(--rr-panel-solid); color: var(--rr-ink); cursor: pointer; font-size: 9.5px; }
.drr-ecosystem__switch i { width: 23px; height: 13px; padding: 2px; border-radius: 999px; background: var(--rr-faint); }
.drr-ecosystem__switch i::after { content: ""; display: block; width: 9px; height: 9px; border-radius: 50%; background: white; transition: transform .15s; }
.drr-ecosystem__switch[aria-checked="true"] i { background: var(--rr-accent); }
.drr-ecosystem__switch[aria-checked="true"] i::after { transform: translateX(10px); }
.drr-ecosystem__examples { margin-top: 15px; }
.drr-ecosystem__examples > div { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
.drr-ecosystem__examples button { display: flex; justify-content: space-between; padding: 9px 10px; border: 1px solid var(--rr-line); border-radius: 9px; background: var(--rr-panel-solid); color: var(--rr-ink); cursor: pointer; font-size: 10px; }

@container (max-width: 840px) {
  .rr-portal-main { grid-template-columns: 1fr; gap: 20px; align-content: center; padding: 26px 6px 18px; }
  .rr-portal-copy { max-width: none; }
  .rr-portal-copy h1 { max-width: 650px; font-size: clamp(38px, 10cqw, 54px); }
  .rr-portal-path { display: none; }
  .rr-portal-capabilities { justify-content: flex-start; overflow-x: auto; padding-bottom: 3px; }
}
@container (max-width: 560px) {
  .rr-portal-main { min-height: 405px; padding: 23px 0 12px; }
  .rr-portal-copy h1 { font-size: clamp(34px, 10.5cqw, 44px); line-height: 1.01; }
  .rr-portal-copy > p { margin-top: 15px; font-size: 12px; line-height: 1.55; }
  .rr-portal-actions { margin-top: 18px; }
  .rr-portal-primary, .rr-portal-secondary { min-height: 42px; }
  .rr-portal-metrics { margin-top: 20px; }
  .rr-portal-metrics div { min-width: 0; flex: 1; margin-right: 10px; padding-right: 10px; }
  .rr-portal-metrics dt { font-size: 7.5px; }
  .rr-portal-metrics dd { font-size: 19px; }
  .rr-portal-capabilities span { padding-inline: 7px; font-size: 7.5px; }
}

@container (max-width: 760px) {
  .rr-project__mast, .rr-project__section-head { align-items: flex-start; flex-direction: column; }
  .rr-project__mast { gap: 14px; padding: 16px; }
  .rr-project__mast .rr-button { width: 100%; }
  .rr-project__section-head > p { max-width: none; text-align: left; }
  .rr-project__grid { grid-template-columns: 1fr; }
  .rr-project__steps { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .rr-project__summary { grid-template-columns: repeat(3,minmax(0,1fr)); }
  .rr-project__summary > div { min-width: 0; border-right: 1px solid var(--rr-line); border-bottom: 0; }
  .rr-project__summary > div:last-child { border-right: 0; }
  .rr-project__module-strip { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .drr-ecosystem__header { align-items: flex-start; flex-direction: column; }
  .drr-ecosystem__metrics div { text-align: left; }
  .drr-ecosystem__body { grid-template-columns: 1fr; }
  .drr-ecosystem__tabs { display: flex; max-width: 100%; overflow-x: auto; scrollbar-gutter: stable; }
  .drr-ecosystem__tab { flex: 0 0 min(210px, 76cqw); }
  .drr-ecosystem__status-grid { grid-template-columns: 1fr; }
  .drr-ecosystem__examples > div { grid-template-columns: 1fr; }
  .drr-ecosystem__showcases article { align-items: flex-start; flex-direction: column; }
  .rr-detail-head { grid-template-columns: minmax(0,1fr) auto; gap: 12px; padding: 17px; }
  .rr-preview, .rr-preview-fallback { display: none; }
  .rr-section-grid { grid-template-columns: 1fr; }
  .rr-info-block--wide { grid-column: auto; }
  .rr-detail-body { padding: 16px 17px 20px; }
  .rr-detail-foot { align-items: flex-start; flex-direction: column; padding-inline: 17px; }
  .rr-actions { width: 100%; margin: 0; }
  .rr-actions .rr-button { width: 100%; }
  .rr-session-project__body { align-items: flex-start; flex-direction: column; gap: 12px; }
  .rr-session-project__next { max-width: none; }
  .rr-session-flow__grid { grid-template-columns: 1fr; }
  .rr-session-flow__section:last-child { grid-column: auto; }
}

@container (max-width: 500px) {
  .rr-project__mast h1 { font-size: 26px; line-height: 1.05; }
  .rr-project__primary, .rr-project__modules { padding: 14px; }
  .rr-project__steps, .rr-project__summary, .rr-project__module-strip { grid-template-columns: 1fr; }
  .rr-project__summary > div { border-right: 0; border-bottom: 1px solid var(--rr-line); }
  .drr-ecosystem__header, .drr-ecosystem__detail { padding: 14px; }
  .drr-ecosystem__metrics { width: 100%; justify-content: space-between; gap: 8px; }
  .drr-ecosystem__detail-head { align-items: flex-start; }
  .drr-ecosystem__large-mark { flex-basis: 36px; height: 36px; }
  .drr-ecosystem__tab { flex-basis: min(190px, 80cqw); }
  .rr-detail-title { font-size: 22px; }
  .rr-tabs { max-width: 100%; padding-inline: 10px; overflow-x: auto; }
  .rr-tab { flex: 1 0 auto; }
}

@keyframes rr-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes rr-rise { from { opacity: 0; transform: translateY(9px) scale(.985) } to { opacity: 1; transform: translateY(0) scale(1) } }
@container (max-width: 600px) {
  .rr-root--hero .rr-launch { grid-template-columns: auto minmax(0, 1fr); }
  .rr-root--hero .rr-launch-count { display: none; }
  .rr-root--hero .rr-toolbar { grid-template-columns: 1fr; }
  .rr-root--hero .rr-search { grid-column: auto; }
  .rr-root--hero .rr-select { min-width: 0; }
  .rr-root--hero .rr-count { justify-self: start; }
  .rr-root--hero .rr-grid { grid-template-columns: 1fr; }
}
@media (max-width: 840px) {
  .rr-portal { min-height: 610px; max-height: min(720px, calc(100vh - 220px)); padding-inline: 20px; }
  .rr-portal-main { grid-template-columns: 1fr; gap: 21px; align-content: center; padding: 30px 6px 20px; }
  .rr-portal-copy { max-width: 670px; }
  .rr-portal-copy h1 { max-width: 650px; font-size: clamp(38px, 7vw, 56px); }
  .rr-portal-path { display: none; }
  .rr-portal-capabilities { justify-content: flex-start; overflow-x: auto; padding-bottom: 3px; }
  .rr-root { width: 100%; max-width: 680px; }
  .rr-root--hero { width: 100%; min-height: 360px; max-height: min(620px, calc(100vh - 235px)); padding-inline: 10px; }
  .rr-launch { grid-template-columns: auto minmax(0, 1fr); }
  .rr-launch-count { display: none; }
  .rr-hero-head { height: 120px; }
  .rr-grid { grid-template-columns: 1fr; }
  .rr-toolbar { grid-template-columns: 1fr 1fr; }
  .rr-search { grid-column: 1 / -1; }
  .rr-count { justify-self: end; }
  .rr-detail-head { grid-template-columns: 100px minmax(0,1fr) auto; gap: 13px; }
  .rr-preview, .rr-preview-fallback { width: 100px; height: 78px; }
  .drr-ecosystem__body { grid-template-columns: 1fr; }
  .drr-ecosystem__tabs { display: flex; overflow-x: auto; }
  .drr-ecosystem__tab { flex: 0 0 210px; }
  .drr-ecosystem__status-grid { grid-template-columns: 1fr; }
  .rr-project__mast, .rr-project__section-head { align-items: flex-start; flex-direction: column; }
  .rr-project__section-head > p { max-width: none; text-align: left; }
  .rr-project__grid { grid-template-columns: 1fr; }
  .rr-project__summary { grid-template-columns: repeat(3,1fr); }
  .rr-project__summary > div { border-right: 1px solid var(--rr-line); border-bottom: 0; }
  .rr-project__summary > div:last-child { border-right: 0; }
  .rr-project__module-strip { grid-template-columns: repeat(3,minmax(0,1fr)); }
}
@media (max-width: 560px) {
  .rr-portal { min-height: 560px; max-height: min(650px, calc(100vh - 190px)); padding: 17px 16px 15px; border-radius: 19px; }
  .rr-portal-edition { padding-inline: 8px; font-size: 8px; }
  .rr-portal-main { min-height: 440px; padding: 26px 1px 16px; }
  .rr-portal-copy h1 { font-size: clamp(35px, 11.5vw, 48px); }
  .rr-portal-copy > p { font-size: 12.5px; }
  .rr-portal-actions { display: grid; }
  .rr-portal-primary, .rr-portal-secondary { width: 100%; }
  .rr-portal-metrics div { min-width: 0; flex: 1; margin-right: 12px; padding-right: 12px; }
  .rr-portal-metrics dt { font-size: 7.5px; }
  .rr-portal-metrics dd { font-size: 19px; }
  .rr-workspace-head { grid-template-columns: auto minmax(0,1fr); }
  .rr-workspace-status { display: none; }
  .rr-workspace-title p { display: none; }
  .rr-root--session { padding: 20px 13px 75px; }
  .rr-session-project__body { align-items: start; flex-direction: column; gap: 12px; }
  .rr-session-flow__grid { grid-template-columns: 1fr; }
  .rr-session-flow__section:last-child { grid-column: auto; }
  .rr-launch { padding: 11px; }
  .rr-toolbar { grid-template-columns: 1fr; }
  .rr-search { grid-column: auto; }
  .rr-count { justify-self: start; }
  .rr-source-note { display: block; }
  .rr-source-note span { display: block; margin-top: 4px; }
  .rr-detail-head { grid-template-columns: minmax(0,1fr) auto; }
  .rr-preview, .rr-preview-fallback { display: none; }
  .rr-section-grid { grid-template-columns: 1fr; }
  .rr-info-block--wide { grid-column: auto; }
  .rr-detail-foot { align-items: flex-start; flex-direction: column; }
  .rr-actions { width: 100%; margin: 0; }
  .rr-actions .rr-button { flex: 1; }
  .rr-mode-picker { grid-template-columns: 1fr; }
  .drr-ecosystem__header { align-items: start; flex-direction: column; }
  .drr-ecosystem__metrics div { text-align: left; }
  .drr-ecosystem__examples > div { grid-template-columns: 1fr; }
  .rr-project__identity { align-items: flex-start; }
  .rr-project__mast .rr-launch-mark { display: none; }
  .rr-project__mast .rr-button { width: 100%; }
  .rr-project__steps { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .rr-project__summary { grid-template-columns: 1fr; }
  .rr-project__summary > div { border-right: 0; border-bottom: 1px solid var(--rr-line); }
  .rr-project__module-strip { grid-template-columns: 1fr 1fr; }
  .drr-ecosystem__showcases article { align-items: flex-start; flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) { .rr-card, .rr-card-arrow, .rr-portal-primary, .rr-portal-primary svg { animation: none; transition: none; } }

.rr-science-sidebar { display: flex; min-height: 100%; flex-direction: column; gap: 14px; padding: 18px 14px; color: var(--dsw-alias-label-primary, var(--rr-ink)); }
.rr-science-sidebar__head p { margin: 0 0 4px; color: var(--rr-accent); font-size: 10px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
.rr-science-sidebar__head h2 { margin: 0; font: 650 20px/1.25 Georgia, "Times New Roman", serif; }
.rr-science-sidebar__head > span { display: block; margin-top: 7px; color: var(--dsw-alias-label-secondary, var(--rr-muted)); font-size: 11px; line-height: 1.55; }
.rr-science-sidebar__modules { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.rr-science-sidebar__modules li { display: grid; grid-template-columns: 7px minmax(0, 1fr) auto; align-items: center; gap: 9px; min-height: 43px; padding: 7px 8px; border: 1px solid var(--dsw-alias-border-l2, var(--rr-line)); border-radius: 10px; background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, #fffefa) 84%, transparent); }
.rr-science-sidebar__mark { width: 7px; height: 7px; border-radius: 50%; }
.rr-science-sidebar__modules strong, .rr-science-sidebar__modules small { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rr-science-sidebar__modules strong { font-size: 10.5px; font-weight: 650; }
.rr-science-sidebar__modules small { margin-top: 2px; color: var(--dsw-alias-label-secondary, var(--rr-muted)); font-size: 8.5px; }
.rr-science-sidebar__modules em { color: var(--rr-accent-ink); font-size: 8.5px; font-style: normal; font-weight: 650; }
.rr-science-sidebar__activate { display: inline-flex; min-height: 36px; align-items: center; justify-content: center; gap: 7px; margin-top: auto; padding: 8px 11px; border: 0; border-radius: 10px; background: var(--dsw-alias-button-primary-fill, var(--rr-accent)); color: #fff; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.rr-science-sidebar__activate:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, var(--rr-accent-ink)); }
.rr-science-sidebar__activate:focus-visible { outline: 2px solid var(--rr-accent); outline-offset: 2px; }
.rr-science-sidebar__activate:disabled { cursor: wait; opacity: .62; }
.rr-science-sidebar__message { min-height: 2.6em; margin: -6px 2px 0; color: var(--dsw-alias-label-secondary, var(--rr-muted)); font-size: 9px; line-height: 1.35; }
.rr-science-sidebar--compact { min-height: auto; align-items: center; padding: 8px 5px; }
.rr-science-sidebar__activate--compact { width: 36px; min-height: 36px; padding: 0; border-radius: 9px; }
.rr-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
`;
