#!/usr/bin/env python3
"""Fetch pinned-by-accession RCSB coordinates and pinned-by-CID PubChem records."""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path


CASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = CASE_DIR / "inputs" / "case-config.json"
USER_AGENT = "GPT-Science-showcase/1.0 (public-data acquisition)"


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def fetch_json(url: str) -> dict:
    return json.loads(fetch_bytes(url).decode("utf-8"))


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    source_records: dict[str, object] = {
        "showcase_id": config["showcase_id"],
        "retrieved_on": config["retrieved_on"],
        "coordinate_format": "legacy PDB text from the current RCSB entry revision",
        "structures": [],
        "compounds": [],
    }

    for structure in config["structures"]:
        pdb_id = structure["pdb_id"].upper()
        coordinate_url = f"https://files.rcsb.org/download/{pdb_id}.pdb"
        metadata_url = f"https://data.rcsb.org/rest/v1/core/entry/{pdb_id}"
        destination = CASE_DIR / structure["file"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(fetch_bytes(coordinate_url))
        metadata = fetch_json(metadata_url)
        accession = metadata.get("rcsb_accession_info", {})
        entry_info = metadata.get("rcsb_entry_info", {})
        citation = (metadata.get("citation") or [{}])[0]
        source_records["structures"].append({
            "pdb_id": pdb_id,
            "label": structure["label"],
            "coordinate_url": coordinate_url,
            "metadata_url": metadata_url,
            "entry_url": f"https://www.rcsb.org/structure/{pdb_id}",
            "title": metadata.get("struct", {}).get("title"),
            "experimental_method": (metadata.get("exptl") or [{}])[0].get("method"),
            "resolution_angstrom": (entry_info.get("resolution_combined") or [None])[0],
            "initial_release_date": accession.get("initial_release_date"),
            "revision_date": accession.get("revision_date"),
            "major_revision": accession.get("major_revision"),
            "minor_revision": accession.get("minor_revision"),
            "pdb_doi": f"10.2210/pdb{pdb_id.lower()}/pdb",
            "primary_citation_doi": citation.get("pdbx_database_id_DOI"),
        })

    properties = (
        "Title,MolecularFormula,MolecularWeight,XLogP,TPSA,HBondDonorCount,"
        "HBondAcceptorCount,RotatableBondCount,ConnectivitySMILES,SMILES,InChIKey"
    )
    for compound in config["compounds"]:
        cid = compound["pubchem_cid"]
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/property/{properties}/JSON"
        payload = fetch_json(url)
        destination = CASE_DIR / "inputs" / f"pubchem-{compound['slug']}.json"
        destination.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        record = payload["PropertyTable"]["Properties"][0]
        source_records["compounds"].append({
            "name": compound["name"],
            "role": compound["role"],
            "pubchem_cid": cid,
            "property_url": url,
            "entry_url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}",
            "title": record.get("Title"),
            "inchi_key": record.get("InChIKey"),
        })

    metadata_path = CASE_DIR / "inputs" / "source-metadata.json"
    metadata_path.write_text(json.dumps(source_records, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"WROTE {len(config['structures'])} PDB files, {len(config['compounds'])} PubChem records, and source-metadata.json")


if __name__ == "__main__":
    main()
