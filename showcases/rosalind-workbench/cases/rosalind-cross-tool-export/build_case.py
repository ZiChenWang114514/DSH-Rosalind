#!/usr/bin/env python3
"""Build a deterministic RO-Crate snapshot from four Rosalind evidence cases."""

from __future__ import annotations

import csv
import json
import mimetypes
import shutil
import zipfile
from collections import Counter
from pathlib import Path


CASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = CASE_DIR.parents[3]
CRATE_DIR = CASE_DIR / "outputs" / "ro-crate"
ZIP_PATH = CASE_DIR / "outputs" / "rosalind-evidence-ro-crate.zip"

ARTIFACTS = {
    "rosalind-scientific-compute": [
        ("inputs/source-provenance.json", "source-observation"),
        ("outputs/embedding-summary.json", "computed-result"),
        ("outputs/run-metrics.json", "provenance"),
    ],
    "rosalind-pdl1-assay-plan": [
        ("inputs/KN035-public-evidence.md", "source-observation"),
        ("outputs/assay-plan.json", "experimental-plan"),
        ("outputs/competitive-elisa-plate-map.csv", "experimental-plan"),
    ],
    "rosalind-boltz-repeats": [
        ("inputs/source-and-run-provenance.md", "provenance"),
        ("outputs/run-evidence.json", "computed-result"),
        ("outputs/top5-ensemble-ranking.csv", "computed-result"),
        ("outputs/top5-confidence-records.json", "computed-result"),
    ],
    "rosalind-nextflow-snakemake": [
        ("inputs/source-provenance.json", "source-observation"),
        ("outputs/reference-qc.json", "computed-result"),
        ("outputs/readiness.json", "provenance"),
        ("outputs/workflow-contract.json", "workflow-plan"),
        ("workflows/nextflow/main.nf", "workflow-plan"),
        ("workflows/snakemake/Snakefile", "workflow-plan"),
    ],
}


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    if CRATE_DIR.exists():
        shutil.rmtree(CRATE_DIR)
    CRATE_DIR.mkdir(parents=True)

    graph = [
        {
            "@id": "ro-crate-metadata.json",
            "@type": "CreativeWork",
            "about": {"@id": "./"},
            "conformsTo": {"@id": "https://w3id.org/ro/crate/1.1"},
        },
        {
            "@id": "./",
            "@type": "Dataset",
            "name": "Rosalind scientific evidence teaching package",
            "description": "A compact package of public-source observations, local computations, an experimental plan, a retained Boltz-2 prediction summary, and unexecuted workflow definitions.",
            "datePublished": "2026-08-30",
            "hasPart": [],
        },
    ]
    root_dataset = graph[1]
    inventory = []
    classifications = Counter()

    for case_id, artifacts in ARTIFACTS.items():
        source_case = REPO_ROOT / "showcases" / "rosalind-workbench" / "cases" / case_id
        case_entity_id = f"cases/{case_id}/"
        case_parts = []
        for relative, evidence_class in artifacts:
            source = source_case / relative
            if not source.is_file():
                raise RuntimeError(f"Missing source artifact: {source}")
            destination_relative = Path("cases") / case_id / relative
            destination = CRATE_DIR / destination_relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
            crate_id = destination_relative.as_posix()
            media_type = mimetypes.guess_type(destination.name)[0] or "application/octet-stream"
            classifications[evidence_class] += 1
            inventory.append(
                {
                    "crate_path": crate_id,
                    "source_case": case_id,
                    "source_path": relative,
                    "evidence_class": evidence_class,
                    "bytes": destination.stat().st_size,
                }
            )
            case_parts.append({"@id": crate_id})
            graph.append(
                {
                    "@id": crate_id,
                    "@type": "File",
                    "name": destination.name,
                    "encodingFormat": media_type,
                    "contentSize": str(destination.stat().st_size),
                    "additionalType": evidence_class,
                    "isPartOf": {"@id": case_entity_id},
                }
            )
        graph.append(
            {
                "@id": case_entity_id,
                "@type": "Dataset",
                "name": case_id,
                "hasPart": case_parts,
            }
        )
        root_dataset["hasPart"].append({"@id": case_entity_id})

    inventory_path = CRATE_DIR / "artifact-inventory.csv"
    with inventory_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(inventory[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(inventory)
    graph.append(
        {
            "@id": "artifact-inventory.csv",
            "@type": "File",
            "name": "Artifact inventory",
            "encodingFormat": "text/csv",
            "contentSize": str(inventory_path.stat().st_size),
            "additionalType": "provenance",
            "isPartOf": {"@id": "./"},
        }
    )
    root_dataset["hasPart"].append({"@id": "artifact-inventory.csv"})

    crate_readme = '''# Rosalind scientific evidence RO-Crate

This RO-Crate 1.1 teaching package contains selected evidence from four cases.

- GB1: public-source provenance, deterministic one-hot embedding summary, and run metrics.
- PD-L1 assay: public KN035 evidence, an experimental plan, and a 96-well map. These files contain no wet-lab result.
- Boltz-2: prior-run provenance, ensemble ranking, per-run evidence, and 25 raw confidence payloads. These are computational predictions.
- Workflow comparison: a directly computed FASTQ QC reference, readiness record, output contract, and two unexecuted workflow definitions.

The evidence class of every included artifact appears in `artifact-inventory.csv` and `ro-crate-metadata.json`. Packaging preserves the recorded evidence strength; it does not add experimental confirmation.
'''
    write_text(CRATE_DIR / "README.md", crate_readme)
    graph.append(
        {
            "@id": "README.md",
            "@type": "File",
            "name": "Human-readable package guide",
            "encodingFormat": "text/markdown",
            "contentSize": str((CRATE_DIR / "README.md").stat().st_size),
            "additionalType": "provenance",
            "isPartOf": {"@id": "./"},
        }
    )
    root_dataset["hasPart"].append({"@id": "README.md"})

    graph.append(
        {
            "@id": "#export-action",
            "@type": "CreateAction",
            "name": "Deterministic local RO-Crate export",
            "endTime": "2026-08-30",
            "instrument": {"@id": "#python-standard-library"},
            "result": {"@id": "./"},
        }
    )
    graph.append(
        {
            "@id": "#python-standard-library",
            "@type": "SoftwareApplication",
            "name": "Python standard library",
        }
    )

    metadata = {"@context": "https://w3id.org/ro/crate/1.1/context", "@graph": graph}
    write_text(CRATE_DIR / "ro-crate-metadata.json", json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")

    file_entities = [entity for entity in graph if entity.get("@type") == "File"]
    missing = [entity["@id"] for entity in file_entities if not (CRATE_DIR / entity["@id"]).is_file()]
    size_mismatches = [
        entity["@id"]
        for entity in file_entities
        if entity.get("contentSize") != str((CRATE_DIR / entity["@id"]).stat().st_size)
    ]
    validation = {
        "ro_crate_version": "1.1",
        "metadata_json_valid": True,
        "inventory_rows": len(inventory),
        "file_entities": len(file_entities),
        "evidence_class_counts": dict(sorted(classifications.items())),
        "missing_files": missing,
        "content_size_mismatches": size_mismatches,
        "planned_items_preserved_as_plans": True,
        "ok": not missing and not size_mismatches,
    }
    write_text(CRATE_DIR / "validation.json", json.dumps(validation, indent=2) + "\n")

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(CRATE_DIR.rglob("*"), key=lambda item: item.relative_to(CRATE_DIR).as_posix()):
            if not path.is_file():
                continue
            relative = path.relative_to(CRATE_DIR).as_posix()
            info = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())

    nodes = [
        ("GB1", "computed result", "#22d3ee"),
        ("PD-L1 assays", "experimental plan", "#fbbf24"),
        ("Boltz-2", "prediction evidence", "#a78bfa"),
        ("Workflows", "direct QC + plans", "#2dd4bf"),
    ]
    boxes = []
    for index, (name, kind, color) in enumerate(nodes):
        y = 210 + index * 95
        boxes.append(f'<rect x="70" y="{y}" width="330" height="70" rx="16" fill="#0f2538" stroke="{color}"/>')
        boxes.append(f'<text x="95" y="{y+31}" class="h">{name}</text><text x="95" y="{y+56}" class="s">{kind}</text>')
        boxes.append(f'<path d="M400 {y+35} H650" stroke="{color}" stroke-width="4"/>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">Rosalind evidence RO-Crate</title><desc id="desc">Four case-specific evidence groups feed a deterministic RO-Crate package while preserving each artifact's evidence class.</desc>
<rect width="1200" height="675" fill="#071522"/><style>.k{{font:600 21px Segoe UI,Arial;fill:#67e8f9}}.t{{font:700 42px Segoe UI,Arial;fill:#f8fafc}}.h{{font:700 22px Segoe UI,Arial;fill:#f8fafc}}.b{{font:21px Segoe UI,Arial;fill:#cbd5e1}}.s{{font:16px Segoe UI,Arial;fill:#94a3b8}}</style>
<text x="64" y="68" class="k">RO-CRATE 1.1 · DETERMINISTIC EXPORT</text><text x="64" y="125" class="t">Evidence stays identifiable in transit</text>{''.join(boxes)}
<rect x="650" y="240" width="460" height="300" rx="28" fill="#102a3f" stroke="#67e8f9" stroke-width="3"/><text x="710" y="310" class="h">Rosalind evidence package</text><text x="710" y="365" class="b">{len(inventory)} selected artifacts</text><text x="710" y="410" class="b">metadata + inventory + validation</text><text x="710" y="455" class="b">fixed-timestamp ZIP</text><text x="710" y="505" class="s">plans remain plans · predictions remain predictions</text>
<text x="64" y="635" class="s">Packaging improves inspection and transfer; it does not increase scientific evidence strength.</text>
</svg>'''
    write_text(CASE_DIR / "previews" / "preview.svg", svg + "\n")


if __name__ == "__main__":
    main()
