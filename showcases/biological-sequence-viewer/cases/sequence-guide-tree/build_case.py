#!/usr/bin/env python3
"""Build the RAS exploratory guide-tree teaching artifacts."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path


CASE = Path(__file__).resolve().parent
SOURCE = CASE.parent / "sequence-ras-alignment" / "inputs" / "human-RAS-UniProt-SV1.aln-fasta"
INPUT = CASE / "inputs" / "human-RAS-UniProt-SV1.aln-fasta"
EXPECTED_SOURCE_SHA256 = "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f"
ORDER = ["P01116", "P01111", "P01112"]


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def parse_fasta(text: str) -> dict[str, str]:
    rows: dict[str, str] = {}
    name = ""
    for line in text.splitlines():
        if line.startswith(">"):
            name = line[1:].split()[0]
            rows[name] = ""
        elif line.strip():
            rows[name] += line.strip()
    return rows


def p_distance(left: str, right: str) -> tuple[int, int, float]:
    compared = [(a, b) for a, b in zip(left, right) if not (a == "-" and b == "-")]
    differences = sum(a != b for a, b in compared)
    return len(compared), differences, differences / len(compared)


def main() -> None:
    source_bytes = SOURCE.read_bytes().replace(b"\r\n", b"\n")
    if sha256(source_bytes) != EXPECTED_SOURCE_SHA256:
        raise SystemExit("RAS alignment checksum does not match the verified repository source")
    INPUT.parent.mkdir(parents=True, exist_ok=True)
    INPUT.write_bytes(source_bytes)
    rows = parse_fasta(source_bytes.decode("utf-8"))
    if list(rows) != ORDER or {len(value) for value in rows.values()} != {191}:
        raise SystemExit("expected P01116/P01111/P01112 in fixed order and 191 columns")

    pairs: list[dict[str, object]] = []
    distances: dict[tuple[str, str], float] = {}
    for index, left in enumerate(ORDER):
        for right in ORDER[index + 1 :]:
            compared, differences, distance = p_distance(rows[left], rows[right])
            pairs.append({
                "row_a": left,
                "row_b": right,
                "compared_columns": compared,
                "different_columns": differences,
                "p_distance": distance,
            })
            distances[(left, right)] = distance

    output_dir = CASE / "outputs"
    output_dir.mkdir(exist_ok=True)
    with (output_dir / "pairwise-distances.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(pairs[0]))
        writer.writeheader()
        writer.writerows(pairs)

    a, b, c = ORDER
    dab = distances[(a, b)]
    dac = distances[(a, c)]
    dbc = distances[(b, c)]
    limb_a = (dab + dac - dbc) / 2
    limb_b = (dab + dbc - dac) / 2
    limb_c = (dac + dbc - dab) / 2
    newick = (
        f"('{a}':{limb_a / 2:.6f},"
        f"('{b}':{limb_b:.6f},'{c}':{limb_c:.6f}):{limb_a / 2:.6f});"
    )
    (output_dir / "RAS-exploratory-NJ.nwk").write_text(newick + "\n", encoding="utf-8")

    analysis = {
        "showcase_id": "sequence-guide-tree",
        "source_alignment": "inputs/human-RAS-UniProt-SV1.aln-fasta",
        "source_sha256": EXPECTED_SOURCE_SHA256,
        "row_order": ORDER,
        "alignment_columns": 191,
        "distance_method": "uncorrected p-distance",
        "column_policy": "exclude only columns where both compared rows contain gaps; count residue-gap as different",
        "pairs": pairs,
        "tree": {
            "algorithm": "neighbor joining for three taxa",
            "newick": newick,
            "display_root": "midpoint of the P01116 limb; chosen only to draw the unrooted three-leaf result",
            "support_values": "not computed",
        },
        "execution": {
            "status": "verified local computation",
            "tool": "Python 3 standard library",
            "viewer_operations": "rehearsed; no viewer session was opened for this case",
        },
        "warning": "This three-sequence guide tree is exploratory and is not a publication-grade phylogeny.",
    }
    (output_dir / "analysis.json").write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    provenance = {
        "author": "Codex",
        "created": "2026-08-30",
        "source_case": "sequence-ras-alignment",
        "source_artifact": "../sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta",
        "source_sha256": EXPECTED_SOURCE_SHA256,
        "public_records": [
            "https://rest.uniprot.org/uniprotkb/P01116.fasta",
            "https://rest.uniprot.org/uniprotkb/P01111.fasta",
            "https://rest.uniprot.org/uniprotkb/P01112.fasta",
        ],
        "derivation": "deterministic local p-distance calculation followed by the exact three-taxon NJ limb solution",
        "rosalind_observation": {
            "path": "outputs/rosalind-open-observation.json",
            "tool": "mcp__rosalind__rosalind_open",
            "scientific_job_executed": False,
            "note": "The observed ready response documents only the task chooser; the local script produced the scientific result.",
        },
        "viewer_status": "rehearsed",
    }
    (output_dir / "provenance.json").write_text(
        json.dumps(provenance, indent=2) + "\n", encoding="utf-8"
    )

    preview = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc">
<title id="title">Exploratory human RAS guide tree</title><desc id="desc">Pairwise p-distance matrix, three-leaf neighbor-joining diagram, and method cautions.</desc>
<rect width="1200" height="760" rx="28" fill="#07121f"/><rect x="48" y="44" width="1104" height="672" rx="22" fill="#102238" stroke="#2c4764"/>
<style>.s{{font-family:Segoe UI,Arial,sans-serif}}.m{{font-family:Consolas,monospace}}.w{{fill:#f4f8fb}}.d{{fill:#a8bad0}}.g{{fill:#54ddb0}}.a{{fill:#ffc86b}}.p{{fill:#142d47;stroke:#315372}}.l{{stroke:#78a7d5;stroke-width:4;fill:none}}</style>
<text x="82" y="102" class="s g" font-size="21" font-weight="700">SEQUENCE VIEWER 0.1.43 · LOCAL REPRODUCTION</text><text x="82" y="154" class="s w" font-size="38" font-weight="700">Human RAS exploratory guide tree</text>
<text x="82" y="194" class="s d" font-size="18">P01116 / P01111 / P01112 · 191 aligned columns · uncorrected p-distance</text>
<rect x="78" y="232" width="500" height="326" rx="16" class="p"/><text x="106" y="275" class="s w" font-size="22" font-weight="650">Pairwise distances</text>
<text x="265" y="326" class="s d" font-size="17">KRAS</text><text x="377" y="326" class="s d" font-size="17">NRAS</text><text x="489" y="326" class="s d" font-size="17">HRAS</text>
<text x="108" y="372" class="s w" font-size="17">KRAS</text><text x="275" y="372" class="m g" font-size="17">0</text><text x="374" y="372" class="m w" font-size="17">{dab:.6f}</text><text x="486" y="372" class="m w" font-size="17">{dac:.6f}</text>
<text x="108" y="418" class="s w" font-size="17">NRAS</text><text x="260" y="418" class="m w" font-size="17">{dab:.6f}</text><text x="390" y="418" class="m g" font-size="17">0</text><text x="486" y="418" class="m w" font-size="17">{dbc:.6f}</text>
<text x="108" y="464" class="s w" font-size="17">HRAS</text><text x="260" y="464" class="m w" font-size="17">{dac:.6f}</text><text x="374" y="464" class="m w" font-size="17">{dbc:.6f}</text><text x="502" y="464" class="m g" font-size="17">0</text>
<text x="108" y="520" class="s d" font-size="16">190 columns compared per pair;</text><text x="108" y="543" class="s d" font-size="16">residue–gap columns count as differences.</text>
<rect x="610" y="232" width="512" height="326" rx="16" class="p"/><text x="638" y="275" class="s w" font-size="22" font-weight="650">Neighbor joining</text>
<path d="M668 406H760M760 406V326M760 326H856M760 406V475M760 475H824M824 475V433M824 433H916M824 475V517M824 517H916" class="l"/>
<text x="870" y="332" class="s w" font-size="18">P01116 · KRAS</text><text x="930" y="439" class="s w" font-size="18">P01111 · NRAS</text><text x="930" y="523" class="s w" font-size="18">P01112 · HRAS</text>
<text x="82" y="616" class="s a" font-size="18" font-weight="650">Exploratory only</text><text x="82" y="650" class="s d" font-size="17">Three proteins, no substitution model, no resampling support; the drawn root is arbitrary.</text>
<text x="82" y="684" class="s d" font-size="15">Viewer actions were rehearsed. All numbers shown here were recomputed locally from the retained aligned FASTA.</text></svg>'''
    (CASE / "previews" / "preview.svg").write_text(preview, encoding="utf-8")


if __name__ == "__main__":
    main()
