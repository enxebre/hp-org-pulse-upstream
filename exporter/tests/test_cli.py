"""Command-line tests for the FCN-745 exporter."""

import contextlib
import io
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[2]))

from exporter import run  # noqa: E402


class SyntheticService:
    def __init__(self, data_source):
        self.data_source = data_source

    def get_descendants_tree(self, scope_name):
        return {"name": scope_name, "type": "team", "children": []}

    def get_all_employee_uids(self):
        return ["SYNTHETIC-USER"]

    def get_employee_by_uid(self, uid):
        return {"uid": uid}

    def get_teams_for_uid(self, _uid):
        return []

    def get_user_memberships(self, _uid):
        return [{"name": "Synthetic Team", "type": "team"}]


def fake_orgdatacore(service_class=SyntheticService):
    module = types.ModuleType("orgdatacore")
    module.GCSConfig = lambda **kwargs: kwargs
    module.GCSDataSource = lambda config: config
    module.Service = service_class
    return module


class ExporterCliTests(unittest.TestCase):
    def test_cli_writes_valid_snapshot_and_prints_aggregate_summary(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "nested" / "enrichment.json"
            argv = [
                "exporter.run", "--scope-name", "Synthetic Team", "--scope-type", "team",
                "--output", str(output),
            ]
            stdout = io.StringIO()
            with patch.object(sys, "argv", argv), patch.dict(sys.modules, orgdatacore=fake_orgdatacore()):
                with contextlib.redirect_stdout(stdout):
                    run.main()

            snapshot = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(snapshot["people"][0]["uid"], "synthetic-user")
            self.assertEqual(snapshot["people"][0]["teams"], [])
            summary = json.loads(stdout.getvalue())
            self.assertEqual(summary["peopleCount"], 1)
            self.assertEqual(summary["unassignedCount"], 1)
            self.assertNotIn("synthetic-user", stdout.getvalue())

    def test_cli_suppresses_person_level_source_errors(self):
        class FailingService(SyntheticService):
            def get_all_employee_uids(self):
                raise RuntimeError("sensitive-user-identifier")

        with tempfile.TemporaryDirectory() as temporary:
            argv = ["exporter.run", "--output", str(Path(temporary) / "snapshot.json")]
            with patch.object(sys, "argv", argv), patch.dict(
                sys.modules, orgdatacore=fake_orgdatacore(FailingService)
            ):
                with self.assertRaisesRegex(SystemExit, "person-level details were suppressed") as raised:
                    run.main()
            self.assertNotIn("sensitive-user-identifier", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
