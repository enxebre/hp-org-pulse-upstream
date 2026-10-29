const { fetchAllJqlResults } = require('../../../../shared/server/jira')

const REFINEMENT_JQL = 'project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" ORDER BY updated DESC'
// The OpenShift bug lifecycle moves an issue to POST when a pull request is linked and to MODIFIED when it merges.
const PR_POSTED_JQL = 'project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" AND status WAS POST'
const MERGED_JQL = 'project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" AND status WAS MODIFIED'
// Backport clones are recorded on the original issue as jlp-<branch>:<clone key> labels.
const BACKPORT_LABEL = /^jlp-([^:]+):([A-Z][A-Z0-9]+-\d+)$/
const PULL_REQUEST_URL = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i
const FIELDS = 'summary,status,project,priority,assignee,reporter,components,labels,created,updated'
const DISPOSITIONS = new Set(['DEFER', 'SOLVE', 'NEEDS_INFO', 'NEED_HUMAN_ANALYSIS', 'CLOSE'])
// Labels whose additions and removals are workflow decisions: the solve agent's intake label and Chai's waiting labels.
const TIMELINE_LABELS = new Set(['issue-for-agent', 'needs-info', 'need-human-analysis'])
// The bulk changelog API accepts at most 1000 issues per request.
const CHANGELOG_BATCH = 1000

function commentText(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  if (value.type === 'text') return value.text || ''
  if (value.type === 'hardBreak') return '\n'
  const text = (value.content || []).map(commentText).join('')
  return ['paragraph', 'heading', 'codeBlock'].includes(value.type) ? `${text}\n` : text
}

function isoTime(value) {
  if (value === null || value === undefined || value === '') return null
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? null : time.toISOString()
}

// Reads every saved assessment so the pipeline can show re-assessments; the newest one is the disposition.
async function fetchAssessments(jiraRequest, key) {
  const assessments = []
  let startAt = 0
  while (true) {
    const params = new URLSearchParams({ orderBy: '-created', maxResults: '100', startAt: String(startAt) })
    const page = await jiraRequest(`/rest/api/3/issue/${encodeURIComponent(key)}/comment?${params}`)
    const comments = page.comments || []
    for (const comment of comments) {
      const marker = [...commentText(comment.body).matchAll(/\[refine:v1\]\s*outcome\s*=\s*([A-Z][A-Z0-9_]*)\b/g)].at(-1)
      if (marker) {
        assessments.push({
          outcome: DISPOSITIONS.has(marker[1]) ? marker[1] : null,
          created: comment.created || null,
          commentId: comment.id ? String(comment.id) : null,
          by: comment.author?.displayName || null
        })
      }
    }
    const nextStart = (page.startAt ?? startAt) + comments.length
    if (!comments.length || page.total === undefined || nextStart >= page.total) break
    if (nextStart <= startAt) throw new Error('Jira comment pagination did not advance')
    startAt = nextStart
  }
  const [newest] = assessments
  return {
    disposition: newest?.outcome ?? null,
    dispositionAt: newest?.created ?? null,
    dispositionCommentId: newest?.commentId ?? null,
    assessments: assessments.reverse().map(({ outcome, created, commentId, by }) => ({ type: 'assessment', at: isoTime(created), by, outcome, commentId }))
  }
}

async function fetchRefinedIssues(jiraRequest) {
  const issues = await fetchAllJqlResults(jiraRequest, REFINEMENT_JQL, FIELDS)
  const ids = new Map(issues.filter(issue => issue.id).map(issue => [String(issue.id), issue.key]))
  const refinedIssues = issues.map(issue => ({
    key: issue.key,
    summary: issue.fields?.summary || issue.key,
    project: issue.fields?.project?.key || issue.key.split('-')[0],
    status: issue.fields?.status?.name || 'Unknown',
    priority: issue.fields?.priority?.name || 'Unknown',
    assignee: issue.fields?.assignee?.displayName || null,
    reporter: issue.fields?.reporter?.displayName || null,
    components: (issue.fields?.components || []).map(component => component.name),
    labels: issue.fields?.labels || [],
    created: issue.fields?.created || null,
    updated: issue.fields?.updated || null
  }))
  // Bound concurrent comment requests; assessments wait for the changelog to build each timeline.
  const assessments = new Map()
  for (let i = 0; i < refinedIssues.length; i += 5) {
    await Promise.all(refinedIssues.slice(i, i + 5).map(async issue => {
      const { assessments: saved, ...disposition } = await fetchAssessments(jiraRequest, issue.key)
      Object.assign(issue, disposition)
      assessments.set(issue.key, saved)
    }))
  }
  if (refinedIssues.length) {
    await addLifecycle(jiraRequest, refinedIssues)
    const changes = await fetchChangeEvents(jiraRequest, refinedIssues.map(issue => issue.key), ids)
    for (const issue of refinedIssues) {
      issue.timeline = [...assessments.get(issue.key), ...(changes.get(issue.key) || [])]
        .sort((a, b) => (a.at || '').localeCompare(b.at || ''))
    }
  }
  return refinedIssues
}

// Status transitions and workflow label changes, with who made them, from the bulk changelog API.
async function fetchChangeEvents(jiraRequest, keys, ids) {
  const events = new Map()
  for (let i = 0; i < keys.length; i += CHANGELOG_BATCH) {
    let nextPageToken
    do {
      const page = await jiraRequest('/rest/api/3/changelog/bulkfetch', {
        method: 'POST',
        body: { issueIdsOrKeys: keys.slice(i, i + CHANGELOG_BATCH), fieldIds: ['status', 'labels'], maxResults: 1000, ...(nextPageToken && { nextPageToken }) }
      })
      for (const log of page?.issueChangeLogs || []) {
        const key = ids.get(String(log.issueId))
        if (!key) continue
        if (!events.has(key)) events.set(key, [])
        for (const history of log.changeHistories || []) {
          events.get(key).push(...historyEvents(history))
        }
      }
      nextPageToken = page?.nextPageToken
    } while (nextPageToken)
  }
  return events
}

function historyEvents(history) {
  const at = isoTime(history.created)
  const by = history.author?.displayName || null
  return (history.items || []).flatMap(item => {
    if (item.field === 'status') return [{ type: 'status', at, by, from: item.fromString || null, to: item.toString || null }]
    if (item.field !== 'labels') return []
    const before = new Set((item.fromString || '').split(/\s+/).filter(Boolean))
    const after = new Set((item.toString || '').split(/\s+/).filter(Boolean))
    const tracked = label => TIMELINE_LABELS.has(label) || BACKPORT_LABEL.test(label)
    return [
      ...[...after].filter(label => !before.has(label) && tracked(label)).map(label => ({ type: 'label', at, by, label, added: true })),
      ...[...before].filter(label => !after.has(label) && tracked(label)).map(label => ({ type: 'label', at, by, label, added: false }))
    ]
  })
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
    issue.backports = []
    issue.pullRequests = []
  }
  // A linked pull request whose bug check fails (jira/invalid-bug) never moves the issue to POST,
  // so backport clones are read too and any linked pull request also counts as posted.
  const backportKeys = new Set(refinedIssues.flatMap(issue => backportLinks(issue.labels).map(({ key }) => key)))
  const linked = refinedIssues.filter(issue => issue.disposition === 'SOLVE' || backportKeys.has(issue.key))
  for (let i = 0; i < linked.length; i += 5) {
    await Promise.all(linked.slice(i, i + 5).map(async issue => {
      issue.pullRequests = await fetchPullRequests(jiraRequest, issue.key)
      if (issue.pullRequests.length) issue.prPosted = true
    }))
  }
  // Clones inherit refined-by-agent, so their outcomes come from the same snapshot.
  const byKey = new Map(refinedIssues.map(issue => [issue.key, issue]))
  for (const issue of refinedIssues) {
    issue.backports = backportLinks(issue.labels).map(({ key, branch }) => {
      const clone = byKey.get(key)
      return { key, branch, status: clone?.status ?? null, prPosted: clone ? clone.prPosted : null, merged: clone ? clone.merged : null }
    })
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

module.exports = { REFINEMENT_JQL, PR_POSTED_JQL, MERGED_JQL, BACKPORT_LABEL, fetchRefinedIssues, fetchAssessments }
