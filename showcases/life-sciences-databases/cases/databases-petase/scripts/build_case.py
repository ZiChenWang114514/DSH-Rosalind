#!/usr/bin/env python3
"""Build the PETase sequence-structure summary from retained public records."""

from __future__ import annotations

import json
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
INPUT = CASE / "inputs"
OUTPUT = CASE / "outputs"


def main() -> None:
    uniprot = json.loads((INPUT / "uniprot-A0A0K8P6T7.json").read_text(encoding="utf-8"))
    rcsb = json.loads((INPUT / "rcsb-5XJH.json").read_text(encoding="utf-8"))
    sequence = uniprot["sequence"]["value"]
    active = [f for f in uniprot["features"] if f["type"] == "Active site"]
    sites = [{"residue": sequence[f["location"]["start"]["value"] - 1], "position": f["location"]["start"]["value"], "role": f["description"]} for f in active]
    pet_reaction = next(c["reaction"] for c in uniprot["comments"] if c["commentType"] == "CATALYTIC ACTIVITY" and "ethylene terephthalate" in c["reaction"]["name"])
    rhea = next(x["id"] for x in pet_reaction["reactionCrossReferences"] if x["database"] == "Rhea" and "COMP" not in x["id"])
    assert [f"{x['residue']}{x['position']}" for x in sites] == ["S160", "D206", "H237"]
    assert rcsb["rcsb_id"] == "5XJH"
    result = {
        "showcase_id": "databases-petase",
        "retrieved_at_utc": "2026-08-29T18:15:55Z",
        "protein": {
            "uniprot_accession": uniprot["primaryAccession"],
            "entry_id": uniprot["uniProtkbId"],
            "reviewed": uniprot["entryType"] == "UniProtKB reviewed (Swiss-Prot)",
            "organism": uniprot["organism"]["scientificName"],
            "length_aa": uniprot["sequence"]["length"],
            "signal_peptide": [1, 27],
            "mature_chain": [28, 290],
            "active_sites": sites,
        },
        "catalytic_annotation": {"ec_number": pet_reaction["ecNumber"], "rhea_id": rhea, "reaction": pet_reaction["name"]},
        "structure": {
            "pdb_id": "5XJH",
            "title": rcsb["struct"]["title"],
            "method": rcsb["exptl"][0]["method"],
            "resolution_angstrom": rcsb["rcsb_entry_info"]["resolution_combined"][0],
        },
        "interpretation": "The UniProt sequence annotations identify the S160-D206-H237 catalytic triad and the PET hydrolysis reaction; 5XJH supplies a high-resolution structure record for the same enzyme.",
        "limitations": [
            "The map joins curated annotations and one structure; it does not calculate kinetics or mutation effects.",
            "Residue numbering follows the full UniProt sequence, including the 1-27 signal peptide.",
            "The preview is a project graphic, not an interactive structure-viewer capture.",
        ],
    }
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">PETase sequence-structure map</title><desc id="desc">UniProt catalytic annotations for IsPETase linked to RCSB structure 5XJH.</desc><rect width="1200" height="675" fill="#071925"/><rect x="48" y="42" width="1104" height="590" rx="26" fill="#102b38" stroke="#2c5b68"/><style>.t{font:700 39px Segoe UI,Arial;fill:#f7fbfd}.s{font:18px Segoe UI,Arial;fill:#b4c7d0}.h{font:700 18px Segoe UI,Arial;fill:#74e1bd}.v{font:700 27px Segoe UI,Arial;fill:#fff}.m{font:16px Consolas,monospace;fill:#cfdee4}</style><text x="80" y="105" class="t">IsPETase sequence–structure map</text><text x="80" y="143" class="s">UniProt A0A0K8P6T7 · RCSB 5XJH · RHEA:49528</text><line x1="160" y1="310" x2="1040" y2="310" stroke="#5a8593" stroke-width="14" stroke-linecap="round"/><circle cx="525" cy="310" r="32" fill="#f0a95f"/><circle cx="700" cy="310" r="32" fill="#dc718b"/><circle cx="820" cy="310" r="32" fill="#728fe2"/><text x="525" y="318" text-anchor="middle" class="v">S</text><text x="700" y="318" text-anchor="middle" class="v">D</text><text x="820" y="318" text-anchor="middle" class="v">H</text><text x="490" y="370" class="m">S160</text><text x="665" y="370" class="m">D206</text><text x="785" y="370" class="m">H237</text><text x="80" y="235" class="h">CURATED ACTIVE SITES ON THE 290-AA PRECURSOR</text><rect x="90" y="430" width="1020" height="125" rx="20" fill="#173746" stroke="#63b5c7"/><text x="120" y="474" class="h">RCSB PDB 5XJH</text><text x="120" y="518" class="v">Crystal structure of PETase · 1.54 Å</text><text x="120" y="550" class="m">Sequence annotations link catalysis; this case does not estimate turnover or mutation effects.</text></svg>'''
    (CASE / "previews" / "preview.svg").write_text(svg + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
