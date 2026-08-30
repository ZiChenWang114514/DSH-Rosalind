from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
before = json.loads((ROOT / "inputs/authorization-before.json").read_text(encoding="utf-8"))
after = json.loads((ROOT / "inputs/authorization-after.json").read_text(encoding="utf-8"))
validation = json.loads((ROOT / "outputs/authorization-validation.json").read_text(encoding="utf-8"))
rosalind = json.loads((ROOT / "outputs/rosalind-open-observation.json").read_text(encoding="utf-8"))

assert before["session_id"] == after["session_id"]
for key in ("source_id", "source_revision", "public_url", "bytes"):
    assert before["source"][key] == after["source"][key]
for key in ("layer_id", "layer_source_revision", "entity_kind", "entity_count"):
    assert before["scientific_layer"][key] == after["scientific_layer"][key]
for group in ("source", "scientific_layer"):
    assert before[group]["lease_label"] != after[group]["lease_label"]
    old = datetime.fromisoformat(before[group]["expires_at"].replace("Z", "+00:00"))
    new = datetime.fromisoformat(after[group]["expires_at"].replace("Z", "+00:00"))
    assert new > old
assert before["credentials_included"] is after["credentials_included"] is False
assert before["viewer_execution"] is after["viewer_execution"] is False
assert rosalind["schema"] == "rosalind.open-observation/v1"
assert rosalind["tool"] == "mcp__rosalind__rosalind_open"
assert rosalind["arguments"]["task_context"].startswith("Source and scientific-layer")
assert rosalind["response_message"] == "Rosalind Workbench is ready. Choose a research task in the app."
assert rosalind["ready"] is True and rosalind["scientific_job_executed"] is False

expected_tools = {
    "slide-viewer.slide_renew_source_authorization",
    "slide-viewer.slide_renew_scientific_layer_authorization",
    "slide-viewer.slide_list_workflow_sources",
    "slide-viewer.slide_get_scientific_layer_import",
    "slide-viewer.slide_list_scientific_layers",
}
assert set(validation["viewer_operations"]) == expected_tools
with (ROOT / "outputs/authorization-diff.csv").open(newline="", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))
assert len(rows) == 14 and all(row["result"] == "pass" for row in rows)
print(f"PASS {validation['showcase_id']}: {len(rows)} authorization checks; viewer operations rehearsed")
