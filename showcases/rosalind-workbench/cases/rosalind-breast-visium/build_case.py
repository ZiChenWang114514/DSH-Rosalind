#!/usr/bin/env python3
"""Summarize the retained CELLxGENE breast-cancer Visium collection metadata."""

from __future__ import annotations

import csv
import json
import statistics
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "inputs" / "cellxgene-collection.json"
SUMMARY = ROOT / "outputs" / "visium-metadata-summary.json"
TABLE = ROOT / "outputs" / "dataset-qc-table.csv"
COLLECTION_ID = "bfd55632-15e2-4dde-a1b9-02ade511fc4d"


def main() -> None:
    collection = json.loads(SOURCE.read_text(encoding="utf-8"))
    if collection.get("collection_id") != COLLECTION_ID:
        raise ValueError("unexpected CELLxGENE collection")
    datasets = collection.get("datasets", [])
    if len(datasets) != 15:
        raise ValueError(f"expected 15 datasets, found {len(datasets)}")
    records = []
    participant_summary = collection.get("study_participant_summary", {})
    if participant_summary != {
        "participant_count": 11,
        "dataset_count": 15,
        "participants_with_multiple_datasets": 3,
    }:
        raise ValueError("unexpected de-identified participant summary")
    label_presence: dict[str, Counter[str]] = {}
    for item in datasets:
        disease = item["disease"][0]["label"]
        assay = item["assay"][0]
        if assay["ontology_term_id"] != "EFO:0022857" or "spatial" not in item["embeddings"]:
            raise ValueError(f"dataset {item['dataset_id']} lacks the expected Visium spatial metadata")
        labels = sorted(value["label"] for value in item["cell_type"])
        label_presence.setdefault(disease, Counter()).update(labels)
        records.append(
            {
                "dataset_id": item["dataset_id"],
                "dataset_version_id": item["dataset_version_id"],
                "title": item["title"],
                "disease": disease,
                "spots": item["cell_count"],
                "features": item["feature_count"],
                "mean_genes_per_spot": item["mean_genes_per_cell"],
                "cell_type_labels": "; ".join(labels),
                "spatial_embedding": True,
                "full_resolution_image": item["spatial"]["has_fullres"],
            }
        )
    groups: dict[str, list[dict[str, object]]] = {}
    for row in records:
        groups.setdefault(str(row["disease"]), []).append(row)
    group_summary = {}
    for disease, rows in sorted(groups.items()):
        values = [float(row["mean_genes_per_spot"]) for row in rows]
        group_summary[disease] = {
            "datasets": len(rows),
            "spots": sum(int(row["spots"]) for row in rows),
            "mean_genes_per_spot_mean": round(statistics.fmean(values), 6),
            "mean_genes_per_spot_median": round(statistics.median(values), 6),
            "mean_genes_per_spot_range": [round(min(values), 6), round(max(values), 6)],
            "cell_type_label_presence_by_dataset": dict(sorted(label_presence[disease].items())),
        }
    payload = {
        "schema": "rosalind.visium-metadata-qc/v1",
        "case_id": "rosalind-breast-visium",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "The de-identified official CELLxGENE collection response was retained and transformed into aggregate Visium QC outputs.",
        },
        "collection_id": COLLECTION_ID,
        "collection_version_id": collection["collection_version_id"],
        "collection_name": collection["name"],
        "doi": collection["doi"],
        "assay": {"label": "Visium Spatial Gene Expression V1", "ontology_term_id": "EFO:0022857"},
        "dataset_count": len(records),
        "total_spots": sum(int(row["spots"]) for row in records),
        "feature_count_uniform": len({row["features"] for row in records}) == 1,
        "feature_count": records[0]["features"],
        "all_have_spatial_embedding": all(row["spatial_embedding"] for row in records),
        "full_resolution_images_present": sum(bool(row["full_resolution_image"]) for row in records),
        "study_participant_summary": participant_summary,
        "groups": group_summary,
        "interpretation_scope": "The retained metadata supports study-level QC planning and sample comparison. It does not contain spot coordinates, expression values, image pixels, or region annotations.",
    }
    SUMMARY.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")
    with TABLE.open("w", encoding="utf-8", newline="") as handle:
        fields = ["dataset_id", "dataset_version_id", "title", "disease", "spots", "features", "mean_genes_per_spot", "cell_type_labels", "spatial_embedding", "full_resolution_image"]
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(records)
    check = json.loads(SUMMARY.read_text(encoding="utf-8"))
    assert check["dataset_count"] == 15 and check["total_spots"] == 74880
    assert check["all_have_spatial_embedding"] is True
    print(f"PASS rosalind-breast-visium: {check['dataset_count']} datasets, {check['total_spots']} spots")


if __name__ == "__main__":
    main()
