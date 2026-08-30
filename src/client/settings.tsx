import { SettingsIcon } from "./icons.js";
import { SCIENCE_ECOSYSTEMS } from "./ecosystem.js";

const GROUPS = [
  { title: "Local and public sources", description: "Replay works offline. Public APIs are checked only for a fresh run.", providers: ["Repository replay", "PubMed / PMC", "bioRxiv / medRxiv", "Open Targets", "UniProt", "RCSB PDB"] },
  { title: "Scientific compute", description: "Containers and workflow engines are detected from the active DSH host.", providers: ["Local algorithms", "Docker", "Nextflow / Snakemake", "Structure and sequence viewers"] },
  { title: "Remote and molecular design", description: "These providers require a specific plan and explicit approval.", providers: ["SSH / HPC", "Boltz-2", "Biohub ESM", "Modal", "Runpod"] },
] as const;

export function ProviderSettings(): JSX.Element {
  return (
    <section className="rr-settings">
      <h2><SettingsIcon size={22} /> Scientific providers</h2>
      <p>DSH-Rosalind reports installation, credentials, current availability, resource needs, and estimated cost without exposing secret values. Provider state is checked when you prepare work; it is not inferred from a bundle declaration.</p>
      <details className="rr-provider-group" aria-label="Scientific capabilities reference">
        <summary style={{ cursor: "pointer" }}><h3 style={{ display: "inline" }}>Scientific capabilities</h3></summary>
        <p style={{ marginTop: 9 }}>Capability reference for plugin discovery and maintenance. Versions, Skills, and operations describe declared contracts; installed or registered services are not necessarily ready to run.</p>
        <div className="rr-provider-list" aria-label="Declared scientific capabilities">
          {SCIENCE_ECOSYSTEMS.map((plugin) => <span className="rr-provider" key={plugin.id} title={`${plugin.name}: ${plugin.description}`}>{plugin.name}</span>)}
        </div>
        <p style={{ marginTop: 11, marginBottom: 0 }}>Use the provider groups below to review readiness and resource requirements before preparing a conversation task.</p>
      </details>
      <div className="rr-provider-groups">{GROUPS.map((group) => <section className="rr-provider-group" key={group.title}><h3>{group.title}</h3><p>{group.description}</p><div className="rr-provider-list">{group.providers.map((provider) => <span className="rr-provider" key={provider}>{provider}</span>)}</div></section>)}</div>
      <div className="rr-settings-note">Paid services, GPU work, SSH/HPC jobs, large downloads, and external writes are described in a plan and wait for your confirmation. A failed provider is never replaced automatically.</div>
    </section>
  );
}
