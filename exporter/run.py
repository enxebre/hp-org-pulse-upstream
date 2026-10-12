#!/usr/bin/env python3
"""Generate an Org Pulse Cyborg snapshot from the supported Cyborg data API."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .cyborg_snapshot import export_snapshot, write_snapshot


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope-name", default=os.getenv("CYBORG_SCOPE_NAME", "Fleet Engineering"))
    parser.add_argument("--scope-type", default=os.getenv("CYBORG_SCOPE_TYPE", "pillar"))
    parser.add_argument("--bucket", default=os.getenv("CYBORG_SOURCE_BUCKET", "resolved-org"))
    parser.add_argument(
        "--object-path",
        default=os.getenv("CYBORG_SOURCE_OBJECT", "orgdata/comprehensive_index_dump.json"),
    )
    parser.add_argument("--project-id", default=os.getenv("CYBORG_GCP_PROJECT", "openshift-crt"))
    parser.add_argument("--output", default=os.getenv("CYBORG_OUTPUT"))
    parser.add_argument(
        "--optional-fields",
        default=os.getenv("CYBORG_OPTIONAL_FIELDS", "repositories,jira,slackChannels"),
        help="Comma-separated optional snapshot fields to include",
    )
    parser.add_argument(
        "--source-check-interval-minutes",
        type=int,
        default=int(os.getenv("CYBORG_SOURCE_CHECK_INTERVAL_MINUTES", "5")),
    )
    args = parser.parse_args()
    if not args.output:
        parser.error("--output or CYBORG_OUTPUT is required")
    return args


def main() -> None:
    args = _arguments()
    try:
        from orgdatacore import GCSConfig, GCSDataSource, Service
    except ImportError as error:
        raise SystemExit("install the pinned orgdatacore[gcs] dependency first") from error

    try:
        service = Service(data_source=GCSDataSource(GCSConfig(
            bucket=args.bucket,
            object_path=args.object_path,
            project_id=args.project_id,
            check_interval=timedelta(minutes=args.source_check_interval_minutes),
        )))
        snapshot = export_snapshot(
            service,
            scope_name=args.scope_name,
            scope_type=args.scope_type,
            generated_at=datetime.now(timezone.utc),
            optional_fields={field.strip() for field in args.optional_fields.split(",") if field.strip()},
        )
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        write_snapshot(snapshot, output)
    except Exception:
        raise SystemExit("Cyborg snapshot export failed; person-level details were suppressed") from None
    print(json.dumps({
        "status": "success",
        "source": snapshot["source"],
        "scope": snapshot["scope"],
        "generatedAt": snapshot["generatedAt"],
        "peopleCount": len(snapshot["people"]),
        "teamAssignmentCount": sum(len(person["teams"]) for person in snapshot["people"]),
        "unassignedCount": sum(not person["teams"] for person in snapshot["people"]),
        "output": str(output),
    }, sort_keys=True))


if __name__ == "__main__":
    main()
