#!/usr/bin/env node

/**
 * Validates that Dockerfile npm install --no-save lists stay in sync with
 * package.json. Every non-core dependency must appear with a major-version
 * pin in at least one Dockerfile, and every Dockerfile package must be a real
 * dependency.
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
const hpEngDeps = new Map(
  Object.entries(pkg.dependencies || {})
    .filter(([name]) => name !== '@org-pulse/core' && !coreDeps.has(name))
    .map(([name, version]) => [name, {
      declaredVersion: version,
      major: getMajorVersion(version),
    }])
);

/** Return a major version only for a simple exact, caret, or tilde version. */
function getMajorVersion(version) {
  if (typeof version !== 'string') return null;
  const match = version.trim().match(/^[~^]?(\d+)(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
  return match ? match[1] : null;
}

// --- Parse Dockerfile npm install --no-save lines ---
function parseDockerfileDeps(filepath) {
  const content = fs.readFileSync(filepath, 'utf8')
    .split(/\r?\n/)
    .filter(line => !/^\s*#/.test(line))
    .join('\n')
    .replace(/\\\r?\n/g, ' ');
  const deps = [];
  const installCommands = /\bnpm\s+install\b([^\n;&|]*)/g;
  const optionsWithValues = new Set([
    '--cache', '--install-strategy', '--loglevel', '--omit', '--include',
    '--prefix', '--registry', '--tag', '--workspace',
  ]);

  for (const match of content.matchAll(installCommands)) {
    const tokens = match[1].trim().split(/\s+/).filter(Boolean);
    if (!tokens.includes('--no-save')) continue;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith('-')) {
        if (optionsWithValues.has(token) && tokens[i + 1] && !tokens[i + 1].startsWith('-')) i++;
        continue;
      }

      const separator = token.startsWith('@')
        ? token.lastIndexOf('@') > token.indexOf('/') ? token.lastIndexOf('@') : -1
        : token.lastIndexOf('@') > 0 ? token.lastIndexOf('@') : -1;
      const name = separator === -1 ? token : token.slice(0, separator);
      const version = separator === -1 ? null : token.slice(separator + 1);
      deps.push({
        name,
        version,
        spec: token,
        filepath,
      });
    }
  }
  return deps;
}

const frontendDockerfile = path.join(ROOT, 'deploy/hp-eng.frontend.Dockerfile');
const backendDockerfile = path.join(ROOT, 'deploy/hp-eng.backend.Dockerfile');

const dockerDeps = [
  ...parseDockerfileDeps(frontendDockerfile),
  ...parseDockerfileDeps(backendDockerfile),
];
const dockerDepsByName = new Map();
for (const dep of dockerDeps) {
  if (!dockerDepsByName.has(dep.name)) dockerDepsByName.set(dep.name, []);
  dockerDepsByName.get(dep.name).push(dep);
}

// --- Compare ---
let errors = 0;

// Check: every HP Eng dep should be in at least one Dockerfile
for (const [dep, details] of hpEngDeps) {
  const entries = dockerDepsByName.get(dep) || [];
  if (!details.major) {
    console.error(
      `UNSUPPORTED VERSION: "${dep}" has package.json version "${details.declaredVersion}";` +
      ` the validator cannot determine a single major-version pin.`
    );
    errors++;
  }

  if (entries.length === 0) {
    const suggestion = details.major ? `${dep}@${details.major}` : dep;
    console.error(
      `MISSING: "${dep}" is in package.json but not in any Dockerfile.` +
      `\n  Add "${suggestion}" to npm install --no-save in` +
      ` deploy/hp-eng.frontend.Dockerfile or deploy/hp-eng.backend.Dockerfile.` +
      `\n  Example: RUN npm install --no-save ${suggestion}`
    );
    errors++;
    continue;
  }

  if (details.major) {
    for (const entry of entries) {
      if (entry.version !== details.major) {
        console.error(
          `VERSION: "${entry.spec}" in ${path.relative(ROOT, entry.filepath)}` +
          ` does not match the expected major pin for package.json version` +
          ` "${details.declaredVersion}".\n  Replace it with "${dep}@${details.major}".`
        );
        errors++;
      }
    }
  }
}

// Check: every Dockerfile dep should be a real HP Eng dependency
for (const dep of dockerDeps) {
  if (!hpEngDeps.has(dep.name)) {
    if (dep.name === '@org-pulse/core' || coreDeps.has(dep.name)) {
      console.error(
        `REDUNDANT: "${dep.spec}" in ${path.relative(ROOT, dep.filepath)}` +
        ` is already provided by @org-pulse/core.\n  Remove it from the Dockerfile.`
      );
    } else if (!ourDeps.has(dep.name)) {
      console.error(
        `UNKNOWN: "${dep.spec}" in ${path.relative(ROOT, dep.filepath)}` +
        ` is not in package.json.\n  Add "${dep.name}" to package.json or remove it from the Dockerfile.`
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
