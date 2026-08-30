#!/usr/bin/env python3
"""Create and verify a one-residue KRAS G12C protein-sequence copy."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path


CASE = Path(__file__).resolve().parent
SOURCE_ALIGNMENT = CASE.parent / "sequence-ras-alignment" / "inputs" / "human-RAS-UniProt-SV1.aln-fasta"
SOURCE_ALIGNMENT_SHA256 = "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f"
SOURCE_SEQUENCE_SHA256 = "1d5a9ab11f64cb886d8ffa08a153c412b2d190fcf70e5690cd4b4c7efcdee53a"


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def wrap(sequence: str, width: int = 60) -> str:
    return "\n".join(sequence[index : index + width] for index in range(0, len(sequence), width))


def read_p01116(text: str) -> str:
    sequence = ""
    active = False
    for line in text.splitlines():
        if line.startswith(">"):
            active = line.startswith(">P01116 ")
        elif active:
            sequence += line.strip().replace("-", "")
    return sequence


def main() -> None:
    alignment_bytes = SOURCE_ALIGNMENT.read_bytes().replace(b"\r\n", b"\n")
    if sha256(alignment_bytes) != SOURCE_ALIGNMENT_SHA256:
        raise SystemExit("RAS alignment checksum mismatch")
    original = read_p01116(alignment_bytes.decode("utf-8"))
    if len(original) != 189 or sha256(original.encode("ascii")) != SOURCE_SEQUENCE_SHA256:
        raise SystemExit("P01116 sequence identity mismatch")
    if original[11] != "G":
        raise SystemExit("P01116 residue 12 is not glycine")

    input_dir = CASE / "inputs"
    output_dir = CASE / "outputs"
    input_dir.mkdir(exist_ok=True)
    output_dir.mkdir(exist_ok=True)
    source_fasta = (
        ">P01116 KRAS_HUMAN reviewed UniProtKB sequence version 1; source copy\n"
        + wrap(original)
        + "\n"
    )
    source_path = input_dir / "P01116-KRAS-SV1.fasta"
    source_path.write_text(source_fasta, encoding="utf-8")
    source_file_before = sha256(source_path.read_bytes())

    edited = original[:11] + "C" + original[12:]
    copy_fasta = (
        ">P01116_G12C_COPY derived_from=P01116@SV1 edit=G12C source_not_overwritten=true\n"
        + wrap(edited)
        + "\n"
    )
    copy_path = output_dir / "P01116-G12C-copy.fasta"
    copy_path.write_text(copy_fasta, encoding="utf-8")

    differences = [(index + 1, left, right) for index, (left, right) in enumerate(zip(original, edited)) if left != right]
    if differences != [(12, "G", "C")]:
        raise SystemExit(f"unexpected differences: {differences}")
    with (output_dir / "before-after.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["coordinate_1based", "before", "after", "edit"])
        writer.writeheader()
        writer.writerow({"coordinate_1based": 12, "before": "G", "after": "C", "edit": "G12C"})

    checks = {
        "showcase_id": "sequence-edit-copy",
        "source": {
            "accession": "P01116",
            "sequence_version": 1,
            "length": len(original),
            "sequence_sha256": sha256(original.encode("ascii")),
            "file_sha256_before_build": source_file_before,
            "file_sha256_after_build": sha256(source_path.read_bytes()),
            "unchanged_during_edit": source_file_before == sha256(source_path.read_bytes()),
        },
        "copy": {
            "record_id": "P01116_G12C_COPY",
            "length": len(edited),
            "sequence_sha256": sha256(edited.encode("ascii")),
            "file_sha256": sha256(copy_path.read_bytes()),
        },
        "edit": {
            "type": "replace one protein residue in a derived copy",
            "coordinate_system": "1-based protein residue",
            "start": 12,
            "end": 12,
            "before": "G",
            "after": "C",
            "difference_count": len(differences),
            "length_preserved": len(original) == len(edited),
        },
        "execution": {
            "status": "verified local copy transformation",
            "tool": "Python 3 standard library",
            "viewer_operations": "sequence.edit_copy and sequence.export_artifact were rehearsed; no live viewer copy was modified or exported",
        },
        "limitations": [
            "This protein-sequence copy does not specify a nucleotide codon or expression construct.",
            "The edit record does not by itself establish biochemical, clinical, or structural consequences.",
        ],
    }
    (output_dir / "edit-checks.json").write_text(
        json.dumps(checks, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    provenance = {
        "author": "Codex",
        "created": "2026-08-30",
        "database": "UniProtKB",
        "accession": "P01116",
        "sequence_version": 1,
        "source_url": "https://rest.uniprot.org/uniprotkb/P01116.fasta",
        "repository_source_alignment": "../sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta",
        "source_alignment_sha256": SOURCE_ALIGNMENT_SHA256,
        "derivation": "remove alignment gaps from the P01116 row, preserve the 189-aa source FASTA, and replace residue 12 G with C only in a new copy",
        "rosalind_observation": {
            "path": "outputs/rosalind-open-observation.json",
            "tool": "mcp__rosalind__rosalind_open",
            "scientific_job_executed": False,
            "note": "The observed ready response documents only the task chooser; the local script created and verified the copy.",
        },
        "viewer_status": "rehearsed",
    }
    (output_dir / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")

    before_window = original[7:16]
    after_window = edited[7:16]
    preview = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc"><title id="title">KRAS G12C safe copy edit</title><desc id="desc">Before and after protein sequence windows plus checks that exactly one residue changed and the 189-residue source remained unchanged.</desc>
<rect width="1200" height="760" rx="28" fill="#08131f"/><rect x="48" y="44" width="1104" height="672" rx="22" fill="#102238" stroke="#2e4a65"/><style>.s{{font-family:Segoe UI,Arial,sans-serif}}.m{{font-family:Consolas,monospace}}.w{{fill:#f3f7fb}}.d{{fill:#a6bad0}}.g{{fill:#55ddb0}}.a{{fill:#ffcb6b}}.p{{fill:#142d47;stroke:#315472}}</style>
<text x="82" y="102" class="s g" font-size="21" font-weight="700">DERIVED COPY · SOURCE PRESERVED</text><text x="82" y="154" class="s w" font-size="38" font-weight="700">P01116 KRAS protein copy: G12C</text><text x="82" y="196" class="s d" font-size="18">Reviewed UniProtKB sequence version 1 · protein coordinates are 1-based</text>
<rect x="78" y="244" width="1044" height="264" rx="16" class="p"/><text x="110" y="294" class="s d" font-size="17">SOURCE · residues 8–16</text><text x="110" y="352" class="m w" font-size="34">{before_window}</text><text x="466" y="352" class="s a" font-size="20">residue 12 = G</text><text x="110" y="418" class="s d" font-size="17">DERIVED COPY · residues 8–16</text><text x="110" y="476" class="m g" font-size="34">{after_window}</text><text x="466" y="476" class="s g" font-size="20">residue 12 = C</text>
<text x="82" y="566" class="s w" font-size="19" font-weight="650">Checks</text><text x="82" y="604" class="s d" font-size="17">Length 189 → 189 · exactly 1 difference · source file unchanged · independent output FASTA</text><text x="82" y="644" class="s a" font-size="16">No nucleotide codon, construct design, functional effect, or clinical interpretation is inferred.</text><text x="82" y="680" class="s d" font-size="15">Viewer edit and export operations were rehearsed; the retained copy was generated and checked locally.</text></svg>'''
    (CASE / "previews" / "preview.svg").write_text(preview, encoding="utf-8")


if __name__ == "__main__":
    main()
