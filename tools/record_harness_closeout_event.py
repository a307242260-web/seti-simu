#!/usr/bin/env python3
"""Append one lightweight SETI harness closeout signal as JSONL."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ISSUE_PATTERN = re.compile(r"^SETI-\d+$")
LOOP_TYPES = ("coding", "data_analysis", "exploratory_research", "coordination", "archive")
TARGETS = ("none", "loop_template", "watcher_lint", "issue_workflow", "agent_prompt", "project_memory")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue", required=True)
    parser.add_argument("--loop-type", required=True, choices=LOOP_TYPES)
    parser.add_argument("--observation", required=True)
    parser.add_argument("--signal", action="append", default=[])
    parser.add_argument("--evidence", action="append", default=[])
    parser.add_argument("--recommended-target", choices=TARGETS, default="none")
    parser.add_argument("--output")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    issue = args.issue.upper()
    if not ISSUE_PATTERN.fullmatch(issue):
        parser.error("--issue 必须为 SETI-<number>")

    now = datetime.now(timezone.utc)
    repository_root = Path(__file__).resolve().parent.parent
    output = Path(args.output) if args.output else (
        repository_root / "checkpoint" / "mocha_harness_closeout_events" / f"{now.date().isoformat()}.jsonl"
    )
    event = {
        "schema_version": "seti-harness-closeout-event-v1",
        "recorded_at": now.isoformat().replace("+00:00", "Z"),
        "issue": issue,
        "loop_type": args.loop_type,
        "observation": args.observation.strip(),
        "signals": [value.strip() for value in args.signal if value.strip()],
        "evidence": [value.strip() for value in args.evidence if value.strip()],
        "recommended_target": args.recommended_target,
        "promotion_status": "deferred_review",
    }
    encoded = json.dumps(event, ensure_ascii=False, sort_keys=True)
    if not args.dry_run:
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("a", encoding="utf-8") as stream:
            stream.write(encoded + "\n")
    print(json.dumps({"mode": "dry_run" if args.dry_run else "written", "output": str(output), "event": event}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
