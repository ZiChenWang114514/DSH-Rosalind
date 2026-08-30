#!/usr/bin/env python3
"""Build two deterministic, sequence-derived row-grouping plans for human RAS."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path


CASE = Path(__file__).resolve().parent
SOURCE = CASE.parent / "sequence-ras-alignment" / "inputs" / "human-RAS-UniProt-SV1.aln-fasta"
INPUT = CASE / "inputs" / "human-RAS-UniProt-SV1.aln-fasta"
EXPECTED_SHA256 = "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f"
ORDER = ["P01116", "P01111", "P01112"]


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def parse_fasta(text: str) -> dict[str, str]:
    records: dict[str, str] = {}
    name = ""
    for line in text.splitlines():
        if line.startswith(">"):
            name = line[1:].split()[0]
            records[name] = ""
        elif line.strip():
            records[name] += line.strip()
    return records


def main() -> None:
    source_bytes = SOURCE.read_bytes().replace(b"\r\n", b"\n")
    if sha256(source_bytes) != EXPECTED_SHA256:
        raise SystemExit("RAS alignment checksum mismatch")
    INPUT.parent.mkdir(parents=True, exist_ok=True)
    INPUT.write_bytes(source_bytes)
    aligned = parse_fasta(source_bytes.decode("utf-8"))
    if list(aligned) != ORDER:
        raise SystemExit("unexpected row order")

    metrics: list[dict[str, object]] = []
    for accession in ORDER:
        protein = aligned[accession].replace("-", "")
        if len(protein) != 189:
            raise SystemExit(f"unexpected protein length for {accession}")
        hvr = protein[165:185]
        pre_caax = protein[165:-4]
        basic = sum(residue in "KR" for residue in hvr)
        cysteines = pre_caax.count("C")
        metrics.append({
            "accession": accession,
            "original_row_index_0based": ORDER.index(accession),
            "hvr_window_residues_166_185": hvr,
            "basic_K_or_R_count": basic,
            "pre_CAAX_cysteine_count": cysteines,
            "CAAX_residues_186_189": protein[-4:],
            "basicity_group": "high-basicity" if basic >= 6 else "lower-basicity",
            "pre_CAAX_cysteine_group": "two-cysteines" if cysteines == 2 else "one-cysteine",
        })

    output_dir = CASE / "outputs"
    output_dir.mkdir(exist_ok=True)
    with (output_dir / "row-metrics-and-groups.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(metrics[0]))
        writer.writeheader()
        writer.writerows(metrics)

    plans = {
        "hvr-basicity": {
            "rule": "count K or R in ungapped residues 166..185; high-basicity if count >= 6",
            "groups": {
                "high-basicity": [row["accession"] for row in metrics if row["basicity_group"] == "high-basicity"],
                "lower-basicity": [row["accession"] for row in metrics if row["basicity_group"] == "lower-basicity"],
            },
        },
        "pre-caax-cysteines": {
            "rule": "count cysteine from residue 166 through the residue immediately before the terminal CAAX motif",
            "groups": {
                "one-cysteine": [row["accession"] for row in metrics if row["pre_CAAX_cysteine_group"] == "one-cysteine"],
                "two-cysteines": [row["accession"] for row in metrics if row["pre_CAAX_cysteine_group"] == "two-cysteines"],
            },
        },
    }
    result = {
        "showcase_id": "sequence-row-groups",
        "source_sha256": EXPECTED_SHA256,
        "original_row_order": ORDER,
        "row_order_after_group_assignment": ORDER,
        "order_preserved": True,
        "metrics": metrics,
        "grouping_plans": plans,
        "execution": {
            "status": "verified local computation",
            "tool": "Python 3 standard library",
            "viewer_operation": "sequence.edit_copy row-group operations were rehearsed; no live copy was changed",
        },
        "interpretation": "The two plans expose contrasting hypervariable-region composition without relabeling the rows as evolutionary or clinical classes.",
        "limitations": [
            "The thresholds are transparent teaching rules for three sequences, not learned biological classifiers.",
            "Counts do not establish post-translational modification or membrane localization.",
        ],
    }
    (output_dir / "row-group-plan.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    provenance = {
        "author": "Codex",
        "created": "2026-08-30",
        "source_case": "sequence-ras-alignment",
        "source_sha256": EXPECTED_SHA256,
        "public_records": [
            "https://rest.uniprot.org/uniprotkb/P01116.fasta",
            "https://rest.uniprot.org/uniprotkb/P01111.fasta",
            "https://rest.uniprot.org/uniprotkb/P01112.fasta",
        ],
        "derivation": "ungap each 189-aa record, inspect residues 166..185 and terminal residues 186..189, then assign explicit rule-based groups",
        "rosalind_observation": {
            "path": "outputs/rosalind-open-observation.json",
            "tool": "mcp__rosalind__rosalind_open",
            "scientific_job_executed": False,
            "note": "The observed ready response documents only the task chooser; the local script produced the grouping plans.",
        },
        "viewer_status": "rehearsed",
    }
    (output_dir / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")

    preview = '''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc"><title id="title">Human RAS row grouping plans</title><desc id="desc">Two transparent grouping schemes based on hypervariable-region basic-residue and pre-CAAX cysteine counts while preserving row order.</desc>
<rect width="1200" height="760" rx="28" fill="#08131f"/><rect x="48" y="44" width="1104" height="672" rx="22" fill="#102238" stroke="#2d4964"/><style>.s{font-family:Segoe UI,Arial,sans-serif}.m{font-family:Consolas,monospace}.w{fill:#f3f7fb}.d{fill:#a6bad0}.g{fill:#55ddb0}.a{fill:#ffcb6b}.b{fill:#76a9ff}.p{fill:#142d47;stroke:#315472}</style>
<text x="82" y="102" class="s g" font-size="21" font-weight="700">ALIGNMENT ROW GROUPS · ORDER PRESERVED</text><text x="82" y="154" class="s w" font-size="38" font-weight="700">RAS hypervariable-region comparisons</text><text x="82" y="196" class="s d" font-size="18">Rows remain P01116 → P01111 → P01112 in both plans</text>
<rect x="78" y="232" width="504" height="354" rx="16" class="p"/><text x="106" y="275" class="s w" font-size="22" font-weight="650">Plan A · K/R count in residues 166–185</text><text x="106" y="316" class="s a" font-size="18">High basicity · count ≥ 6</text><text x="132" y="354" class="m w" font-size="19">P01116  count 8</text><text x="106" y="410" class="s b" font-size="18">Lower basicity · count &lt; 6</text><text x="132" y="448" class="m w" font-size="19">P01111  count 3</text><text x="132" y="484" class="m w" font-size="19">P01112  count 4</text><text x="106" y="548" class="s d" font-size="15">Transparent threshold; teaching use only.</text>
<rect x="610" y="232" width="512" height="354" rx="16" class="p"/><text x="638" y="275" class="s w" font-size="22" font-weight="650">Plan B · cysteines before terminal CAAX</text><text x="638" y="316" class="s g" font-size="18">One cysteine</text><text x="664" y="354" class="m w" font-size="19">P01116  …GCVKIKK | CIIM</text><text x="664" y="390" class="m w" font-size="19">P01111  …QGCMGLP | CVVM</text><text x="638" y="446" class="s a" font-size="18">Two cysteines</text><text x="664" y="484" class="m w" font-size="19">P01112  …GCMSCK | CVLS</text><text x="638" y="548" class="s d" font-size="15">Counts do not prove modification state.</text>
<text x="82" y="640" class="s d" font-size="17">Viewer row-group editing was rehearsed. CSV and JSON retain the exact sequences, counts, rules, and original order.</text><text x="82" y="676" class="s d" font-size="15">Source: reviewed UniProtKB P01116, P01111, and P01112 sequence version 1.</text></svg>'''
    (CASE / "previews" / "preview.svg").write_text(preview, encoding="utf-8")


if __name__ == "__main__":
    main()
