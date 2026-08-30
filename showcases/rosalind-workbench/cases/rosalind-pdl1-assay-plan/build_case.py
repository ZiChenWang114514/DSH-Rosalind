#!/usr/bin/env python3
"""Generate the inspectable PD-L1 candidate assay plan and plate map."""

from __future__ import annotations

import csv
import json
from pathlib import Path


CASE_DIR = Path(__file__).resolve().parent
CANDIDATES = ["NB13_E104Q", "NB16_L110I", "NB17_V111I", "NB05_S31N", "NB11_F103Y", "KN035_parent"]
CONCENTRATIONS_NM = [0.3, 1, 3, 10, 30, 100]


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    wells = [f"{row}{column}" for row in "ABCDEFGH" for column in range(1, 13)]
    records = []
    cursor = 0
    for candidate in CANDIDATES:
        for concentration in CONCENTRATIONS_NM:
            for replicate in (1, 2):
                records.append(
                    {
                        "well": wells[cursor],
                        "class": "candidate",
                        "candidate": candidate,
                        "concentration_nM": concentration,
                        "replicate": replicate,
                        "purpose": "PD-1/PD-L1 competitive ELISA dose response",
                    }
                )
                cursor += 1
    controls = [
        ("no_inhibitor", "PD-L1 plus PD-1; maximum-signal control"),
        ("no_pdl1", "PD-1 detection mixture without PD-L1"),
        ("blank", "buffer and detection reagents only"),
    ]
    for control, purpose in controls:
        for replicate in range(1, 9):
            records.append(
                {
                    "well": wells[cursor],
                    "class": "control",
                    "candidate": control,
                    "concentration_nM": "",
                    "replicate": replicate,
                    "purpose": purpose,
                }
            )
            cursor += 1
    if cursor != 96:
        raise RuntimeError(f"Expected 96 wells, assigned {cursor}")

    plate_path = CASE_DIR / "outputs" / "competitive-elisa-plate-map.csv"
    plate_path.parent.mkdir(parents=True, exist_ok=True)
    with plate_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(records[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(records)

    plan = {
        "showcase_id": "rosalind-pdl1-assay-plan",
        "evidence_class": "experimental plan; no wet-lab measurements",
        "candidate_panel": CANDIDATES,
        "candidate_basis": "five candidates prioritized by the retained Boltz-2 ensemble case plus the KN035 parent control",
        "stages": [
            {
                "stage": 1,
                "name": "expression and sample quality",
                "measurements": ["yield", "analytical SEC monomer fraction", "DSF or nanoDSF melting transition"],
                "decision_rule": "Do not interpret weak binding for a sample that fails identity or monodispersity checks.",
            },
            {
                "stage": 2,
                "name": "direct binding by BLI",
                "proposed_setup": "biotinylated human PD-L1 extracellular domain on streptavidin sensors; monomeric VHH in solution",
                "proposed_analyte_concentrations_nM": [0.625, 1.25, 2.5, 5, 10],
                "association_seconds": 120,
                "dissociation_seconds": 320,
                "controls": ["reference sensor", "KN035 parent", "nonbinding VHH", "buffer-only analyte"],
                "reported_outputs": ["raw sensorgrams", "reference-subtracted sensorgrams", "kon", "koff", "KD", "fit residuals"],
                "note": "Concentrations and immobilization format are proposed for this plan and require pilot optimization.",
            },
            {
                "stage": 3,
                "name": "PD-1/PD-L1 competitive ELISA",
                "plate_design": {
                    "candidates": 6,
                    "concentrations_nM": CONCENTRATIONS_NM,
                    "technical_replicates": 2,
                    "candidate_wells": 72,
                    "control_wells": 24,
                    "total_wells": 96,
                },
                "reported_outputs": ["background-subtracted absorbance", "four-parameter dose-response fit", "IC50 with confidence interval"],
            },
            {
                "stage": 4,
                "name": "cell-surface orthogonal check",
                "proposal": "flow cytometry on PD-L1-positive and matched PD-L1-negative cells, with viability and isotype controls",
                "reported_outputs": ["median fluorescence intensity", "specific-to-negative-cell signal ratio", "replicate variability"],
            },
        ],
        "decision_sequence": [
            "Review sample quality before affinity ranking.",
            "Require interpretable sensorgrams and acceptable residuals before quoting kinetic constants.",
            "Compare direct binding with competitive inhibition; discordant candidates require investigation.",
            "Advance candidates only after a cell-surface specificity check.",
        ],
        "procurement": {
            "vendor_quotes_collected": False,
            "cost_claim": "No purchasing price is reported.",
            "quote_inputs_needed": ["protein format and purity", "biosensor type and pack size", "plate and detection chemistry", "instrument access", "replicate count"],
        },
        "wet_lab_executed": False,
    }
    write_text(CASE_DIR / "outputs" / "assay-plan.json", json.dumps(plan, indent=2) + "\n")

    dots = []
    palette = {"candidate": "#22d3ee", "no_inhibitor": "#fbbf24", "no_pdl1": "#a78bfa", "blank": "#64748b"}
    for record in records:
        row = "ABCDEFGH".index(record["well"][0])
        column = int(record["well"][1:]) - 1
        key = record["class"] if record["class"] == "candidate" else record["candidate"]
        dots.append(f'<circle cx="{590 + column * 42}" cy="{270 + row * 42}" r="13" fill="{palette[key]}"/>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">PD-L1 nanobody assay plan</title><desc id="desc">A four-stage experimental plan and a complete 96-well competitive ELISA layout for five predicted candidates plus KN035.</desc>
<rect width="1200" height="675" fill="#071522"/><style>.k{{font:600 21px Segoe UI,Arial;fill:#67e8f9}}.t{{font:700 42px Segoe UI,Arial;fill:#f8fafc}}.b{{font:22px Segoe UI,Arial;fill:#cbd5e1}}.s{{font:17px Segoe UI,Arial;fill:#cbd5e1}}</style>
<text x="64" y="75" class="k">PD-L1 · KN035-DERIVED PANEL</text><text x="64" y="132" class="t">Orthogonal assay plan</text>
<rect x="64" y="190" width="430" height="350" rx="22" fill="#0f2538" stroke="#164e63"/>
<text x="96" y="245" class="b">1 · SEC + DSF sample quality</text><text x="96" y="315" class="b">2 · Direct binding by BLI</text><text x="96" y="385" class="b">3 · Competitive ELISA</text><text x="96" y="455" class="b">4 · Cell-surface specificity</text>
<path d="M105 266 V292 M105 336 V362 M105 406 V432" stroke="#22d3ee" stroke-width="4"/>
<text x="565" y="220" class="b">96-well competitive ELISA plan</text>{''.join(dots)}
<circle cx="570" cy="625" r="9" fill="#22d3ee"/><text x="588" y="631" class="s">72 candidate wells</text><circle cx="790" cy="625" r="9" fill="#fbbf24"/><text x="808" y="631" class="s">24 controls</text>
<text x="64" y="610" class="s">Planning evidence only · no binding, affinity, inhibition, or pricing result</text>
</svg>'''
    write_text(CASE_DIR / "previews" / "preview.svg", svg + "\n")


if __name__ == "__main__":
    main()
