#!/usr/bin/env python3
"""Build the deterministic KRAS G12C teaching summary from retained API evidence."""

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
    access = Counter("PMC open access" if item["pmc_open_access"] else "not reported as PMC open access" for item in records)
    result = {
        "schema": "literature.deterministic-summary/v1",
        "case_id": evidence["case_id"],
        "source_retrieved_at_utc": evidence["retrieved_at_utc"],
        "selection_rule": "Retain the seminal switch-II-pocket report, an inactive-state covalent study, the AMG 510 discovery report, and a recent resistance study returned by the recorded PubMed searches.",
        "record_count": len(records),
        "earliest_record": records[0]["pmid"],
        "latest_record": records[-1]["pmid"],
        "pmc_record_count": sum(bool(item["pmc_record_available"]) for item in records),
        "pmc_open_access_count": sum(bool(item["pmc_open_access"]) for item in records),
        "access_class_counts": dict(sorted(access.items())),
        "timeline": [
            {
                "date": item["date"],
                "pmid": item["pmid"],
                "title": item["title"],
                "project_label": item["project_label"]
            }
            for item in records
        ],
        "interpretation": "The four-record trail links a structural starting point to inactive-state covalent pharmacology, candidate discovery, and later resistance research. It is a curated teaching trail rather than a systematic review."
    }
    DESTINATION.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
