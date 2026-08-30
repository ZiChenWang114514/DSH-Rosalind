#!/usr/bin/env python3
"""Summarize retained public TNBC single-cell collection metadata."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "inputs" / "cellxgene-collection.json"
SUMMARY = ROOT / "outputs" / "tme-metadata-summary.json"
TABLE = ROOT / "outputs" / "cell-type-inventory.csv"
COLLECTION_ID = "ceef2841-5333-46ac-92ef-ccbe0c20fe55"


def main() -> None:
    collection = json.loads(SOURCE.read_text(encoding="utf-8"))
    if collection.get("collection_id") != COLLECTION_ID:
        raise ValueError("unexpected CELLxGENE collection")
    datasets = collection.get("datasets", [])
    if len(datasets) != 1:
        raise ValueError(f"expected one dataset, found {len(datasets)}")
    dataset = datasets[0]
    participant_count = dataset["study_participant_count"]
    labels = sorted(dataset["cell_type"], key=lambda item: item["label"])
    assays = sorted(dataset["assay"], key=lambda item: item["ontology_term_id"])
    payload = {
        "schema": "rosalind.single-cell-tme-metadata/v1",
        "case_id": "rosalind-single-cell-tme",
        "public_evidence_operation": {
            "capability": "rosalind-workbench.public-evidence",
            "performed": True,
            "outcome": "The de-identified official CELLxGENE collection response was retained and transformed into aggregate preparation checks.",
        },
        "collection_id": COLLECTION_ID,
        "collection_version_id": collection["collection_version_id"],
        "collection_name": collection["name"],
        "dataset_id": dataset["dataset_id"],
        "dataset_version_id": dataset["dataset_version_id"],
        "dataset_title": dataset["title"],
        "organism": dataset["organism"],
        "disease": dataset["disease"],
        "tissue": dataset["tissue"],
        "assays": assays,
        "cells": dataset["cell_count"],
        "primary_cells": dataset["primary_cell_count"],
        "features": dataset["feature_count"],
        "mean_genes_per_cell": round(float(dataset["mean_genes_per_cell"]), 6),
        "study_participant_count": participant_count,
        "broad_cell_type_count": len(labels),
        "broad_cell_types": labels,
        "embedding_inventory": dataset["embeddings"],
        "raw_data_location": dataset["raw_data_location"],
        "asset": {"filetype": dataset["assets"][0]["filetype"], "bytes": dataset["assets"][0]["filesize"], "url": dataset["assets"][0]["url"]},
        "preparation_checks": {
            "human_breast_tissue": dataset["organism"][0]["ontology_term_id"] == "NCBITaxon:9606" and dataset["tissue"][0]["ontology_term_id"] == "UBERON:0000310",
            "tnbc_disease_annotation": dataset["disease"][0]["ontology_term_id"] == "MONDO:0005494",
            "raw_counts_declared": dataset["raw_data_location"] == "raw.X",
            "umap_available": "X_umap" in dataset["embeddings"],
        },
        "interpretation_scope": "The metadata establishes cohort scale, assay versions, broad annotations, and matrix availability for planning. No H5AD expression matrix or cell-level annotation was downloaded or reanalysed.",
    }
    SUMMARY.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")
    with TABLE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["label", "ontology_term_id"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(labels)
    check = json.loads(SUMMARY.read_text(encoding="utf-8"))
    assert check["cells"] == 427823 and check["study_participant_count"] == 101
    assert all(check["preparation_checks"].values())
    print(f"PASS rosalind-single-cell-tme: {check['cells']} cells, {check['study_participant_count']} participants")


if __name__ == "__main__":
    main()
