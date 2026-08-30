#!/usr/bin/env python3
"""Search a short RAS P-loop query across the retained alignment."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path


CASE = Path(__file__).resolve().parent
SOURCE = CASE.parent / "sequence-ras-alignment" / "inputs" / "human-RAS-UniProt-SV1.aln-fasta"
INPUT = CASE / "inputs" / "human-RAS-UniProt-SV1.aln-fasta"
EXPECTED_SHA256 = "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f"
PATTERN = re.compile(r"G....GKS")


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


def alignment_column_for_residue(aligned: str, residue: int) -> int:
    seen = 0
    for column, symbol in enumerate(aligned, start=1):
        if symbol != "-":
            seen += 1
        if seen == residue:
            return column
    raise ValueError(residue)


def main() -> None:
    source_bytes = SOURCE.read_bytes().replace(b"\r\n", b"\n")
    if sha256(source_bytes) != EXPECTED_SHA256:
        raise SystemExit("RAS alignment checksum mismatch")
    INPUT.parent.mkdir(parents=True, exist_ok=True)
    INPUT.write_bytes(source_bytes)
    records = parse_fasta(source_bytes.decode("utf-8"))

    hits: list[dict[str, object]] = []
    for accession, aligned in records.items():
        ungapped = aligned.replace("-", "")
        for match in PATTERN.finditer(ungapped):
            start = match.start() + 1
            end = match.end()
            hits.append({
                "accession": accession,
                "query": "G....GKS",
                "matched_sequence": match.group(),
                "residue_start_1based": start,
                "residue_end_1based_inclusive": end,
                "alignment_column_start_1based": alignment_column_for_residue(aligned, start),
                "alignment_column_end_1based_inclusive": alignment_column_for_residue(aligned, end),
            })
    if len(hits) != 3 or any(hit["matched_sequence"] != "GAGGVGKS" for hit in hits):
        raise SystemExit("expected exactly one GAGGVGKS hit per RAS sequence")

    output_dir = CASE / "outputs"
    output_dir.mkdir(exist_ok=True)
    with (output_dir / "motif-hits.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(hits[0]))
        writer.writeheader()
        writer.writerows(hits)

    result = {
        "showcase_id": "sequence-motif-search",
        "source_sha256": EXPECTED_SHA256,
        "records_searched": list(records),
        "coordinate_system": "1-based inclusive residue and alignment coordinates",
        "query": {
            "regular_expression": "G....GKS",
            "length": 8,
            "fixed_positions": {"1": "G", "6": "G", "7": "K", "8": "S"},
            "scope": "ungapped protein sequence, case-sensitive",
        },
        "hit_count": len(hits),
        "hits": hits,
        "execution": {
            "status": "verified local computation",
            "tool": "Python 3 standard-library regular expressions",
            "viewer_operations": "rehearsed; no viewer search or analysis job was run",
        },
        "false_positive_cautions": [
            "Four of eight positions are unconstrained, so an unrelated protein can match by chance.",
            "A sequence match alone does not establish nucleotide binding, GTPase activity, or structural context.",
            "This case searched only three curated human RAS records and is not a proteome-wide specificity test.",
        ],
    }
    (output_dir / "motif-search.json").write_text(
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
        "query_origin": "a deliberately compact query spanning the conserved RAS P-loop segment; it is not presented as a complete family classifier",
        "rosalind_observation": {
            "path": "outputs/rosalind-open-observation.json",
            "tool": "mcp__rosalind__rosalind_open",
            "scientific_job_executed": False,
            "note": "The observed ready response documents only the task chooser; the local regex scan produced the scientific result.",
        },
        "viewer_status": "rehearsed",
    }
    (output_dir / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")

    rows = "".join(
        f'<text x="92" y="{330 + i * 58}" class="m w" font-size="21">{h["accession"]}</text>'
        f'<text x="282" y="{330 + i * 58}" class="m g" font-size="21">{h["matched_sequence"]}</text>'
        f'<text x="512" y="{330 + i * 58}" class="m w" font-size="21">residues {h["residue_start_1based"]}–{h["residue_end_1based_inclusive"]}</text>'
        for i, h in enumerate(hits)
    )
    preview = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc"><title id="title">RAS motif search results</title><desc id="desc">Exact coordinates for one short P-loop query match in each of three human RAS proteins, with specificity cautions.</desc>
<rect width="1200" height="760" rx="28" fill="#09131f"/><rect x="48" y="44" width="1104" height="672" rx="22" fill="#102238" stroke="#2d4a66"/>
<style>.s{{font-family:Segoe UI,Arial,sans-serif}}.m{{font-family:Consolas,monospace}}.w{{fill:#f3f7fb}}.d{{fill:#a7bbd1}}.g{{fill:#58dfb2}}.a{{fill:#ffc86d}}.p{{fill:#142d47;stroke:#315472}}</style>
<text x="82" y="102" class="s g" font-size="21" font-weight="700">DETERMINISTIC PROTEIN MOTIF SEARCH</text><text x="82" y="154" class="s w" font-size="38" font-weight="700">One RAS P-loop query, three exact hits</text><text x="82" y="198" class="m a" font-size="25">G....GKS</text><text x="270" y="198" class="s d" font-size="18">ungapped protein sequence · case-sensitive</text>
<rect x="78" y="240" width="1044" height="300" rx="16" class="p"/><text x="92" y="282" class="s d" font-size="16">RECORD</text><text x="282" y="282" class="s d" font-size="16">MATCH</text><text x="512" y="282" class="s d" font-size="16">1-BASED INCLUSIVE COORDINATES</text>{rows}
<text x="82" y="602" class="s a" font-size="19" font-weight="650">Specificity caution</text><text x="82" y="638" class="s d" font-size="17">Four positions are wildcards. A match does not establish function or structural context.</text><text x="82" y="672" class="s d" font-size="15">Viewer operations were rehearsed; the retained CSV and JSON were computed locally from the verified RAS alignment.</text></svg>'''
    (CASE / "previews" / "preview.svg").write_text(preview, encoding="utf-8")


if __name__ == "__main__":
    main()
