from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PLAN = json.loads((ROOT / "inputs/pathology-plan.json").read_text(encoding="utf-8"))
MODEL = json.loads((ROOT / "outputs/pathology-state-machine.json").read_text(encoding="utf-8"))
ROSALIND = json.loads((ROOT / "outputs/rosalind-open-observation.json").read_text(encoding="utf-8"))

expected_tools = {
    "slide-viewer.slide_get_pathology",
    "slide-viewer.slide_cancel_pathology",
    "slide-viewer.slide_resume_pathology",
}
assert set(PLAN["current_contract"]["available"]) == expected_tools
assert set(MODEL["viewer_operations"]) == expected_tools
assert PLAN["current_contract"]["start_operation_available"] is False
assert PLAN["execution"] == {"viewer_opened": False, "pathology_job_started": False, "remote_workflow_called": False}
assert PLAN["source"]["bytes"] == 132565343
assert PLAN["source"]["sha256"] == "9a1923cd9bcb260ba4d99d64f8d6e32550648c332ba48817f920662f3a513420"
assert ROSALIND["schema"] == "rosalind.open-observation/v1"
assert ROSALIND["tool"] == "mcp__rosalind__rosalind_open"
assert ROSALIND["arguments"]["task_context"].startswith("Pathology lifecycle")
assert ROSALIND["response_message"] == "Rosalind Workbench is ready. Choose a research task in the app."
assert ROSALIND["ready"] is True and ROSALIND["scientific_job_executed"] is False

allowed = {(row["from"], row["event"], row["to"]) for row in MODEL["transitions"]}
with (ROOT / "outputs/state-transition-checks.csv").open(newline="", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))
for row in rows:
    observed = (row["from_state"], row["event"], row["to_state"]) in allowed
    assert observed == (row["expected_allowed"] == "true")
    assert observed == (row["observed_allowed"] == "true")

result = {
    "showcase_id": "slide-pathology-workflow",
    "verification_kind": "deterministic local pathology state-machine validation",
    "source_pin_checked": True,
    "transition_cases": len(rows),
    "allowed_cases": sum(row["observed_allowed"] == "true" for row in rows),
    "rejected_cases": sum(row["observed_allowed"] == "false" for row in rows),
    "all_checks_passed": True,
    "rosalind_launcher_invoked": True,
    "rosalind_scientific_task_executed": False,
    "viewer_operations_executed": False,
    "remote_workflow_executed": False
}
(ROOT / "outputs/local-validation.json").write_bytes((json.dumps(result, indent=2) + "\n").encode("utf-8"))
print(f"PASS {result['showcase_id']}: {len(rows)} transition cases; viewer operations rehearsed")
