#!/usr/bin/env python3
"""Extract a compact lambda reference window and a source-linked GFF3 track."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path


CASE = Path(__file__).resolve().parent
SOURCE = CASE.parent / "sequence-lambda-annotation" / "inputs" / "NC_001416.1.gb"
SOURCE_SHA256 = "3c624302adeeb3c00649f549903ab781b9e75bab16069ae655833d536407367f"
REGION_START = 37180
REGION_END = 38050
SEQID = "NC_001416.1_region_37180_38050"
FEATURES = [
    {"id": "cI_CDS", "type": "CDS", "label": "cI", "start": 37227, "end": 37940, "strand": "-", "source_location": "complement(37227..37940)"},
    {"id": "OR3", "type": "regulatory_region", "label": "OR3", "start": 37951, "end": 37967, "strand": "+", "source_location": "37951..37967"},
    {"id": "OR2", "type": "regulatory_region", "label": "OR2", "start": 37974, "end": 37990, "strand": "+", "source_location": "37974..37990"},
    {"id": "OR1", "type": "regulatory_region", "label": "OR1", "start": 37998, "end": 38014, "strand": "+", "source_location": "37998..38014"},
]


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def wrap(sequence: str, width: int = 70) -> str:
    return "\n".join(sequence[index : index + width] for index in range(0, len(sequence), width))


def main() -> None:
    source_bytes = SOURCE.read_bytes()
    if sha256(source_bytes) != SOURCE_SHA256:
        raise SystemExit("lambda GenBank source checksum mismatch")
    text = source_bytes.decode("utf-8")
    if "VERSION     NC_001416.1" not in text or "LOCUS       NC_001416              48502 bp" not in text:
        raise SystemExit("unexpected GenBank identity or genome length")
    for feature in FEATURES:
        if feature["source_location"] not in text:
            raise SystemExit(f"source feature location missing: {feature['source_location']}")

    origin = text.split("ORIGIN", 1)[1].split("//", 1)[0]
    genome = "".join(re.findall(r"[acgt]", origin, flags=re.IGNORECASE)).upper()
    if len(genome) != 48502:
        raise SystemExit(f"expected 48,502 bases, found {len(genome)}")
    region = genome[REGION_START - 1 : REGION_END]
    if len(region) != REGION_END - REGION_START + 1:
        raise SystemExit("regional extraction length mismatch")

    input_dir = CASE / "inputs"
    output_dir = CASE / "outputs"
    input_dir.mkdir(exist_ok=True)
    output_dir.mkdir(exist_ok=True)
    fasta = (
        f">{SEQID} source=NC_001416.1 source_coordinates={REGION_START}-{REGION_END} 1-based-inclusive\n"
        f"{wrap(region)}\n"
    )
    (input_dir / "NC_001416.1-region-37180-38050.fasta").write_text(fasta, encoding="utf-8")

    rows: list[dict[str, object]] = []
    gff = ["##gff-version 3", f"##sequence-region {SEQID} 1 {len(region)}"]
    for feature in FEATURES:
        local_start = int(feature["start"]) - REGION_START + 1
        local_end = int(feature["end"]) - REGION_START + 1
        attributes = (
            f"ID={feature['id']};Name={feature['label']};"
            f"source_accession=NC_001416.1;source_location={feature['source_location']}"
        )
        gff.append(
            "\t".join([
                SEQID, "NCBI_GenBank", str(feature["type"]), str(local_start), str(local_end),
                ".", str(feature["strand"]), "0" if feature["type"] == "CDS" else ".", attributes,
            ])
        )
        rows.append({
            "feature_id": feature["id"],
            "type": feature["type"],
            "label": feature["label"],
            "local_start_1based": local_start,
            "local_end_1based_inclusive": local_end,
            "strand": feature["strand"],
            "source_accession": "NC_001416.1",
            "source_start_1based": feature["start"],
            "source_end_1based_inclusive": feature["end"],
        })
    (input_dir / "NC_001416.1-region-37180-38050.gff3").write_text("\n".join(gff) + "\n", encoding="utf-8")

    with (output_dir / "annotation-summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "showcase_id": "sequence-annotation-track",
        "reference": {
            "accession_version": "NC_001416.1",
            "source_length": len(genome),
            "source_sha256": SOURCE_SHA256,
            "extracted_interval": {"start": REGION_START, "end": REGION_END, "coordinate_system": "1-based inclusive"},
            "regional_length": len(region),
            "regional_sequence_sha256": sha256(region.encode("ascii")),
        },
        "coordinate_mapping": "local = source - 37180 + 1",
        "features": rows,
        "track_format": "GFF3 using regional FASTA coordinates",
        "execution": {
            "status": "verified local extraction",
            "tool": "Python 3 standard library",
            "viewer_operations": "sequence_load_track was genuinely requested twice in source-compatible sessions; neither load was acknowledged, and the fresh records and tracks queries also timed out",
            "viewer_observation": "outputs/sequence-load-track-observation.json",
            "track_loaded": False,
        },
        "limitations": [
            "The regional GFF3 contains only cI and OR3/OR2/OR1, not every GenBank feature in the interval.",
            "The preview is a coordinate-faithful project graphic, not a viewer capture.",
            "Two Viewer sessions returned no load acknowledgement or mapping diagnostics, so parsing, mapping, display, and retention of the track remain unverified.",
        ],
    }
    (output_dir / "annotation-track.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    provenance = {
        "author": "Codex",
        "created": "2026-08-30",
        "database": "NCBI RefSeq via Nucleotide EFetch",
        "accession_version": "NC_001416.1",
        "source_url": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_001416.1&rettype=gbwithparts&retmode=text",
        "repository_source": "../sequence-lambda-annotation/inputs/NC_001416.1.gb",
        "source_bytes": len(source_bytes),
        "source_sha256": SOURCE_SHA256,
        "derivation": "extract bases 37180..38050 and remap four source annotations to local 1-based GFF3 coordinates",
        "rosalind_observation": {
            "path": "outputs/rosalind-open-observation.json",
            "tool": "mcp__rosalind__rosalind_open",
            "scientific_job_executed": False,
            "note": "The observed ready response documents only the task chooser; the local extraction produced the FASTA and GFF3.",
        },
        "viewer_observation": {
            "path": "outputs/sequence-load-track-observation.json",
            "open_tool": "mcp__sequence_viewer__sequence_open_from_chat",
            "operation_tool": "mcp__sequence_viewer__sequence_load_track",
            "query_tool": "mcp__sequence_viewer__sequence_query_viewer",
            "status": "unacknowledged after two attempts",
            "track_loaded": False,
            "note": "Two exact GFF3 load requests timed out without viewer acknowledgement; the fresh records readiness query and tracks follow-up query also timed out, and no mapping diagnostics were returned.",
        },
        "viewer_status": "two genuine operations attempted; track load unverified",
    }
    (output_dir / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")

    def x(source_coordinate: int) -> int:
        return 100 + round((source_coordinate - REGION_START) / (REGION_END - REGION_START) * 980)

    ci_x, ci_w = x(37227), x(37940) - x(37227)
    blocks = []
    for feature, color in zip(FEATURES[1:], ["#ffcb6b", "#62d9b0", "#76a9ff"]):
        fx = x(int(feature["start"])); fw = max(8, x(int(feature["end"])) - fx)
        blocks.append(f'<rect x="{fx}" y="422" width="{fw}" height="48" rx="7" fill="{color}"/>')
    preview = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc"><title id="title">Lambda cI and operator annotation track</title><desc id="desc">A source-linked regional annotation track for cI and OR3, OR2, and OR1 from RefSeq NC_001416.1.</desc>
<rect width="1200" height="760" rx="28" fill="#08131f"/><rect x="48" y="44" width="1104" height="672" rx="22" fill="#102238" stroke="#2e4a65"/><style>.s{{font-family:Segoe UI,Arial,sans-serif}}.m{{font-family:Consolas,monospace}}.w{{fill:#f2f7fb}}.d{{fill:#a6bad0}}.g{{fill:#55ddb0}}.a{{fill:#ffcb6b}}</style>
<text x="82" y="102" class="s g" font-size="21" font-weight="700">SOURCE-LINKED GFF3 TRACK</text><text x="82" y="154" class="s w" font-size="38" font-weight="700">λ cI and right-operator region</text><text x="82" y="196" class="s d" font-size="18">NC_001416.1:37180–38050 · 871 bases · local coordinate 1 maps to source 37180</text>
<line x1="100" y1="365" x2="1080" y2="365" stroke="#7595b6" stroke-width="5"/><text x="100" y="339" class="m d" font-size="15">37180</text><text x="1030" y="339" class="m d" font-size="15">38050</text>
<rect x="{ci_x}" y="278" width="{ci_w}" height="54" rx="10" fill="#d5689d"/><text x="{ci_x + 16}" y="313" class="s w" font-size="19">cI CDS · reverse strand · source 37227–37940</text>
{''.join(blocks)}
<rect x="830" y="494" width="16" height="16" rx="3" fill="#ffcb6b"/><text x="854" y="508" class="s w" font-size="14">OR3</text><rect x="910" y="494" width="16" height="16" rx="3" fill="#62d9b0"/><text x="934" y="508" class="s w" font-size="14">OR2</text><rect x="990" y="494" width="16" height="16" rx="3" fill="#76a9ff"/><text x="1014" y="508" class="s w" font-size="14">OR1</text>
<text x="82" y="566" class="s a" font-size="19" font-weight="650">Track contents</text><text x="82" y="600" class="s d" font-size="17">One reverse-strand CDS plus three source-record regulatory annotations; coordinates are 1-based inclusive.</text>
<text x="82" y="636" class="s d" font-size="17">The regional track omits other GenBank features. Two live load requests timed out without acknowledgement.</text><text x="82" y="680" class="s d" font-size="15">Retained artifacts: regional FASTA, GFF3, results, provenance, and exact operation observation.</text></svg>'''
    (CASE / "previews" / "preview.svg").write_text(preview, encoding="utf-8")


if __name__ == "__main__":
    main()
