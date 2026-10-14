# HP/Fleet Cyborg snapshot exporter (FCN-745)

This standalone Python exporter reads Cyborg through the supported
`orgdatacore[gcs]` client and emits the complete-roster snapshot consumed by
Org Pulse Core. It is owned by HP/Fleet and has its own image and command; it
does not run through EPD's `cyborg_probe.py` or its GitHub Pages workflow.

## Snapshot behavior

The default scope is `Fleet Engineering` / `pillar`. The exporter includes
direct members and descendants, emits direct members with `teams: []`, filters
out-of-scope team memberships, and preserves multiple in-scope teams. UID
normalization follows Core's NFD + trim + lowercase rule. A missing or
ambiguous UID, normalized collision, missing scope, malformed record, or empty
result fails the export. Optional fields are emitted only when requested and
available.

The output follows Core's complete-roster v1 schema. The exporter writes JSON
to the requested path and prints aggregate status/counts only. Treat the
snapshot file as person-level data and store it only in an approved location.
Scheduling, destination publication, retention, and rollback are handled by
FCN-746.

## Install and verify

Use Python 3.11 for local development and tests. The container uses a separate
multi-stage Red Hat Hardened Python image.

```bash
python3 -m venv .venv-cyborg
source .venv-cyborg/bin/activate
python -m pip install -r exporter/requirements.txt
make test-exporter
```

Build the container with `make build-exporter-image` (Docker or Podman required),
then check its CLI with `make exporter-smoke-test`:

```bash
make build-exporter-image
make exporter-smoke-test
```

The smoke test does not generate a snapshot.
The default image name is `exporter-smoke-local`, configurable with
`EXPORTER_IMAGE`.

## Generate a snapshot

Use ADC or an approved workload identity. Keep credentials and generated
person-level output out of Git. For an approved local verification:

```bash
OUTPUT_DIR="$(mktemp -d /private/tmp/fcn-745.XXXXXX)"

python -m exporter.run \
  --scope-name "Fleet Engineering" \
  --scope-type pillar \
  --bucket resolved-org \
  --object-path orgdata/comprehensive_index_dump.json \
  --project-id openshift-crt \
  --optional-fields repositories,jira,slackChannels \
  --output "$OUTPUT_DIR/enrichment.json"
```

The default optional fields above exclude names, email addresses, titles,
manager UIDs, and GitHub usernames. The printed JSON contains only scope,
timestamp, counts, status, and output path.
