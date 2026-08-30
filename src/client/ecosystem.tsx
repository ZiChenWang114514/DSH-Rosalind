import { useEffect, useRef, useState } from "react";
import { SHOWCASES } from "../generated/catalog.js";
import type { ShowcaseDefinition, ShowcaseMode } from "../shared/types.js";

export interface EcosystemExample {
  label: string;
  prompt: string;
}

export interface SciencePluginSpec {
  id: string;
  name: string;
  version: string;
  description: string;
  color: string;
  mcpServices: readonly string[];
  skillCount: number;
  operationCount: number;
  examples: readonly EcosystemExample[];
}

/** Public catalogue for the seven independently selectable science ecosystems. */
export const SCIENCE_ECOSYSTEMS: readonly SciencePluginSpec[] = [
  { id: "literature", name: "Life Sciences Literature", version: "0.1.5", description: "Search papers, inspect full-text access, and connect preprints with later publications.", color: "#c1845b", mcpServices: ["literature"], skillCount: 3, operationCount: 0, examples: [{ label: "Find TREM2 papers", prompt: "Search TREM2 literature and show provenance." }, { label: "Trace a preprint", prompt: "Connect a bioRxiv preprint to a published paper." }, { label: "Check open access", prompt: "Check PMC availability and license metadata." }] },
  { id: "databases", name: "Life Sciences Databases", version: "0.1.5", description: "Bring together genetics, pharmacology, pathways, protein resources, and disease evidence.", color: "#6f81bd", mcpServices: ["databases"], skillCount: 44, operationCount: 4, examples: [{ label: "Explore IL6R", prompt: "Investigate IL6R evidence for asthma." }, { label: "Interpret a variant", prompt: "Retrieve ClinVar and population evidence for a variant." }, { label: "Map EGFR", prompt: "Summarize EGFR target, drug, and pathway evidence." }] },
  { id: "sequence", name: "Biological Sequence & Alignment Viewer", version: "0.1.43", description: "Inspect sequences and alignments with annotations, conservation, trees, and reproducible exports.", color: "#4c977e", mcpServices: ["sequence-viewer"], skillCount: 1, operationCount: 13, examples: [{ label: "Annotate lambda", prompt: "Open and annotate a lambda phage sequence." }, { label: "Align RAS", prompt: "Compare human RAS protein sequences." }, { label: "QC FASTQ", prompt: "Inspect per-cycle FASTQ quality." }] },
  { id: "ngs", name: "NGS Analysis Workbench", version: "0.2.16", description: "Design workflows, check local readiness and execution, prepare remote requirements, and interpret analyses.", color: "#876aab", mcpServices: ["ngs-app", "ngs-analysis-workbench", "ngs-compute"], skillCount: 5, operationCount: 22, examples: [{ label: "Plan bulk RNA-seq", prompt: "Design a bulk RNA-seq workflow." }, { label: "Check readiness", prompt: "Check NGS inputs and compute readiness." }, { label: "Review a run", prompt: "Interpret a completed NGS analysis." }] },
  { id: "structure", name: "Molecular Structure Viewer", version: "0.1.80", description: "Explore molecular scenes, selections, contacts, surfaces, structure comparison, and publication figures.", color: "#c26e6a", mcpServices: ["structure-viewer"], skillCount: 1, operationCount: 41, examples: [{ label: "Inspect MDM2–p53", prompt: "Analyze MDM2 and p53 contacts." }, { label: "Compare kinases", prompt: "Align adenylate kinase conformations." }, { label: "Build a GFP figure", prompt: "Create a provenance-bearing GFP figure." }] },
  { id: "slide", name: "Slide Viewer", version: "0.1.56", description: "Navigate whole-slide images, spatial expression, annotations, measurements, segmentation, and export.", color: "#b18c3f", mcpServices: ["slide-viewer"], skillCount: 1, operationCount: 40, examples: [{ label: "View tissue", prompt: "Open a whole-slide tissue architecture study." }, { label: "Spatial expression", prompt: "Explore spatial gene expression." }, { label: "Review segmentation", prompt: "Inspect a segmentation overlay." }] },
  { id: "workbench", name: "Rosalind Workbench", version: "0.2.2-research-preview", description: "Coordinate scientific capabilities, settings, research plans, confirmation, files, and cross-plugin work.", color: "#4c7fa4", mcpServices: ["rosalind"], skillCount: 0, operationCount: 1, examples: [{ label: "Design nanobodies", prompt: "Open the PD-L1 nanobody design study." }, { label: "Launch structure", prompt: "Open the molecular structure launcher." }, { label: "Launch genomics", prompt: "Open the genomics launcher." }] },
] as const;

export interface ScienceEcosystemPanelProps {
  onExample?: (example: EcosystemExample, plugin: SciencePluginSpec) => void;
  onShowcase?: (showcase: ShowcaseDefinition, mode: ShowcaseMode) => void;
  className?: string;
}

function marker(color: string): React.CSSProperties { return { background: color, boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 16%, transparent)` }; }

function useHorizontalTabs(): { containerRef: React.RefObject<HTMLElement>; horizontal: boolean } {
  const containerRef = useRef<HTMLElement>(null);
  const [horizontal, setHorizontal] = useState(false);
  useEffect(() => {
    const update = (): void => {
      const width = containerRef.current?.clientWidth ?? window.innerWidth;
      setHorizontal(width <= 760);
    };
    update();
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    if (containerRef.current && observer) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, []);
  return { containerRef, horizontal };
}

export function ScienceEcosystemPanel({ onExample, onShowcase, className = "" }: ScienceEcosystemPanelProps): JSX.Element {
  const [activeId, setActiveId] = useState(SCIENCE_ECOSYSTEMS[0]!.id);
  const { containerRef, horizontal } = useHorizontalTabs();
  const activeIndex = Math.max(0, SCIENCE_ECOSYSTEMS.findIndex((item) => item.id === activeId));
  const active = SCIENCE_ECOSYSTEMS[activeIndex]!;
  const declaredOperationCount = SCIENCE_ECOSYSTEMS.reduce((sum, item) => sum + item.operationCount, 0);
  const activeShowcases = SHOWCASES.filter((showcase) => showcase.status === "ready" && showcase.categoryId === active.id);

  function selectAt(index: number): void {
    const next = SCIENCE_ECOSYSTEMS[(index + SCIENCE_ECOSYSTEMS.length) % SCIENCE_ECOSYSTEMS.length]!;
    setActiveId(next.id);
    document.getElementById(`science-ecosystem-tab-${next.id}`)?.focus();
  }

  return (
    <section ref={containerRef} className={`drr-ecosystem ${className}`.trim()} aria-label="Scientific capability reference">
      <header className="drr-ecosystem__header">
        <div><p className="drr-ecosystem__eyebrow">Capability reference</p><h2>Scientific capabilities</h2><p>Find a specialist workspace and review its declared contract. Installation or registration does not confirm that a provider is ready for a fresh run.</p></div>
        <dl className="drr-ecosystem__metrics" aria-label="Declared capability contract summary"><div><dt>Declared plugins</dt><dd>{SCIENCE_ECOSYSTEMS.length}</dd></div><div><dt>Declared skills</dt><dd>{SCIENCE_ECOSYSTEMS.reduce((sum, item) => sum + item.skillCount, 0)}</dd></div><div><dt>Declared operations</dt><dd>{declaredOperationCount}</dd></div></dl>
      </header>
      <div className="drr-ecosystem__body">
        <div className="drr-ecosystem__tabs" role="tablist" aria-label="Scientific plugin workspaces" aria-orientation={horizontal ? "horizontal" : "vertical"}>
          {SCIENCE_ECOSYSTEMS.map((plugin, index) => {
            const selected = plugin.id === active.id;
            return <button id={`science-ecosystem-tab-${plugin.id}`} key={plugin.id} type="button" className={`drr-ecosystem__tab${selected ? " is-active" : ""}`} role="tab" aria-selected={selected} aria-controls={`science-ecosystem-panel-${plugin.id}`} tabIndex={selected ? 0 : -1} onClick={() => setActiveId(plugin.id)} onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); selectAt(index + 1); }
              if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); selectAt(index - 1); }
              if (event.key === "Home") { event.preventDefault(); selectAt(0); }
              if (event.key === "End") { event.preventDefault(); selectAt(SCIENCE_ECOSYSTEMS.length - 1); }
            }}>
              <span className="drr-ecosystem__mark" style={marker(plugin.color)} aria-hidden="true" /><span><strong>{plugin.name}</strong><small>{plugin.skillCount} declared skills · {plugin.mcpServices.length} declared MCP {plugin.mcpServices.length === 1 ? "service" : "services"}</small></span>
            </button>;
          })}
        </div>
        <article id={`science-ecosystem-panel-${active.id}`} className="drr-ecosystem__detail" role="tabpanel" aria-labelledby={`science-ecosystem-tab-${active.id}`}>
          <div className="drr-ecosystem__detail-head"><span className="drr-ecosystem__large-mark" style={marker(active.color)} aria-hidden="true">✦</span><div><p className="drr-ecosystem__eyebrow">Declared contract · {active.version}</p><h3>{active.name}</h3><p>{active.description}</p></div></div>
          <div className="drr-ecosystem__status-grid"><section><h4>Services</h4><ul>{active.mcpServices.map((service) => <li key={service}><span className="drr-ecosystem__ready" style={{ background: "var(--rr-muted)" }} aria-hidden="true" />{service}<small>declared in bundle</small></li>)}</ul><p>Check provider status before a fresh run. Registration only records bundle membership; it does not confirm provider readiness.</p></section><section><h4>Skills & showcases</h4><p><strong>{active.skillCount}</strong> declared {active.skillCount === 1 ? "skill" : "skills"}</p><p><strong>{activeShowcases.length}</strong> reviewed showcases</p><p className="drr-ecosystem__read-only">Change provider configuration in DSH Settings → Rosalind.</p></section><section><h4>Tools</h4>{active.operationCount > 0 ? <p><strong>{active.operationCount}</strong> declared tools in this workspace</p> : <p>This reference does not claim runtime availability. Source requests use the Literature and Databases gateway tools.</p>}</section></div>
          <section className="drr-ecosystem__examples" aria-label={`${active.name} example conversation tasks`}><h4>Example conversation tasks</h4><p className="drr-ecosystem__read-only">When connected to a conversation composer, selecting an example prepares a conversation task; it does not run a provider.</p><div>{active.examples.map((example) => <button key={example.label} type="button" aria-label={`Prepare conversation task: ${example.label}`} onClick={() => onExample?.(example, active)}>{example.label}<span aria-hidden="true">→</span></button>)}</div></section>
          <section className="drr-ecosystem__showcases" aria-label={`${active.name} showcases`}><h4>Reviewed research records</h4><div>{activeShowcases.map((showcase) => <article key={showcase.id}><div><strong>{showcase.title}</strong><p>{showcase.summary}</p></div><div><button type="button" onClick={() => onShowcase?.(showcase, "lesson")}>Inspect</button>{showcase.modes.includes("reproduce") && <button type="button" onClick={() => onShowcase?.(showcase, "reproduce")}>Reproduce</button>}</div></article>)}</div></section>
        </article>
      </div>
    </section>
  );
}
