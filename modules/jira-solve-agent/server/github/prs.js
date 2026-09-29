/**
 * Fetch pull requests opened by the Jira Solve Agent bot (redhat-chai-bot)
 * across the OpenShift repositories wired up to the periodic agent jobs.
 *
 * The GitHub GraphQL `search` API is used with a per-repo `author:` filter so
 * we count every PR the bot has ever opened (all states). Each PR's leading
 * Jira key is extracted from its title (OpenShift convention: "KEY-123: ...",
 * "Bug KEY-123: ...", "[release-x.y] KEY-123: ...") so the caller can
 * de-duplicate PRs against the Jira `issue-for-agent` set.
 *
 * Requires a GITHUB_TOKEN (classic PAT). This is a lightweight fetch (a handful
 * of repos, cursor-paginated), consistent with the app's display-layer role.
 */

const fetch = require('node-fetch');

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const GITHUB_REST_URL = 'https://api.github.com';
const BOT_LOGIN = 'redhat-chai-bot';

// Hydration is latency-bound single-object GETs, so it runs as a rolling pool
// of workers rather than fixed batches — no worker idles waiting on a slow peer.
const HYDRATE_CONCURRENCY = 30;

// GitHub's search API is rate-limited far more tightly than the REST API
// (roughly 30 requests/minute), so repo searches run in small waves.
const SEARCH_CONCURRENCY = 8;
const HYDRATE_MAX_RETRIES = 3;
const HYDRATE_BACKOFF_BASE_MS = 1000;
const HYDRATE_MAX_BACKOFF_MS = 30000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Repo -> team key. Team keys match the client's TEAMS list in AgentContent.vue.
// This map doubles as the fetch list and the team-attribution filter.
//
// Grouped by owning area rather than one team per repo: the client renders one
// selector button per team, so per-repo teams would swamp the UI. Declared as
// team -> repos and flattened below, which keeps each area's membership legible.
const TEAM_REPOS = {
  mco: ['machine-config-operator', 'os'],
  ingress: ['cluster-ingress-operator', 'router'],
  wmco: ['windows-machine-config-operator'],
  installer: ['installer'],
  hypershift: ['hypershift'],
  trt: ['sippy', 'origin', 'ci-tools', 'ci-docs', 'ci-tools-standalone', 'enhancements'],
  ota: ['cluster-version-operator', 'cincinnati-graph-data'],
  'kube-api': [
    'kubernetes',
    'api',
    'oc',
    'cluster-kube-apiserver-operator',
    'cluster-openshift-apiserver-operator',
    'cluster-authentication-operator',
    'ocp-release-operator-sdk'
  ],
  oadp: [
    'oadp-operator',
    'velero',
    'velero-plugin-for-aws',
    'velero-plugin-for-gcp',
    'velero-plugin-for-microsoft-azure',
    'velero-plugin-for-legacy-aws',
    'openshift-velero-plugin',
    'oadp-must-gather'
  ],
  networking: ['ovn-kubernetes', 'cluster-network-operator', 'multus-cni', 'ptp-operator'],
  etcd: ['etcd', 'cluster-etcd-operator'],
  storage: [
    'local-storage-operator',
    'csi-operator',
    'secrets-store-csi-driver',
    'csi-external-snapshotter',
    'csi-driver-smb',
    'cluster-image-registry-operator'
  ],
  'cloud-providers': [
    'cloud-provider-kubevirt',
    'cloud-provider-azure',
    'cloud-provider-ibm',
    'cluster-cloud-controller-manager-operator',
    'cloud-credential-operator'
  ],
  'cluster-lifecycle': [
    'cluster-samples-operator',
    'cluster-baremetal-operator',
    'assisted-service',
    'oc-mirror'
  ],
  'machine-api': [
    'cluster-control-plane-machine-set-operator',
    'cluster-api-actuator-pkg',
    'machine-api-provider-gcp',
    'kubernetes-autoscaler'
  ],
  console: ['console', 'console-operator'],
  olm: ['operator-framework-olm', 'ansible-operator-plugins', 'kueue-operator'],
  support: ['insights-operator', 'must-gather'],
  // Edge & Ecosystem pillar — derived from gitlab.cee.redhat.com/hybrid-platforms/org.
  // Repos already wired to another team (oc-mirror→cluster-lifecycle,
  // installer→installer, hypershift→hypershift, etc.) are intentionally excluded.
  // Non-openshift/ orgs (openshift-eng, openshift-metal3, okd-project) are excluded
  // because the bot only targets openshift/ repositories.
  'edge-ecosystem': [
    // Edge
    'lvm-operator', 'microshift',
    // Application Platform (OAP)
    'cert-manager-operator', 'secrets-store-csi-driver-operator',
    'spire-operator', 'external-secrets-operator', 'must-gather-operator',
    // CID
    'mirror-gui',
    // Multi Architecture
    'multiarch-tuning-operator',
    // Metal Platform
    'ironic-image', 'ironic-agent-image', 'ironic-rhcos-downloader',
    'cluster-api-provider-baremetal', 'cluster-api-provider-metal3',
    'baremetal-operator', 'ironic-standalone-operator',
    'machine-os-images', 'image-customization-controller',
    'openstack-sushy', 'openstack-ironic', 'openstack-ironic-lib',
    'openstack-ironic-python-agent', 'openstack-ironic-inspector'
  ]
};

const REPO_TEAMS = Object.entries(TEAM_REPOS).flatMap(([team, repos]) =>
  repos.map(name => ({ repo: `openshift/${name}`, team }))
);

// Leading Jira key in a PR title. Excludes CVE- (not a Jira project).
const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

/**
 * Extract the first Jira-style key from a PR title, ignoring CVE identifiers.
 * @param {string} title
 * @returns {string|null}
 */
function extractJiraKey(title) {
  if (!title) return null;
  const matches = title.match(JIRA_KEY_RE) || [];
  for (const m of matches) {
    if (m.startsWith('CVE-')) continue;
    return m;
  }
  return null;
}

async function graphqlRequest(query, variables, token) {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'jira-solve-agent'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map(e => e.message).join('; ')}`);
  }
  return json.data;
}

const SEARCH_QUERY = `
  query($q: String!, $cursor: String) {
    search(query: $q, type: ISSUE, first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          number
          title
          url
          state
          createdAt
        }
      }
    }
  }
`;

/**
 * Fetch every PR opened by the bot in a single repo (all states, all pages).
 * @param {string} repo - "owner/name"
 * @param {string} token
 * @returns {Promise<Array<{number:number,title:string,url:string,state:string,createdAt:string}>>}
 */
async function fetchRepoPrs(repo, token) {
  const q = `repo:${repo} type:pr author:${BOT_LOGIN}`;
  const prs = [];
  let cursor = null;

  // Safety bound: GitHub search caps at 1000 results; 10 pages of 100 covers it.
  for (let page = 0; page < 10; page++) {
    const data = await graphqlRequest(SEARCH_QUERY, { q, cursor }, token);
    const search = data && data.search;
    if (!search) break;

    for (const node of search.nodes || []) {
      if (!node || typeof node.number !== 'number') continue; // skip non-PR nodes
      prs.push({
        number: node.number,
        title: node.title,
        url: node.url,
        state: node.state,
        createdAt: node.createdAt
      });
    }

    if (!search.pageInfo || !search.pageInfo.hasNextPage) break;
    cursor = search.pageInfo.endCursor;
  }

  return prs;
}

/**
 * Fetch all bot PRs across the wired-up repos.
 * @param {object} [options]
 * @param {string} options.token - GitHub API token
 * @param {number} [options.concurrency] - repo searches in flight at once
 * @returns {Promise<Array<{repo:string,team:string,number:number,title:string,url:string,state:string,createdAt:string,jiraKey:string|null}>>}
 */
async function fetchAgentPrs(options = {}) {
  const token = options.token;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured');
  }

  // Each repo is an independent paginated search, so they run concurrently —
  // but GitHub's search API is rate-limited far more tightly than the REST API,
  // so they go in bounded waves rather than all at once. `allSettled` keeps the
  // per-repo error isolation of the original serial loop: one repo failing
  // degrades that repo only, never the whole fetch.
  const concurrency = Math.max(
    1,
    options.concurrency != null ? options.concurrency : SEARCH_CONCURRENCY
  );

  const all = [];
  for (let i = 0; i < REPO_TEAMS.length; i += concurrency) {
    const wave = REPO_TEAMS.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      wave.map(({ repo }) => fetchRepoPrs(repo, token))
    );

    settled.forEach((outcome, j) => {
      const { repo, team } = wave[j];
      if (outcome.status === 'rejected') {
        console.warn(`[jira-solve-agent] Failed to fetch PRs for ${repo}: ${outcome.reason.message}`);
        return;
      }
      for (const pr of outcome.value) {
        all.push({
          repo,
          team,
          number: pr.number,
          title: pr.title,
          url: pr.url,
          state: pr.state,
          createdAt: pr.createdAt,
          jiraKey: extractJiraKey(pr.title)
        });
      }
    });
  }

  return all;
}

const AGENT_REPOS = REPO_TEAMS.map(rt => rt.repo);

// Map a repo name back to its team key, so a linked PR can be team-attributed.
const REPO_TEAM_BY_NAME = REPO_TEAMS.reduce((acc, rt) => {
  acc[rt.repo] = rt.team;
  return acc;
}, {});

/**
 * Map a GitHub REST pull object to OPEN | MERGED | CLOSED | UNKNOWN.
 * @param {{ merged?: boolean, state?: string }} data
 * @returns {string}
 */
function prStateFromRestPull(data) {
  if (!data) return 'UNKNOWN';
  if (data.merged) return 'MERGED';
  if (data.state === 'open') return 'OPEN';
  if (data.state === 'closed') return 'CLOSED';
  return 'UNKNOWN';
}

/**
 * Seconds to wait before retrying a rate-limited GitHub response. Honours
 * `retry-after`, then the primary-rate-limit `x-ratelimit-reset` epoch, and
 * falls back to exponential backoff.
 *
 * @param {object} response
 * @param {number} attempt - zero-based retry attempt
 * @param {number} [baseMs] - backoff base, overridable so tests need not sleep
 * @returns {number} delay in milliseconds
 */
function rateLimitDelayMs(response, attempt, baseMs = HYDRATE_BACKOFF_BASE_MS) {
  const header = (name) => (response.headers && typeof response.headers.get === 'function')
    ? response.headers.get(name)
    : null;

  const retryAfter = parseInt(header('retry-after'), 10);
  if (!isNaN(retryAfter) && retryAfter > 0) return retryAfter * 1000;

  const reset = parseInt(header('x-ratelimit-reset'), 10);
  if (!isNaN(reset) && reset > 0) {
    const delta = reset * 1000 - Date.now();
    if (delta > 0) return Math.min(delta, HYDRATE_MAX_BACKOFF_MS);
  }

  return Math.min(Math.pow(2, attempt + 1) * baseMs, HYDRATE_MAX_BACKOFF_MS);
}

/**
 * True when a GitHub response indicates rate limiting: an explicit 429, or the
 * 403 GitHub returns when the primary rate limit is exhausted.
 *
 * @param {object} response
 * @returns {boolean}
 */
function isRateLimited(response) {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;
  const remaining = response.headers && typeof response.headers.get === 'function'
    ? response.headers.get('x-ratelimit-remaining')
    : null;
  return remaining === '0';
}

/**
 * Fetch live PR state from GitHub REST (merged flag distinguishes MERGED vs CLOSED).
 *
 * Retries on rate limiting so that raising hydration concurrency cannot quietly
 * degrade PR state to UNKNOWN; other errors throw on the first attempt.
 *
 * @param {string} repo - "owner/name"
 * @param {number} number
 * @param {string} token
 * @param {Function} [fetchImpl]
 * @param {object} [options]
 * @param {number} [options.backoffBaseMs]
 * @returns {Promise<string>}
 */
async function hydratePullRequestState(repo, number, token, fetchImpl = fetch, options = {}) {
  const parts = repo.split('/');
  if (parts.length !== 2) {
    throw new Error(`invalid repo: ${repo}`);
  }
  const [owner, name] = parts;

  for (let attempt = 0; ; attempt++) {
    const response = await fetchImpl(
      `${GITHUB_REST_URL}/repos/${owner}/${name}/pulls/${number}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'jira-solve-agent'
        }
      }
    );

    if (response.ok) {
      return prStateFromRestPull(await response.json());
    }

    if (isRateLimited(response) && attempt < HYDRATE_MAX_RETRIES) {
      const delay = rateLimitDelayMs(response, attempt, options.backoffBaseMs);
      console.warn(
        `[jira-solve-agent] GitHub rate limited on ${repo}#${number}, ` +
        `retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${HYDRATE_MAX_RETRIES})`
      );
      await sleep(delay);
      continue;
    }

    throw new Error(`GitHub PR API error: ${response.status} ${response.statusText}`);
  }
}

/**
 * Hydrate PR state on linked PR objects discovered via Jira remote links.
 * Jira remotelinks often omit merge status, so we resolve state from GitHub.
 *
 * @param {Map<string, Array<{repo:string,number:number,url:string,state:string}>>} linkedByKey
 * @param {object} options
 * @param {string} options.token - GitHub API token
 * @param {Function} [options.fetchImpl]
 * @param {number} [options.concurrency]
 */
async function hydrateLinkedPrStates(linkedByKey, options = {}) {
  if (!linkedByKey || linkedByKey.size === 0) return;

  const token = options.token;
  const fetchImpl = options.fetchImpl || fetch;
  const concurrency = Math.max(
    1,
    options.concurrency != null ? options.concurrency : HYDRATE_CONCURRENCY
  );

  // A PR linked from several Jira issues appears once per key as a separate
  // object. Group every copy under its url so one fetch updates all of them —
  // keeping only the last copy would leave the rest stuck at their initial
  // state and render as Unknown in the UI.
  const byUrl = new Map();
  for (const prs of linkedByKey.values()) {
    for (const pr of prs) {
      if (!pr || !pr.url) continue;
      const copies = byUrl.get(pr.url);
      if (copies) copies.push(pr);
      else byUrl.set(pr.url, [pr]);
    }
  }

  const list = [...byUrl.values()];
  if (list.length === 0) return;

  const applyState = (copies, state) => {
    for (const pr of copies) pr.state = state;
  };

  if (!token) {
    for (const copies of list) applyState(copies, 'UNKNOWN');
    return;
  }

  // Rolling pool: workers pull the next index off a shared cursor, so a slow
  // call never blocks the others and dispatch order still follows `list`.
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const copies = list[cursor++];
      const { repo, number } = copies[0];
      try {
        applyState(copies, await hydratePullRequestState(repo, number, token, fetchImpl, {
          backoffBaseMs: options.backoffBaseMs
        }));
      } catch (err) {
        console.warn(
          `[jira-solve-agent] Failed to hydrate PR state for ${repo}#${number}: ${err.message}`
        );
        applyState(copies, 'UNKNOWN');
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, list.length) },
    () => worker()
  );
  await Promise.all(workers);
}

module.exports = {
  fetchAgentPrs,
  fetchRepoPrs,
  hydrateLinkedPrStates,
  hydratePullRequestState,
  prStateFromRestPull,
  extractJiraKey,
  TEAM_REPOS,
  REPO_TEAMS,
  AGENT_REPOS,
  REPO_TEAM_BY_NAME,
  BOT_LOGIN,
  HYDRATE_CONCURRENCY,
  SEARCH_CONCURRENCY
};
