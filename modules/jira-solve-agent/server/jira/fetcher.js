const { fetchAllJqlResults } = require('../../../../shared/server/jira');

const PROJECTS = [
  'OCPBUGS', 'CNTRLPLANE', 'TRT', 'WINC', 'MCO', 'NE',
  // Edge & Ecosystem pillar — derived from gitlab.cee.redhat.com/hybrid-platforms/org
  'OCPEDGE', 'USHIFT',                              // Edge
  'OAPE', 'SSCSI', 'SPIRE', 'ESO',                  // Application Platform (OAP)
  'CLID',                                            // CID
  'OKD',                                             // OKD
  'MULTIARCH',                                       // Multi Architecture
  'METAL',                                           // Metal Platform
  'SPLAT', 'OPCT'                                    // SPLAT
];
const AGENT_LABEL = 'issue-for-agent';
const PROCESSED_LABEL = 'agent-processed';
const READY_TO_SOLVE_LABEL = 'ready-to-solve';
const CHAI_BACKPORT_LABEL = 'chai-backport';

const FIELDS = 'summary,status,issuetype,priority,created,updated,labels,components,assignee';

function classifyIssue(statusCategory, labels) {
  const category = (statusCategory || '').toLowerCase();
  const labelSet = new Set(labels);

  if (category === 'done') {
    return 'closed';
  }
  if (category === 'in progress') {
    return 'in-progress';
  }
  if (category === 'to do' || category === 'new') {
    if (labelSet.has(READY_TO_SOLVE_LABEL)) return 'ready-to-solve';
    return 'new';
  }
  return 'other';
}

function processIssue(issue) {
  const labels = issue.fields.labels || [];
  const statusName = issue.fields.status?.name || 'Unknown';
  const statusCategory = issue.fields.status?.statusCategory?.name || '';
  const components = (issue.fields.components || []).map(c => c.name);

  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: statusName,
    issueType: issue.fields.issuetype?.name || 'Unknown',
    priority: issue.fields.priority?.name || 'None',
    created: issue.fields.created,
    updated: issue.fields.updated,
    labels,
    components,
    assignee: issue.fields.assignee?.displayName || null,
    agentState: classifyIssue(statusCategory, labels),
    processed: labels.includes(PROCESSED_LABEL)
  };
}

function computeMetrics(issues) {
  const byState = { new: 0, 'ready-to-solve': 0, 'in-progress': 0, closed: 0, other: 0 };
  let processedCount = 0;

  for (const issue of issues) {
    byState[issue.agentState] = (byState[issue.agentState] || 0) + 1;
    if (issue.processed) processedCount++;
  }

  const totalIssues = issues.length;
  const processedRate = totalIssues > 0
    ? Math.round((processedCount / totalIssues) * 100)
    : 0;

  return {
    totalIssues,
    byState,
    processedCount,
    processedRate
  };
}

async function fetchAgentData(jiraRequest) {
  const projectClause = PROJECTS.map(p => `"${p}"`).join(', ');
  const jql = `project IN (${projectClause}) AND labels = "${AGENT_LABEL}" AND labels != "${CHAI_BACKPORT_LABEL}" ORDER BY created DESC`;

  const rawIssues = await fetchAllJqlResults(jiraRequest, jql, FIELDS);
  return rawIssues.map(processIssue);
}

/**
 * De-duplicate the bot's pull requests against the set of `issue-for-agent`
 * Jira issues. Each PR falls into exactly one bucket:
 *
 *   - overlap:      the PR's leading Jira key matches an issue we already track
 *                   (already counted via the Jira issue — do not double-count)
 *   - net-new keyed: the PR carries a Jira key we do NOT already track
 *                   (net-new work — counts toward the total as its own row)
 *   - no key:       the PR has no Jira key at all (e.g. NO-JIRA chores — counts
 *                   toward the total, surfaced as a NO-JIRA row by the caller)
 *
 * The `combined` totals give the union of Jira issues + counted PRs, where the
 * only PRs that add to the total are the net-new-keyed and no-key ones.
 *
 * @param {Array<{key:string}>} issues - tracked Jira issues (issue-for-agent)
 * @param {Array<{jiraKey:string|null}>} prs - bot PRs (from fetchAgentPrs)
 * @returns {{
 *   overlapPrs: Array,
 *   netNewKeyedPrs: Array,
 *   noKeyPrs: Array,
 *   combined: {jiraIssues:number, prsCounted:number, prsOverlap:number, netNewKeyed:number, noKey:number, total:number}
 * }}
 */
function dedupeAgentWork(issues, prs) {
  const issueKeys = new Set((issues || []).map(i => i && i.key).filter(Boolean));

  const overlapPrs = [];
  const netNewKeyedPrs = [];
  const noKeyPrs = [];
  // Net-new Jira keys already claimed by an earlier PR in this batch, so two PRs
  // for the same net-new key only produce one net-new row (and one count).
  const seenNetNewKeys = new Set();

  for (const pr of prs || []) {
    const key = pr && pr.jiraKey;
    if (!key) {
      noKeyPrs.push(pr);
      continue;
    }
    if (issueKeys.has(key)) {
      overlapPrs.push(pr);
      continue;
    }
    if (seenNetNewKeys.has(key)) {
      // Another PR already introduced this net-new key; treat as overlap so the
      // count stays 1-per-key.
      overlapPrs.push(pr);
      continue;
    }
    seenNetNewKeys.add(key);
    netNewKeyedPrs.push(pr);
  }

  const jiraIssues = issueKeys.size;
  const netNewKeyed = netNewKeyedPrs.length;
  const noKey = noKeyPrs.length;
  const prsCounted = netNewKeyed + noKey;

  return {
    overlapPrs,
    netNewKeyedPrs,
    noKeyPrs,
    combined: {
      jiraIssues,
      prsCounted,
      prsOverlap: overlapPrs.length,
      netNewKeyed,
      noKey,
      total: jiraIssues + prsCounted
    }
  };
}

/**
 * Look up the current status and assignee for a set of Jira keys, batched into
 * `key IN (...)` JQL searches. Used to give net-new-keyed bot PRs (Jira tickets
 * that lack the `issue-for-agent` label) an accurate agent state.
 *
 * Keys are de-duplicated and falsy values skipped; an empty set issues no
 * request. Missing status defaults to "Unknown".
 *
 * @param {Function} jiraRequest
 * @param {string[]} keys
 * @param {number} [batchSize=50]
 * @returns {Promise<Map<string, {status:string, assignee:string|null, labels:string[]}>>}
 */
async function fetchIssueStatusesByKeys(jiraRequest, keys, batchSize = 50) {
  const result = new Map();
  const distinct = [...new Set((keys || []).filter(Boolean))];
  if (distinct.length === 0) return result;

  for (let i = 0; i < distinct.length; i += batchSize) {
    const batch = distinct.slice(i, i + batchSize);
    const jql = `key IN (${batch.join(', ')})`;
    const rawIssues = await fetchAllJqlResults(jiraRequest, jql, 'status,assignee,labels');
    for (const issue of rawIssues) {
      if (!issue || !issue.key) continue;
      const fields = issue.fields || {};
      result.set(issue.key, {
        status: fields.status?.name || 'Unknown',
        assignee: fields.assignee?.displayName || null,
        labels: fields.labels || []
      });
    }
  }

  return result;
}

module.exports = {
  fetchAgentData,
  processIssue,
  classifyIssue,
  computeMetrics,
  dedupeAgentWork,
  fetchIssueStatusesByKeys,
  PROJECTS,
  AGENT_LABEL,
  PROCESSED_LABEL,
  READY_TO_SOLVE_LABEL,
  CHAI_BACKPORT_LABEL
};
