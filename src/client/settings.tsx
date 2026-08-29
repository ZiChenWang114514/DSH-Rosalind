import { SettingsIcon } from "./icons.js";

const GROUPS = [
  { title: "Local and public sources", description: "Replay works offline. Public APIs are checked only for a fresh run.", providers: ["Repository replay", "PubMed / PMC", "bioRxiv / medRxiv", "Open Targets", "UniProt", "RCSB PDB"] },
  { title: "Scientific compute", description: "Containers and workflow engines are detected from the active DSH host.", providers: ["Local algorithms", "Docker", "Nextflow / Snakemake", "Structure and sequence viewers"] },
  { title: "Remote and molecular design", description: "These providers require a specific plan and explicit approval.", providers: ["SSH / HPC", "Boltz-2", "Biohub ESM", "Modal", "Runpod"] },
] as const;

export function ProviderSettings(): JSX.Element {
  return (
    <section className="rr-settings">
      <h2><SettingsIcon size={22} /> Scientific providers</h2>
      <p>DSH-Rosalind reports installation, credentials, current availability, resource needs, and estimated cost without exposing secret values.</p>
      <div className="rr-provider-groups">{GROUPS.map((group) => <section className="rr-provider-group" key={group.title}><h3>{group.title}</h3><p>{group.description}</p><div className="rr-provider-list">{group.providers.map((provider) => <span className="rr-provider" key={provider}>{provider}</span>)}</div></section>)}</div>
      <div className="rr-settings-note">Paid services, GPU work, SSH/HPC jobs, large downloads, and external writes are described in a plan and wait for your confirmation. A failed provider is never replaced automatically.</div>
    </section>
  );
}
