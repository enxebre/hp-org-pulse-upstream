import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MainView from '../../client/views/MainView.vue'

vi.mock('@shared/client/services/api.js', () => ({ apiRequest: vi.fn() }))
import { apiRequest } from '@shared/client/services/api.js'

describe('Agentic Risk Assessment MainView', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({
      fetchedAt: '2026-11-10T08:00:00.000Z',
      labelPrefix: 'chai-risk-assessment/',
      levels: ['low', 'moderate', 'critical'],
      repos: [
        { repo: 'openshift/hypershift', total: 78, counts: { low: 25, moderate: 42, critical: 11 }, percentages: { low: 32, moderate: 54, critical: 14 } },
        { repo: 'openshift/topolvm', total: 0, counts: { low: 0, moderate: 0, critical: 0 }, percentages: { low: null, moderate: null, critical: null } }
      ],
      totals: { total: 78, counts: { low: 25, moderate: 42, critical: 11 }, percentages: { low: 32, moderate: 54, critical: 14 } }
    })
  })

  it('shows combined totals and risk shares', async () => {
    const wrapper = mount(MainView)
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith('/modules/risk-assessment/data')
    const summary = wrapper.get('[data-testid="risk-summary"]').text()
    expect(summary).toContain('Assessed PRs')
    expect(summary).toContain('78')
    expect(summary).toContain('32%')
    expect(summary).toContain('54%')
    expect(summary).toContain('14%')
    expect(summary).toContain('11 of 78 PRs')
  })

  it('groups rows per repository with totals, shares, and GitHub search links', async () => {
    const wrapper = mount(MainView)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="risk-repo-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('openshift/hypershift')
    expect(rows[0].text()).toContain('78')
    expect(rows[0].text()).toContain('54%')
    expect(rows[0].get('[role="img"]').attributes('aria-label')).toBe('Low 32%, Moderate 54%, Critical 14%')

    const critical = rows[0].get(`a[href="https://github.com/openshift/hypershift/pulls?q=${encodeURIComponent('is:pr label:chai-risk-assessment/critical')}"]`)
    expect(critical.text()).toBe('11')

    expect(rows[1].text()).toContain('—')
    expect(rows[1].text()).toContain('No assessed PRs')
    expect(wrapper.get('[data-testid="risk-totals-row"]').text()).toContain('All repositories')
  })

  it('shows an error with a retry button', async () => {
    apiRequest.mockRejectedValueOnce(new Error('GITHUB_TOKEN is not configured'))
    const wrapper = mount(MainView)
    await flushPromises()

    expect(wrapper.text()).toContain('GITHUB_TOKEN is not configured')
    expect(wrapper.get('button').text()).toBe('Retry')
  })
})
