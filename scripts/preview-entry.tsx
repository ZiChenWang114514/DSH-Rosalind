import { useState } from "react";
import { createRoot } from "react-dom/client";

import { ShowcaseDetailOverlay, Workbench } from "../src/client/components.js";
import { WORKBENCH_CSS } from "../src/client/styles.js";

const chromeCss = `
html, body, #root { min-height: 100%; margin: 0; }
body { background: var(--rr-bg); color: var(--rr-ink); }
.preview-shell { min-height: 100vh; padding: 48px 0 24px; background: radial-gradient(circle at 50% -10%, color-mix(in srgb, var(--rr-accent-soft) 58%, transparent), transparent 34%), var(--rr-bg); }
.preview-context { width: min(1100px, calc(100vw - 52px)); margin: 0 auto 12px; display: flex; justify-content: space-between; color: var(--rr-faint); font: 600 10px/1.4 Inter, ui-sans-serif, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.preview-draft { position: fixed; z-index: 900; right: 18px; bottom: 18px; width: min(390px, calc(100vw - 36px)); max-height: 104px; padding: 11px 13px; overflow: auto; border: 1px solid var(--rr-line); border-radius: 12px; background: var(--rr-panel-solid); box-shadow: var(--rr-shadow); color: var(--rr-muted); font: 11px/1.45 ui-monospace, monospace; }
.preview-draft:empty { display: none; }
@media (max-width: 840px) { .preview-shell { padding-top: 28px; } .preview-context { width: min(680px, calc(100vw - 28px)); } }
`;

function Preview(): JSX.Element {
  const [draft, setDraft] = useState("");
  return <div className="preview-shell">
    <div className="preview-context"><span>DSH Web · Rosalind</span><span>Interactive release preview</span></div>
    <Workbench inputActions={{ setDraft }} />
    <ShowcaseDetailOverlay />
    <output id="preview-draft" className="preview-draft" aria-label="Prepared DSH prompt">{draft}</output>
  </div>;
}

document.documentElement.dataset.theme = new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light";
const style = document.createElement("style");
style.textContent = `${WORKBENCH_CSS}\n${chromeCss}`;
document.head.append(style);
createRoot(document.getElementById("root")!).render(<Preview />);
