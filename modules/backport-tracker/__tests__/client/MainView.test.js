import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MainView from '../../client/views/MainView.vue'

vi.mock('@shared/client/services/api.js', () => ({ apiRequest: vi.fn() }))
import { apiRequest } from '@shared/client/services/api.js'

describe('Agentic Backports MainView', () => {
  beforeEach(() => {
    apiRequest.mockResolvedValue({
      jiraHost: 'https://redhat.atlassian.net',
      metrics: { total: 2, merged: 1, mergeRate: 50 },
      issues: [
        { key: 'OCPBUGS-1', summary: 'Open backport', status: 'POST', merged: false },
        { key: 'OCPBUGS-2', summary: 'Merged backport', status: 'VERIFIED', merged: true }
      ]
    })
  })

  it('shows total, merged, merge rate, and Jira issues', async () => {
    const wrapper = mount(MainView)
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith('/modules/backport-tracker/data')
    expect(wrapper.text()).toContain('Total')
    expect(wrapper.text()).toContain('Merged')
    expect(wrapper.text()).toContain('Merge rate')
    expect(wrapper.text()).toContain('50%')
    expect(wrapper.find('a[href="https://redhat.atlassian.net/browse/OCPBUGS-2"]').exists()).toBe(true)
  })
})
