/**
 * Discover GitHub pull requests linked to Jira issues via remote issue links
 * (GitHub-for-Jira integration). Replaces per-key GitHub search — one Jira API
 * call per issue returns the exact PR URLs shown in the development panel.
 */

const { AGENT_REPOS, REPO_TEAM_BY_NAME } = require('../github/prs');

const PR_URL_RE = /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i;

// Remote links are fetched one issue at a time, so the sweep is dominated by
// round-trip latency rather than payload size. Running a bounded number of keys
// concurrently turns a ~250ms-per-key serial walk into a handful of waves; the
// shared Jira client already retries 429s, which is the real rate-limit guard.
// `throttleMs` remains supported as a per-wave pause for callers that want to
// slow the sweep down. The key cap is a safety bound, not a silent drop.
const LINKED_PR_THROTTLE_MS = 0;
const LINKED_PR_CONCURRENCY = 15;
const LINKED_PR_MAX_KEYS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Derive PR state from a GitHub-for-Jira remote link's status icon/title.
 * Returns null when Jira omits status metadata (display as Unknown in the UI).
 *
 * @param {object} link - Jira remote issue link object
 * @returns {string|null} "OPEN" | "MERGED" | "CLOSED" | null
 */
function prStateFromRemoteLink(link) {
  const status = link && link.object && link.object.status;
  if (!status) return null;

  const iconTitle = (status.icon && status.icon.title || '').trim();
  if (iconTitle) {
    const lower = iconTitle.toLowerCase();
    if (lower.includes('merged')) return 'MERGED';
    if (lower.includes('open')) return 'OPEN';
    if (lower.includes('declined') || lower.includes('closed')) return 'CLOSED';
  }

  if (status.resolved === true) return 'CLOSED';
  if (status.resolved === false && iconTitle) return 'OPEN';

  return null;
}

/**
 * Parse a GitHub PR from a Jira remote issue link, filtering to agent repos.
 *
 * @param {object} link
 * @param {Set<string>} agentRepoSet
 * @returns {{repo:string,team:string|null,number:number,url:string,state:string|null,author:null}|null}
 */
function parseRemoteLinkPr(link, agentRepoSet) {
  const object = link && link.object;
  const url = object && object.url;
  if (!url) return null;

  const m = url.match(PR_URL_RE);
  if (!m) return null;

  const repo = m[1];
  if (agentRepoSet && !agentRepoSet.has(repo)) return null;

  return {
    repo,
    team: REPO_TEAM_BY_NAME[repo] || null,
    number: Number(m[2]),
    url,
    state: null, // resolved from GitHub during refresh; UNKNOWN if unavailable
    author: null
  };
}

/**
 * Fetch remote issue links for a single Jira key.
 *
 * @param {Function} jiraRequest
 * @param {string} key
 * @returns {Promise<object[]>}
 */
async function fetchRemoteLinksForKey(jiraRequest, key) {
  const links = await jiraRequest(`/rest/api/3/issue/${encodeURIComponent(key)}/remotelink`);
  return Array.isArray(links) ? links : [];
}

/**
 * Fetch linked PRs for many Jira keys via remote issue links.
 *
 * @param {Function} jiraRequest
 * @param {string[]} keys
 * @param {object} [options]
 * @param {string[]} [options.repos] - agent repos to include (defaults to AGENT_REPOS)
 * @param {number} [options.throttleMs] - pause between concurrent waves
 * @param {number} [options.concurrency]
 * @param {number} [options.maxKeys]
 * @returns {Promise<Map<string, Array<{repo:string,team:string|null,number:number,url:string,state:string|null,author:null}>>>}
 */
async function fetchLinkedPrsForKeys(jiraRequest, keys, options = {}) {
  const byKey = new Map();
  const repos = options.repos || AGENT_REPOS;
  const agentRepoSet = new Set(repos);
  const throttleMs = options.throttleMs != null ? options.throttleMs : LINKED_PR_THROTTLE_MS;
  const concurrency = Math.max(1, options.concurrency != null ? options.concurrency : LINKED_PR_CONCURRENCY);
  const maxKeys = options.maxKeys != null ? options.maxKeys : LINKED_PR_MAX_KEYS;

  const distinct = [...new Set((keys || []).filter(Boolean))];
  const targets = distinct.slice(0, maxKeys);
  if (distinct.length > targets.length) {
    console.warn(
      `[jira-solve-agent] Remote-link fetch capped at ${maxKeys} keys; ` +
      `${distinct.length - targets.length} ticket(s) not fetched this run.`
    );
  }

  // One key's worth of work. A failure is logged and skipped so a single bad
  // ticket never aborts the sweep, matching the previous serial behaviour.
  async function collectKey(key) {
    try {
      const links = await fetchRemoteLinksForKey(jiraRequest, key);
      const prs = [];
      const seenUrls = new Set();
      for (const link of links) {
        const pr = parseRemoteLinkPr(link, agentRepoSet);
        if (!pr || seenUrls.has(pr.url)) continue;
        seenUrls.add(pr.url);
        prs.push(pr);
      }
      if (prs.length) byKey.set(key, prs);
    } catch (err) {
      console.warn(`[jira-solve-agent] Remote-link fetch failed for ${key}: ${err.message}`);
    }
  }

  for (let i = 0; i < targets.length; i += concurrency) {
    const wave = targets.slice(i, i + concurrency);
    await Promise.all(wave.map(collectKey));
    if (throttleMs > 0 && i + concurrency < targets.length) {
      await sleep(throttleMs);
    }
  }

  return byKey;
}

module.exports = {
  fetchLinkedPrsForKeys,
  fetchRemoteLinksForKey,
  parseRemoteLinkPr,
  prStateFromRemoteLink,
  LINKED_PR_THROTTLE_MS,
  LINKED_PR_CONCURRENCY,
  LINKED_PR_MAX_KEYS
};
