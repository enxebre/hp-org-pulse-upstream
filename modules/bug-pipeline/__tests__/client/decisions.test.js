import { describe, expect, it } from 'vitest'
import { buildDecisionGraph, buildFlow, flowChart, formatDuration, formatShare, layoutSankey, leadTimes, phaseTimes } from '../../client/utils/decisions.js'
import fixture from '../../../../fixtures/bug-refinement/data.json'

const HOUR = 3600000
const pipelineIssues = fixture.issues.filter(issue => issue.project === 'OCPBUGS')
const solved = fixture.issues.find(issue => issue.key === 'OCPBUGS-10002')

function assessment(at, outcome, by = 'Jordan Refiner') {
  return { type: 'assessment', at, by, outcome, commentId: at }
}

function nodeValues(graph) {
  return Object.fromEntries(graph.columns.flatMap(column => column.nodes.map(node => [node.id, node.value])))
}

describe('decision graph', () => {
  it('follows each refined bug through its assessments, pull request, merge, and backports', () => {
    const graph = buildDecisionGraph(pipelineIssues)
    expect(graph.reassessed).toBe(true)
    expect(graph.total).toBe(3)
    expect(graph.columns.map(column => column.label)).toEqual(['Refined', 'First assessment', 'Latest assessment', 'Pull request', 'Merge', 'Backports', 'Backport PRs', 'Backport merge'])
    expect(nodeValues(graph)).toEqual({
      refined: 3,
      'first:CLOSE': 1,
      'first:NEEDS_INFO': 2,
      'latest:SOLVE': 1,
      'latest:CLOSE': 1,
      'latest:NEEDS_INFO': 1,
      'pr:posted': 1,
      'merge:merged': 1,
      'backports:some': 1,
      'backportPr:posted': 1,
      'backportMerge:partial': 1
    })
    expect(graph.columns.at(-1).nodes[0].backports).toEqual({ total: 2, stages: [{ key: 'merged', label: 'merged', count: 1 }, { key: 'posted', label: 'awaiting merge', count: 1 }] })
    expect(graph.columns[0].nodes[0].backports).toBeNull()
    const links = Object.fromEntries(graph.links.map(link => [link.id, link]))
    expect(links['first:NEEDS_INFO->latest:SOLVE']).toMatchObject({ value: 1, keys: ['OCPBUGS-10002'], timing: { label: 'first to latest assessment', median: 97 * HOUR, timed: 1 } })
    expect(links['refined->first:NEEDS_INFO'].timing).toEqual({ label: 'report to first assessment', median: 20 * HOUR, timed: 2 })
    expect(links['latest:SOLVE->pr:posted'].timing.median).toBe(100 * 60000)
    expect(links['pr:posted->merge:merged'].timing.median).toBe(15 * HOUR + 35 * 60000)
    expect(links['first:NEEDS_INFO->latest:NEEDS_INFO'].timing).toBeNull()
  })

  it('skips the first assessment column when no bug changed outcome and solve stages without merge tracking', () => {
    const issues = [
      { key: 'OCPBUGS-1', disposition: 'SOLVE', status: 'New', timeline: [assessment('2026-10-01T00:00:00Z', 'SOLVE'), assessment('2026-10-02T00:00:00Z', 'SOLVE')] },
      { key: 'OCPBUGS-2', disposition: null, status: 'Closed' },
      { key: 'OCPBUGS-3', disposition: null, status: 'New', dispositionCommentId: '9' }
    ]
    const graph = buildDecisionGraph(issues, { tracked: false })
    expect(graph.reassessed).toBe(false)
    expect(graph.columns.map(column => column.label)).toEqual(['Refined', 'Assessment'])
    expect(graph.columns[1].nodes.map(node => [node.label, node.value])).toEqual([['Solve', 1], ['Close', 1], ['Unknown', 1]])
  })

  it('stops each solve path at its furthest stage', () => {
    const issue = (key, overrides) => ({ key, disposition: 'SOLVE', status: 'New', prPosted: false, merged: false, backports: [], ...overrides })
    const graph = buildDecisionGraph([issue('OCPBUGS-1'), issue('OCPBUGS-2', { prPosted: true }), issue('OCPBUGS-3', { prPosted: true, merged: true })])
    expect(nodeValues(graph)).toMatchObject({ 'pr:none': 1, 'pr:posted': 2, 'merge:open': 1, 'merge:merged': 1, 'backports:none': 1 })
  })

  it('gives bugs whose backports are at different steps their own boxes, so backports add up column to column', () => {
    const merged = (key, backports, timeline = []) => ({ key, disposition: 'SOLVE', status: 'Verified', prPosted: true, merged: true, backports, timeline })
    const clone = (key, overrides = {}) => ({ key, branch: 'release-4.22', status: 'New', prPosted: false, merged: false, ...overrides })
    const status = (at, to) => ({ type: 'status', at, by: 'Bot', from: null, to })
    const issues = [
      merged('OCPBUGS-1', []),
      merged('OCPBUGS-2', [clone('OCPBUGS-20'), clone('OCPBUGS-21', { status: 'POST', prPosted: true })]),
      merged('OCPBUGS-3', [clone('OCPBUGS-30', { status: 'Verified', prPosted: true, merged: true }), clone('OCPBUGS-31', { status: 'POST', prPosted: true })]),
      merged('OCPBUGS-4', [clone('OCPBUGS-40', { status: 'Verified', prPosted: true, merged: true }), clone('OCPBUGS-41', { status: 'ON_QA', prPosted: true, merged: true })], [status('2026-10-01T00:00:00Z', 'MODIFIED')]),
      merged('OCPBUGS-5', [{ key: 'OCPBUGS-50', branch: 'release-4.21', status: 'POST', merged: false }]),
      merged('OCPBUGS-6', [{ key: 'OCPBUGS-60', branch: 'release-4.21', status: null, prPosted: null, merged: null }]),
      merged('OCPBUGS-7', [clone('OCPBUGS-70')])
    ]
    const issuesByKey = new Map([
      ['OCPBUGS-40', { key: 'OCPBUGS-40', timeline: [status('2026-10-01T02:00:00Z', 'POST'), status('2026-10-01T03:00:00Z', 'MODIFIED')] }],
      ['OCPBUGS-41', { key: 'OCPBUGS-41', timeline: [status('2026-10-01T04:00:00Z', 'POST'), status('2026-10-01T09:00:00Z', 'MODIFIED')] }]
    ])
    const graph = buildDecisionGraph(issues, { issuesByKey })
    const nodes = Object.fromEntries(graph.columns.flatMap(column => column.nodes.map(node => [node.id, node])))
    expect(Object.fromEntries(Object.entries(nodes).filter(([id]) => id.startsWith('backport')).map(([id, node]) => [id, node.keys]))).toEqual({
      'backports:some': ['OCPBUGS-2', 'OCPBUGS-3', 'OCPBUGS-4', 'OCPBUGS-5', 'OCPBUGS-6', 'OCPBUGS-7'],
      'backports:none': ['OCPBUGS-1'],
      'backportPr:posted': ['OCPBUGS-3', 'OCPBUGS-4', 'OCPBUGS-5'],
      'backportPr:some': ['OCPBUGS-2'],
      'backportPr:none': ['OCPBUGS-7'],
      'backportPr:unknown': ['OCPBUGS-6'],
      'backportMerge:merged': ['OCPBUGS-4'],
      'backportMerge:partial': ['OCPBUGS-3'],
      'backportMerge:open': ['OCPBUGS-5']
    })
    expect(nodes['backportPr:some'].backports.stages.map(stage => [stage.label, stage.count])).toEqual([['awaiting merge', 1], ['no PR yet', 1]])
    const backportTotal = column => graph.columns.find(entry => entry.key === column).nodes.reduce((total, node) => total + node.backports.total, 0)
    expect(backportTotal('backportPr')).toBe(nodes['backports:some'].backports.total)
    expect(backportTotal('backportMerge')).toBe(nodes['backportPr:posted'].backports.total)
    expect([nodes['backportPr:posted'], nodes['backportMerge:merged'], nodes['backportMerge:open']].map(node => node.backports.total)).toEqual([5, 2, 1])
    const links = Object.fromEntries(graph.links.map(link => [link.id, link]))
    expect(links['backports:some->backportPr:posted'].timing).toEqual({ label: 'merge to last backport pull request', median: 4 * HOUR, timed: 1 })
    expect(links['backportPr:posted->backportMerge:merged'].timing).toEqual({ label: 'last backport pull request to its merge', median: 5 * HOUR, timed: 1 })
    expect(links['backportPr:posted->backportMerge:open'].timing).toBeNull()
  })

  it('lays out stacked columns inside the chart with band widths that add up to each box', () => {
    const graph = buildDecisionGraph(pipelineIssues)
    const layout = layoutSankey(graph, { width: 900, height: 300, right: 130 })
    layout.columns.forEach((column, index) => expect(column.x0).toBeCloseTo(index * 758 / 7))
    expect(layout.columns.at(-1).x1).toBeCloseTo(770)
    for (const node of layout.nodes) {
      expect(node.y0).toBeGreaterThanOrEqual(28)
      expect(node.y1).toBeLessThanOrEqual(292)
      const height = node.y1 - node.y0
      const outgoing = layout.links.filter(link => link.source === node.id)
      const incoming = layout.links.filter(link => link.target === node.id)
      if (outgoing.length) expect(outgoing.reduce((total, link) => total + link.width, 0)).toBeCloseTo(height)
      if (incoming.length) expect(incoming.reduce((total, link) => total + link.width, 0)).toBeCloseTo(height)
    }
    const node = id => layout.nodes.find(candidate => candidate.id === id)
    expect(node('pr:posted').y0).toBe(node('latest:SOLVE').y0)
    expect(layout.links.find(link => link.id === 'latest:SOLVE->pr:posted').path).toMatch(/^M\d/)
  })
})

describe('decision flow', () => {
  it('lists each decision with who made it and the time since the previous one', () => {
    const steps = buildFlow(solved, new Map())
    expect(steps.map(step => step.title)).toEqual([
      'Reported',
      'Assessed: Needs info',
      'Cleared needs-info',
      'Assessed: Solve',
      'Sent to solve agent',
      'POST · pull request linked',
      'Backport to release-4.22',
      'Backport to release-4.21',
      'MODIFIED · pull request merged',
      'ON_QA · in a build',
      'Verified · fix verified',
      'Closed'
    ])
    expect(steps.map(step => step.by)).toEqual(['Pat Reporter', 'Jordan Refiner', 'Pat Reporter', 'Jordan Refiner', 'Example Solve Bot', 'Example Prow Bot', 'Example Solve Bot', 'Example Solve Bot', 'Example Prow Bot', 'Example Build Bot', 'Example Release Bot', 'Alex Engineer'])
    expect(steps.slice(0, 4).map(step => step.elapsed)).toEqual([null, 22 * HOUR, 79.5 * HOUR, 17.5 * HOUR])
    expect(steps[6].lane).toEqual([{ kind: 'status', title: 'Now Verified · fix verified', status: 'Verified', at: null, by: null, elapsed: null }])
    expect(leadTimes(solved).map(({ key, value }) => [key, formatDuration(value)])).toEqual([
      ['assessment', '22h'], ['pull-request', '1h 40m'], ['merge', '15h 35m'], ['total', '5d 16h']
    ])
  })

  it('folds repeated assessments and follows backport clones from the snapshot', () => {
    const original = {
      key: 'OCPBUGS-1',
      created: '2026-10-01T00:00:00Z',
      reporter: null,
      disposition: 'SOLVE',
      backports: [{ key: 'OCPBUGS-2', branch: 'release-4.22', status: 'POST', merged: false }],
      timeline: [
        assessment('2026-10-02T00:00:00Z', 'SOLVE'),
        assessment('2026-10-02T00:02:00Z', 'SOLVE'),
        { type: 'label', at: '2026-10-02T01:00:00Z', by: 'Bot', label: 'jlp-release-4.22:OCPBUGS-2', added: true },
        { type: 'label', at: '2026-10-03T00:00:00Z', by: 'Bot', label: 'jlp-release-4.22:OCPBUGS-2', added: false }
      ]
    }
    const clone = { key: 'OCPBUGS-2', timeline: [
      { type: 'assessment', at: '2026-10-02T01:00:00Z', by: 'Bot', outcome: 'SOLVE' },
      { type: 'status', at: '2026-10-02T03:00:00Z', by: 'Prow', from: 'New', to: 'POST' }
    ] }
    const steps = buildFlow(original, new Map([[clone.key, clone]]))
    expect(steps.map(step => [step.title, step.count])).toEqual([['Reported', undefined], ['Assessed: Solve', 2], ['Backport to release-4.22', undefined]])
    expect(steps[2].lane).toEqual([{ kind: 'status', title: 'POST · pull request linked', status: 'POST', detail: 'New → POST', at: '2026-10-02T03:00:00Z', by: 'Prow', elapsed: 2 * HOUR }])
  })

  it('draws a Mermaid flowchart with escaped labels, timed edges, and dotted backport lanes', () => {
    const chart = flowChart([
      { kind: 'reported', title: 'Reported', at: '2026-10-01T00:00:00Z', by: 'Pat "PJ" <Reporter> #1', elapsed: null },
      { kind: 'assessment', title: 'Assessed: Solve', outcome: 'SOLVE', count: 2, at: '2026-10-01T05:30:00Z', by: 'Jordan Refiner', elapsed: 5.5 * HOUR },
      { kind: 'backport', title: 'Backport to release-4.22', key: 'OCPBUGS-2', at: null, by: 'Bot', elapsed: null, lane: [{ kind: 'status', title: 'POST · pull request linked', status: 'POST', at: null, by: null, elapsed: 3 * 24 * HOUR }] }
    ])
    const lines = chart.split('\n')
    expect(lines[0]).toBe('flowchart TD')
    expect(lines[1]).toMatch(/^ {2}s0\(\["Reported<br\/><small>Pat #quot;PJ#quot; #lt;Reporter#gt; #35;1 · .+<\/small>"\]\)$/)
    expect(lines).toContain('  s0 -->|"5h 30m"| s1')
    expect(chart).toContain('s1{{"Assessed: Solve ×2<br/>')
    expect(lines).toContain('  s1 --> s2')
    expect(lines).toContain('  s2b0("OCPBUGS-2: POST · pull request linked")')
    expect(lines).toContain('  s2 -.->|"3d"| s2b0')
    expect(lines).toContain('  classDef solve fill:#059669,stroke:#059669,color:#ffffff')
    expect(lines).toContain('  class s1 solve')
    expect(lines).toContain('  class s2b0 posted')
  })

  it.each([[0, '<1m'], [45 * 60000, '45m'], [2 * HOUR, '2h'], [26 * HOUR + 5 * 60000, '1d 2h'], [null, '—']])('formats %s ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })

  it('takes the median of each phase over the bugs, counting only bugs sent to solve past the first assessment', () => {
    const closed = {
      key: 'OCPBUGS-9',
      disposition: 'CLOSE',
      created: '2026-10-01T00:00:00Z',
      timeline: [
        assessment('2026-10-01T02:00:00Z', 'CLOSE'),
        { type: 'status', at: '2026-10-02T00:00:00Z', by: 'Prow', from: 'New', to: 'POST' },
        { type: 'status', at: '2026-10-03T00:00:00Z', by: 'Prow', from: 'POST', to: 'MODIFIED' }
      ]
    }
    expect(phaseTimes([closed, solved]).map(({ key, label, median, timed }) => [key, label, formatDuration(median), timed])).toEqual([
      ['assessment', 'Report → first assessment', '12h', 2],
      ['pull-request', 'Solve assessment → PR', '1h 40m', 1],
      ['merge', 'PR → merge', '15h 35m', 1],
      ['total', 'Report → merge', '5d 16h', 1]
    ])
    expect(phaseTimes([])).toEqual([])
  })

  it.each([[1, 3, '33%'], [0, 3, '0%'], [3, 3, '100%'], [1, 300, '<1%'], [299, 300, '>99%'], [1, 0, '—']])('formats %s of %s as %s', (value, total, text) => {
    expect(formatShare(value, total)).toBe(text)
  })
})
