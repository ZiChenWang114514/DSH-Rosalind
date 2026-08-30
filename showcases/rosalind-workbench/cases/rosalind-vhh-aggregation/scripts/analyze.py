#!/usr/bin/env python3
"""Calculate deterministic sequence-only VHH risk proxies."""

from __future__ import annotations

import csv
import json
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
MOTIFS = {"NG": "deamidation", "NS": "deamidation", "NT": "deamidation", "DG": "isomerization", "DS": "isomerization", "DT": "isomerization"}


def read_fasta(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    key = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(">"):
            key = line[1:].split()[0]; result[key] = ""
        elif key:
            result[key] += line.strip()
    return result


def net_charge(sequence: str, ph: float) -> float:
    counts = Counter(sequence)
    charge = 1 / (1 + 10 ** (ph - PKA["Nterm"])) - 1 / (1 + 10 ** (PKA["Cterm"] - ph))
    for aa in "HKR": charge += counts[aa] / (1 + 10 ** (ph - PKA[aa]))
    for aa in "DECY": charge -= counts[aa] / (1 + 10 ** (PKA[aa] - ph))
    return charge


def predicted_pi(sequence: str) -> float:
    low, high = 0.0, 14.0
    for _ in range(80):
        mid = (low + high) / 2
        if net_charge(sequence, mid) > 0: low = mid
        else: high = mid
    return (low + high) / 2


def top_window(sequence: str, size: int, score) -> tuple[int, str, int]:
    values = [(i + 1, sequence[i:i + size], score(sequence[i:i + size])) for i in range(len(sequence) - size + 1)]
    return max(values, key=lambda item: (item[2], -item[0]))


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    fasta = read_fasta(INPUT / "vhh-polymer-sequences.fasta")
    records = list(csv.DictReader((INPUT / "source-records.csv").open(encoding="utf-8", newline="")))
    metrics, motifs = [], []
    for record in records:
        raw = fasta[record["sequence_id"]]
        marker = record["analysis_end_motif"]
        end = raw.rfind(marker)
        if end < 0:
            raise ValueError(f"terminal motif missing from {record['sequence_id']}")
        sequence = raw[:end + len(marker)]
        hpos, hseq, hcount = top_window(sequence, 9, lambda s: sum(aa in HYDROPHOBIC for aa in s))
        cpos, cseq, cscore = top_window(sequence, 9, lambda s: abs(sum(aa in POSITIVE for aa in s) - sum(aa in NEGATIVE for aa in s)))
        cdr_match = re.search(r"C([^C]{3,40})WGQG", sequence)
        cdr_proxy = cdr_match.group(1) if cdr_match else ""
        metrics.append({
            "sequence_id": record["sequence_id"], "label": record["label"], "pdb_id": record["pdb_id"],
            "raw_polymer_length": len(raw), "analyzed_vhh_length": len(sequence), "excluded_c_terminal_residues": len(raw) - len(sequence),
            "predicted_pI": f"{predicted_pi(sequence):.2f}", "net_charge_pH7_4": f"{net_charge(sequence, 7.4):.2f}",
            "hydrophobic_fraction": f"{sum(aa in HYDROPHOBIC for aa in sequence) / len(sequence):.3f}",
            "max_hydrophobic_residues_in_9mer": hcount, "top_hydrophobic_9mer_start": hpos, "top_hydrophobic_9mer": hseq,
            "max_abs_charge_in_9mer": cscore, "top_charge_9mer_start": cpos, "top_charge_9mer": cseq,
            "cdr3_like_segment": cdr_proxy, "cdr3_like_length": len(cdr_proxy),
            "cdr3_like_hydrophobic_fraction": f"{sum(aa in HYDROPHOBIC for aa in cdr_proxy) / len(cdr_proxy):.3f}" if cdr_proxy else "",
        })
        for motif, category in MOTIFS.items():
            for match in re.finditer(f"(?={motif})", sequence):
                motifs.append({"sequence_id": record["sequence_id"], "label": record["label"], "category": category, "motif": motif, "position_1_based": match.start() + 1})
        for match in re.finditer(r"N[^P][ST]", sequence):
            motifs.append({"sequence_id": record["sequence_id"], "label": record["label"], "category": "N_linked_sequon", "motif": match.group(), "position_1_based": match.start() + 1})

    with (OUTPUT / "vhh-sequence-metrics.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(metrics[0]), lineterminator="\n"); writer.writeheader(); writer.writerows(metrics)
    with (OUTPUT / "motif-liabilities.csv").open("w", encoding="utf-8", newline="") as handle:
        fields = ["sequence_id", "label", "category", "motif", "position_1_based"]
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n"); writer.writeheader(); writer.writerows(motifs)
    summary = {
        "showcase_id": "rosalind-vhh-aggregation",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "Exact public RCSB VHH polymer sequences were retained and transformed into sequence-risk proxy tables.",
        },
        "method": "exact RCSB polymer sequences; analysis ends at terminal VTVSS; local sequence-only proxies",
        "observations": [{
            "label": row["label"], "predicted_pI": row["predicted_pI"], "net_charge_pH7_4": row["net_charge_pH7_4"],
            "max_hydrophobic_9mer": row["max_hydrophobic_residues_in_9mer"], "max_abs_charge_9mer": row["max_abs_charge_in_9mer"],
            "cdr3_like_segment": row["cdr3_like_segment"],
        } for row in metrics],
        "interpretation": "Sequences with stronger local hydrophobic or charge patches can be prioritized for structural inspection and experimental aggregation assays; these proxies do not measure exposure or aggregation.",
        "limitations": [
            "No solvent accessibility, three-dimensional patch, formulation, concentration, thermal stress, or aggregation experiment is included.",
            "The CDR3-like segment is defined only by a conserved C...WGQG sequence pattern and is not an IMGT-numbered CDR assignment.",
            "Predicted pI and net charge use simplified residue pKa values.",
            "The three VHHs bind different antigens and are not controlled variants of one scaffold.",
        ],
    }
    (OUTPUT / "result-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    rendered = []
    y = 310
    for row in metrics:
        rendered.append(f'<text x="82" y="{y}" class="name">{row["label"]}</text><text x="465" y="{y}" class="num">{row["predicted_pI"]}</text><text x="610" y="{y}" class="num">{row["net_charge_pH7_4"]}</text><text x="785" y="{y}" class="num">{row["max_hydrophobic_residues_in_9mer"]}/9</text><text x="970" y="{y}" class="num">{row["max_abs_charge_in_9mer"]}</text>')
        y += 82
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">VHH sequence aggregation-risk screen</title><desc id="desc">Sequence-only comparison of three public VHH polymer records.</desc>
<style>.title{{font:700 39px Segoe UI,Arial;fill:#f8fafc}}.sub{{font:19px Segoe UI,Arial;fill:#a9bdd0}}.head{{font:600 17px Segoe UI,Arial;fill:#67e8f9}}.name{{font:600 20px Segoe UI,Arial;fill:#f8fafc}}.num{{font:19px Consolas,monospace;fill:#dbeafe}}.foot{{font:16px Segoe UI,Arial;fill:#fbbf24}}</style><rect width="1200" height="675" fill="#071726"/><rect x="48" y="48" width="1104" height="580" rx="28" fill="#0b2237" stroke="#164e63"/><text x="80" y="108" class="title">VHH sequence risk proxies</text><text x="82" y="150" class="sub">Exact PDB polymer sequences · tags excluded at terminal VTVSS</text><line x1="80" y1="205" x2="1118" y2="205" stroke="#155e75"/><text x="82" y="250" class="head">VHH</text><text x="465" y="250" class="head">pI</text><text x="610" y="250" class="head">Charge pH 7.4</text><text x="785" y="250" class="head">Hydrophobic 9-mer</text><text x="970" y="250" class="head">|Charge| 9-mer</text>{''.join(rendered)}<text x="82" y="590" class="foot">Sequence flags nominate experiments; they do not measure aggregation or solvent exposure.</text></svg>'''
    PREVIEW.parent.mkdir(parents=True, exist_ok=True); PREVIEW.write_text(svg + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
