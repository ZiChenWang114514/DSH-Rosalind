#!/usr/bin/env python3
"""Compute transparent, molecule-only descriptors for three ACE inhibitors."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import Crippen, Descriptors, Lipinski, rdMolDescriptors


CASE = Path(__file__).resolve().parents[1]
INPUT = CASE / "inputs" / "compounds.csv"
OUTPUT = CASE / "outputs"
PREVIEW = CASE / "previews" / "preview.svg"


def f(value: float) -> str:
    return f"{value:.2f}"


def svg_escape(value: object) -> str:
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader(INPUT.open(encoding="utf-8", newline="")))
    results = []
    for row in rows:
        mol = Chem.MolFromSmiles(row["pubchem_smiles"])
        if mol is None:
            raise ValueError(f"invalid SMILES for {row['name']}")
        results.append({
            "name": row["name"],
            "cid": row["cid"],
            "rdkit_mol_wt": f(Descriptors.MolWt(mol)),
            "rdkit_mol_logp": f(Crippen.MolLogP(mol)),
            "rdkit_tpsa": f(rdMolDescriptors.CalcTPSA(mol)),
            "hbd": Lipinski.NumHDonors(mol),
            "hba": Lipinski.NumHAcceptors(mol),
            "rotatable_bonds": Lipinski.NumRotatableBonds(mol),
            "ring_count": Lipinski.RingCount(mol),
            "fraction_csp3": f(rdMolDescriptors.CalcFractionCSP3(mol)),
            "pubchem_xlogp": row["pubchem_xlogp"],
            "pubchem_tpsa": row["pubchem_tpsa"],
            "pka_annotation": row["pka_annotation"],
            "ph_conditioned_lipophilicity": row["ph_conditioned_lipophilicity"],
        })

    fields = list(results[0])
    with (OUTPUT / "descriptor-comparison.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(results)

    ionization = [{
        "name": row["name"],
        "pka_annotation": row["pka_annotation"],
        "source_note": row["pka_source_note"],
        "pH_conditioned_lipophilicity": row["ph_conditioned_lipophilicity"],
        "interpretation": row["interpretive_note"],
    } for row in rows]
    with (OUTPUT / "ionization-evidence.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(ionization[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(ionization)

    summary = {
        "showcase_id": "rosalind-ace-logd-pka",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "CID-exact PubChem records were retained and transformed into the descriptor and ionization evidence tables.",
        },
        "method": "PubChem PUG records plus local RDKit 2026.03.5 descriptors",
        "compound_count": len(results),
        "observations": [
            "Lisinopril has the highest PubChem TPSA (133.0 A^2) and the lowest PubChem XLogP (-2.9) in this three-compound set.",
            "Captopril has the smallest molecular weight and TPSA in the set.",
            "The retained PubChem annotations report multiple pKa values for all three compounds, supporting a multi-state ionization discussion.",
        ],
        "interpretation": "The descriptor spread is consistent with different ionization and polarity profiles, but it does not quantify plasma LogD or clinical absorption.",
        "limitations": [
            "PubChem XLogP and RDKit MolLogP are computed descriptors and are not clinical ADME measurements.",
            "The PubChem pages do not provide a uniform experimental LogD at pH 7.4 for all three compounds.",
            "Macro-pKa values alone do not uniquely assign microspecies when several ionizable sites are present.",
        ],
    }
    (OUTPUT / "result-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    table_rows = []
    y = 338
    for item in results:
        table_rows.append(
            f'<text x="82" y="{y}" class="name">{svg_escape(item["name"])}</text>'
            f'<text x="365" y="{y}" class="num">{item["rdkit_mol_wt"]}</text>'
            f'<text x="545" y="{y}" class="num">{item["pubchem_xlogp"]}</text>'
            f'<text x="700" y="{y}" class="num">{item["rdkit_mol_logp"]}</text>'
            f'<text x="850" y="{y}" class="num">{item["rdkit_tpsa"]}</text>'
            f'<text x="970" y="{y}" class="pka">{svg_escape(item["pka_annotation"])}</text>'
        )
        y += 82
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">ACE inhibitor ionization and lipophilicity comparison</title>
<desc id="desc">Data table comparing public and locally computed descriptors for captopril, enalapril, and lisinopril.</desc>
<style>.title{{font:700 38px Segoe UI,Arial;fill:#f8fafc}}.sub{{font:19px Segoe UI,Arial;fill:#9fb4c8}}.head{{font:600 17px Segoe UI,Arial;fill:#67e8f9}}.name{{font:600 20px Segoe UI,Arial;fill:#eef6ff}}.num{{font:18px Consolas,monospace;fill:#d7e3ef}}.pka{{font:16px Consolas,monospace;fill:#d7e3ef}}.foot{{font:16px Segoe UI,Arial;fill:#fbbf24}}</style>
<rect width="1200" height="675" fill="#071726"/><rect x="50" y="45" width="1100" height="585" rx="26" fill="#0b2237" stroke="#164e63"/>
<text x="78" y="105" class="title">ACE inhibitors: public evidence + local descriptors</text>
<text x="80" y="145" class="sub">CID-exact records · RDKit 2026.03.5 · no experimental LogD calculation</text>
<line x1="80" y1="210" x2="1120" y2="210" stroke="#155e75"/>
<text x="82" y="255" class="head">Compound</text><text x="365" y="255" class="head">MW</text><text x="545" y="255" class="head">PubChem XLogP</text><text x="700" y="255" class="head">RDKit LogP</text><text x="850" y="255" class="head">TPSA</text><text x="970" y="255" class="head">pKa annotations</text>
<line x1="80" y1="276" x2="1120" y2="276" stroke="#155e75"/>{''.join(table_rows)}
<text x="80" y="608" class="foot">Computed descriptors organize hypotheses; they do not establish clinical absorption or measured plasma distribution.</text>
</svg>'''
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW.write_text(svg + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
