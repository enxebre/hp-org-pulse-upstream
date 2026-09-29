import { describe, it, expect } from 'vitest'

const { dedupeAgentWork, fetchAgentData, fetchIssueStatusesByKeys } = require('../../server/jira/fetcher')
const { extractJiraKey } = require('../../server/github/prs')

describe('extractJiraKey', () => {
  it('extracts a leading key', () => {
    expect(extractJiraKey('OCPBUGS-123: fix thing')).toBe('OCPBUGS-123')
  })

  it('extracts key after a "Bug" prefix', () => {
    expect(extractJiraKey('Bug OCPBUGS-999: nil pointer')).toBe('OCPBUGS-999')
  })

  it('extracts key after a backport prefix', () => {
    expect(extractJiraKey('[release-4.20] CNTRLPLANE-4211: backport')).toBe('CNTRLPLANE-4211')
  })

  it('ignores CVE identifiers', () => {
    expect(extractJiraKey('Update image to fix CVE-2025-14087')).toBeNull()
  })

  it('prefers a real Jira key over a CVE in the same title', () => {
    expect(extractJiraKey('OCPBUGS-105555: fix CVE-2025-14087')).toBe('OCPBUGS-105555')
  })

  it('returns null for NO-JIRA titles', () => {
    expect(extractJiraKey('NO-JIRA: docs update')).toBeNull()
  })

  it('returns null for chores with no key', () => {
    expect(extractJiraKey('docs: add Chai was here')).toBeNull()
  })

  it('handles empty/undefined', () => {
    expect(extractJiraKey('')).toBeNull()
    expect(extractJiraKey(undefined)).toBeNull()
  })
})

describe('dedupeAgentWork', () => {
  const issues = [
    { key: 'OCPBUGS-1' },
    { key: 'TRT-2' },
    { key: 'CNTRLPLANE-3' }
  ]

  it('does not double-count a PR whose key matches a Jira issue', () => {
    const prs = [{ jiraKey: 'OCPBUGS-1', url: 'u1' }]
    const r = dedupeAgentWork(issues, prs)
    expect(r.overlapPrs).toHaveLength(1)
    expect(r.combined.prsCounted).toBe(0)
    expect(r.combined.total).toBe(3) // just the Jira issues
  })

  it('counts a PR with a new Jira key as net-new', () => {
    const prs = [{ jiraKey: 'OCPBUGS-999', url: 'u2' }]
    const r = dedupeAgentWork(issues, prs)
    expect(r.netNewKeyedPrs).toHaveLength(1)
    expect(r.combined.total).toBe(4)
  })

  it('counts a PR with no Jira key', () => {
    const prs = [{ jiraKey: null, url: 'u3' }]
    const r = dedupeAgentWork(issues, prs)
    expect(r.noKeyPrs).toHaveLength(1)
    expect(r.combined.noKey).toBe(1)
    expect(r.combined.total).toBe(4)
  })

  it('computes the full union across all buckets', () => {
    const prs = [
      { jiraKey: 'OCPBUGS-1', url: 'a' },      // overlap
      { jiraKey: 'TRT-2', url: 'b' },          // overlap
      { jiraKey: 'OCPBUGS-500', url: 'c' },    // net-new keyed
      { jiraKey: 'NE-600', url: 'd' },         // net-new keyed
      { jiraKey: null, url: 'e' },             // no key
      { jiraKey: null, url: 'f' }              // no key
    ]
    const r = dedupeAgentWork(issues, prs)
    expect(r.combined).toEqual({
      jiraIssues: 3,
      prsCounted: 4,       // 2 net-new + 2 no-key
      prsOverlap: 2,
      netNewKeyed: 2,
      noKey: 2,
      total: 7             // 3 Jira + 4 counted PRs
    })
  })

  it('handles empty inputs', () => {
    expect(dedupeAgentWork([], []).combined.total).toBe(0)
    expect(dedupeAgentWork(undefined, undefined).combined.total).toBe(0)
  })

  it('counts distinct Jira issues only once even if issues repeat', () => {
    const dupIssues = [{ key: 'OCPBUGS-1' }, { key: 'OCPBUGS-1' }]
    const r = dedupeAgentWork(dupIssues, [])
    expect(r.combined.jiraIssues).toBe(1)
  })
})

describe('fetchIssueStatusesByKeys', () => {
  function makeFakeJira(issuesByKey) {
    const calls = []
    const jiraRequest = async (path) => {
      calls.push(path)
      const jql = decodeURIComponent(new URL('https://x' + path).searchParams.get('jql'))
      const keys = (jql.match(/[A-Z][A-Z0-9]+-\d+/g) || [])
      const issues = keys
        .filter(k => issuesByKey[k])
        .map(k => ({ key: k, fields: issuesByKey[k] }))
      return { issues, isLast: true }
    }
    return { jiraRequest, calls }
  }

  it('maps status and assignee by key', async () => {
    const { jiraRequest } = makeFakeJira({
      'OCPBUGS-1': { status: { name: 'In Progress' }, assignee: { displayName: 'Ada' } },
      'MCO-5': { status: { name: 'Closed' }, assignee: null }
    })
    const m = await fetchIssueStatusesByKeys(jiraRequest, ['OCPBUGS-1', 'MCO-5'])
    expect(m.get('OCPBUGS-1')).toEqual({ status: 'In Progress', assignee: 'Ada', labels: [] })
    expect(m.get('MCO-5')).toEqual({ status: 'Closed', assignee: null, labels: [] })
  })

  it('de-duplicates keys and skips falsy values', async () => {
    const { jiraRequest, calls } = makeFakeJira({
      'OCPBUGS-1': { status: { name: 'New' }, assignee: null }
    })
    const m = await fetchIssueStatusesByKeys(jiraRequest, ['OCPBUGS-1', 'OCPBUGS-1', null, undefined, ''])
    expect(m.size).toBe(1)
    // Only one distinct key → exactly one JQL request.
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('OCPBUGS-1')
  })

  it('batches large key sets into multiple requests', async () => {
    const map = {}
    const keys = []
    for (let i = 1; i <= 120; i++) {
      const k = `OCPBUGS-${i}`
      keys.push(k)
      map[k] = { status: { name: 'New' }, assignee: null }
    }
    const { jiraRequest, calls } = makeFakeJira(map)
    const m = await fetchIssueStatusesByKeys(jiraRequest, keys, 50)
    expect(m.size).toBe(120)
    // 120 keys / 50 per batch = 3 requests.
    expect(calls).toHaveLength(3)
  })

  it('returns an empty map for empty input without any request', async () => {
    const { jiraRequest, calls } = makeFakeJira({})
    const m = await fetchIssueStatusesByKeys(jiraRequest, [])
    expect(m.size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('defaults missing status to Unknown', async () => {
    const { jiraRequest } = makeFakeJira({
      'TRT-9': { assignee: { displayName: 'Bob' } } // no status field
    })
    const m = await fetchIssueStatusesByKeys(jiraRequest, ['TRT-9'])
    expect(m.get('TRT-9')).toEqual({ status: 'Unknown', assignee: 'Bob', labels: [] })
  })
})

describe('fetchAgentData', () => {
  it('excludes Chai-driven backports from the Jira Solve query', async () => {
    let requestedJql = ''
    const jiraRequest = async (path) => {
      requestedJql = new URL('https://x' + path).searchParams.get('jql')
      return { issues: [], isLast: true }
    }

    await fetchAgentData(jiraRequest)

    expect(requestedJql).toContain('labels = "issue-for-agent"')
    expect(requestedJql).toContain('labels != "chai-backport"')
  })
})
