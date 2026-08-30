export const SETTINGS_CSS = String.raw`
.rr-settings { display: grid; gap: 16px; width: 100%; max-height: calc(100dvh - 9rem); padding: clamp(4px, 1.5vw, 16px) clamp(4px, 1.5vw, 32px) 32px; overflow-y: auto; overscroll-behavior: contain; }
.rr-settings__header h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(22px, 2vw, 26px); font-weight: 500; }
.rr-settings__header p { max-width: 720px; margin: 8px 0 0; color: var(--rr-muted); font-size: 12.5px; line-height: 1.6; }
.rr-settings__header .rr-settings__note { color: var(--rr-faint); }
.rr-settings__notice { margin: 0; padding: 10px 12px; border: 1px solid var(--rr-line); border-radius: 10px; background: var(--rr-panel-muted); color: var(--rr-ink); font-size: 12px; line-height: 1.5; }
.rr-settings__notice--error { border-color: color-mix(in srgb, #bd4d50 45%, var(--rr-line)); color: color-mix(in srgb, #bd4d50 72%, var(--rr-ink)); }
.rr-settings__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 25rem), 1fr)); gap: 12px; align-items: start; }
.rr-settings__card { min-width: 0; padding: clamp(12px, 2vw, 18px); border: 1px solid var(--rr-line); border-radius: 14px; background: var(--rr-panel-solid); box-shadow: 0 8px 22px color-mix(in srgb, var(--rr-ink) 6%, transparent); }
.rr-settings__row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.rr-settings__identity { min-width: 0; }
.rr-settings__identity h3 { margin: 0; overflow-wrap: anywhere; font-size: 15px; line-height: 1.35; }
.rr-settings__identity p { margin: 5px 0 0; color: var(--rr-muted); font-size: 12px; line-height: 1.5; }
.rr-settings__state { display: inline-flex; align-items: center; gap: 4px; font-weight: 750; white-space: nowrap; }
.rr-settings__state::before { width: .5em; height: .5em; border-radius: 50%; background: currentColor; content: ""; }
.rr-settings__state[data-state="active"] { color: #23724d; }
.rr-settings__state[data-state="needs_setup"] { color: #8b5b0e; }
.rr-settings__state[data-state="error"] { color: #ae383b; }
.rr-settings__state[data-state="disabled"] { color: var(--rr-faint); }
:root[data-theme="dark"] .rr-settings__state[data-state="active"], [data-theme="dark"] .rr-settings__state[data-state="active"] { color: #8ed3af; }
:root[data-theme="dark"] .rr-settings__state[data-state="needs_setup"], [data-theme="dark"] .rr-settings__state[data-state="needs_setup"] { color: #e6bd72; }
:root[data-theme="dark"] .rr-settings__state[data-state="error"], [data-theme="dark"] .rr-settings__state[data-state="error"] { color: #f0a6a8; }
.rr-settings__switch { min-width: 88px; min-height: 40px; padding: 8px 13px; border: 1px solid transparent; border-radius: 999px; background: var(--rr-faint); color: #fff; cursor: pointer; font-weight: 750; }
.rr-settings__switch[data-enabled="true"] { background: var(--rr-accent); }
.rr-settings__switch:disabled { cursor: not-allowed; opacity: .62; }
.rr-settings__switch:focus-visible, .rr-settings__details summary:focus-visible { outline: 3px solid color-mix(in srgb, var(--rr-accent) 40%, transparent); outline-offset: 3px; }
.rr-settings__pending { margin: 10px 0 0; color: color-mix(in srgb, #93630d 75%, var(--rr-ink)); font-size: 12px; line-height: 1.5; }
.rr-settings__metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: 8px; margin: 12px 0; }
.rr-settings__metric { min-width: 0; padding: 8px; border-radius: 9px; background: color-mix(in srgb, var(--rr-panel-muted) 70%, transparent); }
.rr-settings__metric dt { color: var(--rr-muted); font-size: 11px; }
.rr-settings__metric dd { margin: 2px 0 0; overflow-wrap: anywhere; font-size: 14px; font-weight: 700; }
.rr-settings__details { border-top: 1px solid var(--rr-line); }
.rr-settings__details summary { min-height: 36px; padding-top: 10px; cursor: pointer; font-weight: 700; }
.rr-settings__details-content { display: grid; gap: 12px; padding-top: 2px; overflow-wrap: anywhere; }
.rr-settings__details-content section { padding: 10px; border-radius: 9px; background: color-mix(in srgb, var(--rr-panel-muted) 58%, transparent); }
.rr-settings__details-content h4 { margin: 0 0 6px; color: var(--rr-accent-ink); font-size: 12px; }
.rr-settings__details-content p, .rr-settings__details-content ul { margin: 0; font-size: 12px; line-height: 1.55; }
.rr-settings__details-content ul { padding-inline-start: 20px; }
.rr-settings__issues { border-left: 3px solid #bd4d50; }
.rr-settings__issues h4 { color: #ae383b; }
`;
