/**
 * Count pull requests carrying each Chai risk assessment label, per repository.
 *
 * Chai labels the latest commit of a PR with exactly one of
 * `chai-risk-assessment/low`, `/moderate`, or `/critical`. GitHub search
 * returns an `issueCount` without paging, so every repo/level count is one
 * aliased `search` field and the whole snapshot is a single GraphQL request.
 *
 * Uses Node's global fetch (available in Node 22+).
 */

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql'

const RISK_LABEL_PREFIX = 'chai-risk-assessment/'
const RISK_LEVELS = ['low', 'moderate', 'critical']

const REPOS = [
  'openshift/cluster-api-provider-aws',
  'openshift/cluster-etcd-operator',
  'openshift/cluster-ingress-operator',
  'openshift/cluster-kube-apiserver-operator',
  'openshift/cluster-network-operator',
  'openshift/cluster-version-operator',
  'openshift/console-operator',
  'openshift/hypershift',
  'openshift/installer',
  'openshift/lvm-operator',
  'openshift/machine-config-operator',
  'openshift/topolvm',
  'openshift/windows-machine-config-operator'
]

function riskLabel(level) {
  return `${RISK_LABEL_PREFIX}${level}`
}

function searchQuery(repo, level) {
  return `repo:${repo} is:pr label:${riskLabel(level)}`
}

function alias(repoIndex, level) {
  return `r${repoIndex}_${level}`
}

/**
 * Build one GraphQL query with an aliased count per repo and risk level.
 * @param {string[]} repos
 * @returns {string}
 */
function buildCountsQuery(repos) {
  const fields = repos.flatMap((repo, i) => RISK_LEVELS.map(level =>
    `  ${alias(i, level)}: search(query: ${JSON.stringify(searchQuery(repo, level))}, type: ISSUE, first: 0) { issueCount }`
  ))
  return `query {\n${fields.join('\n')}\n}`
}

/**
 * Fetch raw per-level PR counts for every repo.
 * @param {object} options
 * @param {string} options.token - GitHub API token
 * @param {string[]} [options.repos]
 * @param {Function} [options.fetchImpl]
 * @returns {Promise<Array<{repo:string,counts:{low:number,moderate:number,critical:number}}>>}
 */
async function fetchRiskCounts(options = {}) {
  const { token, repos = REPOS, fetchImpl = fetch } = options
  if (!token) throw new Error('GITHUB_TOKEN is not configured')

  const response = await fetchImpl(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'org-pulse-risk-assessment'
    },
    body: JSON.stringify({ query: buildCountsQuery(repos) })
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  if (json.errors && json.errors.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map(e => e.message).join('; ')}`)
  }

  const data = json.data || {}
  return repos.map((repo, i) => ({
    repo,
    counts: Object.fromEntries(RISK_LEVELS.map(level => [level, data[alias(i, level)]?.issueCount || 0]))
  }))
}

function percentage(count, total) {
  return total ? Math.round((count / total) * 100) : null
}

/**
 * Add the assessed-PR total and each level's share to a repo's raw counts.
 * @param {{low?:number,moderate?:number,critical?:number}} counts
 */
function summarizeCounts(counts = {}) {
  const normalized = Object.fromEntries(RISK_LEVELS.map(level => [level, counts[level] || 0]))
  const total = RISK_LEVELS.reduce((sum, level) => sum + normalized[level], 0)
  return {
    total,
    counts: normalized,
    percentages: Object.fromEntries(RISK_LEVELS.map(level => [level, percentage(normalized[level], total)]))
  }
}

/**
 * Per-repo summaries, most assessed PRs first, plus the totals across repos.
 * @param {Array<{repo:string,counts:object}>} repos
 */
function computeSummary(repos = []) {
  const rows = repos
    .map(({ repo, counts }) => ({ repo, ...summarizeCounts(counts) }))
    .sort((a, b) => b.total - a.total || a.repo.localeCompare(b.repo))

  const combined = Object.fromEntries(RISK_LEVELS.map(level => [
    level,
    rows.reduce((sum, row) => sum + row.counts[level], 0)
  ]))

  return { repos: rows, totals: summarizeCounts(combined) }
}

module.exports = {
  REPOS,
  RISK_LEVELS,
  RISK_LABEL_PREFIX,
  riskLabel,
  searchQuery,
  buildCountsQuery,
  fetchRiskCounts,
  summarizeCounts,
  computeSummary
}
