---
name: create-module
description: Bootstrap a new module from the template
---

# Create Module

Bootstrap a new built-in module for the People & Teams app.

Ask the user for:

1. **Module name** (display name, e.g., "Sprint Health")
1. **Slug** (URL-safe identifier, e.g., "sprint-health")
1. **Description** (short, for landing page)
1. **Icon** (Lucide icon name, e.g., "bar-chart", "box", "search")
1. **Needs backend?** (whether to include server routes)

Then perform these steps:

## 1. Copy the template

```bash
cp -r docs/module-template modules/<slug>
```

## 2. Update module.json

Edit `modules/<slug>/module.json` with the provided name, slug, description, and icon. Update
`navItems[0].label` to match the module name. If no backend is needed, remove the `server` section.

## 3. Update view template

Edit `modules/<slug>/client/views/MainView.vue` — replace "My Module" with the module name.

## 4. Update test

Edit `modules/<slug>/__tests__/client/MainView.test.js` — update the expected text to match the module name.

## 6. Validate

```bash
npm run validate:modules
```

## 7. Run tests

```bash
npm test
```

Confirm both pass before finishing.
