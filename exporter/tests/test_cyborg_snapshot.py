"""FCN-745 exporter contract tests using only the Python standard library."""

import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2]))

from exporter.cyborg_snapshot import (  # noqa: E402
    SnapshotError,
    build_snapshot,
    collect_scope_records,
    export_snapshot,
    normalize_uid,
    validate_snapshot,
)


class FakeService:
    def get_all_employee_uids(self):
        return ["DIRECT", "team-member", "outside"]

    def is_employee_in_org(self, uid, scope_name):
        return scope_name == "Fleet Engineering" and uid != "outside"

    def get_employee_by_uid(self, uid):
        return {"uid": uid, "full_name": uid.title()}

    def get_teams_for_uid(self, uid):
        return {"direct": [], "team-member": ["Fleet Console Next"]}.get(uid, [])


class HierarchyService:
    def get_descendants_tree(self, scope_name):
        if scope_name != "Fleet Engineering":
            return None
        return {
            "name": scope_name,
            "type": "pillar",
            "children": [{
                "name": "Fleet Experience",
                "type": "team_group",
                "children": [
                    {"name": "Fleet Console Next", "type": "team", "children": []},
                    {"name": "Fleet Services", "type": "team", "children": []},
                ],
            }],
        }

    def get_all_employee_uids(self):
        return ["direct", "multi", "outside"]

    def get_employee_by_uid(self, uid):
        return {
            "uid": uid,
            "full_name": uid.title(),
            "github_id": f"gh-{uid}" if uid != "direct" else "",
            "manager_uid": "MGR" if uid == "multi" else "",
        }

    def get_teams_for_uid(self, uid):
        return {
            "direct": ["Unrelated Team"],
            "multi": ["Fleet Services", "Unrelated Team", "Fleet Console Next"],
            "outside": ["Unrelated Team"],
        }[uid]

    def get_user_memberships(self, uid):
        return {
            "direct": [{"name": "Fleet Engineering", "type": "pillar"}],
            "multi": [{"name": "Fleet Console Next", "type": "team"}],
            "outside": [{"name": "Unrelated Team", "type": "team"}],
        }[uid]

    def get_hierarchy_path(self, name, entity_type):
        if name in {"Fleet Console Next", "Fleet Services"}:
            return [
                {"name": "Fleet Engineering", "type": "pillar"},
                {"name": "Fleet Experience", "type": "team_group"},
                {"name": name, "type": entity_type},
            ]
        return [{"name": name, "type": entity_type}]

    def get_team_by_name(self, name):
        return {
            "group": {
                "repos": [{"repo": f"https://github.com/example/{name.replace(' ', '-').lower()}"}],
                "jiras": [{"project": "FCN"}],
                "slack": {"channels": [{"channel": "fleet-dev"}]},
            }
        }


class CyborgSnapshotTests(unittest.TestCase):
    def test_fixture_parsing_and_serialization(self):
        fixture = Path(__file__).parents[1] / "fixtures/raw-employees.json"
        records = json.loads(fixture.read_text(encoding="utf-8"))
        snapshot = build_snapshot(records, scope_name="Fleet Engineering", scope_type="pillar",
                                  generated_at=datetime(2026, 10, 5, tzinfo=timezone.utc))
        self.assertEqual([person["uid"] for person in snapshot["people"]], ["alice", "bob-1"])
        self.assertEqual(snapshot["people"][0]["teams"], ["Fleet Console Next"])
        self.assertEqual(snapshot["people"][1]["teams"], [])

    def test_uid_normalization_and_deduplication(self):
        self.assertEqual(normalize_uid("  ALICE  "), "alice")
        with self.assertRaisesRegex(SnapshotError, "collision"):
            build_snapshot([{"uid": "Alice", "teams": []}, {"uid": " alice ", "teams": []}],
                           scope_name="Fleet Engineering", scope_type="pillar")

    def test_schema_validation(self):
        snapshot = build_snapshot([{"uid": "a", "teams": []}], scope_name="Fleet Engineering",
                                  scope_type="pillar")
        snapshot["people"][0]["unexpected"] = True
        with self.assertRaisesRegex(SnapshotError, "unsupported"):
            validate_snapshot(snapshot)

    def test_schema_validation_rejects_invalid_optional_field_shapes(self):
        invalid_people = [
            {"uid": "a", "teams": [], "fullName": 7},
            {"uid": "a", "teams": [], "email": ["a@example.invalid"]},
            {"uid": "a", "teams": [], "jobTitle": False},
            {"uid": "a", "teams": [], "githubUsername": {"name": "alice"}},
            {"uid": "a", "teams": [], "repositories": {"repo": "https://example.invalid/repo"}},
            {"uid": "a", "teams": [], "slackChannels": "fleet-dev"},
            {"uid": "a", "teams": [], "jira": {"project": "FCN"}},
            {"uid": "a", "teams": [], "repositories": ["https:///missing-host"]},
            {"uid": "a", "teams": [], "repositories": ["https://example.invalid:99999/repo"]},
        ]
        for person in invalid_people:
            with self.subTest(person=person):
                snapshot = {
                    "schemaVersion": 1,
                    "source": "cyborg",
                    "generatedAt": "2026-10-05T12:00:00.000Z",
                    "scope": {"name": "Fleet Engineering", "type": "pillar"},
                    "people": [person],
                }
                with self.assertRaises(SnapshotError):
                    validate_snapshot(snapshot)

    def test_schema_validation_requires_core_timestamp_and_top_level_fields(self):
        snapshot = build_snapshot([{"uid": "a", "teams": []}], scope_name="Fleet Engineering",
                                  scope_type="pillar")
        for timestamp in (
            "2026-10-05T12:00Z",
            "2026-10-05T12:00:00.1234Z",
            "2026-10-05T12:00:00+00:00",
        ):
            with self.subTest(timestamp=timestamp):
                invalid = dict(snapshot, generatedAt=timestamp)
                with self.assertRaisesRegex(SnapshotError, "generatedAt"):
                    validate_snapshot(invalid)

        with self.assertRaisesRegex(SnapshotError, "top-level"):
            validate_snapshot({key: value for key, value in snapshot.items() if key != "scope"})

        invalid_version = dict(snapshot, schemaVersion=True)
        with self.assertRaisesRegex(SnapshotError, "schemaVersion/source"):
            validate_snapshot(invalid_version)

    def test_missing_or_partial_data_fails_closed(self):
        with self.assertRaisesRegex(SnapshotError, "no people"):
            build_snapshot([], scope_name="Fleet Engineering", scope_type="pillar")
        with self.assertRaisesRegex(SnapshotError, "missing teams"):
            build_snapshot([{"uid": "a"}], scope_name="Fleet Engineering", scope_type="pillar")
        with self.assertRaisesRegex(SnapshotError, "invalid github"):
            build_snapshot([{"uid": "a", "teams": [], "githubUsername": " "}],
                           scope_name="Fleet Engineering", scope_type="pillar")

    def test_direct_and_descendant_membership(self):
        snapshot = export_snapshot(FakeService(), scope_name="Fleet Engineering", scope_type="pillar")
        self.assertEqual([person["uid"] for person in snapshot["people"]], ["direct", "team-member"])
        self.assertEqual(snapshot["people"][0]["teams"], [])

    def test_pillar_scope_filters_unrelated_teams_and_collects_enrichment(self):
        snapshot = export_snapshot(
            HierarchyService(), scope_name="Fleet Engineering", scope_type="pillar"
        )
        self.assertEqual([person["uid"] for person in snapshot["people"]], ["direct", "multi"])
        self.assertEqual(snapshot["people"][0]["teams"], [])
        multi = snapshot["people"][1]
        self.assertEqual(multi["teams"], ["Fleet Console Next", "Fleet Services"])
        self.assertEqual(multi["managerUid"], "mgr")
        self.assertEqual(multi["githubUsername"], "gh-multi")
        self.assertEqual(multi["jira"], [{"project": "FCN"}])
        self.assertEqual(multi["slackChannels"], ["fleet-dev"])
        self.assertEqual(len(multi["repositories"]), 2)

    def test_optional_field_policy_omits_unapproved_identity_fields(self):
        snapshot = export_snapshot(
            HierarchyService(),
            scope_name="Fleet Engineering",
            scope_type="pillar",
            optional_fields={"repositories", "jira"},
        )
        multi = snapshot["people"][1]
        self.assertNotIn("fullName", multi)
        self.assertNotIn("managerUid", multi)
        self.assertNotIn("githubUsername", multi)
        self.assertIn("repositories", multi)

    def test_missing_configured_scope_fails_closed(self):
        service = HierarchyService()
        service.get_descendants_tree = lambda _name: None
        with self.assertRaisesRegex(SnapshotError, "scope was not found"):
            export_snapshot(service, scope_name="Missing", scope_type="pillar")

    def test_generated_snapshot_freshness_metadata(self):
        generated_at = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)
        snapshot = export_snapshot(FakeService(), scope_name="Fleet Engineering", scope_type="pillar",
                                   generated_at=generated_at)
        self.assertEqual(snapshot["generatedAt"], "2026-10-05T12:00:00.000Z")
        self.assertEqual(snapshot["source"], "cyborg")


if __name__ == "__main__":
    unittest.main()
