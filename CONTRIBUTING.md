# Contributing to People & Teams

## Prerequisites

- **Node.js 22+** and npm
- **Red Hat VPN** connection (for LDAP roster sync)
- A **Jira Cloud API token** for live data — [create one here](https://id.atlassian.com/manage-profile/security/api-tokens)
  or just use **Demo Mode** (no credentials needed)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/openshift-online/hp-org-pulse.git
cd hp-org-pulse
npm install
npm run setup    # Symlinks core platform files (src/, shared/, modules/team-tracker) into workspace
```

### 2. Configure environment

```bash
cp .env.example .env
```

**Option A — Demo Mode (no credentials needed):**

```env
DEMO_MODE=true
VITE_DEMO_MODE=true
```

**Option B — Live data:**

```env
JIRA_EMAIL=you@redhat.com
JIRA_TOKEN=your-jira-api-token
ADMIN_EMAILS=you@redhat.com

# Optional
GITHUB_TOKEN=your-github-classic-pat
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa-key.json
```

See [README.md](README.md) for details on obtaining each credential.

### 3. Run locally

```bash
npm run dev:full
```

This starts both the Vite frontend (port 5173) and the Express dev server (port 3001) concurrently.
The Vite dev server proxies `/api` requests to the backend.

- **Frontend:** <http://localhost:5173>
- **API:** <http://localhost:3001/api>

### 4. Run tests

```bash
npm test            # single run
npm run test:watch  # watch mode
npm run lint        # linting
```

## Project Structure

This repo is the HP Engineering consumer of [`@org-pulse/core`](https://github.com/red-hat-data-services/org-pulse-core).
Core platform files (`src/`, `shared/`, `modules/team-tracker`) are symlinked into the workspace by `npm run setup`.

```text
server/
  index.js            # Thin wrapper — calls core's startServer() with HP Eng config

modules/              # HP Eng-specific feature modules (auto-discovered via module.json)

platform/             # HP Eng-specific core UI customizations (About page tabs, etc.)

deploy/
  hp-eng.backend.Dockerfile   # HP Eng backend (extends core backend image)
  hp-eng.frontend.Dockerfile  # HP Eng frontend (extends core builder + runtime)

scripts/
  openapi-route-count.json     # Route count snapshot for OpenAPI validation
  setup.js                     # Symlinks core files into workspace
  validate-dockerfile-deps.js  # Verifies Dockerfile deps match package.json

tests/
  smoke/              # Playwright smoke tests (container images)
  integration/        # Playwright module integration tests
fixtures/             # Demo mode fixture data (HP Eng modules)
data/                 # Local dev data (gitignored)
secrets/              # Service account keys (gitignored)

# Symlinked from @org-pulse/core (created by npm run setup):
src/                  # → node_modules/@org-pulse/core/src/
shared/               # → node_modules/@org-pulse/core/shared/
modules/team-tracker/ # → node_modules/@org-pulse/core/modules/team-tracker/
```

## Making Changes

### Branch naming

Use descriptive branch names:

- `feat/description` — new features
- `fix/description` — bug fixes
- `refactor/description` — code improvements

### Development workflow

1. Create a branch from `main`
1. Make your changes
1. Write or update tests for any changed logic
1. Run `npm test` and `npm run lint` to verify
1. Run `npm run build` to confirm the production build works
1. Open a PR against `main`

### Code style & conventions

See [`AGENTS.md`](AGENTS.md) for the full list of code style conventions and
hard constraints. Key points:

- `<script setup>` for new Vue components
- CommonJS (`require`) for server-side code, ES modules for frontend
- No TypeScript — plain JavaScript throughout
- Tailwind CSS utility classes for styling
- No cross-module imports (use `@shared` or API calls)
- Extract reusable logic into composables (`shared/client/composables/`)

### Testing

#### Cyborg Exporter tests

The standalone Cyborg snapshot exporter uses Python 3.11 and the standard-library
`unittest` framework. Use Python 3.11 for local exporter development and testing:

```bash
make test-exporter          # Run exporter unit tests
make build-exporter-image   # Build its container image (requires Docker/Podman)
make exporter-smoke-test    # Check the built image's --help CLI
```

Build the image before running its smoke test. The smoke test uses
`exporter-smoke-local` by default; set `EXPORTER_IMAGE` to select another image.

#### Dashboard Unit tests

Dashboard unit tests use **Vitest** with **jsdom** and **@vue/test-utils**.

```bash
npm test            # Run all tests
npm run test:watch  # Watch mode

# Run a specific test file
npx vitest run modules/team-tracker/server/jira/__tests__/sprint-report.test.js
```

#### Dashboard Smoke tests

Smoke tests use **Playwright** to verify the production container images work correctly.
These run in CI and can also be run locally on any OS (RHEL, macOS, Ubuntu),
but do NOT require secrets/credentials to run.

**Note:** First-time image pulls can take a while (~5-10 minutes)

```bash
make build-backend-image   # Build HP Eng backend image (extends core)
make build-frontend-image  # Build HP Eng frontend image (extends core)
make smoke-test            # Run smoke tests against HP Eng images
```

Smoke tests run Playwright in a container, so no local browser installation is needed.
The backend runs in demo mode (using fixture data) so no credentials are required.

**macOS note:** The Playwright container bind-mounts your workspace and runs `npm ci`,
which installs Linux-native packages into your local `node_modules/`. After running `make smoke-test`,
you may need to run `npm ci` again to restore macOS-native packages before running
local commands like `npm test` or `npm run dev`.

#### Dashboard Integration tests

> [!IMPORTANT]
> PRs that modify files in `modules/` (views, components, server routes, server logic) **require**
> corresponding integration test updates.

Integration tests are run using **Playwright**. They validate that:

1. Modules are visible _and_ clickable from the sidebar
1. Modules load in Org Pulse when clicked
1. Module content renders properly after being loaded

Use `make` to run a module's integration tests:

```bash
MODULE_NAME=module-name                 # Choose a testable module
make test-module MODULE=${MODULE_NAME}  # Runs the integration tests against an existing module
```

Available, testable modules can be found here by name: [tests/integration](./tests/integration/)

## Deployment

Deployed to OpenShift via ArgoCD. Relative manifests can be found in the
[`hp-gitops-manifests`](https://github.com/openshift-online/hp-gitops-manifests) repository.

## Questions?

Open an issue or reach out in Slack.
