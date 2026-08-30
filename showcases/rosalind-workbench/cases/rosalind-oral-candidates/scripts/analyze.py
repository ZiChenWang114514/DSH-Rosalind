#!/usr/bin/env python3
"""Build a deterministic molecule-only oral-drug descriptor comparison."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import Crippen, Descriptors, Lipinski, QED, rdMolDescriptors


CASE = Path(__file__).resolve().parents[1]
INPUT = CASE / "inputs" / "compounds.csv"
OUTPUT = CASE / "outputs"
PREVIEW = CASE / "previews" / "preview.svg"


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source_rows = list(csv.DictReader(INPUT.open(encoding="utf-8", newline="")))
    results = []
    for source in source_rows:
        mol = Chem.MolFromSmiles(source["pubchem_smiles"])
        if mol is None: raise ValueError(f"invalid SMILES for {source['name']}")
        mw = Descriptors.MolWt(mol); logp = Crippen.MolLogP(mol); tpsa = rdMolDescriptors.CalcTPSA(mol)
        hbd = Lipinski.NumHDonors(mol); hba = Lipinski.NumHAcceptors(mol); rot = Lipinski.NumRotatableBonds(mol)
        lipinski = sum((mw > 500, logp > 5, hbd > 5, hba > 10))
        veber = sum((rot > 10, tpsa > 140))
        results.append({
            "name": source["name"], "cid": source["cid"], "rdkit_mol_wt": f"{mw:.2f}",
            "rdkit_mol_logp": f"{logp:.2f}", "rdkit_tpsa": f"{tpsa:.2f}", "hbd": hbd, "hba": hba,
            "rotatable_bonds": rot, "aromatic_ring_count": Lipinski.NumAromaticRings(mol),
            "fraction_csp3": f"{rdMolDescriptors.CalcFractionCSP3(mol):.3f}", "qed": f"{QED.qed(mol):.3f}",
            "lipinski_threshold_exceedances": lipinski, "veber_threshold_exceedances": veber,
        })
    with (OUTPUT / "property-comparison.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(results[0]), lineterminator="\n"); writer.writeheader(); writer.writerows(results)
    summary = {
        "showcase_id": "rosalind-oral-candidates",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "Five CID-exact public compound records were retained and transformed into the molecular-property comparison.",
        },
        "method": "exact PubChem structures; local RDKit 2026.03.5 descriptors and explicit thresholds",
        "thresholds": {"Lipinski": "MW > 500; MolLogP > 5; HBD > 5; HBA > 10", "Veber_style": "rotatable bonds > 10; TPSA > 140 A^2"},
        "observations": [
            f"{row['name']}: {row['lipinski_threshold_exceedances']} Lipinski and {row['veber_threshold_exceedances']} Veber-style threshold exceedances."
            for row in results
        ],
        "interpretation": "The five reference drugs occupy a broad descriptor range despite oral administration, illustrating that simple thresholds are filters rather than clinical absorption models.",
        "limitations": [
            "The comparison omits solid state, salt form, formulation, dissolution, permeability, transporters, metabolism, dose, and exposure.",
            "QED and all listed descriptors are computed molecule-level quantities, without clinical ADME measurement.",
            "Threshold exceedances do not rank efficacy, safety, developability, or probability of oral success.",
            "All five entries are reference drugs, not prospectively selected development candidates.",
        ],
    }
    (OUTPUT / "result-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    render = []
    y = 305
    for row in results:
        render.append(f'<text x="78" y="{y}" class="name">{row["name"]}</text><text x="350" y="{y}" class="num">{row["rdkit_mol_wt"]}</text><text x="505" y="{y}" class="num">{row["rdkit_mol_logp"]}</text><text x="655" y="{y}" class="num">{row["rdkit_tpsa"]}</text><text x="805" y="{y}" class="num">{row["rotatable_bonds"]}</text><text x="970" y="{y}" class="num">{row["lipinski_threshold_exceedances"]} / {row["veber_threshold_exceedances"]}</text>')
        y += 60
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">Five oral-drug property profiles</title><desc id="desc">Locally computed descriptor comparison of five exact PubChem compound records.</desc><style>.title{{font:700 38px Segoe UI,Arial;fill:#f8fafc}}.sub{{font:19px Segoe UI,Arial;fill:#a9bdd0}}.head{{font:600 16px Segoe UI,Arial;fill:#67e8f9}}.name{{font:600 18px Segoe UI,Arial;fill:#f8fafc}}.num{{font:18px Consolas,monospace;fill:#dbeafe}}.foot{{font:16px Segoe UI,Arial;fill:#fbbf24}}</style><rect width="1200" height="675" fill="#071726"/><rect x="45" y="45" width="1110" height="585" rx="28" fill="#0b2237" stroke="#164e63"/><text x="76" y="105" class="title">Five oral-drug property profiles</text><text x="78" y="145" class="sub">Exact PubChem CIDs · RDKit 2026.03.5 · molecule-only comparison</text><line x1="76" y1="194" x2="1120" y2="194" stroke="#155e75"/><text x="78" y="240" class="head">Compound</text><text x="350" y="240" class="head">MW</text><text x="505" y="240" class="head">LogP</text><text x="655" y="240" class="head">TPSA</text><text x="805" y="240" class="head">RotB</text><text x="970" y="240" class="head">Lipinski / Veber flags</text>{''.join(render)}<text x="78" y="592" class="foot">Descriptor thresholds organize comparison; they do not predict clinical oral exposure.</text></svg>'''
    PREVIEW.parent.mkdir(parents=True, exist_ok=True); PREVIEW.write_text(svg + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
