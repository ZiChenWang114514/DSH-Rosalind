#!/usr/bin/env python3
"""Build the KRAS G12C summary and preview from retained public API responses."""

from __future__ import annotations

import json
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
INPUT = CASE / "inputs"
OUTPUT = CASE / "outputs"


def load(name: str):
    return json.loads((INPUT / name).read_text(encoding="utf-8"))


def main() -> None:
    uniprot = load("uniprot-P01116.json")
    clinvar = load("clinvar-KRAS-G12C-search.json")
    chembl = load("chembl-sotorasib-search.json")
    rcsb = load("rcsb-6OIM.json")

    assert uniprot["primaryAccession"] == "P01116"
    assert uniprot["sequence"]["value"][11] == "G"
    g12c = next(row for row in clinvar[3] if "p.Gly12Cys" in row[1])
    sotorasib = next(row for row in chembl["molecules"] if row.get("pref_name") == "SOTORASIB")
    assert rcsb["rcsb_id"] == "6OIM"

    result = {
        "showcase_id": "databases-kras-g12c",
        "retrieved_at_utc": "2026-08-29T18:15:55Z",
        "protein": {
            "uniprot_accession": uniprot["primaryAccession"],
            "entry_id": uniprot["uniProtkbId"],
            "reviewed": uniprot["entryType"] == "UniProtKB reviewed (Swiss-Prot)",
            "length_aa": uniprot["sequence"]["length"],
            "reference_residue_12": uniprot["sequence"]["value"][11],
        },
        "variant": {
            "clinvar_variation_id": g12c[0],
            "transcript_hgvs": g12c[1],
            "search_term": "KRAS G12C",
            "records_total": clinvar[0],
            "records_retained": len(clinvar[1]),
        },
        "compound": {
            "name": sotorasib["pref_name"],
            "chembl_id": sotorasib["molecule_chembl_id"],
            "max_phase": int(float(sotorasib["max_phase"])),
            "first_approval_year": sotorasib["first_approval"],
        },
        "structure": {
            "pdb_id": rcsb["rcsb_id"],
            "title": rcsb["struct"]["title"],
            "method": rcsb["exptl"][0]["method"],
            "resolution_angstrom": rcsb["rcsb_entry_info"]["resolution_combined"][0],
        },
        "interpretation": "The four identifiers describe the same research theme at protein, allele, compound, and covalent-complex levels; they do not constitute a treatment recommendation.",
        "limitations": [
            "The ClinVar search response is a ten-record retained slice of twelve matches.",
            "ChEMBL maximum phase and first approval are database fields, not comparative efficacy measures.",
            "One crystal structure cannot establish behavior across all KRAS G12C states or cellular contexts.",
        ],
    }
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">KRAS G12C public evidence map</title><desc id="desc">Four exact public identifiers connect KRAS protein, the G12C allele, sotorasib, and a covalent crystal structure.</desc>
<rect width="1200" height="675" fill="#081522"/><rect x="48" y="42" width="1104" height="590" rx="26" fill="#10263a" stroke="#2e526f"/><style>.t{{font:700 38px Segoe UI,Arial;fill:#f7fbff}}.s{{font:18px Segoe UI,Arial;fill:#aec3d5}}.h{{font:700 17px Segoe UI,Arial;fill:#63e6d5}}.v{{font:700 24px Segoe UI,Arial;fill:#fff}}.m{{font:15px Consolas,monospace;fill:#c8d8e6}}</style><text x="80" y="103" class="t">KRAS G12C evidence map</text><text x="80" y="140" class="s">Retained UniProt, ClinVar, ChEMBL, and RCSB responses · 29 Aug 2026</text>
<path d="M280 295 L480 295 M720 295 L920 295 M600 350 L600 470" stroke="#4f718e" stroke-width="5"/><circle cx="600" cy="295" r="92" fill="#126c70" stroke="#55e0cf" stroke-width="4"/><text x="600" y="286" text-anchor="middle" class="v">KRAS G12C</text><text x="600" y="319" text-anchor="middle" class="m">Gly12→Cys</text>
<rect x="78" y="220" width="270" height="150" rx="18" fill="#172f47"/><text x="103" y="258" class="h">UNIPROT</text><text x="103" y="303" class="v">P01116</text><text x="103" y="336" class="m">189 aa · residue 12 = G</text>
<rect x="852" y="220" width="270" height="150" rx="18" fill="#172f47"/><text x="877" y="258" class="h">CLINVAR</text><text x="877" y="303" class="v">Variation {g12c[0]}</text><text x="877" y="336" class="m">c.34G&gt;T · p.Gly12Cys</text>
<rect x="165" y="445" width="360" height="130" rx="18" fill="#172f47"/><text x="190" y="483" class="h">CHEMBL</text><text x="190" y="526" class="v">Sotorasib</text><text x="190" y="556" class="m">{sotorasib['molecule_chembl_id']} · max phase 4</text>
<rect x="675" y="445" width="360" height="130" rx="18" fill="#172f47"/><text x="700" y="483" class="h">RCSB PDB</text><text x="700" y="526" class="v">6OIM · 1.65 Å</text><text x="700" y="556" class="m">KRAS G12C covalently bound to AMG 510</text></svg>'''
    (CASE / "previews" / "preview.svg").write_text(svg + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
