import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentContent from '../../client/components/AgentContent.vue'

describe('AgentContent', () => {
  const sampleData = {
    fetchedAt: '2026-07-07T10:00:00Z',
    jiraHost: 'https://redhat.atlassian.net',
    teamRepos: {
      hypershift: ['hypershift'],
      installer: ['installer'],
      trt: ['sippy', 'origin'],
      mco: ['machine-config-operator', 'os'],
      ota: ['cluster-version-operator', 'cincinnati-graph-data'],
      'edge-ecosystem': ['microshift', 'lvm-operator', 'baremetal-operator']
    },
    metrics: {
      totalIssues: 14,
      byState: { new: 2, 'ready-to-solve': 0, 'in-progress': 1, closed: 1 },
      processedCount: 1,
      processedRate: 7
    },
    issues: [
      { key: 'OCPBUGS-1', summary: 'HyperShift bug', status: 'New', agentState: 'new', processed: false, issueType: 'Bug', priority: 'Major', created: '2026-07-01', updated: '2026-07-07', labels: [], components: ['HyperShift'], assignee: null, linkedPrs: [{ repo: 'openshift/hypershift', team: 'hypershift', number: 9137, url: 'https://github.com/openshift/hypershift/pull/9137', state: 'OPEN', author: 'x' }, { repo: 'openshift/origin', team: 'trt', number: 31382, url: 'https://github.com/openshift/origin/pull/31382', state: 'CLOSED', author: 'y' }] },
      { key: 'CNTRLPLANE-10', summary: 'Installer issue', status: 'In Progress', agentState: 'in-progress', processed: true, issueType: 'Bug', priority: 'Critical', created: '2026-07-02', updated: '2026-07-06', labels: ['agent-processed'], components: ['Installer / openshift-installer'], assignee: 'Jane' },
      { key: 'OCPBUGS-2', summary: 'Hosted CP bug', status: 'Closed', agentState: 'closed', processed: false, issueType: 'Bug', priority: 'Minor', created: '2026-07-03', updated: '2026-07-05', labels: [], components: ['Hosted Control Planes'], assignee: null },
      { key: 'TRT-100', summary: 'TRT test fix', status: 'New', agentState: 'new', processed: false, issueType: 'Task', priority: 'Major', created: '2026-07-04', updated: '2026-07-07', labels: [], components: [], assignee: null },
      { key: 'WINC-5', summary: 'WMCO bug', status: 'New', agentState: 'new', processed: false, issueType: 'Bug', priority: 'Major', created: '2026-07-05', updated: '2026-07-07', labels: [], components: [], assignee: null, linkedPrs: [{ repo: 'openshift/windows-machine-config-operator', team: 'wmco', number: 321, url: 'https://github.com/openshift/windows-machine-config-operator/pull/321', state: 'MERGED', author: 'z' }] },
      { key: 'OCPBUGS-3', summary: 'Windows Containers component bug', status: 'New', agentState: 'new', processed: false, issueType: 'Bug', priority: 'Major', created: '2026-07-05', updated: '2026-07-07', labels: [], components: ['Windows Containers'], assignee: null },
      { key: 'MCO-12', summary: 'MCO bug', status: 'New', agentState: 'new', processed: false, issueType: 'Bug', priority: 'Major', created: '2026-07-05', updated: '2026-07-07', labels: [], components: [], assignee: null },
      { key: 'OCPBUGS-4', summary: 'MCO component bug', status: 'New', agentState: 'new', processed: false, issueType: 'Bug', priority: 'Major', created: '2026-07-05', updated: '2026-07-07', labels: [], components: ['Machine Config Operator'], assignee: null },
      { key: 'NE-7', summary: 'Ingress bug', status: 'New', agentState: 'new', processed: false, issueType: 'Bug', priority: 'Major', created: '2026-07-05', updated: '2026-07-07', labels: [], components: [], assignee: null },
      { key: 'OCPBUGS-5', summary: 'Ingress component bug', status: 'New', agentState: 'new', processed: false, issueType: 'Bug', priority: 'Major', created: '2026-07-05', updated: '2026-07-07', labels: [], components: ['Networking / router'], assignee: null },
      { key: 'OCPEDGE-20', summary: 'Edge pillar feature', status: 'New', agentState: 'new', processed: false, issueType: 'Story', priority: 'Major', created: '2026-07-06', updated: '2026-07-07', labels: [], components: [], assignee: null },
      { key: 'OCPBUGS-6', summary: 'MicroShift component bug', status: 'New', agentState: 'new', processed: false, issueType: 'Bug', priority: 'Major', created: '2026-07-06', updated: '2026-07-07', labels: [], components: ['MicroShift'], assignee: null },
      { key: 'METAL-3', summary: 'Metal platform story', status: 'New', agentState: 'new', processed: false, issueType: 'Story', priority: 'Major', created: '2026-07-06', updated: '2026-07-07', labels: [], components: [], assignee: null },
      { key: 'OCPBUGS-7', summary: 'VCF migration operator bug', status: 'New', agentState: 'new', processed: false, issueType: 'Bug', priority: 'Major', created: '2026-07-06', updated: '2026-07-07', labels: [], components: ['vcf-migration-operator'], assignee: null }
    ]
  }

  it('renders stat cards with metrics', () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    expect(wrapper.text()).toContain(String(sampleData.metrics.totalIssues))
    expect(wrapper.text()).toContain('Total Issues')
    expect(wrapper.text()).toContain('Ready to Solve')
    expect(wrapper.text()).toContain(sampleData.metrics.processedRate + '%')
  })

  it('renders the issue table with Key, Summary, PR Status and Jira Status columns', () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    const text = wrapper.text()
    // Column headers.
    expect(text).toContain('Key')
    expect(text).toContain('Summary')
    expect(text).toContain('PR Status')
    expect(text).toContain('Jira Status')
    // Key + summary render.
    expect(text).toContain('OCPBUGS-1')
    expect(text).toContain('HyperShift bug')
    // Jira status renders.
    expect(text).toContain('In Progress')
    // The removed Component column content is no longer shown in the table.
    expect(text).not.toContain('Installer / openshift-installer')
  })

  it('rolls up the PR Status badge across an issue\'s multiple linked PRs', () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    // OCPBUGS-1 has an OPEN and a CLOSED linked PR → rollup badge is "Open"
    // (any open wins) and links to the first PR.
    const badge = wrapper.findAll('a[href="https://github.com/openshift/hypershift/pull/9137"]')
      .find(a => a.text() === 'Open')
    expect(badge).toBeTruthy()
  })

  it('lists every PR for a Jira issue in the PR column', () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    // Both linked PRs render as their own compact links, each pointing at its PR.
    const hs = wrapper.find('a[href="https://github.com/openshift/hypershift/pull/9137"]')
    const origin = wrapper.find('a[href="https://github.com/openshift/origin/pull/31382"]')
    expect(hs.exists()).toBe(true)
    expect(origin.exists()).toBe(true)
    // The PR column uses compact "repo#number" labels for each.
    const labels = wrapper.findAll('a').map(a => a.text())
    expect(labels).toContain('hypershift#9137')
    expect(labels).toContain('origin#31382')
  })

  it('shows team selector buttons with inline stats', () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    const buttons = wrapper.findAll('button')
    const allBtn = buttons.find(b => b.text().includes('All Teams'))
    expect(allBtn.exists()).toBe(true)
    expect(allBtn.text()).toContain('total')
    expect(allBtn.text()).toContain('merged')
    expect(allBtn.text()).toContain('wip')
    expect(buttons.some(b => b.text().includes('HyperShift'))).toBe(true)
    expect(buttons.some(b => b.text().includes('Installer'))).toBe(true)
    expect(buttons.some(b => b.text().includes('TRT'))).toBe(true)
    expect(buttons.some(b => b.text().includes('Windows Containers'))).toBe(true)
    expect(buttons.some(b => b.text().includes('MCO'))).toBe(true)
    expect(buttons.some(b => b.text().includes('Ingress Operator'))).toBe(true)
  })

  it('shows a merged stat that counts rows with a merged PR', () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    // The WMCO box matches two issues (WINC-5 by prefix, OCPBUGS-3 by the
    // "Windows Containers" component); only WINC-5's linked PR is MERGED.
    const wmcoBtn = wrapper.findAll('button').find(b => b.text().includes('Windows Containers'))
    expect(wmcoBtn.text()).toContain('merged')
    // Its stat cluster reads: total=2, wip=0, merged=1, merge rate=100%
    // (one of its two rows carries a PR, and that PR merged).
    const nums = wmcoBtn.findAll('.text-xl').map(n => n.text())
    expect(nums).toEqual(['2', '0', '1', '100%'])
  })

  it('filters issues by team when team button is clicked', async () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    const buttons = wrapper.findAll('button')
    const installerBtn = buttons.find(b => b.text().includes('Installer'))
    await installerBtn.trigger('click')

    expect(wrapper.text()).toContain('CNTRLPLANE-10')
    expect(wrapper.text()).not.toContain('OCPBUGS-1')
    expect(wrapper.text()).not.toContain('OCPBUGS-2')
  })

  it('filters TRT issues by project prefix', async () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    const buttons = wrapper.findAll('button')
    const trtBtn = buttons.find(b => b.text().includes('TRT'))
    await trtBtn.trigger('click')

    expect(wrapper.text()).toContain('TRT-100')
    expect(wrapper.text()).not.toContain('OCPBUGS-1')
    expect(wrapper.text()).not.toContain('CNTRLPLANE-10')
  })

  it('filters WMCO issues by project prefix and component', async () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    const buttons = wrapper.findAll('button')
    const wmcoBtn = buttons.find(b => b.text().includes('Windows Containers'))
    await wmcoBtn.trigger('click')

    expect(wrapper.text()).toContain('WINC-5')
    expect(wrapper.text()).toContain('Windows Containers component bug')
    expect(wrapper.text()).not.toContain('OCPBUGS-1')
  })

  it('filters MCO issues by project prefix and component', async () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    const buttons = wrapper.findAll('button')
    const mcoBtn = buttons.find(b => b.text().includes('MCO'))
    await mcoBtn.trigger('click')

    expect(wrapper.text()).toContain('MCO-12')
    expect(wrapper.text()).toContain('MCO component bug')
    expect(wrapper.text()).not.toContain('OCPBUGS-1')
  })

  it('filters ingress issues by project prefix and component', async () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    const buttons = wrapper.findAll('button')
    const ingressBtn = buttons.find(b => b.text().includes('Ingress Operator'))
    await ingressBtn.trigger('click')

    expect(wrapper.text()).toContain('NE-7')
    expect(wrapper.text()).toContain('Ingress component bug')
    expect(wrapper.text()).not.toContain('OCPBUGS-1')
  })

  it('filters Edge & Ecosystem issues by project prefix and component', async () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: sampleData, loading: false, error: null }
    })
    const buttons = wrapper.findAll('button')
    const edgeBtn = buttons.find(b => b.text().includes('Edge & Ecosystem'))
    await edgeBtn.trigger('click')

    // OCPEDGE prefix match
    expect(wrapper.text()).toContain('OCPEDGE-20')
    // MicroShift component match
    expect(wrapper.text()).toContain('OCPBUGS-6')
    expect(wrapper.text()).toContain('MicroShift component bug')
    // METAL prefix match
    expect(wrapper.text()).toContain('METAL-3')
    // vcf-migration-operator component match
    expect(wrapper.text()).toContain('OCPBUGS-7')
    expect(wrapper.text()).toContain('VCF migration operator bug')
    // Issues from other teams excluded
    expect(wrapper.text()).not.toContain('OCPBUGS-1')
    expect(wrapper.text()).not.toContain('CNTRLPLANE-10')
  })


  // Row keys in table order, so sort assertions read as the visible ordering.
  function renderedKeys(wrapper) {
    return wrapper.findAll('tbody tr').map(tr => tr.findAll('td')[0].text())
  }

  function headerButton(wrapper, label) {
    return wrapper.findAll('thead th button').find(b => b.text().startsWith(label))
  }

  describe('column filters', () => {
    it('offers a PR status filter matching the PR Status column', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const select = wrapper.find('select[aria-label="Filter by PR status"]')
      expect(select.exists()).toBe(true)
      const values = select.findAll('option').map(o => o.attributes('value'))
      expect(values).toEqual(['all', 'OPEN', 'MERGED', 'CLOSED', 'UNKNOWN', 'none'])
    })

    it('filters rows down to a chosen PR status', async () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      await wrapper.find('select[aria-label="Filter by PR status"]').setValue('MERGED')
      // Only WINC-5 has a MERGED linked PR.
      expect(renderedKeys(wrapper)).toEqual(['WINC-5'])
    })

    it('filters rows with no PR at all via the "No PR" option', async () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      await wrapper.find('select[aria-label="Filter by PR status"]').setValue('none')
      const keys = renderedKeys(wrapper)
      // Rows carrying linked PRs are excluded; the rest remain.
      expect(keys).not.toContain('OCPBUGS-1')
      expect(keys).not.toContain('WINC-5')
      expect(keys).toContain('CNTRLPLANE-10')
    })

    it('keeps the Jira state filter working alongside the PR filter', async () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      await wrapper.find('select[aria-label="Filter by Jira state"]').setValue('in-progress')
      expect(renderedKeys(wrapper)).toEqual(['CNTRLPLANE-10'])
    })

    it('no longer shows the orphaned processed filter', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const optionText = wrapper.findAll('option').map(o => o.text())
      expect(optionText).not.toContain('Not Processed')
    })
  })

  describe('column sorting', () => {
    it('renders every column header as a sort button', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const labels = wrapper.findAll('thead th button').map(b => b.text().replace(/[▲▼]/g, '').trim())
      expect(labels).toEqual(['Key', 'Summary', 'PR Status', 'PR', 'Jira Status'])
    })

    it('sorts by key numerically within a project, not lexicographically', async () => {
      const data = {
        ...sampleData,
        issues: [
          { key: 'OCPBUGS-100', summary: 'c', status: 'New', agentState: 'new', processed: false, components: [], assignee: null },
          { key: 'OCPBUGS-9', summary: 'a', status: 'New', agentState: 'new', processed: false, components: [], assignee: null },
          { key: 'CNTRLPLANE-2', summary: 'b', status: 'New', agentState: 'new', processed: false, components: [], assignee: null }
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      await headerButton(wrapper, 'Key').trigger('click')
      expect(renderedKeys(wrapper)).toEqual(['CNTRLPLANE-2', 'OCPBUGS-9', 'OCPBUGS-100'])
    })

    it('cycles ascending, descending, then back to the default order', async () => {
      const data = {
        ...sampleData,
        issues: [
          { key: 'OCPBUGS-100', summary: 'c', status: 'New', agentState: 'new', processed: false, components: [], assignee: null },
          { key: 'OCPBUGS-9', summary: 'a', status: 'New', agentState: 'new', processed: false, components: [], assignee: null },
          { key: 'CNTRLPLANE-2', summary: 'b', status: 'New', agentState: 'new', processed: false, components: [], assignee: null }
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      const btn = () => headerButton(wrapper, 'Key')

      await btn().trigger('click')
      expect(renderedKeys(wrapper)).toEqual(['CNTRLPLANE-2', 'OCPBUGS-9', 'OCPBUGS-100'])

      await btn().trigger('click')
      expect(renderedKeys(wrapper)).toEqual(['OCPBUGS-100', 'OCPBUGS-9', 'CNTRLPLANE-2'])

      // Third click clears the sort, restoring the server's ordering.
      await btn().trigger('click')
      expect(renderedKeys(wrapper)).toEqual(['OCPBUGS-100', 'OCPBUGS-9', 'CNTRLPLANE-2'])
    })

    it('sorts by summary alphabetically', async () => {
      const data = {
        ...sampleData,
        issues: [
          { key: 'A-1', summary: 'zebra', status: 'New', agentState: 'new', processed: false, components: [], assignee: null },
          { key: 'A-2', summary: 'apple', status: 'New', agentState: 'new', processed: false, components: [], assignee: null }
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      await headerButton(wrapper, 'Summary').trigger('click')
      expect(renderedKeys(wrapper)).toEqual(['A-2', 'A-1'])
    })

    it('sorts by PR status in lifecycle order with no-PR rows last', async () => {
      const pr = (state, number) => [{ repo: 'openshift/origin', team: 'trt', number, url: `https://github.com/openshift/origin/pull/${number}`, state, author: 'x' }]
      const data = {
        ...sampleData,
        issues: [
          { key: 'A-1', summary: 'none', status: 'New', agentState: 'new', processed: false, components: [], assignee: null },
          { key: 'A-2', summary: 'closed', status: 'New', agentState: 'new', processed: false, components: [], assignee: null, linkedPrs: pr('CLOSED', 2) },
          { key: 'A-3', summary: 'open', status: 'New', agentState: 'new', processed: false, components: [], assignee: null, linkedPrs: pr('OPEN', 3) },
          { key: 'A-4', summary: 'merged', status: 'New', agentState: 'new', processed: false, components: [], assignee: null, linkedPrs: pr('MERGED', 4) }
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      await headerButton(wrapper, 'PR Status').trigger('click')
      expect(renderedKeys(wrapper)).toEqual(['A-3', 'A-4', 'A-2', 'A-1'])
    })

    it('sorts by Jira status alphabetically with blanks last', async () => {
      const data = {
        ...sampleData,
        issues: [
          { key: 'A-1', summary: 'a', status: null, agentState: 'other', processed: false, components: [], assignee: null },
          { key: 'A-2', summary: 'b', status: 'Closed', agentState: 'closed', processed: false, components: [], assignee: null },
          { key: 'A-3', summary: 'c', status: 'Assigned', agentState: 'new', processed: false, components: [], assignee: null }
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      await headerButton(wrapper, 'Jira Status').trigger('click')
      expect(renderedKeys(wrapper)).toEqual(['A-3', 'A-2', 'A-1'])
    })

    it('sorts the PR column by number of linked PRs', async () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      await headerButton(wrapper, 'PR').trigger('click')
      // OCPBUGS-1 has two linked PRs, WINC-5 has one, the rest have none.
      const keys = renderedKeys(wrapper)
      expect(keys[0]).toBe('OCPBUGS-1')
      expect(keys[1]).toBe('WINC-5')
    })

    it('marks the sorted column with aria-sort for assistive tech', async () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const keyHeader = () => wrapper.findAll('thead th')[0]
      expect(keyHeader().attributes('aria-sort')).toBe('none')
      await headerButton(wrapper, 'Key').trigger('click')
      expect(keyHeader().attributes('aria-sort')).toBe('ascending')
      await headerButton(wrapper, 'Key').trigger('click')
      expect(keyHeader().attributes('aria-sort')).toBe('descending')
    })

    it('does not mutate the incoming issues array when sorting', async () => {
      const issues = sampleData.issues.map(i => ({ ...i }))
      const order = issues.map(i => i.key)
      const wrapper = mount(AgentContent, {
        props: { agentData: { ...sampleData, issues }, loading: false, error: null }
      })
      await headerButton(wrapper, 'Key').trigger('click')
      expect(issues.map(i => i.key)).toEqual(order)
    })

    it('keeps sorting applied while a filter narrows the rows', async () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      await headerButton(wrapper, 'Key').trigger('click')
      await wrapper.find('select[aria-label="Filter by Jira state"]').setValue('new')
      const keys = renderedKeys(wrapper)
      expect(keys).toEqual([...keys].sort((a, b) => {
        const [pa, na] = a.split('-'); const [pb, nb] = b.split('-')
        return pa === pb ? Number(na) - Number(nb) : pa.localeCompare(pb)
      }))
    })
  })


  describe('team repo tooltips', () => {
    function teamButton(wrapper, label) {
      return wrapper.findAll('button').find(b => b.text().includes(label))
    }

    it('lists a team\'s repos in a tooltip on its box', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const tip = teamButton(wrapper, 'MCO').find('[role="tooltip"]')
      expect(tip.exists()).toBe(true)
      expect(tip.text()).toContain('machine-config-operator')
      expect(tip.text()).toContain('os')
      expect(tip.text()).toContain('2 repos')
    })

    it('rolls every tracked repo up under All Teams', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const tip = teamButton(wrapper, 'All Teams').find('[role="tooltip"]')
      // De-duplicated and sorted across all teams.
      expect(tip.text()).toContain('cincinnati-graph-data')
      expect(tip.text()).toContain('sippy')
      expect(tip.text()).toContain('microshift')
      expect(tip.text()).toContain('11 repos')
    })

    it('uses the singular label for a one-repo team', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const tip = teamButton(wrapper, 'Installer').find('[role="tooltip"]')
      expect(tip.text()).toContain('1 repo')
      expect(tip.text()).not.toContain('1 repos')
    })

    it('lists Edge & Ecosystem repos in its tooltip', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const btn = teamButton(wrapper, 'Edge & Ecosystem')
      const tip = btn.find('[role="tooltip"]')
      expect(tip.exists()).toBe(true)
      expect(tip.text()).toContain('microshift')
      expect(tip.text()).toContain('lvm-operator')
      expect(tip.text()).toContain('baremetal-operator')
      expect(tip.text()).toContain('3 repos')
    })

    it('hides tooltip for a team with no repos in teamRepos', () => {
      // Clear a known team's repos so this test does not depend on any
      // team's real repository assignments.
      const data = {
        ...sampleData,
        teamRepos: { ...sampleData.teamRepos, mco: [] }
      }
      const wrapper = mount(AgentContent, {
        props: { agentData: data, loading: false, error: null }
      })
      const btn = teamButton(wrapper, 'MCO')
      expect(btn.find('[role="tooltip"]').exists()).toBe(false)
      expect(btn.attributes('aria-describedby')).toBeUndefined()
    })

    it('points the box at its tooltip via aria-describedby', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const btn = teamButton(wrapper, 'MCO')
      expect(btn.attributes('aria-describedby')).toBe('repos-mco')
      expect(btn.find('[role="tooltip"]').attributes('id')).toBe('repos-mco')
    })

    it('renders without tooltips when the server sends no teamRepos', () => {
      const { teamRepos, ...withoutRepos } = sampleData
      expect(teamRepos).toBeTruthy()
      const wrapper = mount(AgentContent, {
        props: { agentData: withoutRepos, loading: false, error: null }
      })
      expect(wrapper.findAll('[role="tooltip"]')).toHaveLength(0)
      // The boxes themselves still render.
      expect(teamButton(wrapper, 'MCO').exists()).toBe(true)
    })
  })


  describe('team merge rate', () => {
    function teamButton(wrapper, label) {
      return wrapper.findAll('button').find(b => b.text().includes(label))
    }

    function statValues(btn) {
      return btn.findAll('.text-xl').map(n => n.text())
    }

    it('shows a merge rate cell on every team box', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      expect(teamButton(wrapper, 'All Teams').text()).toContain('merge rate')
    })

    it('measures merged against rows with a PR, not the team total', () => {
      // Two rows, only one of which has a PR, and that PR merged. Measured
      // against the total this would read 50%; against rows with a PR, 100%.
      const data = {
        ...sampleData,
        issues: [
          {
            key: 'WINC-5', summary: 'has a merged PR', status: 'New', agentState: 'new',
            processed: false, components: [], assignee: null,
            linkedPrs: [{ repo: 'openshift/windows-machine-config-operator', team: 'wmco', number: 1, url: 'u1', state: 'MERGED', author: 'z' }]
          },
          { key: 'WINC-6', summary: 'no PR at all', status: 'New', agentState: 'new', processed: false, components: [], assignee: null }
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      const btn = teamButton(wrapper, 'Windows Containers')
      // total=2, wip=0, merged=1, rate=100% (1 of 1 row that had a PR)
      expect(statValues(btn)).toEqual(['2', '0', '1', '100%'])
    })

    it('counts open and closed PRs in the denominator', () => {
      const pr = (state, n) => [{ repo: 'openshift/windows-machine-config-operator', team: 'wmco', number: n, url: `u${n}`, state, author: 'z' }]
      const row = (key, prs) => ({ key, summary: key, status: 'New', agentState: 'new', processed: false, components: [], assignee: null, linkedPrs: prs })
      const data = {
        ...sampleData,
        issues: [
          row('WINC-1', pr('MERGED', 1)),
          row('WINC-2', pr('OPEN', 2)),
          row('WINC-3', pr('CLOSED', 3)),
          row('WINC-4', pr('MERGED', 4))
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      // 2 merged of 4 rows with a PR = 50%
      expect(statValues(teamButton(wrapper, 'Windows Containers'))).toEqual(['4', '0', '2', '50%'])
    })

    it('shows an em dash rather than 0% when a team has no PRs', () => {
      const data = {
        ...sampleData,
        issues: [
          { key: 'WINC-9', summary: 'no PR', status: 'New', agentState: 'new', processed: false, components: [], assignee: null }
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      const values = statValues(teamButton(wrapper, 'Windows Containers'))
      expect(values[3]).toBe('—')
      expect(values[3]).not.toBe('0%')
    })

    it('reports a real 0% when PRs exist but none merged', () => {
      const data = {
        ...sampleData,
        issues: [
          {
            key: 'WINC-9', summary: 'open only', status: 'New', agentState: 'new', processed: false, components: [], assignee: null,
            linkedPrs: [{ repo: 'openshift/windows-machine-config-operator', team: 'wmco', number: 9, url: 'u9', state: 'OPEN', author: 'z' }]
          }
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      expect(statValues(teamButton(wrapper, 'Windows Containers'))[3]).toBe('0%')
    })

    it('explains the ratio in a title attribute', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      const cell = teamButton(wrapper, 'Windows Containers')
        .findAll('[title]').find(el => el.text().includes('merge rate'))
      expect(cell.attributes('title')).toBe('1 of 1 rows with a PR have merged')
    })

    it('says so when a team has no pull requests yet', () => {
      const data = {
        ...sampleData,
        issues: [
          { key: 'WINC-9', summary: 'no PR', status: 'New', agentState: 'new', processed: false, components: [], assignee: null }
        ]
      }
      const wrapper = mount(AgentContent, { props: { agentData: data, loading: false, error: null } })
      const cell = teamButton(wrapper, 'Windows Containers')
        .findAll('[title]').find(el => el.text().includes('merge rate'))
      expect(cell.attributes('title')).toBe('No pull requests yet')
    })

    it('rolls the rate up across all teams', () => {
      const wrapper = mount(AgentContent, {
        props: { agentData: sampleData, loading: false, error: null }
      })
      // Fixture: OCPBUGS-1 (OPEN rollup) and WINC-5 (MERGED) carry PRs.
      // 1 merged of 2 rows with a PR = 50%.
      expect(statValues(teamButton(wrapper, 'All Teams'))[3]).toBe('50%')
    })
  })

  it('shows empty state when no data', () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: null, loading: false, error: null }
    })
    expect(wrapper.text()).toContain('No data available')
  })

  it('shows error state with retry', () => {
    const wrapper = mount(AgentContent, {
      props: { agentData: null, loading: false, error: 'Connection failed' }
    })
    expect(wrapper.text()).toContain('Connection failed')
    expect(wrapper.text()).toContain('Retry')
  })
})
