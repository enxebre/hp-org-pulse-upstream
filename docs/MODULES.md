# Module Development Guide

This document covers how to create, develop, and contribute built-in modules for People & Teams.

## Quick Start

> **Tip:** If you use a supported AI harness, run `/create-module` to bootstrap a new module interactively.

1. Copy the template: `cp -r docs/module-template modules/your-module`
1. Edit `modules/your-module/module.json` with your module's name, slug, description, and icon
1. Implement your views in `modules/your-module/client/views/`
1. Add API routes in `modules/your-module/server/index.js`
1. Run `npm run validate:modules` to verify your manifest
1. Run `npm test` to ensure everything works

## Module Structure

The `bug-refinement` module owns the **Agentic Bug Refinement** sidebar section and view at
`#/bug-refinement/main`. It tracks OCPBUGS and CNTRLPLANE issues with
Chai's `refined-by-agent` label, separately from the solve queue. The Agentic
Tools landing block contributes its home card through the shared `useModuleLink`
helper, guarded by `moduleNav.isModuleAvailable('bug-refinement')`. It does not
import refinement module code or read its storage. The module is enabled by
default and uses its own Jira client, API scopes, refresh job, and cached snapshot.
Below the Total refined, OCPBUGS, and CNTRLPLANE summary cards, the view builds
selectable boxes from the distinct Jira component names in the
loaded snapshot, sorted alphabetically, plus **All Teams** and a **No component**
box when needed. Each box shows counters for total issues, `SOLVE`, `CLOSE`,
`NEED_HUMAN_ANALYSIS`, and `NEEDS_INFO`. An issue with multiple components appears
once in each matching box and once in All Teams. Component names are matched
exactly, including across projects; HyperShift and Hosted Control Planes have
separate boxes when both names are present. Deferred and unknown assessments
contribute only to the total. Selecting a box updates the table and project totals.
Closed issues without a disposition or saved assessment metadata display
**CLOSE (Jira)** and contribute to Close counters, with a tooltip identifying the
status-based fallback. Explicit assessments take precedence, including unknown
outcomes linked to a source comment. This fallback does not alter snapshot data.
Project and search filters further narrow the table without changing the box
counters or project totals. If a selected component disappears after reloading
the snapshot, the view returns to All Teams.
The table displays all of each issue's components. Every column header is a
keyboard-accessible sort button that toggles ascending and descending order and
announces its direction through `aria-sort`. Keys sort naturally (2 before 10),
text sorts without case sensitivity, priorities follow severity order, and update
timestamps sort chronologically. Missing values stay last in both directions.
Sorting preserves the component, project, and search filters and does not change
the snapshot or counters. Before a header is clicked, Jira's snapshot order is
preserved.
Its integration suite uses `@bug-refinement` and is included in module change
detection. See [the snapshot format](DATA-FORMATS.md#agentic-bug-refinement--bug-refinementdatajson).

The `bug-pipeline` module owns the **Agentic Bug Pipeline** sidebar section and view at
`#/bug-pipeline/main`, separate from the refinement section, and the Agentic Tools
landing block adds its home card the same way, guarded by
`moduleNav.isModuleAvailable('bug-pipeline')`. It declares `"requires": ["bug-refinement"]`
and has no Jira client, refresh job, or storage of its own: `GET /api/modules/bug-pipeline/data`
reads the refinement module's exported `bug-refinement/data.json` snapshot through
`readFromStorage`, so the pipeline refreshes with Agentic Bug Refinement. Until that
module fetches its first snapshot, the view says so. Because modules cannot import
each other, the client keeps its own copies of the refinement view's component box,
disposition, and sorting helpers, and of the server's backport label pattern; keep both
copies in sync.
The view shows how refined OCPBUGS issues move
through Chai's solve and backport stages. It leaves out CNTRLPLANE issues and
issues labeled `chai-backport`; backport clones count through their original
issue's `backports`. Summary cards show refined bugs; the shares closed, sent for
human analysis, and waiting for information; the share sent to solve (`SOLVE`);
the share of those that merged; and the share of their linked backports that
merged. Each card states its count and denominator. The view reuses the
refinement view's component boxes and **CLOSE (Jira)** fallback. Each box shows the
refined bug count and the same percentages in the same order, without counts. A
zero denominator shows —.
Selecting a box filters the cards and the **Refined bugs** table. The table lists
every refined bug in the selection, most recently updated first. Its Disposition
column shows the refinement view's badge and, for bugs sent to solve, the solve
outcome (**Merged**, **PR posted**, or **No PR yet**) with links to the GitHub pull
requests from Jira remote links. The table also shows Jira status, each backport's
branch and status, and the update date, with the full timestamp on hover. Its
column headers sort the same way as the refinement view's, through the same
`useSortableRows` composable. Disposition sorts by disposition and then by solve
progress, so a descending sort lists merged fixes first, and Backports sorts by the
number of linked backports. Sorting survives component changes. Snapshots without
merge fields show a refresh notice and — for merge and backport metrics.
Between the component boxes and the table, a **Decision flow** Sankey diagram follows
the selected bugs from refinement to their latest assessment and, for `SOLVE`, to
pull request, merge, backports, backport pull requests, and backport merge. Band
widths are bug counts, so every column partitions the same bugs, and each box shows
its count and share of all refined bugs. Backport boxes also show how many backports
their bugs have, and a bug whose backports are at different steps gets its own box,
**Backport PRs: Some PRs posted** or **Backport merge: Partly merged**, so every
backport column adds up to the one before it in backports as well as bugs. A backport
counts as having a pull request when its clone was ever in POST or has a linked GitHub
pull request; snapshots without the backport `prPosted` flag count a clone in POST.
Above the diagram, **Median time per phase** chips show the median of each phase over
the selected bugs, with the same labels as a bug's own lead times: report to first
assessment for every bug, then solve assessment to PR, PR to merge, merge to last
backport PR, last backport PR to merge, and report to merge for bugs sent to solve.
Each chip names how many bugs had both timestamps, and a phase no bug has is left out. A **First assessment** column appears only when some bug's
first saved assessment differs from its latest one. Boxes keep the disposition badge
colors. Hovering or focusing a box or band shows its count and share; a band also shows the
share of its source box that took it, and a backport box shows how many backports
are merged, awaiting merge, or without a pull request. Where both decisions have
timestamps, the tooltip shows the median time between them: report to first
assessment, first to latest assessment, solve assessment to pull request, pull
request to merge, merge to last backport pull request, and last backport pull
request to its merge. Backport times come from the clones' own timelines in the same
snapshot, so a bug is timed only when all of its clones are there.
Selecting a box or band, by click or Enter/Space, narrows the table to its bugs until
it is cleared or the component changes; the summary cards still count the whole
component. **Show flows as a table** lists every band with its count, both shares, and median.
`client/utils/decisions.js` builds and lays out the diagram without a charting library.
Each table row has a toggle that expands the bug's decision flow: lead times between
decisions, a Mermaid flowchart with one node per decision labeled with who made it and
when, its edges labeled with the time since the previous decision, and the same steps as
an ordered list. Mermaid loads lazily through the module's own copy of ai-impact's
`MermaidDiagram`. Repeated identical assessments fold into one step, and a waiting label
Chai adds with its matching assessment is not repeated. Each backport label opens a
dotted lane with the clone's status transitions from the same snapshot, or the clone's
current status when it is not in the snapshot. Without a `timeline`, the flow asks
for a refresh.
Its integration suite uses `@bug-pipeline`; change detection also runs it when the
refinement server or fixture changes, since they define its data.

The `risk-assessment` module owns the **Agentic Risk Assessment** sidebar section and
view at `#/risk-assessment/main`. Chai labels the latest commit of a pull request with
exactly one of `chai-risk-assessment/low`, `chai-risk-assessment/moderate`, or
`chai-risk-assessment/critical`. The module counts the PRs (any state) carrying each
label in a fixed list of OpenShift repositories, `REPOS` in
`server/github/risk-labels.js`. A refresh is one GitHub GraphQL request with an aliased
`search { issueCount }` per repository and level, made with the platform `GITHUB_TOKEN`
secret. The module is enabled by default and has its own API scopes, refresh job, and
cached snapshot. `GET /api/modules/risk-assessment/data` adds each repository's
assessed-PR total (the sum of its three counts) and each level's share, rounded to a
whole percent, plus the same figures across all repositories. A repository without
assessed PRs shows — for its shares.
Summary cards show the assessed-PR total and each level's combined share and count.
The **By repository** table lists every tracked repository, most assessed PRs first,
with its total, each level's share and count, and a thin segmented bar of the shares.
Counts link to the matching GitHub pull request search, and an **All repositories**
footer repeats the combined figures. Levels use the status colors (good, warning,
critical) and always appear beside their names.
Its integration suite uses `@risk-assessment` and is included in module change
detection. See [the snapshot format](DATA-FORMATS.md#agentic-risk-assessment--datarisk-assessmentdatajson).

```text
modules/your-module/
  module.json              # Module manifest (required)
  client/
    index.js               # Frontend entry: exports { routes }
    views/
      MainView.vue         # Your Vue views
    components/            # Module-private components
    composables/           # Module-private composables
  server/
    index.js               # Backend entry: exports function(router, context)
  __tests__/
    client/                # Frontend tests
    server/                # Backend tests
```

## module.json Reference

```json
{
  "name": "My Module",
  "slug": "my-module",
  "description": "What this module does",
  "icon": "box",
  "order": 10,
  "client": {
    "entry": "./client/index.js",
    "navItems": [
      { "id": "main", "label": "Main", "icon": "BarChart3", "default": true },
      { "id": "detail", "label": "Detail", "icon": "FileText" }
    ],
    "settingsComponent": "./client/components/MySettings.vue"
  },
  "server": {
    "entry": "./server/index.js"
  }
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name shown in sidebar and landing page |
| `slug` | Yes | URL-safe identifier, must match directory name |
| `description` | Yes | Short description for the landing page |
| `icon` | Yes | Lucide icon name (e.g., `bar-chart`, `box`, `search`) |
| `order` | No | Sort order on landing page (default: 100, lower = first) |
| `defaultEnabled` | No | Whether the module is enabled by default (default: `true`) |
| `requires` | No | Array of module slugs this module depends on (default: `[]`) |
| `client.entry` | No | Path to frontend entry point |
| `client.navItems` | No | Sidebar navigation items |
| `client.settingsComponent` | No | Vue component for the Settings page |
| `client.sotuWidgets` | No | Array of widget declarations for the SOTU dashboard (see below) |
| `client.landingBlocks` | No | Array of selectable blocks to display above the landing-page dashboard (see below) |
| `server.entry` | No | Path to backend entry point |
| `fixtures` | No | Object mapping fixture filenames to collection names for demo mode seeding (e.g., `{"data.json": "collection-name"}`) |

### navItem Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique within module, maps to a key in the `routes` export |
| `label` | string | Yes | Sidebar display text |
| `icon` | string | Yes | Lucide icon name |
| `default` | boolean | No | If `true`, this is the module's landing view |
| `disabled` | boolean | No | If `true`, item is visible but non-clickable (greyed out) |
| `requireRole` | string | No | Only show item to users with this role (e.g., `"manager"`, `"team-admin"`, `"planning-manager"`) |
| `requireCondition` | string | No | Only show when condition is met (e.g., `"in-app-mode"` — hides when roster is sheet-based) |
| `separatorBefore` | boolean | No | Render a visual separator line above this item |

### `hiddenRoutes`

In `client`, you can declare `hiddenRoutes` — a map of route IDs to their parent navItem ID.
These are routes that exist in the `routes` export but should not appear as sidebar items
(e.g., detail views navigated to programmatically):

```json
{
  "client": {
    "hiddenRoutes": {
      "feature-detail": "execute"
    }
  }
}
```

### navItems vs routes

- **`navItems`** defines what appears in the sidebar. Each has `id`, `label`, `icon`, and optionally `default: true`.
- **`routes`** (exported from `client/index.js`) is a superset of navItems — it includes sidebar items
  AND internal views navigated to programmatically (e.g., detail views).

## Frontend Entry (`client/index.js`)

```javascript
import { defineAsyncComponent } from 'vue'

export const routes = {
  'main': defineAsyncComponent(() => import('./views/MainView.vue')),
  'detail': defineAsyncComponent(() => import('./views/DetailView.vue')),
}
```

Use `defineAsyncComponent` for lazy loading.

### Landing-page blocks

A module can provide a block for the deployment-wide landing page by declaring it
in `client.landingBlocks`. Components live in `client/blocks/` and use the
`*Block.vue` naming convention. An administrator selects the active block in
Settings → Landing Page; the selected block appears above the dashboard for all
users.

```json
{
  "client": {
    "landingBlocks": [
      {
        "id": "strategic-initiatives",
        "name": "Strategic Initiatives",
        "description": "Quick launchers for strategic engineering initiatives.",
        "component": "./client/blocks/StrategicInitiativesBlock.vue"
      }
    ]
  }
}
```

Each block requires a unique module-local `id`, display `name`, `description`,
and component path. The landing-page configuration stores the selected block as
a module-qualified ID (for example, `agentic-tools:strategic-initiatives`).
Demo deployments can set `activeBlock` in `fixtures/landing-page-config.json` to
preselect a block.

### Floating Widgets

A module can export a `floatingWidget` component that renders as a floating overlay in the app shell,
independent of sidebar navigation. This is useful for always-available features like chat assistants.

```javascript
import { defineAsyncComponent } from 'vue'

export const routes = {
  'chat': defineAsyncComponent(() => import('./views/ChatView.vue')),
}

export const floatingWidget = defineAsyncComponent(() => import('./views/ChatView.vue'))
```

When `floatingWidget` is exported, the shell renders it as a persistent floating component.
The module can omit `navItems` from `module.json` if it doesn't need sidebar navigation — the floating widget
will still load when the module is enabled.

## Navigation API

The shell provides a `moduleNav` object via Vue's `provide/inject`:

```javascript
import { inject } from 'vue'

const nav = inject('moduleNav')

// Navigate to a view within your module
nav.navigateTo('detail', { id: '123' })

// Go back via browser history
nav.goBack()

// Read current route params (reactive)
const id = computed(() => nav.params.value.id)
```

### Hash URL Format

Navigation produces URLs like: `#/<module-slug>/<view-id>?key=value`

Example: `#/my-module/detail?id=123`

### Cross-Module Navigation

To navigate to another module's view, use the shared `useModuleLink` composable:

```javascript
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'

const { navigateTo: crossNavigate } = useModuleLink()

// Navigate to another module's view
crossNavigate('releases', 'feature-detail', { key: 'HPSTRAT-123' })
```

This produces a hash URL like `#/releases/feature-detail?key=HPSTRAT-123` and updates `window.location.hash`.
Use intra-module `moduleNav.navigateTo()` for navigation within your own module.

**Important:** Cross-module links should always be guarded by a module-availability
check so the UI degrades gracefully when the target module is not installed:

```vue
<script setup>
import { inject, computed } from 'vue'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'

const moduleNav = inject('moduleNav')
const targetAvailable = computed(() => moduleNav?.isModuleAvailable?.('other-module') ?? false)
const { linkTo } = useModuleLink()
</script>
<template>
  <a v-if="targetAvailable" :href="linkTo('other-module', 'view', { id: '123' })">View</a>
  <span v-else>View</span>
</template>
```

## Backend Entry (`server/index.js`)

```javascript
/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin } = context

  router.get('/data', async function(req, res) {
    const data = await storage.readFromStorage('my-module-data.json')
    res.json(data || {})
  })

  router.post('/data', requireAdmin, async function(req, res) {
    await storage.writeToStorage('my-module-data.json', req.body)
    res.json({ success: true })
  })
}
```

Routes are automatically mounted at `/api/modules/<slug>/`.

## Server Context Reference

The authoritative typedef for the context object is in `shared/server/module-context.js`.
Each module receives a frozen, per-module context built by `buildModuleContext()`.

### Context Properties

| Property | Type | Description |
|----------|------|-------------|
| `db` | object\|null | Scoped database factory: `db.model(name, schema)` returns a Mongoose model on a `<slug>__<name>` collection. `null` when MongoDB is not configured. |
| `storage` | object | Storage module (`readFromStorage`, `writeToStorage`, etc.) |
| `requireAuth` | middleware | Requires authenticated user |
| `requireAdmin` | middleware | Requires admin role |
| `requireTeamAdmin` | middleware | Requires team-admin or admin role |
| `requireRole(role)` | function | Returns middleware requiring a specific role (admins always pass) |
| `requireScope(name)` | function | Returns middleware for API token scope check |
| `roleStore` | object | Role store instance |
| `registerRole(id, config)` | function | Register a module-specific role (e.g., `planning-manager`) |
| `registerScopes(configs)` | function | Register module-specific API token scopes |
| `registerDiagnostics(fn)` | function | Register diagnostics hook (see below) |
| `registerMessageProvider(id, fn)` | function | Register message provider (see below) |
| `registerRefresh(id, config)` | function | Register refresh handler with optional cadence (see below) |
| `registerExport(fn)` | function | Register data export hook (see below) |
| `secrets` | object | Frozen object containing resolved secret values declared by this module |
| `resolveSecret(name)` | function | Read a dynamic secret from `process.env` at call time |
| `registerSecretValidator(key, fn)` | function | Register a connectivity validator for a secret key |
| `RefreshSkip` | class | Constructor: `new RefreshSkip(reason)` — return from a refresh handler to skip without consuming cadence |

### Testing

Use `createTestContext(overrides)` from `shared/server/module-context.js` to create a mock context for unit tests:

```javascript
const { createTestContext } = require('../../shared/server/module-context')
const context = createTestContext({ storage: myMockStorage })
```

## Shared Imports

Modules can import shared composables and utilities:

```javascript
import { useRoster } from '@shared/client/composables/useRoster'
import { useAuth } from '@shared/client/composables/useAuth'
import { apiRequest } from '@shared/client/services/api'
```

**Modules cannot import from other modules** — only from `@shared`. This is enforced
by the `org-pulse/no-cross-module-imports` ESLint rule, which flags direct imports,
cross-module API paths (`/api/modules/<other>/...`), and cross-module hash routes
(`#/<other>/...`). If a cross-module reference is unavoidable, guard it behind a
module-availability check and add an `eslint-disable` comment with justification.

## Settings Component

To add a settings tab for your module, create a Vue component and reference it in `module.json`:

```json
{
  "client": {
    "settingsComponent": "./client/components/MySettings.vue"
  }
}
```

The component will be rendered as a tab in the shell's Settings page.

## SOTU Widgets

To contribute widgets to the customizable "State of the Union" dashboard, declare them in `module.json`:

```json
{
  "client": {
    "sotuWidgets": [
      {
        "id": "my-widget",
        "name": "My Widget",
        "description": "Short description for the widget picker",
        "component": "./client/widgets/MyWidget.vue",
        "defaultSize": "half",
        "icon": "BarChart3",
        "category": "metrics"
      }
    ]
  }
}
```

**Widget manifest fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique within the module. Globally qualified as `{moduleSlug}:{id}` |
| `name` | Yes | Display name in the widget picker |
| `description` | Yes | Short description shown in the widget picker |
| `component` | Yes | Path relative to module dir. Must match `client/widgets/*Widget.vue` |
| `defaultSize` | No | `"half"` or `"full"` (default: `"half"`). User can override. |
| `icon` | No | Lucide icon name for the widget picker |
| `category` | No | Grouping in the widget picker (e.g., `action-items`, `boards`, `metrics`) |

**Requirements:**

1. Widget files must be named `*Widget.vue` and live in `client/widgets/` (enforced by CI via `validate-modules`).
1. Widgets receive a single prop: `size` (`"half"` or `"full"`) so they can adapt their layout.
1. Widgets are fully self-contained — they fetch their own data and render their own card chrome (bg, border, rounded, padding).
1. Use `useModuleLink` (not `moduleNav`) for all outbound navigation, since widgets render
   on the landing page where `activeModuleSlugRef` is `null`.
1. Pass `from: 'sotu'` in navigation params so destination views can show a "Back to State of the Union"
   button that navigates to `#/`.
1. Users can add, remove, reorder, and resize widgets via the dashboard UI. Layout is persisted to localStorage.

## Testing

- **Unit tests**: Use Vitest with @vue/test-utils for frontend, Vitest for backend
- **Standalone exporter tests**: The HP Cyborg snapshot exporter uses Python 3.11
  `unittest`; run them with `make test-exporter`. Build and smoke-test its standalone
  image with `make build-exporter-image` and `make exporter-smoke-test` (see
  `exporter/README.md`).
- Frontend tests: `modules/your-module/__tests__/client/`
- Backend tests: `modules/your-module/__tests__/server/` or `modules/your-module/server/__tests__/`
- Run all tests: `npm test`
- Module manifest validation: `npm run validate:modules`
- **Integration tests**: Playwright tests in `tests/integration/` validate module UI (see CONTRIBUTING.md)

## CODEOWNERS

Add your module to `.github/CODEOWNERS`:

```text
/modules/your-module/          @your-github-username
```

The `module.json` wildcard rule ensures core team review for manifest changes.

## Module Enable/Disable

Built-in modules can be enabled or disabled by admins via Settings > Modules. State is persisted in `data/modules-state.json`.

### Dependencies (`requires`)

If your module depends on another module, declare it in `module.json`:

```json
{
  "requires": ["team-tracker"]
}
```

- When enabling a module, all transitive dependencies are auto-enabled.
- A module cannot be disabled while another enabled module depends on it.
- At startup, if an enabled module's dependency is disabled, the dependency is auto-enabled.
- The validation script (`npm run validate:modules`) checks for missing dependencies and circular dependency chains.

### `defaultEnabled`

Set `"defaultEnabled": false` if your module should be opt-in. New modules default to enabled (`true`)
when no persisted state exists.

### Restart behavior

Disabling a module hides it from the UI immediately but its server routes remain mounted until the next restart.
Enabling a previously-disabled module updates the state, but if its routes were not mounted at startup,
the API returns `restartRequired: true` and the UI shows a banner.

### CronJob behavior

The CronJob (`deploy/openshift/base/cronjob-sync-refresh.yaml`, every 15 minutes) calls the People & Teams module's API
endpoints directly. If People & Teams is disabled, those endpoints will return 404 and the CronJob will fail silently.
Re-enable People & Teams and restart to restore automatic syncs.

## Export Hook

Modules that persist data via `writeToStorage` **must** register an export hook via `context.registerExport(fn)`
and declare exported files in `module.json`. This ensures all module data is included in the anonymized test data export
(used for demo mode and testing). CI validation (`npm run validate:modules`) enforces this — modules
that write to storage without an `export` section in `module.json` will fail the build.

### module.json

```json
{
  "export": {
    "files": [
      { "path": "my-data.json", "notes": "Description of data" }
    ]
  }
}
```

The `files` array is documentation-only — it describes what the export hook produces.
The actual export logic lives in the registered hook.

### Registering an Export Hook

In your `server/index.js`, register the export function:

```javascript
module.exports = function registerRoutes(router, context) {
  // ... routes ...

  context.registerExport(require('./export'))
}
```

### server/export.js

```javascript
module.exports = async function(addFile, storage, mapping) {
  const data = await storage.readFromStorage('my-data.json');
  if (!data) return;

  // Anonymize PII using the shared mapping
  const anonymized = { ...data };
  if (anonymized.userName) {
    anonymized.userName = mapping.getOrCreateNameMapping(anonymized.userName);
  }

  // Add to the export tarball
  addFile('my-data.json', anonymized);
};
```

**Parameters:**

- `addFile(path, jsonData)` — adds a file to the tarball (path relative to `data/` root)
- `storage` — shared storage layer (`readFromStorage`, `writeToStorage`, `listStorageFiles`)
- `mapping` — universal PII mapping from `shared/server/anonymize.js` with functions like `getOrCreateNameMapping()`,
  `anonymizeJiraKey()`, `anonymizeIssueSummary()`, etc.

## Diagnostics Hook

Modules can register a diagnostics hook to include module-specific health data in the
must-gather diagnostic bundle (`GET /api/must-gather`). This is optional — modules that don't
register a hook are simply skipped.

### Registering Diagnostics

Call `context.registerDiagnostics(fn)` inside your `registerRoutes` function.
The callback has access to closure-scoped runtime state:

```javascript
module.exports = function registerRoutes(router, context) {
  const { storage } = context

  // Module-local runtime state
  const refreshState = { running: false }

  // ... route definitions ...

  // Register diagnostics hook (optional)
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      return {
        refreshState,
        dataExists: !!(await storage.readFromStorage('my-data.json')),
        // Include whatever is useful for debugging
      }
    })
  }
}
```

### Guidelines

- **Return metadata, not data**: Include counts, timestamps, status flags, and health checks — not full data files
- **Include data integrity checks**: Missing files, stale caches, configuration mismatches
- **Keep it fast**: The hook has a 10-second timeout. Avoid expensive operations
- **No PII in keys**: Put PII in values only — the must-gather redaction system anonymizes values but not the structure
- **Guard the call**: Check `if (context.registerDiagnostics)` for backward compatibility with hand-rolled test contexts

### How It Works

- Each module's frozen context provides a `registerDiagnostics` function scoped to that module's slug
- Multiple calls accumulate — sub-routers can each register their own diagnostics
  (e.g., releases' planning, execution, and delivery)
- All registered hooks are called in parallel with a 10-second timeout via `collectModuleDiagnostics()`
- Errors in one module's hook don't affect others
- Results appear under `modules.<slug>` in the must-gather bundle

See [Must-Gather Documentation](MUST-GATHER.md) for the full bundle format.

## Message Provider Hook

Modules can register message providers to surface contextual alerts to users across every page of the application.
Messages appear as a stack of sticky banners below the top bar header.
This is optional — modules that don't register a provider simply produce no messages.

### Registering a Message Provider

Call `context.registerMessageProvider(id, fn)` inside your `registerRoutes` function.
The provider function receives the current user context and returns an array of messages:

```javascript
module.exports = function registerRoutes(router, context) {
  const { storage } = context

  // ... route definitions ...

  // Register message provider (optional)
  if (context.registerMessageProvider) {
    context.registerMessageProvider('my-module:my-alert', async function(user) {
      // user = { email, uid, isAdmin, isTeamAdmin, isManager, roles }

      // Return empty array if nothing to alert on
      if (!someCondition) return []

      return [{
        id: 'my-module:my-alert',
        type: 'warning',          // 'warning' | 'info' | 'error'
        text: 'Something needs attention.',
        link: {                    // optional
          label: 'Review',
          href: '#/my-module/detail'
        }
      }]
    })
  }
}
```

### Message Shape

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Globally unique. Convention: `<module-slug>:<message-name>` |
| `type` | string | Yes | `'warning'`, `'info'`, or `'error'` — determines banner color |
| `text` | string | Yes | Plain text (no HTML or markdown) |
| `link` | object or null | No | Optional CTA with `label` (string) and `href` (string) |

### Guidelines

- **Guard the call**: Check `if (context.registerMessageProvider)` for backward compatibility with hand-rolled test contexts
- **Synchronous registration**: Providers must be registered synchronously during
  `require(entryPath)` — the same constraint as `registerDiagnostics`
- **Per-request execution**: Provider functions are called on every `GET /api/messages`
  request with the current user context. Keep them fast
- **Timeout**: Each provider has a 5-second timeout. Providers that exceed this are skipped with a warning
- **Error isolation**: If a provider throws or times out, other providers still run and the endpoint still returns results
- **Early bailout**: Check `user.isManager`, `user.isAdmin`, or `user.uid` early to skip expensive
  work for users who won't see the message
- **Return an array**: Providers can return zero or more messages. Return `[]` when there is nothing to alert on

### How It Works

- Each module's frozen context provides a `registerMessageProvider` function that delegates to the shared message registry
- All registered providers are called sequentially by the message registry on `GET /api/messages`
- Provider results are merged with admin-stored messages from `data/messages.json`
- The client fetches messages once on app load (non-blocking) and renders them as sticky banners inside the header
- Users can dismiss messages per session (sessionStorage)

## Refresh Handler Hook

Modules can register refresh handlers to participate in the platform's unified data refresh system.
When the CronJob fires (every 15 minutes) or an admin triggers a manual refresh, registered handlers run in order.

### Registering a Refresh Handler

Call `context.registerRefresh(id, config)` inside your `registerRoutes` function:

```javascript
module.exports = function registerRoutes(router, context) {
  const { storage } = context

  if (context.registerRefresh) {
    context.registerRefresh('my-data', {
      order: 50,           // lower runs first (default: 100)
      timeout: 300000,     // per-handler timeout in ms (default: 5 min)
      cadence: '12h',      // how often to run (default: '24h')
      description: 'Fetches external data and stores it locally.',
      handler: async function(options) {
        // Fetch and store data
        const data = await fetchExternalData()
        await storage.writeToStorage('my-module/data.json', data)
        return { status: 'success', count: data.length }
      }
    })
  }
}
```

### RefreshConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `handler` | function | (required) | Async function to execute the refresh |
| `order` | number | 100 | Execution order — lower runs first. Handlers at the same order run in parallel |
| `timeout` | number | 300000 | Per-handler timeout in ms |
| `cadence` | string | `'24h'` | How often the handler should run. Formats: `'15m'`, `'12h'`, `'1d'` |
| `description` | string | null | Human-readable description shown in the admin Settings UI |
| `status` | function | null | Async function returning current status (legacy, used when no runs have occurred) |

### Cadence

Each handler declares a cadence — how often it should actually run. When `runAll()` is called,
handlers whose `lastSuccessfulRun` is more recent than their cadence are skipped.
This allows the CronJob to fire frequently (every 15 minutes) while each handler controls its own update frequency.

- Default cadence is `'24h'` — handlers without an explicit cadence run once per day
- Cadence is validated at registration time — invalid values throw immediately
- Missing `lastSuccessfulRun` (first deploy, new handler) means the handler is immediately due
- Failed handlers retry on the next tick (only successful runs update `lastSuccessfulRun`)
- Admin UI allows cadence overrides per handler (minimum override: `'15m'`)
- `runModule()` (per-module refresh button) ignores cadence — all handlers for that module run

### Dynamic Cadence

If your handler's cadence depends on configuration, re-register when the config changes:

```javascript
context.registerRefresh('my-data', { ...config, cadence: myConfig.intervalHours + 'h' })

// On config change, re-register to update cadence
context.registerRefresh('my-data', { ...config, cadence: newIntervalHours + 'h' })
```

Re-registration replaces the handler entry.
In-flight runs are unaffected (the registry snapshots entries at the start of each run).

### Skipping a Refresh

When a handler decides it has no work to do (e.g., time-of-day guard, report already exists, demo mode),
return a `RefreshSkip` instance instead of returning `undefined` or a plain value.
This preserves the previous `lastSuccessfulRun` so the handler's cadence
is **not** consumed — it remains due on the next tick.

```javascript
context.registerRefresh('package-analysis', {
  cadence: '24h',
  handler: async function() {
    if (DEMO_MODE) return new context.RefreshSkip('Demo mode')
    const now = new Date()
    if (now.getUTCHours() < 6) {
      return new context.RefreshSkip('Before 6am UTC')
    }
    // ... do real work
  }
})
```

Without `RefreshSkip`, a bare `return` counts as a success — `lastSuccessfulRun` advances to now and
the 24h cadence starts over, meaning the handler won't run again until the next
day even though it never produced data.

`RefreshSkip` is available on the module context as `context.RefreshSkip`.
Prefer this over a direct `require` to stay consistent with the module context pattern.

Existing handlers that return `{ status: 'skipped', reason: '...' }` are also recognized
as skips automatically via a legacy compatibility bridge.

## Frontend Contribution Slots

### Mechanism vs. slots

The generic contribution **mechanism** lives in `@shared`
(`shared/client/contributions/` + `shared/client/components/ContributionBoundary.vue`)
so any module can build its own contribution slots on it. Core deliberately does
**not** define a universal slot vocabulary — each module decides what its own
slots are and what a valid contribution looks like.

- `createContributionRegistry({ name, validate })` — factory returning a
  namespaced registry `{ register, getAll, runGuard, reset }`. `name` prefixes
  log messages; `validate` is optional slot-specific validation.
- `runGuard(fn, opts)` — safely run a guard callback (throws are swallowed).
- `ContributionBoundary.vue` — the fault-isolation wrapper (see below). The
  single `render` descriptor `type` switch (component today; `remote` /
  `declarative` later) lives in `shared/client/contributions/`
  (`isValidRenderDescriptor` / `resolveRenderDescriptor`), so new delivery types
  are added in one place.

### team-tracker slots

Team-tracker builds three named **slots** on the shared factory so features can
extend its UI without core hardcoding `if (feature configured)` branches. This is
the frontend analog of the backend `context.registerRefresh` pattern.

The slots live at `modules/team-tracker/client/contributions/`:

- `registry.js` — three `createContributionRegistry` instances
  (`team-tracker:team-detail-tab`, `team-tracker:report`,
  `team-tracker:settings-tab`) wrapped in the team-tracker-specific slot API
  (`registerTeamDetailTab`, `registerReport`, `registerSettingsTab`, the getters,
  and `runGuard`)
- `apply-platform-contributions.js` — the pure, resilient helper that applies
  platform-provided contributions (see the discovery seam below)
- `index.js` — evaluates the registry, side-effect-imports the core reports
  (`../reports/registry`), applies the platform discovery seam, and re-exports the
  getters + `register*` functions. **Always import from `../contributions` (the
  index), never `./registry` directly**, so registration is guaranteed to have run.

The fault-isolation wrapper is imported from
`@shared/client/components/ContributionBoundary.vue`.

### Platform discovery seam (consumer contributions)

Core registers only its own reports (trends, team-comparison) directly. Consumer
repos add contributions from `platform/` — without importing team-tracker
internals — via a glob-by-convention seam:

```js
// modules/team-tracker/client/contributions/index.js
const platformContributions = import.meta.glob(
  '/platform/*/team-tracker-contributions.js',
  { eager: true }
)
applyPlatformContributions(platformContributions, {
  registerTeamDetailTab, registerReport, registerSettingsTab
})
```

A consumer ships one file per extension exporting a `register` function; the
registrar API is **injected**, never imported:

```js
// platform/<name>/team-tracker-contributions.js
export function register({ registerTeamDetailTab, registerReport, registerSettingsTab }) {
  registerTeamDetailTab({ /* ... */ })
}
```

`applyPlatformContributions` calls each `register(api)` inside a try/catch, so a
missing-`register` or throwing extension is skipped and logged, never aborting the
others (mirroring the registry's per-item resilience). When `platform/` is absent
(core / CI) the glob is empty and the seam is a no-op. See
[`docs/PLATFORM.md`](PLATFORM.md) § Team-Tracker Contributions for the consumer
guide.

### Slots

Core registrations import the `register*` functions from `../contributions`
(e.g. `../reports/registry`); consumer contributions receive them injected via
`register(api)` (see the discovery seam above). Either way the shape is the same:

```js
// A tab on the team detail view
registerTeamDetailTab({
  id: 'my-feature',           // unique; also the URL ?tab= value
  label: 'My Feature',
  order: 40,                  // optional, default 100
  icon: '<path ... />',       // optional inline SVG markup
  isVisible: (team, context) => boolean, // optional; throw or falsy hides it
  render: { type: 'component', load: () => import('./MyFeatureTab.vue') }
})

// A card in the Reports hub
registerReport({
  id: 'my-report',
  title: 'My Report',
  description: '...',
  icon: 'PieChart',           // optional lucide icon name
  tags: ['My Feature'],       // optional
  filters: ['org', 'team'],   // optional shared filter ids
  order: 30,
  isAvailable: () => boolean, // optional; throw or falsy hides it
  render: { type: 'component', load: () => import('./MyReport.vue') }
})

// A tab in Team Tracker settings
registerSettingsTab({
  id: 'my-feature',
  label: 'My Feature',
  order: 40,
  render: { type: 'component', load: () => import('./MyFeatureSettings.vue') }
})
```

Read the merged, sorted contributions with `getTeamDetailTabs()`, `getReports()`,
and `getSettingsTabs()`. Core renders each slot generically — it does not know
about any specific feature.

### The `render` descriptor

`render` is a **descriptor**, never a raw component, so the shape stays
forward-compatible with remote/federated or declarative delivery. Today only
`{ type: 'component', load: () => import('...') }` is rendered. Any object with a
string `type` is accepted at registration time; unknown types degrade gracefully
to a fallback at render time. Future types (e.g. `{ type: 'remote', ... }`,
`{ type: 'declarative', ... }`) can be added without breaking existing callers.

### Fault isolation

Extension failures must never break the host page:

- **Rendering** — every contributed component is rendered inside the shared
  `ContributionBoundary.vue` (`@shared/client/components/ContributionBoundary.vue`),
  which combines a Vue error boundary (`onErrorCaptured`) with an async-load
  fallback. A component that throws at runtime, or fails/ times out while
  loading, shows a small "This extension failed to load" panel instead of
  crashing the page.
- **Guards** — `isVisible` / `isAvailable` are always invoked through the
  `runGuard` helper (try/catch). A throw is treated as "not visible / not
  available", never a crash.
- **Registration** — a malformed contribution (missing required field, invalid
  render descriptor, duplicate id) is skipped and logged; it never aborts
  registration of the others.

### Conditional availability

Prefer expressing "only show when X" through `isVisible` / `isAvailable`
callbacks rather than conditional registration, so the decision is re-evaluated
reactively. `registerSettingsTab` has no visibility hook, so gate it by
registering conditionally. For example, a per-team tab can check that the team
has the relevant boards configured via `isVisible: (team, context) => ...`,
returning falsy (or throwing) to stay hidden.

## Secrets Declaration

Modules declare their secret requirements in `module.json`. This enables startup validation,
admin diagnostics, and ESLint enforcement preventing direct `process.env` access in module server code.

### module.json

```json
{
  "secrets": {
    "platform": ["jira", "github"],
    "module": [
      {
        "key": "MY_API_TOKEN",
        "description": "API token for My Service",
        "required": true
      }
    ],
    "dynamic": {
      "pattern": "MY_SERVICE_*_TOKEN",
      "description": "Per-instance tokens for My Service"
    }
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `secrets.platform` | string[] | Platform secret group IDs to consume (`jira`, `github`, `gitlab`, `ipa`, `google`) |
| `secrets.module` | object[] | Module-specific secrets with `key`, `description`, optional `required` (boolean), `group` (string), `exclusive` (boolean) |
| `secrets.dynamic` | object | Dynamic secret pattern with `pattern` (string) and optional `description` |

### Exclusive Groups

When multiple secrets serve the same purpose (e.g., OAuth credentials vs. personal token),
mark them as exclusive within a group:

```json
{
  "secrets": {
    "module": [
      { "key": "OAUTH_CLIENT_ID", "description": "OAuth client ID", "group": "auth" },
      { "key": "OAUTH_CLIENT_SECRET", "description": "OAuth secret", "group": "auth" },
      { "key": "PERSONAL_TOKEN", "description": "Personal token fallback", "group": "auth", "exclusive": true }
    ]
  }
}
```

### Accessing Secrets in Server Code

Module server code accesses secrets via the context object, never via `process.env`:

```javascript
module.exports = function registerRoutes(router, context) {
  // Static secrets (resolved once at startup)
  const token = context.secrets.MY_API_TOKEN

  // Dynamic secrets (resolved at call time from process.env)
  const instanceToken = context.resolveSecret('MY_SERVICE_US_TOKEN')

  // Register a validator for connectivity checks
  // Important: never include secret values in messages — they appear in admin API responses
  context.registerSecretValidator('MY_API_TOKEN', async function(value) {
    // Return { valid: true } or { valid: false, message: 'reason' }
    const ok = await testConnection(value)
    return { valid: ok, message: ok ? 'Connected' : 'Connection failed' }
  })
}
```

### Using Shared Client Factories

Shared server utilities provide `createX(config)` factories that bind credentials at creation time.
Modules should use these instead of the legacy global functions:

```javascript
const { createJiraClient } = require('../../../shared/server/jira')

module.exports = function registerRoutes(router, context) {
  // Create a Jira client with credentials from context.secrets
  const jira = createJiraClient({
    email: (context.secrets && context.secrets.JIRA_EMAIL) || '',
    token: (context.secrets && context.secrets.JIRA_TOKEN) || '',
    host: process.env.JIRA_HOST  // Config, not secret — in ESLint ALLOWED set
  })
  const { jiraRequest, JIRA_HOST } = jira

  // Use jiraRequest as before — same API, credentials bound in closure
  router.get('/data', async (req, res) => {
    const data = await jiraRequest('/rest/api/3/issue/KEY-1')
    res.json(data)
  })
}
```

Available factories: `createJiraClient`, `createGoogleSheetsClient`, `createSmartsheetClient`, `createIpaClient`,
`createBackupClient`. See `shared/API.md` for full signatures.

### ESLint Enforcement

The `org-pulse/no-module-process-env` ESLint rule prevents `process.env` access for secrets
in `modules/**/server/**/*.js`. Non-secret configuration variables (`DEMO_MODE`, `NODE_ENV`, `JIRA_HOST`, etc.)
are allowed. Test files are excluded.

### Admin Diagnostics

- `GET /api/admin/secrets/status` — returns configured/missing status for all secrets (never actual values)
- `POST /api/admin/secrets/validate` — runs registered validators
- Must-gather bundle includes `bundle.secrets` with full status

## Search Index

Modules contribute searchable items to the command palette (`/` key), allowing module-specific data
(feature keys, repo names, releases) to appear in global search alongside page navigation and quick actions.

### Declarative (preferred)

Add a `searchIndex` array to `module.json`. The system auto-generates search entries from your data files — no code needed:

```json
{
  "searchIndex": [
    {
      "source": "my-module/items.json",
      "items": "records",
      "label": "name",
      "context": "My Module → Items",
      "viewId": "detail",
      "params": { "id": "$id" },
      "filter": { "status": "active" },
      "keywords": ["category", "description"]
    }
  ]
}
```

#### Declaration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `source` | Yes | Storage key of the data file to read |
| `items` | Yes | Dot-path to the array (or object) within the JSON (e.g. `"features"`, `"data.repos"`) |
| `label` | Yes | Field name to use as the display label. Use `"$key"` when `items` is an object to use object keys as labels |
| `fallbackLabel` | No | Field name to use if `label` field is empty |
| `context` | Yes | Breadcrumb text shown in suggestions (e.g. "Releases → Schedule") |
| `viewId` | Yes | View ID from the module's `routes` export |
| `params` | No | Query parameters object. Values starting with `$` are field references (e.g. `{ "key": "$key" }` substitutes from each item) |
| `filter` | No | Object with field=value conditions. Only matching items are indexed |
| `keywords` | No | Array of field names whose values become extra search terms |

When `items` points to an object (not an array), each key-value pair becomes an entry with `$key` available as a field reference.

### Custom Handler (advanced)

For complex logic that can't be expressed declaratively, use `context.registerSearchIndex(fn)`:

```javascript
module.exports = function registerRoutes(router, context) {
  context.registerSearchIndex(async function(storage) {
    return [{ label: 'Item', context: 'My Module', viewId: 'view', params: { id: '1' } }]
  })
}
```

Both modes can coexist — declarative entries from `module.json` and custom handlers are merged.

### How It Works

- Items are served at `GET /api/search-index` with a 5-minute server-side cache
- The command palette fetches the index on first open and merges results with page navigation and quick actions
- Fuzzy matching applies to `label`, `context`, and `keywords`
- Routes are built automatically as `#/<module-slug>/<viewId>?<params>`
- Errors in one module's handler don't affect others

## Module Search (Scoped Search)

Modules can declare searchable views that appear in the command palette's scoped search.
When a user selects a searchable view, the palette shows a pill (e.g., "People & Teams → Team Directory")
and a text input. Typing a query and pressing Enter navigates to the module's view with the search term
as a URL param — the module's own search engine handles the query.

This is separate from [Search Index](#search-index): the search index contributes individual data items to global search,
while module search declares individual views as scoped search targets.

### Declaration

Add a `search` object to `module.json` with a `views` array. Each entry registers one searchable view.
View labels are auto-discovered from `navItems` — no hardcoded display names:

```json
{
  "search": {
    "enabled": true,
    "keywords": ["person", "member", "engineer", "team", "manager"],
    "views": [
      { "viewId": "home", "paramName": "search", "placeholder": "Search teams, orgs..." },
      { "viewId": "people", "paramName": "q", "placeholder": "Search people..." }
    ]
  }
}
```

### Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `enabled` | Yes | — | Opt-in flag. Only `true` modules appear as scoped search targets |
| `views` | Yes | — | Array of searchable views (see below) |
| `keywords` | No | `[]` | Extra terms that boost this module in regular (non-slash) search |

Each entry in `views`:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `viewId` | Yes | — | View ID that receives the search param (must match a navItem id or hiddenRoute) |
| `paramName` | No | `"q"` | URL param name for the search term |
| `placeholder` | No | `"Search in <name>..."` | Hint text shown in the scoped search input |

### How It Works

- **Suggestion Mode**: User types a search term → matching views appear as suggestions with a "Module" badge.
  Matches are ranked by relevance (more field matches score higher).
- **Scoped Mode**: Selecting a view shows a glass chip breadcrumb in the search bar
  (e.g., "People & Teams › Team Directory"). The user types a query and sees a single "Go to results" row.
  Pressing Enter navigates to `#/<slug>/<viewId>?<paramName>=<term>` and closes the palette.
- **History**: Each scope (main search vs. each module view) maintains its own separate search history.
  When the search input is empty, recent searches appear as selectable items in the dropdown with a clock icon.
  Selecting a history item populates the input and shows results for that query.
  Individual history items can be removed via the ✕ button or Delete key.
- **Exit**: Pressing Escape or Backspace on an empty input exits scoped mode (returns to portal search).
  A second Escape closes the palette.
- **Search Execution**: The target view reads the param via `inject('moduleNav').params.value.<paramName>`
  and executes its own search.
- **Validation**: `npm run validate:modules` enforces `search.views` is an array with valid `viewId` values.

## PR Checklist

- [ ] `module.json` has all required fields
- [ ] Slug matches directory name
- [ ] `npm run validate:modules` passes
- [ ] `npm test` passes
- [ ] CODEOWNERS entry added
- [ ] No imports from other modules (only `@shared`)
- [ ] If module persists data (`writeToStorage`): export hook registered and `export.files` declared in `module.json`
