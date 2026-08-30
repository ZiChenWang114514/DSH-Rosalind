#!/usr/bin/env python3
"""Start and cancel one disposable child process, then retain bounded evidence."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path


CHILD = """import json, sys, time
from datetime import datetime, timezone
from pathlib import Path
marker = Path(sys.argv[1])
marker.write_text(json.dumps({"started_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}) + "\\n", encoding="utf-8")
while True:
    time.sleep(0.1)
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: run_cancellation_demo.py OUTPUT.json")
    output = Path(sys.argv[1])
    timeline: list[dict[str, object]] = []

    with tempfile.TemporaryDirectory(prefix="gpt-science-ngs-cancel-") as temporary:
        temporary_path = Path(temporary)
        marker = temporary_path / "started.json"
        child = subprocess.Popen([sys.executable, "-c", CHILD, str(marker)])
        deadline = time.monotonic() + 5
        while not marker.exists() and child.poll() is None and time.monotonic() < deadline:
            time.sleep(0.05)
        if not marker.exists():
            child.terminate()
            child.wait(timeout=5)
            raise RuntimeError("disposable child did not report its started state")

        started = json.loads(marker.read_text(encoding="utf-8"))
        timeline.append({"state": "running", "observed_at_utc": started["started_at_utc"]})
        cancellation_requested_at = utc_now()
        child.terminate()
        return_code = child.wait(timeout=5)
        timeline.append({"state": "terminated", "observed_at_utc": utc_now()})

    payload = {
        "schema": "gpt-science.cancellation-observation/v1",
        "case_id": "ngs-run-cancellation",
        "process_kind": "disposable local Python child",
        "timeline": timeline,
        "cancellation_requested": True,
        "cancellation_requested_at_utc": cancellation_requested_at,
        "terminal_state": "terminated",
        "child_return_code": return_code,
        "child_running_after_cancellation": False,
        "temporary_directory_removed": not temporary_path.exists(),
        "workflow_engine_executed": False,
        "workbench_run_registered": False,
        "scientific_result_available": False,
        "limitation": "This observes local child-process cancellation only; no Nextflow, Snakemake, or NGS Analysis Workbench engine run executed."
    }
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
