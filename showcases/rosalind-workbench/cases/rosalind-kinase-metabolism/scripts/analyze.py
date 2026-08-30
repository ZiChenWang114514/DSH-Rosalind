#!/usr/bin/env python3
"""Join official metabolism evidence with transparent local structure queries."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import Crippen, Descriptors, Lipinski, rdMolDescriptors


CASE = Path(__file__).resolve().parents[1]
INPUT = CASE / "inputs"
OUTPUT = CASE / "outputs"
PREVIEW = CASE / "previews" / "preview.svg"
ALERTS = {
    "tertiary_amine_dealkylation_prompt": ("[NX3;H0;!$(N-C=O)]", "tertiary amine; review possible N-dealkylation evidence"),
    "aryl_alkyl_ether_prompt": ("[c][OX2][CX4]", "aryl-alkyl ether; review possible O-dealkylation evidence"),
    "benzylic_sp3_prompt": ("[c][CX4;H1,H2,H3]", "benzylic sp3 carbon; review oxidation evidence"),
    "terminal_alkyne_prompt": ("[C]#[CH]", "terminal alkyne; review mechanism-based reactivity evidence"),
    "michael_acceptor_prompt": ("[C,c]=[C,c][C](=O)[N,O,S]", "alpha,beta-unsaturated carbonyl; review covalent/reactivity evidence"),
}


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    compounds = list(csv.DictReader((INPUT / "compounds.csv").open(encoding="utf-8", newline="")))
    evidence = {row["name"]: row for row in csv.DictReader((INPUT / "metabolism-evidence.csv").open(encoding="utf-8", newline=""))}
    descriptors, hits, comparison = [], [], []
    patterns = {name: (Chem.MolFromSmarts(smarts), smarts, note) for name, (smarts, note) in ALERTS.items()}
    if any(pattern is None for pattern, _, _ in patterns.values()):
        raise ValueError("one or more SMARTS patterns failed to parse")
    for row in compounds:
        mol = Chem.MolFromSmiles(row["pubchem_smiles"])
        if mol is None: raise ValueError(f"invalid SMILES for {row['name']}")
        descriptor = {
            "name": row["name"], "cid": row["cid"], "rdkit_mol_wt": f"{Descriptors.MolWt(mol):.2f}",
            "rdkit_mol_logp": f"{Crippen.MolLogP(mol):.2f}", "rdkit_tpsa": f"{rdMolDescriptors.CalcTPSA(mol):.2f}",
            "hbd": Lipinski.NumHDonors(mol), "hba": Lipinski.NumHAcceptors(mol),
            "rotatable_bonds": Lipinski.NumRotatableBonds(mol), "aromatic_ring_count": Lipinski.NumAromaticRings(mol),
        }
        descriptors.append(descriptor)
        active = []
        for alert, (pattern, smarts, note) in patterns.items():
            matches = mol.GetSubstructMatches(pattern)
            hits.append({"name": row["name"], "alert_id": alert, "smarts": smarts, "match_count": len(matches), "interpretation": note})
            if matches: active.append(alert)
        source = evidence[row["name"]]
        comparison.append({
            "name": row["name"], "dailyMed_observation": source["observed_statement"],
            "local_structure_prompts": "; ".join(active) if active else "none in defined query set",
            "evidence_url": source["source_url"],
        })
    for name, rows in (("descriptors.csv", descriptors), ("structural-alerts.csv", hits), ("metabolism-review.csv", comparison)):
        with (OUTPUT / name).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n"); writer.writeheader(); writer.writerows(rows)
    summary = {
        "showcase_id": "rosalind-kinase-metabolism",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "CID-exact PubChem structures and official DailyMed metabolism statements were retained and joined to local SMARTS results.",
        },
        "method": "exact PubChem structures + official DailyMed statements + local RDKit SMARTS queries",
        "compound_count": len(compounds),
        "observations": [row["dailyMed_observation"] for row in comparison],
        "interpretation": "The labels establish enzyme-related evidence. SMARTS matches identify structural regions for review and do not predict enzyme specificity or clearance.",
        "limitations": [
            "SMARTS hits are uncalibrated prompts and may be false positives or miss relevant metabolic sites.",
            "No metabolite ranking, intrinsic clearance, microsomal stability, transporter effect, or clinical exposure was calculated.",
            "PubChem and RDKit lipophilicity values are computed descriptors.",
            "Label statements are product-specific evidence and can be revised after the retrieval date.",
        ],
    }
    (OUTPUT / "result-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    render = []
    y = 320
    for item in comparison:
        count = sum(1 for hit in hits if hit["name"] == item["name"] and hit["match_count"])
        logp = next(row["rdkit_mol_logp"] for row in descriptors if row["name"] == item["name"])
        render.append(f'<text x="88" y="{y}" class="name">{item["name"]}</text><text x="430" y="{y}" class="num">{logp}</text><text x="620" y="{y}" class="num">{count}</text><text x="790" y="{y}" class="evidence">DailyMed + PubChem</text>')
        y += 84
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">Kinase inhibitor metabolism-evidence review</title><desc id="desc">Comparison of public label evidence and local structural review prompts for three kinase inhibitors.</desc><style>.title{{font:700 38px Segoe UI,Arial;fill:#f8fafc}}.sub{{font:19px Segoe UI,Arial;fill:#a9bdd0}}.head{{font:600 17px Segoe UI,Arial;fill:#67e8f9}}.name{{font:600 21px Segoe UI,Arial;fill:#f8fafc}}.num{{font:20px Consolas,monospace;fill:#dbeafe}}.evidence{{font:18px Segoe UI,Arial;fill:#99f6e4}}.foot{{font:16px Segoe UI,Arial;fill:#fbbf24}}</style><rect width="1200" height="675" fill="#071726"/><rect x="48" y="48" width="1104" height="580" rx="28" fill="#0b2237" stroke="#164e63"/><text x="80" y="108" class="title">Kinase inhibitor metabolism review</text><text x="82" y="150" class="sub">Official label evidence joined to transparent structure queries</text><line x1="80" y1="205" x2="1118" y2="205" stroke="#155e75"/><text x="88" y="260" class="head">Compound</text><text x="430" y="260" class="head">RDKit LogP</text><text x="620" y="260" class="head">Matched query types</text><text x="790" y="260" class="head">Evidence retained</text>{''.join(render)}<text x="82" y="590" class="foot">A SMARTS hit is a review prompt; it is not a metabolism or clearance prediction.</text></svg>'''
    PREVIEW.parent.mkdir(parents=True, exist_ok=True); PREVIEW.write_text(svg + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
