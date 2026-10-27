const { fetchAllJqlResults } = require('../../../../shared/server/jira')

const REFINEMENT_JQL = 'project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" ORDER BY updated DESC'
// The OpenShift bug lifecycle moves an issue to POST when a pull request is linked and to MODIFIED when it merges.
const PR_POSTED_JQL = 'project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" AND status WAS POST'
const MERGED_JQL = 'project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" AND status WAS MODIFIED'
// Backport clones are recorded on the original issue as jlp-<branch>:<clone key> labels.
const BACKPORT_LABEL = /^jlp-([^:]+):([A-Z][A-Z0-9]+-\d+)$/
const PULL_REQUEST_URL = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i
const FIELDS = 'summary,status,project,priority,assignee,components,labels,updated'
const DISPOSITIONS = new Set(['DEFER', 'SOLVE', 'NEEDS_INFO', 'NEED_HUMAN_ANALYSIS', 'CLOSE'])

function commentText(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  if (value.type === 'text') return value.text || ''
  if (value.type === 'hardBreak') return '\n'
  const text = (value.content || []).map(commentText).join('')
  return ['paragraph', 'heading', 'codeBlock'].includes(value.type) ? `${text}\n` : text
}

async function fetchDisposition(jiraRequest, key) {
  let startAt = 0
  while (true) {
    const params = new URLSearchParams({ orderBy: '-created', maxResults: '100', startAt: String(startAt) })
    const page = await jiraRequest(`/rest/api/3/issue/${encodeURIComponent(key)}/comment?${params}`)
    const comments = page.comments || []
    for (const comment of comments) {
      const marker = [...commentText(comment.body).matchAll(/\[refine:v1\]\s*outcome\s*=\s*([A-Z][A-Z0-9_]*)\b/g)].at(-1)
      if (marker) {
        return {
          disposition: DISPOSITIONS.has(marker[1]) ? marker[1] : null,
          dispositionAt: comment.created || null,
          dispositionCommentId: comment.id ? String(comment.id) : null
        }
      }
    }
    const nextStart = (page.startAt ?? startAt) + comments.length
    if (!comments.length || page.total === undefined || nextStart >= page.total) break
    if (nextStart <= startAt) throw new Error('Jira comment pagination did not advance')
    startAt = nextStart
  }
  return { disposition: null, dispositionAt: null, dispositionCommentId: null }
}

async function fetchRefinedIssues(jiraRequest) {
  const issues = await fetchAllJqlResults(jiraRequest, REFINEMENT_JQL, FIELDS)
  const refinedIssues = issues.map(issue => ({
    key: issue.key,
    summary: issue.fields?.summary || issue.key,
    project: issue.fields?.project?.key || issue.key.split('-')[0],
    status: issue.fields?.status?.name || 'Unknown',
    priority: issue.fields?.priority?.name || 'Unknown',
    assignee: issue.fields?.assignee?.displayName || null,
    components: (issue.fields?.components || []).map(component => component.name),
    labels: issue.fields?.labels || [],
    updated: issue.fields?.updated || null
  }))
  // Bound concurrent comment requests and stop at the newest saved assessment.
  for (let i = 0; i < refinedIssues.length; i += 5) {
    await Promise.all(refinedIssues.slice(i, i + 5).map(async issue => {
      Object.assign(issue, await fetchDisposition(jiraRequest, issue.key))
    }))
  }
  if (refinedIssues.length) await addLifecycle(jiraRequest, refinedIssues)
  return refinedIssues
}

async function addLifecycle(jiraRequest, refinedIssues) {
  const [posted, merged] = await Promise.all([
    fetchAllJqlResults(jiraRequest, PR_POSTED_JQL, 'status'),
    fetchAllJqlResults(jiraRequest, MERGED_JQL, 'status')
  ])
  const postedKeys = new Set(posted.map(issue => issue.key))
  const mergedKeys = new Set(merged.map(issue => issue.key))
  for (const issue of refinedIssues) {
    issue.merged = mergedKeys.has(issue.key)
    issue.prPosted = issue.merged || postedKeys.has(issue.key)
  }
  // Clones inherit refined-by-agent, so their outcomes come from the same snapshot.
  const byKey = new Map(refinedIssues.map(issue => [issue.key, issue]))
  for (const issue of refinedIssues) {
    issue.backports = backportLinks(issue.labels).map(({ key, branch }) => {
      const clone = byKey.get(key)
      return { key, branch, status: clone?.status ?? null, merged: clone ? clone.merged : null }
    })
    issue.pullRequests = []
  }
  const solved = refinedIssues.filter(issue => issue.disposition === 'SOLVE')
  for (let i = 0; i < solved.length; i += 5) {
    await Promise.all(solved.slice(i, i + 5).map(async issue => {
      issue.pullRequests = await fetchPullRequests(jiraRequest, issue.key)
    }))
  }
}

// Pull requests are linked to the bug as Jira remote links.
async function fetchPullRequests(jiraRequest, key) {
  const links = await jiraRequest(`/rest/api/3/issue/${encodeURIComponent(key)}/remotelink`)
  const pullRequests = new Map()
  for (const link of Array.isArray(links) ? links : []) {
    const match = link?.object?.url?.match(PULL_REQUEST_URL)
    if (match && !pullRequests.has(match[0])) pullRequests.set(match[0], { url: match[0], repo: match[1], number: Number(match[2]) })
  }
  return [...pullRequests.values()]
}

function backportLinks(labels) {
  return labels.map(label => label.match(BACKPORT_LABEL)).filter(Boolean).map(([, branch, key]) => ({ key, branch }))
}

module.exports = { REFINEMENT_JQL, PR_POSTED_JQL, MERGED_JQL, BACKPORT_LABEL, fetchRefinedIssues, fetchDisposition }
