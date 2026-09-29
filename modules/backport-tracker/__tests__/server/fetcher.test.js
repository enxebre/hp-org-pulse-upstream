import { describe, expect, it, vi } from 'vitest'

const { TOTAL_JQL, MERGED_JQL, computeMetrics, fetchBackports } = require('../../server/jira/fetcher')

describe('backport Jira fetcher', () => {
  it('marks issues returned by the historical MODIFIED query as merged', async () => {
    const jiraRequest = vi.fn()
      .mockResolvedValueOnce({
        issues: [
          { key: 'OCPBUGS-1', fields: { summary: 'Open backport', status: { name: 'POST' }, updated: '2026-09-15' } },
          { key: 'OCPBUGS-2', fields: { summary: 'Merged backport', status: { name: 'VERIFIED' }, updated: '2026-09-16' } }
        ]
      })
      .mockResolvedValueOnce({ issues: [{ key: 'OCPBUGS-2', fields: {} }] })

    const issues = await fetchBackports(jiraRequest)

    expect(TOTAL_JQL).toBe('project = OCPBUGS AND labels = "chai-backport" ORDER BY updated DESC')
    expect(MERGED_JQL).toBe('project = OCPBUGS AND labels = "chai-backport" AND status WAS MODIFIED ORDER BY updated DESC')
    expect(issues.map(issue => [issue.key, issue.merged])).toEqual([
      ['OCPBUGS-1', false],
      ['OCPBUGS-2', true]
    ])
  })

  it('computes total, merged, and merge rate', () => {
    expect(computeMetrics([{ merged: true }, { merged: false }, { merged: true }])).toEqual({
      total: 3,
      merged: 2,
      mergeRate: 67
    })
    expect(computeMetrics([])).toEqual({ total: 0, merged: 0, mergeRate: null })
  })
})
