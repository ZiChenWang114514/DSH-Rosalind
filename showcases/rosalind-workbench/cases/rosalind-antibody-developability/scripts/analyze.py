#!/usr/bin/env python3
"""Calculate transparent sequence-liability proxies for antibody variable domains."""

from __future__ import annotations

import csv
import json
import math
import re
from collections import Counter
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
INPUT = CASE / "inputs"
OUTPUT = CASE / "outputs"
PREVIEW = CASE / "previews" / "preview.svg"
HYDROPHOBIC = set("AVILMFWY")
POSITIVE = set("KR")
NEGATIVE = set("DE")
PKA = {"Cterm": 3.55, "D": 3.65, "E": 4.25, "C": 8.18, "Y": 10.07, "H": 6.00, "Nterm": 7.50, "K": 10.53, "R": 12.48}
MOTIFS = {
    "deamidation_NG": "NG",
    "deamidation_NS": "NS",
    "deamidation_NT": "NT",
    "isomerization_DG": "DG",
    "isomerization_DS": "DS",
    "isomerization_DT": "DT",
}


def read_fasta(path: Path) -> dict[str, str]:
    records: dict[str, str] = {}
    current = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(">"):
            current = line[1:].split()[0]
            records[current] = ""
        elif current:
            records[current] += line.strip()
    return records


def net_charge(sequence: str, ph: float) -> float:
    counts = Counter(sequence)
    charge = 1 / (1 + 10 ** (ph - PKA["Nterm"]))
    charge -= 1 / (1 + 10 ** (PKA["Cterm"] - ph))
    for aa in "HKR":
        charge += counts[aa] / (1 + 10 ** (ph - PKA[aa]))
    for aa in "DECY":
        charge -= counts[aa] / (1 + 10 ** (PKA[aa] - ph))
    return charge


def predicted_pi(sequence: str) -> float:
    low, high = 0.0, 14.0
    for _ in range(80):
        mid = (low + high) / 2
        if net_charge(sequence, mid) > 0:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def max_window(sequence: str, size: int, score) -> tuple[int, str, float]:
    candidates = [(i + 1, sequence[i:i + size], score(sequence[i:i + size])) for i in range(len(sequence) - size + 1)]
    return max(candidates, key=lambda item: (item[2], -item[0]))


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sequences = read_fasta(INPUT / "antibody-chains.fasta")
    records = list(csv.DictReader((INPUT / "source-records.csv").open(encoding="utf-8", newline="")))
    metrics = []
    liabilities = []
    for record in records:
        sequence = sequences[record["sequence_id"]][:int(record["variable_length"])]
        hpos, hseq, hcount = max_window(sequence, 9, lambda s: sum(aa in HYDROPHOBIC for aa in s))
        cpos, cseq, cscore = max_window(sequence, 9, lambda s: abs(sum(aa in POSITIVE for aa in s) - sum(aa in NEGATIVE for aa in s)))
        glyco = [(match.start() + 1, match.group()) for match in re.finditer(r"N[^P][ST]", sequence)]
        metric = {
            "sequence_id": record["sequence_id"],
            "antibody": record["antibody"],
            "chain_type": record["chain_type"],
            "variable_length": len(sequence),
            "predicted_pI": f"{predicted_pi(sequence):.2f}",
            "net_charge_pH7_4": f"{net_charge(sequence, 7.4):.2f}",
            "hydrophobic_fraction": f"{sum(aa in HYDROPHOBIC for aa in sequence) / len(sequence):.3f}",
            "max_hydrophobic_residues_in_9mer": int(hcount),
            "top_hydrophobic_9mer_start": hpos,
            "top_hydrophobic_9mer": hseq,
            "max_abs_charge_in_9mer": int(cscore),
            "top_charge_9mer_start": cpos,
            "top_charge_9mer": cseq,
            "oxidation_M_count": sequence.count("M"),
            "oxidation_W_count": sequence.count("W"),
            "n_linked_sequon_count": len(glyco),
        }
        metrics.append(metric)
        for label, motif in MOTIFS.items():
            for match in re.finditer(f"(?={motif})", sequence):
                liabilities.append({
                    "sequence_id": record["sequence_id"],
                    "antibody": record["antibody"],
                    "chain_type": record["chain_type"],
                    "liability_proxy": label,
                    "motif": motif,
                    "position_1_based": match.start() + 1,
                })
        for pos, motif in glyco:
            liabilities.append({
                "sequence_id": record["sequence_id"], "antibody": record["antibody"],
                "chain_type": record["chain_type"], "liability_proxy": "N_linked_sequon",
                "motif": motif, "position_1_based": pos,
            })

    with (OUTPUT / "sequence-metrics.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(metrics[0]), lineterminator="\n")
        writer.writeheader(); writer.writerows(metrics)
    liability_fields = ["sequence_id", "antibody", "chain_type", "liability_proxy", "motif", "position_1_based"]
    with (OUTPUT / "motif-liabilities.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=liability_fields, lineterminator="\n")
        writer.writeheader(); writer.writerows(liabilities)

    aggregate = {}
    for antibody in sorted({item["antibody"] for item in metrics}):
        subset = [item for item in metrics if item["antibody"] == antibody]
        aggregate[antibody] = {
            "variable_residues": sum(int(item["variable_length"]) for item in subset),
            "motif_flags": sum(1 for item in liabilities if item["antibody"] == antibody),
            "largest_hydrophobic_9mer_count": max(int(item["max_hydrophobic_residues_in_9mer"]) for item in subset),
            "largest_abs_charge_9mer": max(int(item["max_abs_charge_in_9mer"]) for item in subset),
        }
    summary = {
        "showcase_id": "rosalind-antibody-developability",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "Exact public RCSB Fab-chain sequences were retained and transformed into sequence-metric and motif-liability tables.",
        },
        "method": "exact RCSB chain sequences; local deterministic sequence calculations",
        "antibody_summary": aggregate,
        "interpretation": "The tables identify sequence regions for targeted experimental follow-up. Fewer motif flags do not establish superior developability.",
        "limitations": [
            "The analysis does not include solvent exposure, formulation, concentration, glycosylation state, expression host, or conformational dynamics.",
            "Predicted pI and charge-window values use simple residue pKa assumptions.",
            "Motif presence is a screening flag and does not demonstrate chemical degradation.",
            "No laboratory developability, stability, viscosity, aggregation, or pharmacokinetic measurement was performed.",
        ],
    }
    (OUTPUT / "result-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    panels = []
    y = 305
    for antibody, item in aggregate.items():
        panels.append(f'<text x="92" y="{y}" class="name">{antibody}</text>'
                      f'<text x="520" y="{y}" class="num">{item["motif_flags"]}</text>'
                      f'<text x="710" y="{y}" class="num">{item["largest_hydrophobic_9mer_count"]}/9</text>'
                      f'<text x="930" y="{y}" class="num">{item["largest_abs_charge_9mer"]}</text>')
        y += 110
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Therapeutic antibody sequence-liability comparison</title><desc id="desc">Comparison of sequence motif flags and local hydrophobic and charge windows for two Fab variable-domain pairs.</desc>
<style>.title{{font:700 38px Segoe UI,Arial;fill:#f8fafc}}.sub{{font:19px Segoe UI,Arial;fill:#a9bdd0}}.head{{font:600 17px Segoe UI,Arial;fill:#67e8f9}}.name{{font:600 21px Segoe UI,Arial;fill:#f8fafc}}.num{{font:20px Consolas,monospace;fill:#dbeafe}}.foot{{font:16px Segoe UI,Arial;fill:#fbbf24}}</style>
<rect width="1200" height="675" fill="#071726"/><rect x="50" y="48" width="1100" height="580" rx="28" fill="#0b2237" stroke="#164e63"/>
<text x="82" y="108" class="title">Antibody variable-domain sequence screen</text><text x="84" y="150" class="sub">Exact RCSB chains · deterministic motif and window calculations</text>
<line x1="82" y1="205" x2="1115" y2="205" stroke="#155e75"/><text x="92" y="245" class="head">Fab pair</text><text x="520" y="245" class="head">Motif flags</text><text x="710" y="245" class="head">Max hydrophobic 9-mer</text><text x="930" y="245" class="head">Max |charge| 9-mer</text>{''.join(panels)}
<text x="84" y="580" class="foot">These are sequence-derived follow-up flags, without laboratory developability evidence.</text></svg>'''
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW.write_text(svg + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
