#!/usr/bin/env python3
"""Build the airway RNA-seq study summary from the retained BioStudies record."""

from __future__ import annotations

import json
from pathlib import Path


CASE = Path(__file__).resolve().parents[1]
INPUT = CASE / "inputs"
OUTPUT = CASE / "outputs"


def attr(items, name):
    return next(item["value"] for item in items if item["name"] == name)


def flat(items):
    for item in items:
        if isinstance(item, list):
            yield from flat(item)
        else:
            yield item


def main() -> None:
    study = json.loads((INPUT / "biostudies-E-GEOD-52778.json").read_text(encoding="utf-8"))
    sections = list(flat(study["section"]["subsections"]))
    samples = next(s for s in sections if s["type"] == "Samples")
    assays = next(s for s in sections if s["type"] == "Assays and Data")
    factors = next(s for s in flat(samples["subsections"]) if s["type"] == "Experimental Factors")
    factor_rows = list(flat(factors["subsections"]))
    groups = {attr(row["attributes"], "treatment"): int(attr(row["attributes"], "No. of Samples")) for row in factor_rows}
    characteristics = next(s for s in flat(samples["subsections"]) if s["type"] == "Source Characteristics")
    cell_rows = list(flat(characteristics["subsections"]))
    cell_lines = {attr(row["attributes"], "cell line"): int(attr(row["attributes"], "No. of Samples")) for row in cell_rows}
    mage_tab = next(s for s in flat(assays["subsections"]) if s["type"] == "MAGE-TAB Files")
    files = list(flat(mage_tab["files"]))
    assert study["accno"] == "E-GEOD-52778"
    assert sum(groups.values()) == 16 and set(groups.values()) == {4}
    result = {
        "showcase_id": "databases-airway-rnaseq",
        "retrieved_at_utc": "2026-08-29T18:15:55Z",
        "study": {
            "accession": study["accno"],
            "title": attr(study["attributes"], "Title"),
            "study_type": attr(study["section"]["attributes"], "Study type"),
            "organism": attr(study["section"]["attributes"], "Organism"),
            "sample_count": int(attr(samples["attributes"], "Sample count")),
            "assay_count": int(attr(assays["attributes"], "Assay count")),
            "technology": attr(assays["attributes"], "Technology"),
        },
        "treatment_groups": groups,
        "cell_lines": cell_lines,
        "design_checks": {
            "four_treatment_groups": len(groups) == 4,
            "four_samples_per_group": set(groups.values()) == {4},
            "four_cell_lines": len(cell_lines) == 4,
            "one_sample_per_cell_line_treatment_combination": sum(groups.values()) == len(groups) * len(cell_lines),
        },
        "metadata_files": [{"path": f["path"], "bytes": f["size"]} for f in files],
        "interpretation": "The retained study-level metadata describe four airway smooth-muscle cell lines and four treatment conditions. They support treatment-group planning, but they do not support a paired or donor-aware model until the SDRF sample-to-donor mapping has been extracted and verified.",
        "limitations": [
            "The case inspects study and sample metadata only; reads were not downloaded and differential expression was not run.",
            "The study description mentions four donors, but the retained compact record does not establish the sample-to-donor assignments required for donor-aware modeling.",
            "The combined albuterol-dexamethasone group should not be merged with dexamethasone alone.",
        ],
    }
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">Airway RNA-seq dataset discovery</title><desc id="desc">Balanced treatment-by-cell-line design in BioStudies E-GEOD-52778.</desc><rect width="1200" height="675" fill="#0a1524"/><rect x="48" y="42" width="1104" height="590" rx="26" fill="#14283d" stroke="#34536d"/><style>.t{font:700 38px Segoe UI,Arial;fill:#f8fbff}.s{font:18px Segoe UI,Arial;fill:#afc0d1}.h{font:700 17px Segoe UI,Arial;fill:#6fe3cf}.v{font:700 26px Segoe UI,Arial;fill:#fff}.m{font:16px Consolas,monospace;fill:#d1deea}</style><text x="80" y="105" class="t">Airway smooth-muscle RNA-seq</text><text x="80" y="143" class="s">BioStudies / ArrayExpress E-GEOD-52778 · 16 samples · 16 sequencing assays</text><text x="80" y="215" class="h">BALANCED 4 × 4 DESIGN</text><g fill="#1d3b57" stroke="#5d89ad"><rect x="85" y="255" width="235" height="95" rx="16"/><rect x="345" y="255" width="235" height="95" rx="16"/><rect x="605" y="255" width="235" height="95" rx="16"/><rect x="865" y="255" width="235" height="95" rx="16"/></g><text x="202" y="294" text-anchor="middle" class="h">UNTREATED</text><text x="202" y="329" text-anchor="middle" class="v">n = 4</text><text x="462" y="294" text-anchor="middle" class="h">ALBUTEROL</text><text x="462" y="329" text-anchor="middle" class="v">n = 4</text><text x="722" y="294" text-anchor="middle" class="h">DEXAMETHASONE</text><text x="722" y="329" text-anchor="middle" class="v">n = 4</text><text x="982" y="286" text-anchor="middle" class="h">ALBUTEROL +</text><text x="982" y="307" text-anchor="middle" class="h">DEXAMETHASONE</text><text x="982" y="337" text-anchor="middle" class="v">n = 4</text><rect x="85" y="420" width="1015" height="125" rx="20" fill="#19364d"/><text x="115" y="462" class="h">BIOLOGICAL UNITS</text><text x="115" y="504" class="v">4 airway smooth-muscle cell lines</text><text x="115" y="535" class="m">N052611 · N061011 · N080611 · N61311 · one sample per treatment and cell line</text><text x="80" y="602" class="s">Metadata support study planning; reads and differential-expression results are absent from this case.</text></svg>'''
    (CASE / "previews" / "preview.svg").write_text(svg + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
