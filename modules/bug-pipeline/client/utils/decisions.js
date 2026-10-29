import { BACKPORT_LABEL, DISPOSITION_COUNTERS, dispositionValue } from './issues.js'

// Validated with the dataviz palette checks against white and gray-800 surfaces; hex values feed Mermaid.
export const TONES = {
  refined: { fill: 'fill-blue-600 dark:fill-blue-500', stroke: 'stroke-blue-600 dark:stroke-blue-500', swatch: 'bg-blue-600 dark:bg-blue-500', hex: '#2563eb' },
  solve: { fill: 'fill-emerald-600', stroke: 'stroke-emerald-600', swatch: 'bg-emerald-600', hex: '#059669' },
  human: { fill: 'fill-purple-600 dark:fill-purple-500', stroke: 'stroke-purple-600 dark:stroke-purple-500', swatch: 'bg-purple-600 dark:bg-purple-500', hex: '#9333ea' },
  info: { fill: 'fill-amber-600', stroke: 'stroke-amber-600', swatch: 'bg-amber-600', hex: '#d97706' },
  close: { fill: 'fill-slate-500', stroke: 'stroke-slate-500', swatch: 'bg-slate-500', hex: '#64748b' },
  posted: { fill: 'fill-sky-600', stroke: 'stroke-sky-600', swatch: 'bg-sky-600', hex: '#0284c7' },
  merged: { fill: 'fill-emerald-700', stroke: 'stroke-emerald-700', swatch: 'bg-emerald-700', hex: '#047857' },
  neutral: { fill: 'fill-gray-400 dark:fill-gray-500', stroke: 'stroke-gray-400 dark:stroke-gray-500', swatch: 'bg-gray-400 dark:bg-gray-500', hex: '#6b7280' }
}

const OUTCOMES = ['SOLVE', 'CLOSE', 'NEED_HUMAN_ANALYSIS', 'NEEDS_INFO', 'DEFER', 'UNKNOWN']
export const OUTCOME_LABELS = { ...Object.fromEntries(DISPOSITION_COUNTERS.map(({ key, label }) => [key, label])), DEFER: 'Defer', UNKNOWN: 'Unknown' }
export const OUTCOME_TONES = { SOLVE: 'solve', CLOSE: 'close', NEED_HUMAN_ANALYSIS: 'human', NEEDS_INFO: 'info', DEFER: 'neutral', UNKNOWN: 'neutral' }
// Labels drawn beside Sankey boxes must fit between columns; tooltips and the table keep the full label.
const SHORT_LABELS = { NEED_HUMAN_ANALYSIS: 'Human analysis' }
const COLUMNS = [
  { key: 'refined', label: 'Refined' },
  { key: 'first', label: 'First assessment' },
  { key: 'latest', label: 'Latest assessment' },
  { key: 'pr', label: 'Pull request' },
  { key: 'merge', label: 'Merge' },
  { key: 'backports', label: 'Backports' },
  { key: 'backportPr', label: 'Backport PRs' },
  { key: 'backportMerge', label: 'Backport merge' }
]
const STAGES = {
  'pr:posted': { label: 'PR posted', tone: 'posted', order: 0 },
  'pr:none': { label: 'No PR yet', tone: 'neutral', order: 1 },
  'merge:merged': { label: 'Merged', tone: 'merged', order: 0 },
  'merge:open': { label: 'Awaiting merge', tone: 'neutral', order: 1 },
  'backports:some': { label: 'Backported', tone: 'posted', order: 0 },
  'backports:none': { label: 'No backports', tone: 'neutral', order: 1 },
  'backportPr:posted': { label: 'PR posted', tone: 'posted', order: 0 },
  'backportPr:some': { label: 'Some PRs posted', tone: 'neutral', order: 1 },
  'backportPr:none': { label: 'No PR yet', tone: 'neutral', order: 2 },
  'backportPr:unknown': { label: 'Status unknown', tone: 'neutral', order: 3 },
  'backportMerge:merged': { label: 'Merged', tone: 'merged', order: 0 },
  'backportMerge:partial': { label: 'Partly merged', tone: 'neutral', order: 1 },
  'backportMerge:open': { label: 'Awaiting merge', tone: 'neutral', order: 2 }
}
// Least advanced first, for the per-backport breakdown in tooltips.
const BACKPORT_STAGES = [
  { key: 'unknown', label: 'status unknown' },
  { key: 'none', label: 'no PR yet' },
  { key: 'posted', label: 'awaiting merge' },
  { key: 'merged', label: 'merged' }
]
const TIMINGS = {
  assessment: { from: 'reported', to: 'firstAssessment', label: 'report to first assessment' },
  reassessment: { from: 'firstAssessment', to: 'decided', label: 'first to latest assessment' },
  pullRequest: { from: 'decided', to: 'prPosted', label: 'solve assessment to pull request' },
  merge: { from: 'prPosted', to: 'merged', label: 'pull request to merge' },
  backportPullRequests: { from: 'merged', to: 'backportsPosted', label: 'merge to last backport pull request' },
  backportMerge: { from: 'backportsPosted', to: 'backportsMerged', label: 'last backport pull request to its merge' }
}
const WAITING_LABELS = { 'needs-info': 'NEEDS_INFO', 'need-human-analysis': 'NEED_HUMAN_ANALYSIS' }
const STATUS_NOTES = { POST: 'pull request linked', MODIFIED: 'pull request merged', ON_QA: 'in a build', Verified: 'fix verified' }

function time(value) {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

export function between(from, to) {
  const start = time(from)
  const end = time(to)
  return start === null || end === null || end < start ? null : end - start
}

export function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function formatShare(value, total) {
  if (!total) return '—'
  const percent = value / total * 100
  if (percent > 0 && percent < 1) return '<1%'
  if (percent < 100 && percent > 99) return '>99%'
  return `${Math.round(percent)}%`
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—'
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`
}

function savedAssessments(issue) {
  return (issue.timeline || []).filter(event => event.type === 'assessment')
}

function firstOutcome(issue) {
  const [first] = savedAssessments(issue)
  return first ? first.outcome || 'UNKNOWN' : latestOutcome(issue)
}

function latestOutcome(issue) {
  return dispositionValue(issue) || 'UNKNOWN'
}

function firstStatus(issue, status) {
  return (issue?.timeline || []).find(event => event.type === 'status' && event.to === status)?.at ?? null
}

// When every backport clone reached a status, or null while any clone lacks that timestamp.
function lastClone(issue, issuesByKey, status) {
  const times = (issue.backports || []).map(backport => firstStatus(issuesByKey.get(backport.key), status))
  if (!times.length || times.includes(null)) return null
  return times.reduce((latest, at) => (time(at) > time(latest) ? at : latest))
}

// When each decision first happened; decided is the start of the run of assessments that set the current disposition.
export function milestones(issue, issuesByKey = new Map()) {
  const saved = savedAssessments(issue)
  let current = saved.length - 1
  while (current > 0 && saved[current - 1].outcome === saved[current].outcome) current--
  return {
    reported: issue.created ?? null,
    firstAssessment: saved[0]?.at ?? null,
    decided: current >= 0 ? saved[current].at : null,
    prPosted: firstStatus(issue, 'POST'),
    merged: firstStatus(issue, 'MODIFIED'),
    backportsPosted: lastClone(issue, issuesByKey, 'POST'),
    backportsMerged: lastClone(issue, issuesByKey, 'MODIFIED')
  }
}

// Snapshots from before prPosted was copied onto backports fall back to the clone being in POST.
function backportStage(backport) {
  if (backport.merged === true) return 'merged'
  if (backport.prPosted === true || (backport.prPosted === undefined && backport.status === 'POST')) return 'posted'
  return backport.merged === false ? 'none' : 'unknown'
}

// Mixed bugs get their own Some/Partly boxes, so each box's backports share its state and every
// backport column adds up to the one before it in backports as well as bugs.
function backportPath(backports) {
  if (!backports.length) return ['backports:none']
  const stages = backports.map(backportStage)
  if (stages.includes('unknown')) return ['backports:some', 'backportPr:unknown']
  const withPr = stages.filter(stage => stage !== 'none').length
  if (withPr < stages.length) return ['backports:some', withPr ? 'backportPr:some' : 'backportPr:none']
  const merged = stages.filter(stage => stage === 'merged').length
  const merge = merged === stages.length ? 'merged' : merged ? 'partial' : 'open'
  return ['backports:some', 'backportPr:posted', `backportMerge:${merge}`]
}

function backportCounts(issues) {
  const stages = issues.flatMap(issue => (issue.backports || []).map(backportStage))
  if (!stages.length) return null
  return {
    total: stages.length,
    stages: BACKPORT_STAGES.map(({ key, label }) => ({ key, label, count: stages.filter(stage => stage === key).length })).filter(stage => stage.count).reverse()
  }
}

function decisionPath(issue, { reassessed, tracked }) {
  const latest = latestOutcome(issue)
  const path = ['refined', ...(reassessed ? [`first:${firstOutcome(issue)}`] : []), `latest:${latest}`]
  if (latest !== 'SOLVE' || !tracked) return path
  path.push(issue.prPosted ? 'pr:posted' : 'pr:none')
  if (!issue.prPosted) return path
  path.push(issue.merged ? 'merge:merged' : 'merge:open')
  if (issue.merged) path.push(...backportPath(issue.backports || []))
  return path
}

function nodeInfo(id) {
  if (id === 'refined') return { column: 'refined', label: 'Refined bugs', tone: 'refined', order: 0 }
  const [column, value] = id.split(':')
  if (column === 'first' || column === 'latest') return { column, label: OUTCOME_LABELS[value], short: SHORT_LABELS[value], tone: OUTCOME_TONES[value], order: OUTCOMES.indexOf(value) }
  return { column, ...STAGES[id] }
}

function linkTiming(source, target) {
  if (source === 'refined') return TIMINGS.assessment
  if (source.startsWith('first:') && source.slice('first:'.length) !== target.slice('latest:'.length)) return TIMINGS.reassessment
  if (source === 'latest:SOLVE' && target === 'pr:posted') return TIMINGS.pullRequest
  if (target === 'merge:merged') return TIMINGS.merge
  if (target === 'backportPr:posted') return TIMINGS.backportPullRequests
  if (target === 'backportMerge:merged') return TIMINGS.backportMerge
  return null
}

// Each refined bug follows one path through the decision columns, so every column partitions the same bugs.
// Backport clones are looked up in issuesByKey for their timestamps; they are never bugs of their own here.
export function buildDecisionGraph(issues, { tracked = true, issuesByKey = new Map() } = {}) {
  const reassessed = issues.some(issue => firstOutcome(issue) !== latestOutcome(issue))
  const nodes = new Map()
  const links = new Map()
  for (const issue of issues) {
    const path = decisionPath(issue, { reassessed, tracked })
    path.forEach((id, index) => {
      if (!nodes.has(id)) nodes.set(id, { id, ...nodeInfo(id), issues: [] })
      nodes.get(id).issues.push(issue)
      if (!index) return
      const linkId = `${path[index - 1]}->${id}`
      if (!links.has(linkId)) links.set(linkId, { id: linkId, source: path[index - 1], target: id, issues: [] })
      links.get(linkId).issues.push(issue)
    })
  }
  const columns = COLUMNS
    .map(column => ({
      ...column,
      label: column.key === 'latest' && !reassessed ? 'Assessment' : column.label,
      nodes: [...nodes.values()]
        .filter(node => node.column === column.key)
        .sort((a, b) => a.order - b.order)
        .map(({ issues: nodeIssues, ...node }) => ({
          ...node,
          short: node.short || node.label,
          value: nodeIssues.length,
          keys: nodeIssues.map(issue => issue.key),
          backports: node.column.startsWith('backport') ? backportCounts(nodeIssues) : null
        }))
    }))
    .filter(column => column.nodes.length)
  return {
    reassessed,
    total: issues.length,
    columns,
    links: [...links.values()].map(({ issues: linkIssues, ...link }) => {
      const timing = linkTiming(link.source, link.target)
      const durations = timing ? linkIssues.map(issue => {
        const points = milestones(issue, issuesByKey)
        return between(points[timing.from], points[timing.to])
      }).filter(duration => duration !== null) : []
      return {
        ...link,
        value: linkIssues.length,
        keys: linkIssues.map(issue => issue.key),
        timing: timing && { label: timing.label, median: median(durations), timed: durations.length }
      }
    })
  }
}

function sum(items, value) {
  return items.reduce((total, item) => total + value(item), 0)
}

function round(value) {
  return Math.round(value * 10) / 10
}

// Columns are strict layers, so a column whose bugs all come from one node starts level with that node.
// The right gutter keeps room for the last column's labels, which sit right of their boxes like the others.
export function layoutSankey(graph, { width, height, nodeWidth = 12, nodePadding = 16, top = 28, bottom = 8, right = 0 }) {
  const innerHeight = height - top - bottom
  const { columns } = graph
  if (!columns.length) return { columns: [], nodes: [], links: [] }
  const padding = column => (typeof nodePadding === 'function' ? nodePadding(column) : nodePadding)
  const ky = Math.min(...columns.map(column => (innerHeight - (column.nodes.length - 1) * padding(column)) / sum(column.nodes, node => node.value)))
  const step = columns.length > 1 ? (width - right - nodeWidth) / (columns.length - 1) : 0
  const placed = new Map()
  const placedColumns = columns.map((column, index) => {
    const x0 = index * step
    const columnHeight = sum(column.nodes, node => node.value * ky) + (column.nodes.length - 1) * padding(column)
    const ids = new Set(column.nodes.map(node => node.id))
    const sources = new Set(graph.links.filter(link => ids.has(link.target)).map(link => link.source))
    let y = Math.min(sources.size === 1 ? placed.get([...sources][0]).y0 : top, top + innerHeight - columnHeight)
    for (const node of column.nodes) {
      const nodeHeight = node.value * ky
      placed.set(node.id, { ...node, columnIndex: index, x0, x1: x0 + nodeWidth, y0: y, y1: y + nodeHeight })
      y += nodeHeight + padding(column)
    }
    return { key: column.key, label: column.label, x0, x1: x0 + nodeWidth }
  })
  const links = graph.links.map(link => ({ ...link, width: link.value * ky }))
  for (const node of placed.values()) {
    let sy = node.y0
    for (const link of links.filter(link => link.source === node.id).sort((a, b) => placed.get(a.target).y0 - placed.get(b.target).y0)) {
      link.sy = sy
      sy += link.width
    }
    let ty = node.y0
    for (const link of links.filter(link => link.target === node.id).sort((a, b) => placed.get(a.source).y0 - placed.get(b.source).y0)) {
      link.ty = ty
      ty += link.width
    }
  }
  for (const link of links) {
    const x0 = placed.get(link.source).x1
    const x1 = placed.get(link.target).x0
    const xm = (x0 + x1) / 2
    const y0 = link.sy + link.width / 2
    const y1 = link.ty + link.width / 2
    Object.assign(link, { x0, x1, y0, y1, tone: placed.get(link.target).tone, path: `M${round(x0)},${round(y0)}C${round(xm)},${round(y0)} ${round(xm)},${round(y1)} ${round(x1)},${round(y1)}` })
  }
  return { columns: placedColumns, nodes: [...placed.values()], links }
}

function statusTitle(status) {
  return status ? `${status}${STATUS_NOTES[status] ? ` · ${STATUS_NOTES[status]}` : ''}` : 'Status unknown'
}

function withElapsed(steps, start = null) {
  let previous = start
  return steps.map(step => {
    const elapsed = previous === null ? null : between(previous, step.at)
    if (step.at) previous = step.at
    return { ...step, elapsed }
  })
}

// One step per decision, in order: assessments, solve hand-offs, label changes, status transitions, and backports.
export function buildFlow(issue, issuesByKey = new Map()) {
  const steps = []
  if (issue.created) steps.push({ kind: 'reported', title: 'Reported', at: issue.created, by: issue.reporter ?? null })
  for (const event of issue.timeline || []) {
    const previous = steps.at(-1)
    if (event.type === 'assessment') {
      const outcome = event.outcome || 'UNKNOWN'
      if (previous?.kind === 'assessment' && previous.outcome === outcome) {
        previous.count++
        continue
      }
      steps.push({ kind: 'assessment', title: `Assessed: ${OUTCOME_LABELS[outcome]}`, outcome, count: 1, at: event.at, by: event.by, commentId: event.commentId })
    } else if (event.type === 'status') {
      steps.push({ kind: 'status', title: statusTitle(event.to), status: event.to, detail: event.from ? `${event.from} → ${event.to}` : null, at: event.at, by: event.by })
    } else if (event.type === 'label') {
      const backport = event.label.match(BACKPORT_LABEL)
      if (backport) {
        if (event.added) steps.push({ kind: 'backport', title: `Backport to ${backport[1]}`, key: backport[2], branch: backport[1], at: event.at, by: event.by })
      } else if (event.label === 'issue-for-agent') {
        steps.push({ kind: 'handoff', title: event.added ? 'Sent to solve agent' : 'Removed from solve agent', at: event.at, by: event.by })
      } else if (!(event.added && previous?.kind === 'assessment' && previous.outcome === WAITING_LABELS[event.label])) {
        // Chai adds the waiting label with its assessment, so only a separate change is a decision of its own.
        steps.push({ kind: 'label', title: `${event.added ? 'Labeled' : 'Cleared'} ${event.label}`, at: event.at, by: event.by })
      }
    }
  }
  return withElapsed(steps).map(step => step.kind === 'backport' ? { ...step, lane: backportLane(issue, step, issuesByKey) } : step)
}

function backportLane(issue, step, issuesByKey) {
  const clone = issuesByKey.get(step.key)
  const statuses = (clone?.timeline || []).filter(event => event.type === 'status')
  if (statuses.length) {
    return withElapsed(statuses.map(event => ({ kind: 'status', title: statusTitle(event.to), status: event.to, detail: event.from ? `${event.from} → ${event.to}` : null, at: event.at, by: event.by })), step.at)
  }
  // Without the clone's history, show where it stands now.
  const status = (issue.backports || []).find(entry => entry.key === step.key)?.status
  return [{ kind: 'status', title: status ? `Now ${statusTitle(status)}` : 'Status unknown', status, at: null, by: null, elapsed: null }]
}

// Lead times between the decisions shown at the top of a bug's flow.
export function leadTimes(issue, issuesByKey = new Map()) {
  const points = milestones(issue, issuesByKey)
  return [
    { key: 'assessment', label: 'Report → first assessment', value: between(points.reported, points.firstAssessment) },
    { key: 'pull-request', label: 'Solve assessment → PR', value: dispositionValue(issue) === 'SOLVE' ? between(points.decided, points.prPosted) : null },
    { key: 'merge', label: 'PR → merge', value: between(points.prPosted, points.merged) },
    { key: 'backport-pull-request', label: 'Merge → last backport PR', value: between(points.merged, points.backportsPosted) },
    { key: 'backport-merge', label: 'Last backport PR → merge', value: between(points.backportsPosted, points.backportsMerged) },
    { key: 'total', label: 'Report → merge', value: between(points.reported, points.merged) }
  ].filter(entry => entry.value !== null)
}

const PHASE_ORDER = ['assessment', 'pull-request', 'merge', 'backport-pull-request', 'backport-merge', 'total']

// Median of each phase over the given bugs. Only bugs sent to solve count past the first assessment,
// so the phases follow the same bugs as the Sankey's solve path.
export function phaseTimes(issues, issuesByKey = new Map()) {
  const phases = new Map()
  for (const issue of issues) {
    const solve = dispositionValue(issue) === 'SOLVE'
    for (const { key, label, value } of leadTimes(issue, issuesByKey)) {
      if (key !== 'assessment' && !solve) continue
      if (!phases.has(key)) phases.set(key, { key, label, durations: [] })
      phases.get(key).durations.push(value)
    }
  }
  return [...phases.values()]
    .sort((a, b) => PHASE_ORDER.indexOf(a.key) - PHASE_ORDER.indexOf(b.key))
    .map(({ durations, ...phase }) => ({ ...phase, median: median(durations), timed: durations.length }))
}

function mermaidText(value) {
  return String(value).replace(/#/g, '#35;').replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;')
}

function shortDate(value) {
  return value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
}

function stepClass(step) {
  if (step.kind === 'assessment') return OUTCOME_TONES[step.outcome]
  if (step.kind === 'handoff') return 'refined'
  if (step.status === 'POST') return 'posted'
  if (step.status === 'MODIFIED' || step.status === 'Verified') return 'merged'
  return null
}

function mermaidNode(id, step) {
  const title = step.count > 1 ? `${step.title} ×${step.count}` : step.title
  const meta = [step.by, shortDate(step.at)].filter(Boolean).join(' · ')
  const label = `"${mermaidText(title)}${meta ? `<br/><small>${mermaidText(meta)}</small>` : ''}"`
  if (step.kind === 'assessment') return `${id}{{${label}}}`
  if (step.kind === 'reported') return `${id}([${label}])`
  return `${id}(${label})`
}

// Mermaid flowchart of a bug's decisions; edges carry the time since the previous decision.
export function flowChart(steps) {
  const lines = ['flowchart TD']
  const classes = new Map()
  const edge = (from, to, elapsed, dotted) => lines.push(`  ${from} ${dotted ? '-.->' : '-->'}${elapsed === null ? '' : `|"${mermaidText(formatDuration(elapsed))}"|`} ${to}`)
  const classify = (id, step) => {
    const tone = stepClass(step)
    if (tone) classes.set(tone, [...(classes.get(tone) || []), id])
  }
  steps.forEach((step, index) => {
    const id = `s${index}`
    lines.push(`  ${mermaidNode(id, step)}`)
    classify(id, step)
    if (index) edge(`s${index - 1}`, id, step.elapsed, false)
    ;(step.lane || []).forEach((laneStep, laneIndex) => {
      const laneId = `${id}b${laneIndex}`
      lines.push(`  ${mermaidNode(laneId, { ...laneStep, title: laneIndex ? laneStep.title : `${step.key}: ${laneStep.title}` })}`)
      classify(laneId, laneStep)
      edge(laneIndex ? `${id}b${laneIndex - 1}` : id, laneId, laneStep.elapsed, true)
    })
  })
  for (const [tone, ids] of classes) {
    lines.push(`  classDef ${tone} fill:${TONES[tone].hex},stroke:${TONES[tone].hex},color:#ffffff`)
    lines.push(`  class ${ids.join(',')} ${tone}`)
  }
  return lines.join('\n')
}
