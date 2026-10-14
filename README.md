# HP Engineering Org Pulse

HP Engineering modules for [Org Pulse](https://github.com/red-hat-data-services/org-pulse-core),
an internal engineering dashboard connecting Jira, GitHub, and GitLab data with team rosters
to surface delivery insights.

This repo contains HP Eng-specific modules and platform customizations.
The core platform (`@org-pulse/core`) is installed as an npm dependency.

## Quick Start (Demo Mode)

Run the app with sample data — no credentials needed:

```bash
npm install
npm run setup    # Symlinks core platform files into the workspace

sed -r '/DEMO_MODE/s/^# //g' .env.example > .env
echo "DEMO_MODE=true" > .env
echo "VITE_DEMO_MODE=true" >> .env

npm run dev:full
```

Open <http://localhost:5173>.

## Quick Start (Full Setup)

For real Jira and GitHub data:

### Prerequisites

- Node.js 22+
- Red Hat VPN (required for LDAP roster sync)
- @redhat.com Google account
- Python 3.11 (only for developing or testing the standalone exporter; see
  [exporter setup](exporter/README.md))

### 1. Install dependencies

```bash
npm install
npm run setup  # Symlinks core platform files into the workspace
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
JIRA_EMAIL=you@redhat.com
JIRA_TOKEN=your-jira-api-token  # From https://id.atlassian.com/manage-profile/security/api-tokens
ADMIN_EMAILS=you@redhat.com

# Optional — GitHub contribution stats
GITHUB_TOKEN=your-github-classic-pat  # Classic PAT with read:user scope

# Optional — automated roster sync from Google Sheets
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa-key.json
```

**Jira API Token:** Go to <https://id.atlassian.com/manage-profile/security/api-tokens>,
click "Create API token", and paste the value as `JIRA_TOKEN`.

**GitHub Token:** Create a **classic** Personal Access Token (not fine-grained — GraphQL API doesn't support those yet)
at <https://github.com/settings/tokens> with the `read:user` scope.

**Google Service Account** (for roster sync): See [Google Service Account Setup](#google-service-account-setup) below.

### 3. Start dev servers

```bash
npm run dev:full
```

This starts both the Vite frontend (port 5173) and the Express backend (port 3001).
Vite proxies `/api` requests to the backend.

- **Frontend:** <http://localhost:5173>
- **API:** <http://localhost:3001/api>

### 4. Configure roster sync (first run)

On first launch, a yellow banner will appear directing you to **Settings**. There you can configure:

- **Org roots** — LDAP UIDs of org leaders whose teams you want to track (e.g., `shgriffi`)
- **Google Sheet ID** — The spreadsheet ID from the Google Sheets URL (the long alphanumeric string).
  Sheet names are auto-discovered.

Click "Sync Now" to populate the roster. The app will also sync automatically once every 24 hours.

## Google Service Account Setup

To use the Google Sheets roster sync:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
1. Create or select a project
1. Enable the **Google Sheets API** (APIs & Services > Library)
1. Create a **Service Account** (APIs & Services > Credentials > Create Credentials)
1. Create a JSON key for the service account and download it
1. Place the key file at `secrets/google-sa-key.json` (this path is gitignored)
1. Set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa-key.json` in `.env`
1. Share your Google Sheet with the service account email (the `client_email` in the JSON key)

## Commands

```bash
npm run dev:full                  # Start frontend + backend
npm run dev                       # Frontend only (Vite)
npm run dev:server                # Backend only (Express, needs .env)
npm test                          # Run all tests
npm run test:watch                # Tests in watch mode
npm run lint                      # ESLint
npm run build                     # Production build
npm run setup                     # Symlink core platform into workspace
npm run validate:modules          # Validate module manifests
npm run validate:openapi          # Validate OpenAPI annotations
npm run validate:dockerfile-deps  # Verify Dockerfile deps match package.json
npm run update:view-owners        # Regenerate platform/view-owners/owners.js from git history

# Container-based tests (requires Docker/Podman)
make smoke-test                 # Run smoke tests against HP Eng images
make test-module MODULE=<name>  # Run integration tests for a module
make test-exporter              # Run Cyborg exporter unit tests (Python)
make build-exporter-image       # Build the standalone Cyborg exporter image
make exporter-smoke-test        # Run the built exporter image with --help
```

`exporter-smoke-test` requires the exporter image to have been built first. It
uses `exporter-smoke-local` by default; set `EXPORTER_IMAGE` to use a different
image name.

`npm test` runs the dashboard Vitest suite; run the exporter tests separately
with `make test-exporter`.

Dockerfile-only dependency installs must use major-version pins derived from
production dependencies in `package.json`. For example, `"mermaid": "^11.17.2"`
requires `npm install --no-save mermaid@11`. Run
`npm run validate:dockerfile-deps` to check package coverage and pins.

## Tech Stack

- **Frontend**: Vue 3, Vite 8, Tailwind CSS 3, Chart.js 4
- **Backend**: Express (single server for local dev and production)
- **Auth**: OpenShift OAuth proxy (production), no auth (local dev)
- **Storage**: Local filesystem (`./data/`), PVC in OpenShift
- **Hosting**: OpenShift with ArgoCD
- **Testing**: Vitest (dashboard unit), Python unittest (Cyborg exporter),
  Playwright (smoke & integration), and exporter image CLI smoke test

## Deployment

Deployed to OpenShift via ArgoCD. Dashboard HP Eng images extend core images
from `@org-pulse/core`. The Cyborg exporter uses its own multi-stage
Red Hat Hardened Python image; see [`exporter/README.md`](exporter/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, project structure, and code style guidelines.
