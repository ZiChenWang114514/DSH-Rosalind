from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
before = json.loads((ROOT / "inputs/recovery-before.json").read_text(encoding="utf-8"))
after = json.loads((ROOT / "inputs/recovery-after.json").read_text(encoding="utf-8"))
model = json.loads((ROOT / "outputs/recovery-state-machine.json").read_text(encoding="utf-8"))
rosalind = json.loads((ROOT / "outputs/rosalind-open-observation.json").read_text(encoding="utf-8"))

for key in ("public_url", "bytes", "sha256", "matrix", "matrix_value_scale", "historical_source_id", "source_revision"):
    assert before["source"][key] == after["source"][key]
assert before["source"]["authorization_alias"] != after["source"]["authorization_alias"]
assert before["jobs"]["cancel_A"]["durable_id"] == after["jobs"]["cancel_A"]["durable_id"]
assert before["jobs"]["cancel_A"]["execution_settled"] is True
assert after["jobs"]["cancel_A"]["resume_attempted"] is False
assert before["jobs"]["recover_B"]["durable_id"] == after["jobs"]["recover_B"]["durable_id"]
assert after["jobs"]["recover_B"]["current_attempt"] == before["jobs"]["recover_B"]["attempt"] + 1
assert before["jobs"]["recover_B"]["source_revision"] == after["jobs"]["recover_B"]["source_revision"]
assert before["credentials_included"] is after["credentials_included"] is False
assert before["viewer_execution"] is after["viewer_execution"] is False
assert rosalind["schema"] == "rosalind.open-observation/v1"
assert rosalind["tool"] == "mcp__rosalind__rosalind_open"
assert rosalind["arguments"]["task_context"].startswith("Workflow cancellation")
assert rosalind["response_message"] == "Rosalind Workbench is ready. Choose a research task in the app."
assert rosalind["ready"] is True and rosalind["scientific_job_executed"] is False

expected_tools = {
    "slide-viewer.slide_cancel_workflow",
    "slide-viewer.slide_get_workflow",
    "slide-viewer.slide_get_live_workflow",
    "slide-viewer.slide_resume_workflow",
}
assert set(model["viewer_operations"]) == expected_tools
with (ROOT / "outputs/manifest-diff.csv").open(newline="", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))
assert len(rows) == 12 and all(row["result"] == "pass" for row in rows)

result = {
    "showcase_id": "slide-workflow-recovery",
    "verification_kind": "deterministic before-and-after workflow manifest validation",
    "manifest_checks": len(rows),
    "manifest_checks_passed": len(rows),
    "source_content_unchanged": True,
    "terminal_cancel_job_resumed": False,
    "recoverable_job_attempt_incremented": True,
    "credentials_present": False,
    "rosalind_launcher_invoked": True,
    "rosalind_scientific_task_executed": False,
    "viewer_operations_executed": False
}
(ROOT / "outputs/local-validation.json").write_bytes((json.dumps(result, indent=2) + "\n").encode("utf-8"))
print(f"PASS {result['showcase_id']}: {len(rows)} manifest checks; viewer operations rehearsed")
