import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PipelineView from '../../../client/pipeline/views/MainView.vue'
import { apiRequest } from '@shared/client/services/api.js'
import fixture from '../../../../../fixtures/bug-refinement/data.json'

vi.mock('@shared/client/services/api.js', () => ({ apiRequest: vi.fn() }))
const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn(async () => ({ svg: '<svg data-testid="flow-svg"></svg>' })) }))
vi.mock('mermaid', () => ({ default: mermaid }))

const ROW_KEYS = ['refined', 'CLOSE', 'NEED_HUMAN_ANALYSIS', 'NEEDS_INFO', 'SOLVE', 'merged', 'backports-merged']

function issue(key, overrides = {}) {
  return { key, summary: `Summary ${key}`, project: 'OCPBUGS', status: 'New', components: ['HyperShift'], labels: ['refined-by-agent'], disposition: 'SOLVE', prPosted: false, merged: false, backports: [], ...overrides }
}

const pipeline = [
  issue('OCPBUGS-1', { status: 'Verified', prPosted: true, merged: true, updated: '2026-10-20T08:00:00.000Z', labels: ['refined-by-agent', 'jlp-release-4.22:OCPBUGS-9'], backports: [
    { key: 'OCPBUGS-9', branch: 'release-4.22', status: 'Verified', merged: true },
    { key: 'OCPBUGS-8', branch: 'release-4.21', status: null, merged: null }
  ] }),
  issue('OCPBUGS-2', { status: 'POST', prPosted: true, updated: '2026-10-22T08:00:00.000Z' }),
  issue('OCPBUGS-3', { disposition: 'CLOSE', status: 'Closed', updated: '2026-10-19T08:00:00.000Z' }),
  issue('OCPBUGS-4', { disposition: 'NEEDS_INFO', updated: '2026-10-21T08:00:00.000Z' }),
  issue('OCPBUGS-5', { components: ['Networking'], updated: '2026-10-23T08:00:00.000Z' }),
  issue('OCPBUGS-9', { disposition: null, status: 'Verified', merged: true, prPosted: true, labels: ['refined-by-agent', 'chai-backport'] }),
  issue('CNTRLPLANE-1', { project: 'CNTRLPLANE' })
]

function rates(card) {
  return ROW_KEYS.map(key => card.get(`[data-testid="rate-${key}"]`).text())
}

function stageValues(wrapper) {
  return wrapper.findAll('[data-testid^="stage-"]').map(stage => stage.get('.text-3xl').text())
}

function outcomes(wrapper) {
  return wrapper.findAll('tbody > tr').map(row => [
    row.get('td').text(),
    row.get('[data-testid="disposition"]').text(),
    row.find('[data-testid="solve-outcome"]').exists() ? row.get('[data-testid="solve-outcome"]').text() : null
  ])
}

beforeEach(() => {
  vi.clearAllMocks()
  apiRequest.mockResolvedValue({ ...fixture, jiraHost: 'https://jira.example.com' })
})

describe('Agentic Bug Pipeline', () => {
  it('shows stage percentages for refined OCPBUGS issues sent to solve', async () => {
    const wrapper = mount(PipelineView)
    expect(wrapper.text()).toContain('Loading pipeline outcomes')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/modules/hp-automation/pipeline/data')
    expect(wrapper.get('h2').text()).toBe('Agentic Bug Pipeline')
    expect(stageValues(wrapper)).toEqual(['3', '33%', '0%', '33%', '33%', '100%', '50%'])
    expect(wrapper.findAll('[data-testid^="stage-"]').map(stage => stage.findAll('p')[1].text())).toEqual(['Refined bugs', 'Close', 'Need human analysis', 'Needs info', 'Sent to solve', 'Solve merged', 'Backports merged'])
    expect(wrapper.get('[data-testid="stage-CLOSE"]').text()).toContain('1 of 3 refined bugs')
    expect(wrapper.get('[data-testid="stage-merged"]').text()).toContain('1 of 1 sent to solve')
    expect(wrapper.get('[data-testid="pipeline-stages"]').text()).not.toContain('pull request')
    expect(wrapper.get('[data-testid="stage-backports"]').text()).toContain('1 of 2 linked backports')
    expect(wrapper.text()).toContain('Refined bugs (3)')
    expect(wrapper.findAll('th button').map(button => button.attributes('title'))).toEqual(['Key', 'Summary', 'Components', 'Disposition', 'Jira status', 'Backports', 'Updated'].map(label => `Sort by ${label}`))
    expect(outcomes(wrapper)).toEqual([
      ['OCPBUGS-10001', 'NEEDS_INFO', null],
      ['OCPBUGS-10002', 'SOLVE', 'Merged'],
      ['OCPBUGS-10003', 'CLOSE', null]
    ])
    const row = wrapper.findAll('tbody > tr')[1]
    expect(row.findAll('td')[6].text()).toBe(new Date('2026-10-15T05:00:00.000Z').toLocaleDateString())
    expect(row.findAll('td')[6].attributes('title')).toBe(new Date('2026-10-15T05:00:00.000Z').toLocaleString())
    const pullRequest = row.get('a[href^="https://github.com/"]')
    expect(pullRequest.text()).toBe('example-repo#101')
    expect(pullRequest.attributes()).toMatchObject({ href: 'https://github.com/example-org/example-repo/pull/101', title: 'example-org/example-repo#101', target: '_blank', rel: 'noopener noreferrer' })
    expect(row.get('a[data-testid="disposition"]').attributes()).toMatchObject({ href: 'https://jira.example.com/browse/OCPBUGS-10002?focusedCommentId=10003', title: expect.stringContaining('Saved assessment:') })
    expect(row.findAll('td')[5].findAll('li').map(item => item.findAll('span, a').map(part => part.text()))).toEqual([
      ['release-4.22', 'OCPBUGS-10011', 'Merged'],
      ['release-4.21', 'OCPBUGS-10012', 'POST']
    ])
    expect(row.findAll('a').map(link => link.attributes('href'))).toEqual([
      'https://jira.example.com/browse/OCPBUGS-10002',
      'https://jira.example.com/browse/OCPBUGS-10002?focusedCommentId=10003',
      'https://github.com/example-org/example-repo/pull/101',
      'https://jira.example.com/browse/OCPBUGS-10011',
      'https://jira.example.com/browse/OCPBUGS-10012'
    ])
    expect(row.get('a').attributes()).toMatchObject({ target: '_blank', rel: 'noopener noreferrer' })
    expect(wrapper.find('[data-testid="pipeline-refresh-needed"]').exists()).toBe(false)
  })

  it('computes component percentages with counts and excludes CNTRLPLANE and backport clones', async () => {
    apiRequest.mockResolvedValue({ jiraHost: 'https://jira.example.com', issues: pipeline })
    const wrapper = mount(PipelineView)
    await flushPromises()
    expect(wrapper.findAll('button[aria-pressed]').map(card => card.attributes('aria-label'))).toEqual(['All Teams', 'HyperShift', 'Networking'])
    const all = wrapper.get('[data-testid="pipeline-team-all"]')
    expect(rates(all)).toEqual(['5', '20%', '0%', '20%', '60%', '33%', '50%'])
    expect(all.findAll('[data-testid^="rate-"]')).toHaveLength(ROW_KEYS.length)
    expect(all.text()).not.toContain(' of ')
    expect(all.text()).not.toContain('PR posted')
    expect(rates(wrapper.get('button[aria-label="HyperShift"]'))).toEqual(['4', '25%', '0%', '25%', '50%', '50%', '50%'])
    expect(rates(wrapper.get('button[aria-label="Networking"]'))).toEqual(['1', '0%', '0%', '0%', '100%', '0%', '—'])
    expect(wrapper.text()).toContain('Refined bugs (5)')
    expect(wrapper.findAll('tbody > tr').map(row => row.get('td').text())).toEqual(['OCPBUGS-5', 'OCPBUGS-2', 'OCPBUGS-4', 'OCPBUGS-1', 'OCPBUGS-3'])
    expect(wrapper.get('tbody').text()).not.toContain('CNTRLPLANE-1')
    expect(wrapper.get('tbody').text()).toContain('Unknown')

    await wrapper.get('button[aria-label="HyperShift"]').trigger('click')
    expect(wrapper.get('button[aria-label="HyperShift"]').attributes('aria-pressed')).toBe('true')
    expect(stageValues(wrapper)).toEqual(['4', '25%', '0%', '25%', '50%', '50%', '50%'])
    expect(outcomes(wrapper)).toEqual([
      ['OCPBUGS-2', 'SOLVE', 'PR posted'],
      ['OCPBUGS-4', 'NEEDS_INFO', null],
      ['OCPBUGS-1', 'SOLVE', 'Merged'],
      ['OCPBUGS-3', 'CLOSE', null]
    ])
    await wrapper.get('button[aria-label="Networking"]').trigger('click')
    expect(stageValues(wrapper)).toEqual(['1', '0%', '0%', '0%', '100%', '0%', '—'])
    expect(wrapper.get('tbody [data-testid="solve-outcome"]').text()).toBe('No PR yet')
  })

  it('sorts by the newest update by default and by any clicked column header', async () => {
    apiRequest.mockResolvedValue({ jiraHost: 'https://jira.example.com', issues: pipeline })
    const wrapper = mount(PipelineView)
    await flushPromises()
    const keys = () => wrapper.findAll('tbody > tr').map(row => row.get('td').text())
    const header = label => wrapper.findAll('th').find(th => th.get('button').attributes('title') === `Sort by ${label}`)
    expect(header('Updated').attributes('aria-sort')).toBe('descending')
    expect(header('Key').attributes('aria-sort')).toBe('none')
    expect(keys()).toEqual(['OCPBUGS-5', 'OCPBUGS-2', 'OCPBUGS-4', 'OCPBUGS-1', 'OCPBUGS-3'])
    await header('Updated').get('button').trigger('click')
    expect(header('Updated').attributes('aria-sort')).toBe('ascending')
    expect(keys()).toEqual(['OCPBUGS-3', 'OCPBUGS-1', 'OCPBUGS-4', 'OCPBUGS-2', 'OCPBUGS-5'])
    await header('Key').get('button').trigger('click')
    expect(header('Key').attributes('aria-sort')).toBe('ascending')
    expect(header('Updated').attributes('aria-sort')).toBe('none')
    expect(keys()).toEqual(['OCPBUGS-1', 'OCPBUGS-2', 'OCPBUGS-3', 'OCPBUGS-4', 'OCPBUGS-5'])
    await header('Backports').get('button').trigger('click')
    expect(keys()[0]).toBe('OCPBUGS-1')
    await header('Disposition').get('button').trigger('click')
    await header('Disposition').get('button').trigger('click')
    expect(header('Disposition').attributes('aria-sort')).toBe('descending')
    expect(outcomes(wrapper)).toEqual([
      ['OCPBUGS-1', 'SOLVE', 'Merged'],
      ['OCPBUGS-2', 'SOLVE', 'PR posted'],
      ['OCPBUGS-5', 'SOLVE', 'No PR yet'],
      ['OCPBUGS-4', 'NEEDS_INFO', null],
      ['OCPBUGS-3', 'CLOSE', null]
    ])
    await wrapper.get('button[aria-label="HyperShift"]').trigger('click')
    expect(header('Disposition').attributes('aria-sort')).toBe('descending')
    expect(keys()).toEqual(['OCPBUGS-1', 'OCPBUGS-2', 'OCPBUGS-4', 'OCPBUGS-3'])
  })

  it('asks for a refresh instead of reporting zero merges for an older snapshot', async () => {
    apiRequest.mockResolvedValue({ jiraHost: 'https://jira.example.com', issues: [{ key: 'OCPBUGS-1', project: 'OCPBUGS', status: 'POST', labels: ['refined-by-agent'], disposition: 'SOLVE' }] })
    const wrapper = mount(PipelineView)
    await flushPromises()
    expect(wrapper.get('[data-testid="pipeline-refresh-needed"]').text()).toContain('Refresh it to load solve and backport outcomes')
    expect(stageValues(wrapper)).toEqual(['1', '0%', '0%', '0%', '100%', '—', '—'])
    expect(wrapper.get('[data-testid="stage-merged"]').text()).toContain('Refresh needed')
    expect(rates(wrapper.get('[data-testid="pipeline-team-all"]')).slice(5)).toEqual(['—', '—'])
    expect(wrapper.get('tbody').text()).toContain('Unknown')
  })

  it('labels demo examples without linking them to Jira', async () => {
    apiRequest.mockResolvedValue({ ...fixture, demo: true, jiraHost: 'https://jira.example.com' })
    const wrapper = mount(PipelineView)
    await flushPromises()
    expect(wrapper.get('[data-testid="pipeline-demo"]').text()).toContain('fictional examples')
    expect(wrapper.findAll('tbody a')).toHaveLength(0)
    expect(wrapper.get('tbody').text()).toContain('OCPBUGS-10002 (example)')
    expect(wrapper.get('tbody').text()).toContain('example-repo#101 (example)')
    expect(wrapper.get('tbody').text()).toContain('OCPBUGS-10011 (example)')
  })

  it('shows an empty state without refined OCPBUGS and no solve outcome for other dispositions', async () => {
    apiRequest.mockResolvedValue({ fetchedAt: null, jiraHost: 'https://jira.example.com', issues: [] })
    const unfetched = mount(PipelineView)
    await flushPromises()
    expect(unfetched.text()).toContain('Agentic Bug Refinement has not fetched its first snapshot yet.')
    apiRequest.mockResolvedValue({ fetchedAt: fixture.fetchedAt, jiraHost: 'https://jira.example.com', issues: [issue('CNTRLPLANE-1', { project: 'CNTRLPLANE' })] })
    const wrapper = mount(PipelineView)
    await flushPromises()
    expect(wrapper.text()).toContain('No refined OCPBUGS issues were found.')
    expect(stageValues(wrapper)).toEqual(['0', '—', '—', '—', '—', '—', '—'])
    apiRequest.mockResolvedValue({ jiraHost: 'https://jira.example.com', issues: [issue('OCPBUGS-1', { disposition: 'CLOSE' })] })
    const closed = mount(PipelineView)
    await flushPromises()
    expect(closed.text()).toContain('Refined bugs (1)')
    expect(closed.get('[data-testid="disposition"]').text()).toBe('CLOSE')
    expect(closed.find('[data-testid="solve-outcome"]').exists()).toBe(false)
  })

  it('shows the aggregate decision flow and lists the bugs in a selected box or band', async () => {
    const wrapper = mount(PipelineView)
    await flushPromises()
    const sankey = wrapper.get('[data-testid="decision-sankey"]')
    const value = id => sankey.get(`[data-testid="sankey-node-${id}"] [data-testid="sankey-node-value"]`).text()
    expect(['refined', 'first:NEEDS_INFO', 'first:CLOSE', 'latest:SOLVE', 'latest:NEEDS_INFO', 'pr:posted', 'merge:merged', 'backports:some', 'backportPr:posted', 'backportMerge:partial'].map(value)).toEqual(['3', '2', '1', '1', '1', '1', '1', '1', '1', '1'])
    const band = sankey.get('[data-testid="sankey-link-first:NEEDS_INFO->latest:SOLVE"]')
    expect(band.attributes('aria-label')).toBe('First assessment: Needs info to Latest assessment: Solve, 1 bug, 50% of First assessment: Needs info, median first to latest assessment: 4d 1h (1 of 1 bug timed)')
    const share = id => sankey.get(`[data-testid="sankey-node-${id}"] [data-testid="sankey-node-share"]`).text()
    expect(['refined', 'first:NEEDS_INFO', 'latest:SOLVE'].map(share)).toEqual(['100%', '67%', '33%'])
    const backportMerge = sankey.get('[data-testid="sankey-node-backportMerge:partial"]')
    expect(backportMerge.attributes('aria-label')).toBe('Backport merge: Partly merged, 1 bug, 33% of refined bugs, 2 backports: 1 merged, 1 awaiting merge')
    expect(backportMerge.get('[data-testid="sankey-node-backports"]').text()).toBe('2 backports')
    expect(sankey.find('[data-testid="sankey-node-pr:posted"] [data-testid="sankey-node-backports"]').exists()).toBe(false)
    const phase = sankey.get('[data-testid="phase-time-pull-request"]').text()
    expect(phase).toContain('Solve assessment → PR')
    expect(phase).toContain('1h 40m')
    expect(phase).toContain('1 bug')
    expect(sankey.find('[data-testid="phase-time-backport-merge"]').exists()).toBe(false)
    await backportMerge.trigger('focus')
    expect(sankey.get('[data-testid="sankey-tooltip"]').text()).toContain('2 backports: 1 merged, 1 awaiting merge')
    await backportMerge.trigger('blur')
    await band.trigger('focus')
    expect(sankey.get('[data-testid="sankey-tooltip"]').text()).toContain('1 bug · 33% of refined bugs')
    expect(sankey.get('[data-testid="sankey-tooltip"]').text()).toContain('50% of First assessment: Needs info')
    expect(sankey.get('[data-testid="sankey-tooltip"]').text()).toContain('Median first to latest assessment: 4d 1h')
    await band.trigger('click')
    expect(band.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="flow-selection"]').text()).toContain('First assessment: Needs info → Latest assessment: Solve')
    expect(wrapper.text()).toContain('Refined bugs (1)')
    expect(outcomes(wrapper)).toEqual([['OCPBUGS-10002', 'SOLVE', 'Merged']])
    expect(wrapper.findAll('[data-testid^="stage-"]').map(stage => stage.get('.text-3xl').text())[0]).toBe('3')
    await sankey.get('[data-testid="sankey-node-first:NEEDS_INFO"]').trigger('keydown', { key: 'Enter' })
    expect(outcomes(wrapper).map(([key]) => key)).toEqual(['OCPBUGS-10001', 'OCPBUGS-10002'])
    await wrapper.get('[data-testid="flow-selection"] button').trigger('click')
    expect(wrapper.find('[data-testid="flow-selection"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Refined bugs (3)')
    await sankey.get('[data-testid="sankey-node-latest:CLOSE"]').trigger('click')
    await wrapper.get('button[aria-label="Machine Config Operator"]').trigger('click')
    expect(wrapper.find('[data-testid="flow-selection"]').exists()).toBe(false)
    await sankey.get('details').trigger('toggle')
    expect(sankey.find('[data-testid="sankey-table"]').exists()).toBe(false)
    sankey.get('details').element.open = true
    await sankey.get('details').trigger('toggle')
    expect(sankey.get('[data-testid="sankey-table"]').findAll('tbody tr').map(row => row.findAll('td').map(cell => cell.text()))).toEqual([
      ['Refined bugs', 'First assessment: Needs info', '1', '100%', '100%', 'report to first assessment: 22h (1 of 1 bug timed)'],
      ['First assessment: Needs info', 'Latest assessment: Solve', '1', '100%', '100%', 'first to latest assessment: 4d 1h (1 of 1 bug timed)'],
      ['Latest assessment: Solve', 'Pull request: PR posted', '1', '100%', '100%', 'solve assessment to pull request: 1h 40m (1 of 1 bug timed)'],
      ['Pull request: PR posted', 'Merge: Merged', '1', '100%', '100%', 'pull request to merge: 15h 35m (1 of 1 bug timed)'],
      ['Merge: Merged', 'Backports: Backported', '1', '100%', '100%', '—'],
      ['Backports: Backported', 'Backport PRs: PR posted', '1', '100%', '100%', '—'],
      ['Backport PRs: PR posted', 'Backport merge: Partly merged', '1', '100%', '100%', '—']
    ])
  })

  it('expands a bug into its decision flow with who decided, when, and the time between decisions', async () => {
    const wrapper = mount(PipelineView)
    await flushPromises()
    const toggle = wrapper.findAll('[data-testid="flow-toggle"]')[1]
    expect(toggle.attributes()).toMatchObject({ 'aria-expanded': 'false', 'aria-label': 'Decision flow for OCPBUGS-10002', 'aria-controls': 'decision-flow-OCPBUGS-10002' })
    await toggle.trigger('click')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const flow = wrapper.get('[data-testid="decision-flow-row"] #decision-flow-OCPBUGS-10002')
    expect(flow.findAll('[data-testid^="lead-time-"]').map(entry => entry.text())).toEqual(['Report → first assessment 22h', 'Solve assessment → PR 1h 40m', 'PR → merge 15h 35m', 'Report → merge 5d 16h'])
    const steps = flow.findAll('[data-testid="flow-step"]')
    expect(steps.map(step => step.get('[data-testid="flow-step-title"]').text())).toEqual([
      'Reported', 'Assessed: Needs info', 'Cleared needs-info', 'Assessed: Solve', 'Sent to solve agent', 'POST · pull request linked',
      'Backport to release-4.22', 'Backport to release-4.21', 'MODIFIED · pull request merged', 'ON_QA · in a build', 'Verified · fix verified', 'Closed'
    ])
    expect(steps[3].get('[data-testid="flow-step-meta"]').text()).toBe(`Jordan Refiner · ${new Date('2026-10-13T09:00:00.000Z').toLocaleString()} · 17h 30m after the previous decision`)
    expect(steps[6].findAll('[data-testid="flow-lane-step"]').map(step => step.text())).toEqual(['OCPBUGS-10011: Now Verified · fix verified'])
    expect(mermaid.render).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('s1 -->|"3d 7h"| s2'))
    expect(flow.get('[role="img"]').attributes('aria-label')).toBe('Decision flow diagram for OCPBUGS-10002')
    expect(flow.find('[data-testid="flow-svg"]').exists()).toBe(true)
    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="decision-flow-row"]').exists()).toBe(false)
  })

  it('asks for a refresh before showing a bug flow from a snapshot without decision history', async () => {
    apiRequest.mockResolvedValue({ ...fixture, jiraHost: 'https://jira.example.com', issues: fixture.issues.map(issue => ({ ...issue, timeline: undefined })) })
    const wrapper = mount(PipelineView)
    await flushPromises()
    expect(wrapper.get('[data-testid="decision-sankey"]').find('[data-testid="sankey-node-first:NEEDS_INFO"]').exists()).toBe(false)
    await wrapper.get('[data-testid="flow-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="decision-flow"]').text()).toContain('Refresh the Refine data to load who made each decision and when')
    expect(mermaid.render).not.toHaveBeenCalled()
  })

  it('shows a recoverable error and retries', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Pipeline temporarily unavailable'))
    const wrapper = mount(PipelineView)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Pipeline temporarily unavailable')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('tbody > tr')).toHaveLength(3)
  })

  it('leaves the guide to its own page', async () => {
    const wrapper = mount(PipelineView)
    await flushPromises()
    expect(wrapper.find('[data-testid="pipeline-guide"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pipeline-stages"]').exists()).toBe(true)
  })
})
