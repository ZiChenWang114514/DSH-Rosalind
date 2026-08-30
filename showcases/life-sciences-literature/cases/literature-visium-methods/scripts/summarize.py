#!/usr/bin/env python3
"""Build the deterministic Visium-methods teaching summary from retained API evidence."""

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
    access = Counter(item["license_code"] or "no PMC license record" for item in records)
    result = {
        "schema": "literature.deterministic-summary/v1",
        "case_id": evidence["case_id"],
        "source_retrieved_at_utc": evidence["retrieved_at_utc"],
        "selection_rule": "Use the five exact method names in the recorded PubMed title query, then classify each title into a complementary workflow role.",
        "record_count": len(records),
        "pmc_record_count": sum(bool(item["pmc_record_available"]) for item in records),
        "pmc_open_access_count": sum(bool(item["pmc_open_access"]) for item in records),
        "license_class_counts": dict(sorted(access.items())),
        "workflow_roles": [
            {
                "pmid": item["pmid"],
                "method": item["title"].rstrip("."),
                "role": item["method_role"],
                "pmc_status": "open access" if item["pmc_open_access"] else "PMC manuscript or TDM record"
            }
            for item in records
        ],
        "interpretation": "The selected papers form a complementary methods set spanning data infrastructure, artifact correction, denoising, spatial analysis, and region-aware inference. No single record is treated as a complete Visium workflow."
    }
    DESTINATION.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
