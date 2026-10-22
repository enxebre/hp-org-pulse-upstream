const { fetchAllJqlResults } = require('../../../../shared/server/jira')

const REFINEMENT_JQL = 'project IN (OCPBUGS, CNTRLPLANE) AND labels = "refined-by-agent" ORDER BY updated DESC'
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
  return refinedIssues
}

module.exports = { REFINEMENT_JQL, fetchRefinedIssues, fetchDisposition }
