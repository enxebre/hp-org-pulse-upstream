import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RefinementView from '../../client/views/MainView.vue'
import { apiRequest } from '@shared/client/services/api.js'
import fixture from '../../../../fixtures/bug-refinement/data.json'

vi.mock('@shared/client/services/api.js', () => ({ apiRequest: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  apiRequest.mockResolvedValue({ ...fixture, jiraHost: 'https://jira.example.com' })
})

describe('Agentic Bug Refinement', () => {
  it('shows both project counts, closed issues, waiting labels, and safe Jira links', async () => {
    const wrapper = mount(RefinementView)
    expect(wrapper.text()).toContain('Loading refined bugs')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/modules/bug-refinement/data')
    expect(wrapper.findAll('.text-3xl').map(card => card.text())).toEqual(['5', '3', '2'])
    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.findAll('th')).toHaveLength(9)
    expect(wrapper.findAll('tbody tr')[2].findAll('td')[2].text()).toBe('Machine Config Operator')
    expect(wrapper.text()).toContain('Closed')
    expect(wrapper.text()).toContain('needs-info')
    expect(wrapper.text()).toContain('need-human-analysis')
    expect(wrapper.text()).toContain('Unassigned')
    expect(wrapper.get('tbody a').attributes()).toMatchObject({ href: 'https://jira.example.com/browse/OCPBUGS-10001', target: '_blank', rel: 'noopener noreferrer' })
    for (const disposition of ['DEFER', 'SOLVE', 'NEEDS_INFO', 'NEED_HUMAN_ANALYSIS', 'CLOSE']) expect(wrapper.text()).toContain(disposition)
    const assessmentLink = wrapper.findAll('tbody a').find(link => link.text() === 'NEEDS_INFO')
    expect(assessmentLink.attributes()).toMatchObject({ href: 'https://jira.example.com/browse/OCPBUGS-10001?focusedCommentId=10001', target: '_blank', rel: 'noopener noreferrer' })
    expect(assessmentLink.attributes('title')).toContain('Saved assessment:')
    const closureLink = wrapper.findAll('tbody a').find(link => link.text() === 'CLOSE')
    expect(closureLink.attributes('href')).toBe('https://jira.example.com/browse/OCPBUGS-10003?focusedCommentId=10005')
    expect(closureLink.classes()).toContain('bg-slate-100')
  })

  it('shows unknown for an older snapshot rather than inferring disposition from waiting labels', async () => {
    apiRequest.mockResolvedValue({ issues: [{ key: 'OCPBUGS-1', project: 'OCPBUGS', labels: ['refined-by-agent', 'needs-info'] }], jiraHost: 'https://jira.example.com' })
    const wrapper = mount(RefinementView)
    await flushPromises()
    expect(wrapper.get('tbody').text()).toContain('Unknown')
    expect(wrapper.get('tbody').text()).not.toContain('NEEDS_INFO')
  })

  it('combines project and text filters without changing overall totals', async () => {
    const wrapper = mount(RefinementView)
    await flushPromises()
    await wrapper.get('select').setValue('CNTRLPLANE')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    await wrapper.get('input').setValue('SAM')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('CNTRLPLANE-10001')
    expect(wrapper.findAll('.text-3xl').map(card => card.text())).toEqual(['5', '3', '2'])
    await wrapper.get('input').setValue('missing')
    expect(wrapper.text()).toContain('No refined bugs match your filters.')
  })

  it('creates a box for each component with disposition counters, including deferred issues in totals', async () => {
    const wrapper = mount(RefinementView)
    await flushPromises()
    const all = wrapper.get('[data-testid="refinement-team-all"]')
    const hypershift = wrapper.get('button[aria-label="HyperShift"]')
    expect(wrapper.findAll('button[aria-pressed]').map(card => card.attributes('aria-label'))).toEqual(['All Teams', 'HyperShift', 'Machine Config Operator'])
    expect(all.attributes('aria-pressed')).toBe('true')
    expect(hypershift.attributes('aria-pressed')).toBe('false')
    for (const [label, counts] of Object.entries({ 'All Teams': ['5', '1', '1', '1', '1'], HyperShift: ['4', '0', '1', '1', '1'], 'Machine Config Operator': ['1', '1', '0', '0', '0'] })) {
      const card = wrapper.get(`button[aria-label="${label}"]`)
      expect(['total', 'SOLVE', 'CLOSE', 'NEED_HUMAN_ANALYSIS', 'NEEDS_INFO'].map(disposition => card.get(`[data-testid="count-${disposition}"]`).text())).toEqual(counts)
      for (const label of ['Total', 'Solve', 'Close', 'Need human analysis', 'Needs info']) expect(card.text()).toContain(label)
    }
  })

  it('combines component, project, and search filters without narrowing component counters', async () => {
    const wrapper = mount(RefinementView)
    await flushPromises()
    const hypershift = wrapper.get('button[aria-label="HyperShift"]')
    await hypershift.trigger('click')
    expect(hypershift.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('tbody tr')).toHaveLength(4)
    expect(wrapper.get('tbody').text()).not.toContain('OCPBUGS-10002')
    expect(wrapper.findAll('.text-3xl').map(card => card.text())).toEqual(['4', '2', '2'])
    await wrapper.get('select').setValue('CNTRLPLANE')
    await wrapper.get('input').setValue('Sam')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('CNTRLPLANE-10001')
    expect(hypershift.get('[data-testid="count-total"]').text()).toBe('4')
    expect(wrapper.get('[data-testid="refinement-team-all"] [data-testid="count-SOLVE"]').text()).toBe('1')
    await wrapper.get('input').setValue('configuration')
    expect(wrapper.text()).toContain('No refined bugs match your filters.')
    await wrapper.get('select').setValue('')
    await wrapper.get('[data-testid="refinement-team-all"]').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('OCPBUGS-10002')
  })

  it('counts each issue once per component and groups issues without components', async () => {
    apiRequest.mockResolvedValue({ issues: [
      { key: 'OCPBUGS-1', project: 'OCPBUGS', components: ['Hosted Control Planes', 'HyperShift', 'HyperShift'], disposition: 'SOLVE' },
      { key: 'OCPBUGS-2', project: 'OCPBUGS', components: ['Hosted Control Planes'], status: 'Closed', disposition: null },
      { key: 'CNTRLPLANE-1', project: 'CNTRLPLANE', disposition: 'CLOSE' }
    ] })
    const wrapper = mount(RefinementView)
    await flushPromises()
    const hypershift = wrapper.get('button[aria-label="HyperShift"]')
    const hosted = wrapper.get('button[aria-label="Hosted Control Planes"]')
    const unassigned = wrapper.get('button[aria-label="No component"]')
    expect(hypershift.get('[data-testid="count-total"]').text()).toBe('1')
    expect(hypershift.get('[data-testid="count-SOLVE"]').text()).toBe('1')
    expect(hypershift.get('[data-testid="count-CLOSE"]').text()).toBe('0')
    expect(hosted.get('[data-testid="count-total"]').text()).toBe('2')
    expect(hosted.get('[data-testid="count-SOLVE"]').text()).toBe('1')
    expect(hosted.get('[data-testid="count-CLOSE"]').text()).toBe('1')
    expect(unassigned.get('[data-testid="count-total"]').text()).toBe('1')
    expect(unassigned.get('[data-testid="count-CLOSE"]').text()).toBe('1')
    await hypershift.trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    await hosted.trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.get('tbody').text()).not.toContain('CNTRLPLANE-1')
    await unassigned.trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('CNTRLPLANE-1')
  })

  it('shows legacy closed issues as CLOSE from Jira while preserving explicit and unrecognized assessments', async () => {
    const issues = [
      { key: 'OCPBUGS-1', components: ['HyperShift'], status: 'Closed', disposition: null, dispositionAt: null, dispositionCommentId: null },
      { key: 'OCPBUGS-2', components: ['HyperShift'], status: 'Closed', disposition: 'NEEDS_INFO', dispositionCommentId: 'assessment-2' },
      { key: 'OCPBUGS-3', components: ['HyperShift'], status: 'Closed', disposition: null, dispositionCommentId: 'unrecognized-assessment' },
      { key: 'OCPBUGS-4', components: ['HyperShift'], status: 'Verified', disposition: null }
    ]
    apiRequest.mockResolvedValueOnce({ issues, jiraHost: 'https://jira.example.com' })
    const wrapper = mount(RefinementView)
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    const closure = rows[0].get('[title^="Closed in Jira;"]')
    expect(closure.text()).toBe('CLOSE (Jira)')
    expect(closure.element.tagName).toBe('SPAN')
    expect(closure.attributes('title')).toContain('does not confirm a verified fix')
    expect(rows[1].get('a[title^="Saved assessment"]').text()).toBe('NEEDS_INFO')
    expect(rows[2].get('a[title^="No recognized"]').text()).toBe('Unknown')
    expect(rows[3].text()).toContain('Unknown')
    for (const label of ['All Teams', 'HyperShift']) {
      const card = wrapper.get(`button[aria-label="${label}"]`)
      expect(card.get('[data-testid="count-CLOSE"]').text()).toBe('1')
      expect(card.get('[data-testid="count-NEEDS_INFO"]').text()).toBe('1')
    }
    expect(issues[0].disposition).toBeNull()
    await wrapper.get('button[title="Sort by Disposition"]').trigger('click')
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('OCPBUGS-1')
  })

  it('keeps similarly named components separate and resets selection when a refreshed component disappears', async () => {
    apiRequest.mockResolvedValueOnce({ issues: [
      { key: 'OCPBUGS-1', components: ['Networking / router'], disposition: 'SOLVE' },
      { key: 'OCPBUGS-2', components: ['Networking-router'], disposition: 'CLOSE' }
    ] })
    const wrapper = mount(RefinementView)
    await flushPromises()
    await wrapper.get('button[aria-label="Networking / router"]').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('OCPBUGS-1')
    await wrapper.get('button[aria-label="Networking-router"]').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('OCPBUGS-2')
    apiRequest.mockResolvedValueOnce({ issues: [{ key: 'OCPBUGS-3', components: ['A new component'], disposition: 'NEEDS_INFO' }] })
    await wrapper.vm.load()
    await flushPromises()
    expect(wrapper.find('button[aria-label="Networking-router"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="All Teams"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button[aria-label="A new component"] [data-testid="count-NEEDS_INFO"]').text()).toBe('1')
    expect(wrapper.get('tbody').text()).toContain('OCPBUGS-3')
  })

  it.each(['Key', 'Summary', 'Components', 'Disposition', 'Jira status', 'Priority', 'Assignee', 'Waiting labels', 'Updated'])('sorts %s ascending and descending without changing the snapshot', async column => {
    const issues = [
      { key: 'OCPBUGS-10', summary: 'Zebra', components: ['Zebra Component'], disposition: 'SOLVE', status: 'Verified', priority: 'Minor', assignee: 'Zoe', labels: ['needs-info'], updated: '2026-10-20T10:00:00+02:00' },
      { key: 'OCPBUGS-2', summary: 'alpha', components: ['Alpha Component'], disposition: 'CLOSE', status: 'Closed', priority: 'Critical', assignee: 'Alex', labels: ['need-human-analysis'], updated: '2026-10-20T08:30:00Z' }
    ]
    apiRequest.mockResolvedValueOnce({ issues })
    const wrapper = mount(RefinementView)
    await flushPromises()
    const button = wrapper.get(`button[title="Sort by ${column}"]`)
    const rowKeys = () => wrapper.findAll('tbody tr').map(row => row.findAll('td')[0].text())
    const ascendingKeys = column === 'Updated' ? ['OCPBUGS-10', 'OCPBUGS-2'] : ['OCPBUGS-2', 'OCPBUGS-10']
    await button.trigger('click')
    expect(button.element.closest('th').getAttribute('aria-sort')).toBe('ascending')
    expect(rowKeys()).toEqual(ascendingKeys)
    await button.trigger('click')
    expect(button.element.closest('th').getAttribute('aria-sort')).toBe('descending')
    expect(rowKeys()).toEqual([...ascendingKeys].reverse())
    expect(issues.map(issue => issue.key)).toEqual(['OCPBUGS-10', 'OCPBUGS-2'])
  })

  it('keeps missing and invalid sort values last in either direction', async () => {
    apiRequest.mockResolvedValueOnce({ issues: [
      { key: 'OCPBUGS-1', disposition: null, updated: 'invalid' },
      { key: 'OCPBUGS-2', disposition: 'CLOSE', updated: '2026-10-19T08:00:00Z' },
      { key: 'OCPBUGS-3', disposition: 'SOLVE', updated: '2026-10-20T08:00:00Z' }
    ] })
    const wrapper = mount(RefinementView)
    await flushPromises()
    for (const column of ['Disposition', 'Updated']) {
      const button = wrapper.get(`button[title="Sort by ${column}"]`)
      await button.trigger('click')
      expect(wrapper.findAll('tbody tr').map(row => row.findAll('td')[0].text())).toEqual(['OCPBUGS-2', 'OCPBUGS-3', 'OCPBUGS-1'])
      await button.trigger('click')
      expect(wrapper.findAll('tbody tr').map(row => row.findAll('td')[0].text())).toEqual(['OCPBUGS-3', 'OCPBUGS-2', 'OCPBUGS-1'])
    }
  })

  it('clearly identifies demo examples and never links them to real Jira issues', async () => {
    const jiraSearchUrl = 'https://jira.example.com/issues/?jql=labels%3Drefined-by-agent'
    apiRequest.mockResolvedValue({ ...fixture, jiraHost: 'https://jira.example.com', jiraSearchUrl, demo: true })
    const wrapper = mount(RefinementView)
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('fictional examples, not results from Jira')
    expect(wrapper.findAll('tbody a')).toHaveLength(0)
    expect(wrapper.get('tbody').text()).toContain('OCPBUGS-10001 (example)')
    expect(wrapper.text()).toContain('Example snapshot:')
    expect(wrapper.get('a').attributes()).toMatchObject({ href: jiraSearchUrl, target: '_blank', rel: 'noopener noreferrer' })
  })

  it('shows an empty snapshot', async () => {
    apiRequest.mockResolvedValue({ issues: [] })
    const wrapper = mount(RefinementView)
    await flushPromises()
    expect(wrapper.text()).toContain('No issues with the refined-by-agent label')
    expect(wrapper.get('[data-testid="refinement-team-all"] [data-testid="count-total"]').text()).toBe('0')
    expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(1)
  })

  it('retries a failed request', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Jira unavailable'))
    const wrapper = mount(RefinementView)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Jira unavailable')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
