#!/usr/bin/env python3
"""Build a bounded analysis of the public GSE52778 Cuffdiff result."""

from __future__ import annotations

import csv
import gzip
import io
import json
import math
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE_URL = "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE52nnn/GSE52778/suppl/GSE52778_Dex_vs_Untreated_gene_exp.diff.gz"
ENTRY_URL = "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE52778"
THEMES = {
    "glucocorticoid-response panel": {"FKBP5", "TSC22D3", "KLF15", "DUSP1", "PER1", "KLF9", "CRISPLD2"},
    "extracellular-matrix panel": {"SPARCL1", "COL1A1", "COL3A1", "FN1", "MMP1", "MMP3", "TIMP1"},
    "oxidative-and-metabolic panel": {"GPX3", "MAOA", "GLUL", "MT2A", "NNMT", "STEAP4"},
    "immune-and-complement panel": {"C7", "SERPINA3", "SAMHD1", "CCL2", "CXCL8", "IL6"},
}


def main() -> None:
    inputs = ROOT / "inputs"
    outputs = ROOT / "outputs"
    previews = ROOT / "previews"
    inputs.mkdir(exist_ok=True)
    outputs.mkdir(exist_ok=True)
    previews.mkdir(exist_ok=True)

    with urllib.request.urlopen(SOURCE_URL, timeout=60) as response:
        compressed = response.read()
    source_path = inputs / "GSE52778_Dex_vs_Untreated_gene_exp.diff.gz"
    source_path.write_bytes(compressed)
    rows = list(csv.DictReader(io.StringIO(gzip.decompress(compressed).decode("utf-8")), delimiter="\t"))
    tested = [row for row in rows if row["status"] == "OK" and row["gene"] not in ("", "-")]
    significant = [row for row in tested if row["significant"] == "yes" and float(row["q_value"]) <= 0.05]

    normalized = []
    for row in significant:
        dex = float(row["value_1"])
        untreated = float(row["value_2"])
        log2_dex_over_untreated = math.log2(dex / untreated) if dex > 0 and untreated > 0 else None
        normalized.append({
            "gene": row["gene"],
            "dex_fpkm": dex,
            "untreated_fpkm": untreated,
            "log2_dex_over_untreated": log2_dex_over_untreated,
            "source_log2_sample2_over_sample1": float(row["log2(fold_change)"]),
            "p_value": float(row["p_value"]),
            "q_value": float(row["q_value"]),
        })
    normalized.sort(key=lambda row: (row["q_value"], -abs(row["log2_dex_over_untreated"] or 0), row["gene"]))
    top = normalized[:25]
    with (outputs / "top-differential-genes.csv").open("w", encoding="utf-8", newline="") as handle:
        fields = list(top[0])
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in top:
            writer.writerow({key: (f"{value:.8g}" if isinstance(value, float) else value) for key, value in row.items()})

    significant_genes = {row["gene"] for row in normalized}
    theme_rows = []
    for theme, panel in THEMES.items():
        hits = sorted(panel & significant_genes)
        theme_rows.append({"theme": theme, "panel_size": len(panel), "significant_hits": len(hits), "genes": ";".join(hits)})
    with (outputs / "theme-panel-summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(theme_rows[0]))
        writer.writeheader()
        writer.writerows(theme_rows)

    up = sum((row["log2_dex_over_untreated"] or 0) > 0 for row in normalized)
    down = sum((row["log2_dex_over_untreated"] or 0) < 0 for row in normalized)
    summary = {
        "schema": "rosalind.airway-dex-analysis/v1",
        "geo_accession": "GSE52778",
        "source_rows": len(rows),
        "tested_ok_gene_rows": len(tested),
        "significant_q_le_0_05": len(normalized),
        "higher_in_dexamethasone": up,
        "lower_in_dexamethasone": down,
        "top_25_selection": "ascending q-value, then descending absolute recomputed log2(Dex/Untreated), then gene symbol",
        "leading_genes": [row["gene"] for row in top[:10]],
        "theme_method": "descriptive overlap with four predeclared small panels; no pathway-enrichment p-values were calculated",
        "direction_note": "The source names value_1 as Dex and value_2 as Untreated. Direction was recomputed directly as log2(value_1/value_2) because the source Cuffdiff fold-change column uses sample_2/sample_1.",
    }
    (outputs / "analysis-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    provenance = {
        "schema": "public-expression-source/v1",
        "geo_accession": "GSE52778",
        "entry_url": ENTRY_URL,
        "processed_result_url": SOURCE_URL,
        "retrieved_at_utc": "2026-08-29T18:20:00Z",
        "comparison": "Dex versus Untreated processed gene-level Cuffdiff table supplied by the study authors",
    }
    (inputs / "source-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")

    max_hits = max(row["significant_hits"] for row in theme_rows) or 1
    bars = []
    colors = ["#38bdf8", "#2dd4bf", "#a78bfa", "#fbbf24"]
    for index, row in enumerate(theme_rows):
        y = 330 + index * 62
        width = 250 * row["significant_hits"] / max_hits
        bars.append(f'<text x="500" y="{y}" class="s">{row["theme"]}</text><rect x="850" y="{y-25}" width="{width:.1f}" height="30" rx="7" fill="{colors[index]}"/><text x="1085" y="{y}" class="n">{row["significant_hits"]}</text>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">GSE52778 dexamethasone analysis</title><desc id="desc">Significant genes and descriptive theme-panel hits from the public Dex versus untreated table.</desc><rect width="1200" height="675" fill="#071522"/><circle cx="1090" cy="70" r="220" fill="#0e7490" opacity=".25"/>
<style>.k{{font:600 22px Segoe UI,Arial;fill:#67e8f9}}.t{{font:700 43px Segoe UI,Arial;fill:#f8fafc}}.b{{font:24px Segoe UI,Arial;fill:#cbd5e1}}.m{{font:700 39px Segoe UI,Arial;fill:#f8fafc}}.s{{font:18px Segoe UI,Arial;fill:#cbd5e1}}.n{{font:700 20px Segoe UI,Arial;fill:#f8fafc}}</style>
<text x="70" y="85" class="k">NCBI GEO GSE52778 · PROCESSED PUBLIC RNA-SEQ</text><text x="70" y="150" class="t">Dexamethasone airway response</text>
<rect x="70" y="215" width="360" height="330" rx="20" fill="#0f2538" stroke="#155e75"/><text x="105" y="275" class="b">Tested gene rows</text><text x="105" y="325" class="m">{len(tested):,}</text><text x="105" y="395" class="b">Significant at q ≤ 0.05</text><text x="105" y="445" class="m">{len(normalized)}</text><text x="105" y="510" class="s">{up} higher · {down} lower in Dex</text>
<text x="500" y="245" class="b">Descriptive panel hits among significant genes</text>{''.join(bars)}
<text x="70" y="620" class="s">Panels are transparent descriptive summaries, not formal pathway-enrichment tests.</text></svg>'''
    (previews / "preview.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
