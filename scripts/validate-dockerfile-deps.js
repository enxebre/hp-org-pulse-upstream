#!/usr/bin/env node

/**
 * Validates that Dockerfile npm install --no-save lists stay in sync with
 * package.json. Every non-core dependency must appear in at least one
 * Dockerfile, and every Dockerfile package must be a real dependency.
 *
 * Usage: node scripts/validate-dockerfile-deps.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// --- Read package.json dependencies ---
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const ourDeps = new Set(Object.keys(pkg.dependencies || {}));

// --- Read core's dependencies ---
const corePkgPath = path.join(ROOT, 'node_modules/@org-pulse/core/package.json');
if (!fs.existsSync(corePkgPath)) {
  console.error('Error: @org-pulse/core not installed. Run npm install first.');
  process.exit(1);
}
const corePkg = JSON.parse(fs.readFileSync(corePkgPath, 'utf8'));
const coreDeps = new Set(Object.keys(corePkg.dependencies || {}));

// --- Compute HP Eng-only deps (ours minus core's minus @org-pulse/core itself) ---
const hpEngDeps = new Set(
  [...ourDeps].filter(d => d !== '@org-pulse/core' && !coreDeps.has(d))
);

// --- Parse Dockerfile npm install --no-save lines ---
function parseDockerfileDeps(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const deps = new Set();
  // Match: RUN npm install --no-save pkg1 pkg2 ...
  // Handles line continuations with backslash
  const joined = content.replace(/\\\n/g, ' ');
  const match = joined.match(/npm install --no-save\s+(.+)/);
  if (match) {
    match[1].trim().split(/\s+/).forEach(pkg => {
      if (pkg && !pkg.startsWith('-')) deps.add(pkg);
    });
  }
  return deps;
}

const frontendDockerfile = path.join(ROOT, 'deploy/hp-eng.frontend.Dockerfile');
const backendDockerfile = path.join(ROOT, 'deploy/hp-eng.backend.Dockerfile');

const frontendDeps = parseDockerfileDeps(frontendDockerfile);
const backendDeps = parseDockerfileDeps(backendDockerfile);
const dockerDeps = new Set([...frontendDeps, ...backendDeps]);

// --- Compare ---
let errors = 0;

// Check: every HP Eng dep should be in at least one Dockerfile
for (const dep of hpEngDeps) {
  if (!dockerDeps.has(dep)) {
    console.error(
      `MISSING: "${dep}" is in package.json but not in any Dockerfile.` +
      `\n  Add it to deploy/hp-eng.frontend.Dockerfile or deploy/hp-eng.backend.Dockerfile`
    );
    errors++;
  }
}

// Check: every Dockerfile dep should be a real HP Eng dependency
for (const dep of dockerDeps) {
  if (!hpEngDeps.has(dep)) {
    if (coreDeps.has(dep)) {
      console.error(
        `REDUNDANT: "${dep}" is in a Dockerfile but already provided by @org-pulse/core.` +
        `\n  Remove it from the Dockerfile`
      );
    } else if (!ourDeps.has(dep)) {
      console.error(
        `UNKNOWN: "${dep}" is in a Dockerfile but not in package.json.` +
        `\n  Add it to package.json or remove it from the Dockerfile`
      );
    }
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n${errors} Dockerfile dependency sync error(s) found.`);
  process.exit(1);
} else {
  console.log(`Dockerfile deps in sync: ${hpEngDeps.size} HP Eng-specific packages validated.`);
}
