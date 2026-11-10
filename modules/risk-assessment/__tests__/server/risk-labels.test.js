import { describe, expect, it, vi } from 'vitest'

const {
  REPOS,
  buildCountsQuery,
  computeSummary,
  fetchRiskCounts,
  searchQuery,
  summarizeCounts
} = require('../../server/github/risk-labels')

describe('risk assessment label counts', () => {
  it('tracks the requested OpenShift repositories', () => {
    expect(REPOS).toHaveLength(13)
    expect(REPOS).toContain('openshift/hypershift')
    expect(REPOS).toContain('openshift/windows-machine-config-operator')
  })

  it('builds one aliased search per repo and risk level', () => {
    expect(searchQuery('openshift/installer', 'critical')).toBe('repo:openshift/installer is:pr label:chai-risk-assessment/critical')

    const query = buildCountsQuery(['openshift/a', 'openshift/b'])
    expect(query.match(/search\(/g)).toHaveLength(6)
    expect(query).toContain('r0_low: search(query: "repo:openshift/a is:pr label:chai-risk-assessment/low"')
    expect(query).toContain('r1_critical: search(query: "repo:openshift/b is:pr label:chai-risk-assessment/critical"')
  })

  it('maps aliased issue counts back to repos', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          r0_low: { issueCount: 25 }, r0_moderate: { issueCount: 42 }, r0_critical: { issueCount: 11 },
          r1_low: { issueCount: 0 }, r1_moderate: { issueCount: 1 }, r1_critical: { issueCount: 0 }
        }
      })
    })

    const repos = await fetchRiskCounts({ token: 't', repos: ['openshift/hypershift', 'openshift/topolvm'], fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(repos).toEqual([
      { repo: 'openshift/hypershift', counts: { low: 25, moderate: 42, critical: 11 } },
      { repo: 'openshift/topolvm', counts: { low: 0, moderate: 1, critical: 0 } }
    ])
  })

  it('fails without a token or on GraphQL errors', async () => {
    await expect(fetchRiskCounts({ token: '' })).rejects.toThrow('GITHUB_TOKEN is not configured')

    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ errors: [{ message: 'rate limited' }] }) })
    await expect(fetchRiskCounts({ token: 't', fetchImpl })).rejects.toThrow('rate limited')
  })

  it('summarizes totals and rounded shares, with — for repos without assessed PRs', () => {
    expect(summarizeCounts({ low: 25, moderate: 42, critical: 11 })).toEqual({
      total: 78,
      counts: { low: 25, moderate: 42, critical: 11 },
      percentages: { low: 32, moderate: 54, critical: 14 }
    })
    expect(summarizeCounts({})).toEqual({
      total: 0,
      counts: { low: 0, moderate: 0, critical: 0 },
      percentages: { low: null, moderate: null, critical: null }
    })
  })

  it('sorts repos by assessed PRs and combines totals across repos', () => {
    const summary = computeSummary([
      { repo: 'openshift/b', counts: { low: 1, moderate: 0, critical: 0 } },
      { repo: 'openshift/a', counts: { low: 1, moderate: 0, critical: 0 } },
      { repo: 'openshift/c', counts: { low: 2, moderate: 1, critical: 1 } }
    ])

    expect(summary.repos.map(r => r.repo)).toEqual(['openshift/c', 'openshift/a', 'openshift/b'])
    expect(summary.totals).toEqual({
      total: 6,
      counts: { low: 4, moderate: 1, critical: 1 },
      percentages: { low: 67, moderate: 17, critical: 17 }
    })
  })
})
