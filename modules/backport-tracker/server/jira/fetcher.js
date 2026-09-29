const { fetchAllJqlResults } = require('../../../../shared/server/jira')

const CHAI_BACKPORT_LABEL = 'chai-backport'
const TOTAL_JQL = `project = OCPBUGS AND labels = "${CHAI_BACKPORT_LABEL}" ORDER BY updated DESC`
const MERGED_JQL = `project = OCPBUGS AND labels = "${CHAI_BACKPORT_LABEL}" AND status WAS MODIFIED ORDER BY updated DESC`
const FIELDS = 'summary,status,updated'

function processIssue(issue, mergedKeys) {
  return {
    key: issue.key,
    summary: issue.fields?.summary || issue.key,
    status: issue.fields?.status?.name || 'Unknown',
    updated: issue.fields?.updated || null,
    merged: mergedKeys.has(issue.key)
  }
}

function computeMetrics(issues) {
  const total = issues.length
  const merged = issues.filter(issue => issue.merged).length
  return {
    total,
    merged,
    mergeRate: total > 0 ? Math.round((merged / total) * 100) : null
  }
}

async function fetchBackports(jiraRequest) {
  const [allIssues, mergedIssues] = await Promise.all([
    fetchAllJqlResults(jiraRequest, TOTAL_JQL, FIELDS),
    fetchAllJqlResults(jiraRequest, MERGED_JQL, 'status')
  ])
  const mergedKeys = new Set(mergedIssues.map(issue => issue.key))
  return allIssues.map(issue => processIssue(issue, mergedKeys))
}

module.exports = {
  CHAI_BACKPORT_LABEL,
  TOTAL_JQL,
  MERGED_JQL,
  computeMetrics,
  fetchBackports,
  processIssue
}
