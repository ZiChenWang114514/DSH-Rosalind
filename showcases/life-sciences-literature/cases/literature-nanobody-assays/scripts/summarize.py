#!/usr/bin/env python3
"""Build the deterministic nanobody-assay teaching summary from retained API evidence."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path


CASE_DIR = Path(__file__).resolve().parents[1]
SOURCE = CASE_DIR / "outputs" / "sources.json"
DESTINATION = CASE_DIR / "outputs" / "results.json"


def main() -> None:
    evidence = json.loads(SOURCE.read_text(encoding="utf-8"))
    records = sorted(evidence["records"], key=lambda item: (item["date"], item["pmid"]))
    platforms = Counter("BLI protocol" if "BLI" in item["assay_role"] else "SPR plus ELISA application" for item in records)
    result = {
        "schema": "literature.deterministic-summary/v1",
        "case_id": evidence["case_id"],
        "source_retrieved_at_utc": evidence["retrieved_at_utc"],
        "selection_rule": "Retain one BLI kinetics protocol and three PMC-open records returned by the nanobody plus SPR plus ELISA title-or-abstract query.",
        "record_count": len(records),
        "pmc_open_access_count": sum(bool(item["pmc_open_access"]) for item in records),
        "platform_class_counts": dict(sorted(platforms.items())),
        "assay_evidence": [
            {
                "pmid": item["pmid"],
                "title": item["title"],
                "assay_role": item["assay_role"],
                "query_evidence": item["query_evidence"],
                "pmc_open_access": item["pmc_open_access"]
            }
            for item in records
        ],
        "interpretation": "The records support an orthogonal assay strategy in which label-free kinetic measurements are complemented by plate-based binding or specificity tests. They do not compare one shared nanobody panel under harmonized conditions."
    }
    DESTINATION.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
