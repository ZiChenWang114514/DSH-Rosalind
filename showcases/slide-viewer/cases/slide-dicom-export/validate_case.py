from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
objects = json.loads((ROOT / "inputs/dicom-metadata.json").read_text(encoding="utf-8"))
plan = json.loads((ROOT / "outputs/dicom-export-plan.json").read_text(encoding="utf-8"))
rosalind = json.loads((ROOT / "outputs/rosalind-open-observation.json").read_text(encoding="utf-8"))
assert isinstance(objects, list) and len(objects) == 1
obj = objects[0]
value = lambda tag: obj[tag]["Value"][0]

assert value("00080016") == "1.2.840.10008.5.1.4.1.1.77.1.6"
assert value("00080060") == "SM"
uids = [value(tag) for tag in ("00080018", "0020000D", "0020000E", "00200052")]
assert len(set(uids)) == 4
assert all(len(uid) <= 64 and re.fullmatch(r"[0-9]+(?:\.[0-9]+)+", uid) for uid in uids)
rows, columns = value("00280010"), value("00280011")
total_rows, total_columns = value("00480007"), value("00480006")
frames = value("00280008")
assert total_rows % rows == total_columns % columns == 0
assert frames == (total_rows // rows) * (total_columns // columns) == 16
assert value("00280002") == 3 and value("00280004") == "RGB"
assert not ({"00100010", "00100020", "00080050", "7FE00010"} & set(obj))
assert "BulkDataURI" not in json.dumps(objects)

output_uids = {plan["planned_output"]["new_series_instance_uid"], plan["planned_output"]["new_sop_instance_uid"]}
assert len(output_uids) == 2 and output_uids.isdisjoint(uids)
assert plan["planned_output"]["dicom_instance_written"] is False
assert plan["upload"]["authorized"] is False
assert plan["upload"]["prepare_called"] is plan["upload"]["submit_called"] is False
assert rosalind["schema"] == "rosalind.open-observation/v1"
assert rosalind["tool"] == "mcp__rosalind__rosalind_open"
assert rosalind["arguments"]["task_context"].startswith("Metadata-only DICOM")
assert rosalind["response_message"] == "Rosalind Workbench is ready. Choose a research task in the app."
assert rosalind["ready"] is True and rosalind["scientific_job_executed"] is False
expected_tools = {
    "slide-viewer.slide_query_dicomweb",
    "slide-viewer.slide_inspect_dicomweb_instance",
    "slide-viewer.slide_read_dicomweb_object",
    "slide-viewer.slide_import_dicom_object",
    "slide-viewer.slide_export_dicom_object",
    "slide-viewer.slide_prepare_dicom_upload",
    "slide-viewer.slide_submit_dicom_upload",
}
assert set(plan["viewer_operations"]) == expected_tools

with (ROOT / "outputs/dicom-metadata-validation.csv").open(newline="", encoding="utf-8") as handle:
    checks = list(csv.DictReader(handle))
assert len(checks) == 12 and all(row["result"] == "pass" for row in checks)
result = {
    "showcase_id": "slide-dicom-export",
    "verification_kind": "deterministic local DICOM JSON metadata validation",
    "metadata_objects": 1,
    "metadata_checks": len(checks),
    "metadata_checks_passed": len(checks),
    "patient_or_accession_tags_present": False,
    "pixel_data_present": False,
    "dicom_instance_written": False,
    "upload_prepared": False,
    "upload_submitted": False,
    "rosalind_launcher_invoked": True,
    "rosalind_scientific_task_executed": False,
    "viewer_operations_executed": False
}
(ROOT / "outputs/local-validation.json").write_bytes((json.dumps(result, indent=2) + "\n").encode("utf-8"))
print(f"PASS {result['showcase_id']}: {len(checks)} metadata checks; no DICOM write or upload")
