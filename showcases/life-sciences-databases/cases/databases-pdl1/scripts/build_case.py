#!/usr/bin/env python3
"""Build the PD-L1 sequence and structure summary from retained API responses."""

from __future__ import annotations

import json
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
INPUT = CASE / "inputs"
OUTPUT = CASE / "outputs"


def main() -> None:
    uniprot = json.loads((INPUT / "uniprot-Q9NZQ7.json").read_text(encoding="utf-8"))
    rcsb = json.loads((INPUT / "rcsb-5J89.json").read_text(encoding="utf-8"))
    assert uniprot["primaryAccession"] == "Q9NZQ7"
    assert rcsb["rcsb_id"] == "5J89"

    features = {}
    for feature in uniprot["features"]:
        if feature["type"] in {"Signal", "Topological domain", "Transmembrane"}:
            label = feature.get("description") or feature["type"]
            features[label] = [feature["location"]["start"]["value"], feature["location"]["end"]["value"]]
    result = {
        "showcase_id": "databases-pdl1",
        "retrieved_at_utc": "2026-08-29T18:15:55Z",
        "protein": {
            "uniprot_accession": "Q9NZQ7",
            "entry_id": uniprot["uniProtkbId"],
            "recommended_name": uniprot["proteinDescription"]["recommendedName"]["fullName"]["value"],
            "gene": uniprot["genes"][0]["geneName"]["value"],
            "reviewed": uniprot["entryType"] == "UniProtKB reviewed (Swiss-Prot)",
            "length_aa": uniprot["sequence"]["length"],
            "signal_peptide": features["Signal"],
            "extracellular_domain": features["Extracellular"],
            "transmembrane_helix": features["Helical"],
            "cytoplasmic_domain": features["Cytoplasmic"],
        },
        "structure": {
            "pdb_id": "5J89",
            "title": rcsb["struct"]["title"],
            "method": rcsb["exptl"][0]["method"],
            "resolution_angstrom": rcsb["rcsb_entry_info"]["resolution_combined"][0],
        },
        "interpretation": "The UniProt topology record identifies the full-length membrane protein, while 5J89 provides a structure-level observation of a low-molecular-mass inhibitor bound to PD-L1.",
        "limitations": [
            "The retained RCSB entry is one inhibitor-bound crystal structure and does not measure cellular checkpoint inhibition.",
            "UniProt topology annotations describe the canonical sequence and do not represent every proteoform or glycoform.",
            "No affinity value, clinical response, or nanobody ranking is inferred.",
        ],
    }
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">PD-L1 sequence and structure records</title><desc id="desc">A topology strip for human PD-L1 linked to inhibitor-bound structure 5J89.</desc><rect width="1200" height="675" fill="#0a1525"/><rect x="48" y="42" width="1104" height="590" rx="26" fill="#12253d" stroke="#34516c"/><style>.t{font:700 39px Segoe UI,Arial;fill:#f8fbff}.s{font:18px Segoe UI,Arial;fill:#adbed1}.h{font:700 18px Segoe UI,Arial;fill:#7ee6d1}.v{font:700 25px Segoe UI,Arial;fill:#fff}.m{font:16px Consolas,monospace;fill:#c8d6e5}</style><text x="80" y="105" class="t">Human PD-L1 · Q9NZQ7</text><text x="80" y="143" class="s">Reviewed 290-aa CD274 record linked to inhibitor-bound crystal structure 5J89</text><text x="80" y="225" class="h">UNIPROT TOPOLOGY</text><rect x="90" y="270" width="58" height="60" rx="8" fill="#f2b85e"/><rect x="148" y="270" width="704" height="60" rx="8" fill="#48b9aa"/><rect x="852" y="270" width="67" height="60" rx="8" fill="#de6d8a"/><rect x="919" y="270" width="101" height="60" rx="8" fill="#6d87d9"/><text x="90" y="360" class="m">1–18 signal</text><text x="320" y="360" class="m">19–238 extracellular</text><text x="828" y="360" class="m">239–259 TM</text><text x="930" y="360" class="m">260–290 cytoplasmic</text><rect x="90" y="430" width="930" height="125" rx="20" fill="#172f4a" stroke="#77a8d6"/><text x="120" y="472" class="h">RCSB PDB 5J89</text><text x="120" y="516" class="v">PD-L1 with a low-molecular-mass inhibitor</text><text x="120" y="547" class="m">X-ray diffraction · 2.20 Å</text><text x="80" y="605" class="s">Structural binding is observed here; affinity, cellular activity, and clinical response are not inferred.</text></svg>'''
    (CASE / "previews" / "preview.svg").write_text(svg + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
