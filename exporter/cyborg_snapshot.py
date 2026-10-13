"""HP-owned Cyborg snapshot exporter core.

The exporter is deliberately independent from the Org Pulse Node process. The
runtime supplies an ``orgdatacore`` service instance; publication is injected
separately so source identity and destination storage remain deployment-owned.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections.abc import Iterable, Mapping
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

SCHEMA_VERSION = 1
SOURCE = "cyborg"
TOP_LEVEL_FIELDS = {"schemaVersion", "source", "generatedAt", "scope", "people"}
PERSON_FIELDS = {
    "uid", "fullName", "email", "jobTitle", "managerUid", "teams",
    "githubUsername", "repositories", "jira", "slackChannels",
}
REQUIRED_PERSON_FIELDS = {"uid", "teams"}
OPTIONAL_PERSON_FIELDS = PERSON_FIELDS - REQUIRED_PERSON_FIELDS
UTC_TIMESTAMP_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$"
)


class SnapshotError(ValueError):
    """Raised when source data cannot produce a safe snapshot."""


def normalize_uid(value: object) -> str:
    """Apply Core's deterministic UID normalization rules."""

    if not isinstance(value, str):
        return ""
    return unicodedata.normalize("NFD", value).strip().lower()


def _value(record: object, *names: str) -> object:
    for name in names:
        if isinstance(record, Mapping) and name in record:
            return record[name]
        value = getattr(record, name, None)
        if value is not None:
            return value
    return None


def _string_list(value: object, *, sort: bool = False) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str) or not isinstance(value, Iterable):
        raise SnapshotError("expected an array of strings")
    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise SnapshotError("array contains a blank or non-string value")
        item = item.strip()
        if item not in seen:
            seen.add(item)
            result.append(item)
    return sorted(result, key=str.casefold) if sort else result


def _person(record: object) -> dict[str, object]:
    uid = normalize_uid(_value(record, "uid", "employee_uid", "id"))
    if not uid:
        raise SnapshotError("person is missing a non-empty uid")
    raw_teams = _value(record, "teams", "team_names")
    if raw_teams is None:
        raise SnapshotError(f"person {uid!r} is missing teams")

    result: dict[str, object] = {"uid": uid, "teams": _string_list(raw_teams, sort=True)}
    for output, names in {
        "fullName": ("fullName", "full_name", "name"),
        "email": ("email",),
        "jobTitle": ("jobTitle", "job_title", "title"),
    }.items():
        value = _value(record, *names)
        if isinstance(value, str) and value.strip():
            result[output] = value.strip()

    manager = _value(record, "managerUid", "manager_uid")
    if manager:
        normalized_manager = normalize_uid(manager)
        if not normalized_manager:
            raise SnapshotError(f"person {uid!r} has an invalid managerUid")
        result["managerUid"] = normalized_manager

    github = _value(record, "githubUsername", "github_username", "github_id")
    if github is not None:
        if not isinstance(github, str) or not github.strip():
            raise SnapshotError(f"person {uid!r} has an invalid githubUsername")
        result["githubUsername"] = github.strip()

    for output, names in {
        "repositories": ("repositories", "repos"),
        "slackChannels": ("slackChannels", "slack_channels"),
    }.items():
        value = _value(record, *names)
        if value is not None:
            result[output] = _string_list(value, sort=True)

    jira = _value(record, "jira", "jiras")
    if jira is not None:
        if not isinstance(jira, (list, tuple)) or any(
            not isinstance(item, Mapping) for item in jira
        ):
            raise SnapshotError(f"person {uid!r} has invalid jira metadata")
        result["jira"] = sorted(
            [dict(item) for item in jira],
            key=lambda item: (str(item.get("project", "")), str(item.get("boardId", ""))),
        )
    return result


def validate_snapshot(snapshot: object) -> None:
    """Validate the released Core 2.0.90 snapshot contract."""

    if (
        not isinstance(snapshot, dict)
        or set(snapshot) - TOP_LEVEL_FIELDS
        or not TOP_LEVEL_FIELDS.issubset(snapshot)
    ):
        raise SnapshotError("snapshot has an invalid top-level shape")
    version = snapshot.get("schemaVersion")
    if isinstance(version, bool) or version != SCHEMA_VERSION or snapshot.get("source") != SOURCE:
        raise SnapshotError("snapshot schemaVersion/source is invalid")
    generated_at = snapshot.get("generatedAt")
    if not isinstance(generated_at, str) or not UTC_TIMESTAMP_PATTERN.fullmatch(generated_at):
        raise SnapshotError("generatedAt must be a UTC ISO timestamp")
    try:
        datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise SnapshotError("generatedAt must be a UTC ISO timestamp") from error
    scope = snapshot.get("scope")
    if not isinstance(scope, dict) or set(scope) != {"name", "type"}:
        raise SnapshotError("scope must contain name and type")
    if any(not isinstance(scope[key], str) or not scope[key].strip() for key in ("name", "type")):
        raise SnapshotError("scope name and type must be non-empty strings")
    people = snapshot.get("people")
    if not isinstance(people, list) or not people:
        raise SnapshotError("people must be a non-empty array")

    seen: set[str] = set()
    for person in people:
        if not isinstance(person, dict) or set(person) - PERSON_FIELDS:
            raise SnapshotError("person contains unsupported fields")
        uid = normalize_uid(person.get("uid"))
        if not uid or uid != person.get("uid") or uid in seen:
            raise SnapshotError("person UID is empty, non-normalized, or duplicated")
        seen.add(uid)

        for field in ("fullName", "email", "jobTitle"):
            if field in person and person[field] is not None and not isinstance(person[field], str):
                raise SnapshotError(f"{field} must be a string when provided")

        teams = person.get("teams")
        if not isinstance(teams, list) or any(
            not isinstance(team, str) or not team.strip() for team in teams
        ):
            raise SnapshotError("person teams must contain strings")
        normalized_teams = [team.strip() for team in teams]
        if len(normalized_teams) != len(set(normalized_teams)):
            raise SnapshotError("person teams must be deduplicated")
        if "managerUid" in person and person["managerUid"] is not None:
            if not isinstance(person["managerUid"], str):
                raise SnapshotError("managerUid must be a string when provided")
            if normalize_uid(person["managerUid"]) != person["managerUid"]:
                raise SnapshotError("managerUid must be normalized")
        if "githubUsername" in person and person["githubUsername"] is not None:
            if not isinstance(person["githubUsername"], str) or not person["githubUsername"].strip():
                raise SnapshotError("githubUsername must be a non-empty string when provided")
        for field in ("repositories", "slackChannels"):
            if field in person:
                if not isinstance(person[field], list):
                    raise SnapshotError(f"{field} must be an array of strings")
                _string_list(person[field])
        for repository in person.get("repositories", []):
            try:
                parsed_repository = urlparse(repository)
                valid_repository = (
                    parsed_repository.scheme in {"http", "https"}
                    and bool(parsed_repository.netloc)
                    and bool(parsed_repository.hostname)
                    and not any(character.isspace() for character in parsed_repository.netloc)
                )
                port = parsed_repository.port  # Force validation of malformed ports.
                valid_repository = valid_repository and (port is None or 0 <= port <= 65535)
            except ValueError:
                valid_repository = False
            if not valid_repository:
                raise SnapshotError("repositories must contain HTTP(S) URLs")
        if "jira" in person:
            jira = person["jira"]
            if not isinstance(jira, list) or any(
                not isinstance(item, dict) or not (item.get("project") or item.get("boardId"))
                for item in jira
            ):
                raise SnapshotError("jira must be an array of entries containing project or boardId")


def build_snapshot(
    records: Iterable[object],
    *,
    scope_name: str,
    scope_type: str,
    generated_at: datetime | None = None,
    optional_fields: Iterable[str] | None = None,
) -> dict[str, object]:
    """Build and validate a deterministic Core v1 snapshot."""

    if not scope_name.strip() or not scope_type.strip():
        raise SnapshotError("scope name and type are required")
    allowed_optional = OPTIONAL_PERSON_FIELDS if optional_fields is None else set(optional_fields)
    unsupported = allowed_optional - OPTIONAL_PERSON_FIELDS
    if unsupported:
        raise SnapshotError(f"unsupported optional fields: {', '.join(sorted(unsupported))}")

    people: list[dict[str, object]] = []
    seen: set[str] = set()
    for record in records:
        person = _person(record)
        uid = str(person["uid"])
        if uid in seen:
            raise SnapshotError(f"UID collision after normalization: {uid}")
        seen.add(uid)
        person = {
            key: value for key, value in person.items()
            if key in REQUIRED_PERSON_FIELDS or key in allowed_optional
        }
        people.append(person)
    if not people:
        raise SnapshotError("source returned no people; refusing to publish an empty snapshot")
    people.sort(key=lambda person: str(person["uid"]))

    timestamp = generated_at or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    timestamp = timestamp.astimezone(timezone.utc)
    snapshot = {
        "schemaVersion": SCHEMA_VERSION,
        "source": SOURCE,
        "generatedAt": timestamp.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "scope": {"name": scope_name.strip(), "type": scope_type.strip()},
        "people": people,
    }
    validate_snapshot(snapshot)
    return snapshot


def _walk_scope_tree(node: object) -> tuple[set[str], set[tuple[str, str]]]:
    teams: set[str] = set()
    entities: set[tuple[str, str]] = set()

    def visit(current: object) -> None:
        name = str(_value(current, "name") or "").strip()
        entity_type = str(_value(current, "type") or "").strip().lower()
        if name:
            entities.add((name, entity_type))
            if entity_type == "team":
                teams.add(name)
        for child in _value(current, "children") or []:
            visit(child)

    visit(node)
    return teams, entities


def _membership_in_scope(
    service: object,
    membership: object,
    scope_name: str,
    scope_type: str,
    scope_entities: set[tuple[str, str]],
) -> bool:
    name = str(_value(membership, "name") or "").strip()
    entity_type = str(_value(membership, "type") or "").strip().lower()
    if not name:
        return False
    if (name, entity_type) in scope_entities or name == scope_name:
        return True
    get_path = getattr(service, "get_hierarchy_path", None)
    if not callable(get_path):
        return False
    for entry in get_path(name, entity_type) or []:
        if str(_value(entry, "name") or "").strip() != scope_name:
            continue
        path_type = str(_value(entry, "type") or "").strip().lower()
        return path_type == scope_type.lower() or {path_type, scope_type.lower()} == {"org", "pillar"}
    return False


def _team_enrichment(service: object, team_names: Iterable[str]) -> dict[str, object]:
    get_team = getattr(service, "get_team_by_name", None)
    if not callable(get_team):
        return {}
    repositories: list[str] = []
    jira: list[dict[str, object]] = []
    slack_channels: list[str] = []
    for team_name in team_names:
        team = get_team(team_name)
        group = _value(team, "group") if team is not None else None
        if group is None:
            continue
        for repo in _value(group, "repos") or []:
            url = _value(repo, "repo", "repo_name")
            if isinstance(url, str) and url.strip():
                repositories.append(url.strip())
        for item in _value(group, "jiras") or []:
            project = _value(item, "project")
            if isinstance(project, str) and project.strip():
                jira.append({"project": project.strip()})
        slack = _value(group, "slack")
        for channel in _value(slack, "channels") or []:
            name = _value(channel, "channel")
            if isinstance(name, str) and name.strip():
                slack_channels.append(name.strip())
    result: dict[str, object] = {}
    if repositories:
        result["repositories"] = _string_list(repositories, sort=True)
    if jira:
        unique = {(str(item.get("project", "")), str(item.get("boardId", ""))): item for item in jira}
        result["jira"] = [unique[key] for key in sorted(unique)]
    if slack_channels:
        result["slackChannels"] = _string_list(slack_channels, sort=True)
    return result


def collect_scope_records(service: object, scope_name: str, scope_type: str = "pillar") -> list[dict[str, object]]:
    """Collect direct and descendant members using supported Cyborg APIs."""

    required = [getattr(service, name, None) for name in (
        "get_all_employee_uids", "get_employee_by_uid", "get_teams_for_uid"
    )]
    if not all(callable(method) for method in required):
        raise SnapshotError("Cyborg service lacks the required employee membership API")
    list_uids, get_employee, get_teams = required

    scope_teams: set[str] = set()
    scope_entities: set[tuple[str, str]] = {(scope_name, scope_type.lower())}
    get_tree = getattr(service, "get_descendants_tree", None)
    has_scope_tree = callable(get_tree)
    if has_scope_tree:
        tree = get_tree(scope_name)
        if tree is None:
            raise SnapshotError(f"configured Cyborg scope was not found: {scope_name!r}")
        tree_type = str(_value(tree, "type") or "").lower()
        if tree_type and tree_type != scope_type.lower() and {tree_type, scope_type.lower()} != {"org", "pillar"}:
            raise SnapshotError(
                f"configured scope type {scope_type!r} does not match Cyborg type {tree_type!r}"
            )
        scope_teams, scope_entities = _walk_scope_tree(tree)

    get_memberships = getattr(service, "get_user_memberships", None)
    legacy_is_in_scope = getattr(service, "is_employee_in_org", None)
    result: list[dict[str, object]] = []
    for uid in sorted({normalize_uid(value) for value in list_uids()}):
        if not uid:
            continue
        all_teams = _string_list(get_teams(uid) or [], sort=True)
        in_scope_teams = (
            [team for team in all_teams if team in scope_teams]
            if has_scope_tree else all_teams
        )
        memberships = get_memberships(uid) if callable(get_memberships) else []
        in_scope = bool(in_scope_teams) or any(
            _membership_in_scope(service, membership, scope_name, scope_type, scope_entities)
            for membership in memberships
        )
        if not memberships and callable(legacy_is_in_scope):
            in_scope = in_scope or bool(legacy_is_in_scope(uid, scope_name))
        if not in_scope:
            continue
        employee = get_employee(uid)
        if employee is None:
            raise SnapshotError(f"Cyborg returned no employee record for {uid!r}")
        record: dict[str, object] = {
            "uid": _value(employee, "uid", "employee_uid", "id") or uid,
            "teams": in_scope_teams,
        }
        for field, names in {
            "fullName": ("fullName", "full_name", "name"),
            "email": ("email",),
            "jobTitle": ("jobTitle", "job_title", "title"),
            "managerUid": ("managerUid", "manager_uid"),
            "githubUsername": ("githubUsername", "github_username", "github_id"),
        }.items():
            value = _value(employee, *names)
            if isinstance(value, str) and value.strip():
                record[field] = value.strip()
        record.update(_team_enrichment(service, in_scope_teams))
        result.append(record)
    return result


def export_snapshot(
    service: object,
    *,
    scope_name: str,
    scope_type: str,
    generated_at: datetime | None = None,
    optional_fields: Iterable[str] | None = None,
) -> dict[str, object]:
    """Collect, normalize, validate, and return one complete snapshot."""

    return build_snapshot(
        collect_scope_records(service, scope_name, scope_type),
        scope_name=scope_name,
        scope_type=scope_type,
        generated_at=generated_at,
        optional_fields=optional_fields,
    )


def write_snapshot(snapshot: dict[str, object], path: str | Path) -> None:
    """Write a validated local artifact; production promotion is separate."""

    validate_snapshot(snapshot)
    Path(path).write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
