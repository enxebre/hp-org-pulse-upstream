<template>
  <div class="p-6" data-testid="bug-pipeline">
    <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Agentic Bug Pipeline</h2>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      Follow refined OCPBUGS issues from Chai's refinement through solve and backport merges; backport clones count toward their original bug.
      Pull requests and merges come from Jira status history: POST means a pull request was linked, and MODIFIED means it merged.
    </p>
    <p v-if="data?.demo" data-testid="pipeline-demo" role="status" class="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      Demo data — these are fictional examples, not results from Jira.
    </p>

    <p v-if="loading" class="py-12 text-center text-gray-500 dark:text-gray-400" role="status">Loading pipeline outcomes...</p>
    <div v-else-if="error" class="py-12 text-center" role="alert">
      <p class="mb-4 text-red-600 dark:text-red-400">{{ error }}</p>
      <button class="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700" @click="load">Retry</button>
    </div>
    <template v-else>
      <p v-if="!tracked" data-testid="pipeline-refresh-needed" role="status" class="mt-4 rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
        This snapshot was fetched before pull request and merge tracking. Refresh it to load solve and backport outcomes.
      </p>
      <div class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7" data-testid="pipeline-stages">
        <div v-for="stage in stages" :key="stage.key" :data-testid="`stage-${stage.key}`" class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">{{ stage.value }}</p>
          <p class="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ stage.label }}</p>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ stage.detail }}</p>
        </div>
      </div>

      <p class="mt-6 text-xs text-gray-500 dark:text-gray-400">Boxes follow Jira components. Close, human analysis, needs info, and sent to solve percentages are of refined bugs; solve merges are of bugs sent to solve; and backport merges are of the backports linked to those bugs.</p>
      <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2" role="group" aria-label="Filter by component">
        <button
          v-for="team in teamCards"
          :key="team.key"
          type="button"
          :data-testid="`pipeline-team-${team.key}`"
          :aria-label="team.label"
          :aria-pressed="selectedTeam === team.key"
          :aria-describedby="`pipeline-rates-${team.key}`"
          :title="team.key === 'all' ? 'All refined OCPBUGS issues' : team.key === 'none' ? 'Issues without a Jira component' : `Jira component: ${team.label}`"
          class="rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          :class="selectedTeam === team.key
            ? 'border-primary-600 bg-primary-600 text-white shadow-md'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
          @click="selectedTeam = team.key"
        >
          <span class="mb-3 block break-words text-sm font-semibold">{{ team.label }}</span>
          <span :id="`pipeline-rates-${team.key}`" class="block space-y-3">
            <span v-for="(row, index) in team.rows" :key="index" class="grid grid-cols-4 divide-x" :class="[selectedTeam === team.key ? 'divide-white/20' : 'divide-gray-200 dark:divide-gray-700', index > 0 && (selectedTeam === team.key ? 'border-t border-white/20 pt-3' : 'border-t border-gray-200 pt-3 dark:border-gray-700')]">
              <span v-for="counter in row" :key="counter.key" class="min-w-0 px-2 text-center first:pl-0 last:pr-0">
                <span :data-testid="`rate-${counter.key}`" class="block text-xl font-bold" :class="selectedTeam === team.key ? 'text-white' : counter.color">{{ counter.value }}</span>
                <span class="mt-1 block break-words text-[10px] uppercase tracking-wider" :class="selectedTeam === team.key ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'">{{ counter.label }}</span>
              </span>
            </span>
          </span>
        </button>
      </div>

      <DecisionSankey v-if="teamIssues.length" class="mt-6" :issues="teamIssues" :tracked="tracked" :issues-by-key="issuesByKey" :selected-id="flowSelection?.id || null" @select="flowSelection = $event" />

      <div class="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 px-3 py-3 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Refined bugs ({{ tableIssues.length }})</h3>
          <p v-if="flowSelection" data-testid="flow-selection" class="flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">
            Decision flow: {{ flowSelection.label }}
            <button type="button" class="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" @click="flowSelection = null">Clear</button>
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Expand a bug to see each decision, who made it, and the time between decisions.</p>
        </div>
        <p v-if="issues.length === 0" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">{{ data?.fetchedAt ? 'No refined OCPBUGS issues were found.' : 'Agentic Bug Refinement has not fetched its first snapshot yet.' }}</p>
        <div v-else ref="tableScroller" class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
              <tr>
                <th
                  v-for="column in COLUMNS"
                  :key="column.key"
                  scope="col"
                  :aria-sort="sortColumn === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
                  class="px-3 py-3 font-medium"
                >
                  <button type="button" :title="`Sort by ${column.label}`" class="inline-flex items-center gap-1 rounded font-medium hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-gray-100" @click="toggleSort(column.key)">
                    {{ column.label }}
                    <span aria-hidden="true" class="w-2 text-[10px]">{{ sortColumn === column.key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕' }}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="issue in sortedIssues" :key="issue.key">
                <tr class="border-t border-gray-100 text-gray-600 dark:border-gray-700/50 dark:text-gray-300">
                  <td class="whitespace-nowrap px-3 py-3">
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        data-testid="flow-toggle"
                        :aria-expanded="expandedKey === issue.key"
                        :aria-controls="`decision-flow-${issue.key}`"
                        :aria-label="`Decision flow for ${issue.key}`"
                        :title="`${expandedKey === issue.key ? 'Hide' : 'Show'} decision flow`"
                        class="rounded p-0.5 text-gray-400 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-500 dark:hover:text-gray-200"
                        @click="expandedKey = expandedKey === issue.key ? null : issue.key"
                      >
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 transition-transform" :class="expandedKey === issue.key && 'rotate-90'"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
                      </button>
                      <span v-if="data.demo" class="font-medium">{{ issue.key }} (example)</span>
                      <a v-else :href="`${data.jiraHost}/browse/${issue.key}`" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 hover:underline dark:text-primary-400">{{ issue.key }}</a>
                    </div>
                  </td>
                  <td class="min-w-40 px-3 py-3 text-gray-900 [overflow-wrap:anywhere] dark:text-gray-100">{{ issue.summary }}</td>
                  <td class="min-w-32 px-3 py-3">{{ componentsForIssue(issue).join(', ') || '—' }}</td>
                  <td class="whitespace-nowrap px-3 py-3">
                    <div class="flex items-center gap-1">
                      <a v-if="!data.demo && issue.dispositionCommentId" data-testid="disposition" :href="`${data.jiraHost}/browse/${issue.key}?focusedCommentId=${encodeURIComponent(issue.dispositionCommentId)}`" target="_blank" rel="noopener noreferrer" :title="dispositionTitle(issue)" class="inline-block rounded-full px-2 py-1 text-xs font-medium hover:underline" :class="dispositionClasses(dispositionValue(issue))">{{ dispositionLabel(issue) }}</a>
                      <span v-else data-testid="disposition" :title="dispositionTitle(issue)" class="inline-block rounded-full px-2 py-1 text-xs font-medium" :class="dispositionClasses(dispositionValue(issue))">{{ dispositionLabel(issue) }}</span>
                      <template v-if="dispositionValue(issue) === 'SOLVE'">
                        <span aria-hidden="true" class="text-gray-400 dark:text-gray-500">→</span>
                        <span data-testid="solve-outcome" class="inline-block rounded-full px-2 py-1 text-xs font-medium" :class="outcomeClasses(solveOutcome(issue))">{{ solveOutcome(issue) }}</span>
                      </template>
                    </div>
                    <ul v-if="dispositionValue(issue) === 'SOLVE' && issue.pullRequests?.length" class="mt-1 space-y-1">
                      <li v-for="pullRequest in issue.pullRequests" :key="pullRequest.url">
                        <span v-if="data.demo" :title="`${pullRequest.repo}#${pullRequest.number}`" class="font-medium">{{ pullRequestLabel(pullRequest) }} (example)</span>
                        <a v-else :href="pullRequest.url" target="_blank" rel="noopener noreferrer" :title="`${pullRequest.repo}#${pullRequest.number}`" class="font-medium text-primary-600 hover:underline dark:text-primary-400">{{ pullRequestLabel(pullRequest) }}</a>
                      </li>
                    </ul>
                  </td>
                  <td class="px-3 py-3">{{ issue.status }}</td>
                  <td class="px-3 py-3">
                    <span v-if="!issue.backports?.length">—</span>
                    <ul v-else class="space-y-2">
                      <li v-for="backport in issue.backports" :key="backport.key" class="whitespace-nowrap">
                        <span class="block text-xs text-gray-500 dark:text-gray-400">{{ backport.branch }}</span>
                        <span v-if="data.demo" class="font-medium">{{ backport.key }} (example)</span>
                        <a v-else :href="`${data.jiraHost}/browse/${backport.key}`" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 hover:underline dark:text-primary-400">{{ backport.key }}</a>
                        <span class="ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium" :class="outcomeClasses(backportLabel(backport))">{{ backportLabel(backport) }}</span>
                      </li>
                    </ul>
                  </td>
                  <td class="whitespace-nowrap px-3 py-3" :title="formatDate(issue.updated)">{{ formatDay(issue.updated) }}</td>
                </tr>
                <tr v-if="expandedKey === issue.key" data-testid="decision-flow-row" class="bg-gray-50 dark:bg-gray-900/30">
                  <td :colspan="COLUMNS.length" class="p-0">
                    <!-- The table can scroll sideways, so the flow stays pinned to the visible width. -->
                    <div class="sticky left-0 px-3 py-4" :style="scrollerWidth ? { width: `${scrollerWidth}px` } : null">
                      <DecisionFlow :issue="issue" :issues-by-key="issuesByKey" />
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import DecisionFlow from '../components/DecisionFlow.vue'
import DecisionSankey from '../components/DecisionSankey.vue'
import { usePipeline } from '../composables/usePipeline.js'
import { useComponentFilter } from '../composables/useComponentFilter.js'
import { useSortableRows } from '../composables/useSortableRows.js'
import { DISPOSITION_COUNTERS, componentsForIssue, dispositionClasses, dispositionLabel, dispositionTitle, dispositionValue, formatDate } from '../utils/issues.js'

const { data, loading, error, load } = usePipeline()
const COLUMNS = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'components', label: 'Components' },
  { key: 'disposition', label: 'Disposition' },
  { key: 'status', label: 'Jira status' },
  { key: 'backports', label: 'Backports' },
  { key: 'updated', label: 'Updated' }
]
// Within SOLVE, rank by progress so a descending sort lists merged fixes first.
const SOLVE_PROGRESS = { 'No PR yet': 1, 'PR posted': 2, Merged: 3 }
const COUNT_COLOR = 'text-gray-900 dark:text-gray-100'
const MERGED_COLOR = 'text-emerald-600 dark:text-emerald-400'
// Bugs leaving the pipeline at refinement, then the solve path: sent to solve sits next to solve merged.
const EXIT_OUTCOMES = DISPOSITION_COUNTERS.filter(counter => counter.key !== 'SOLVE')
const SOLVE_OUTCOME = { ...DISPOSITION_COUNTERS.find(counter => counter.key === 'SOLVE'), label: 'Sent to solve' }
// Backport clones inherit refined-by-agent; they are counted through their original bug.
const issues = computed(() => (data.value?.issues || []).filter(issue => issue.project === 'OCPBUGS' && !(issue.labels || []).includes('chai-backport')))
const { selectedTeam, teamOptions, issuesForTeam } = useComponentFilter(issues)
const tracked = computed(() => issues.value.every(issue => typeof issue.merged === 'boolean'))
const teamCards = computed(() => teamOptions.value.map(team => ({ ...team, rows: counterRows(summarize(issuesForTeam(team.key))) })))
const teamIssues = computed(() => issuesForTeam(selectedTeam.value))
// A selected Sankey box or band narrows the table to its bugs; clones stay reachable for backport lanes.
const flowSelection = ref(null)
const expandedKey = ref(null)
const tableScroller = ref(null)
const scrollerWidth = ref(null)
let scrollerObserver = null
watch(tableScroller, element => {
  scrollerObserver?.disconnect()
  if (!element || typeof ResizeObserver === 'undefined') return
  scrollerObserver = new ResizeObserver(([entry]) => { scrollerWidth.value = Math.floor(entry.contentRect.width) })
  scrollerObserver.observe(element)
})
onBeforeUnmount(() => scrollerObserver?.disconnect())
const issuesByKey = computed(() => new Map((data.value?.issues || []).map(issue => [issue.key, issue])))
const tableIssues = computed(() => flowSelection.value ? teamIssues.value.filter(issue => flowSelection.value.keys.includes(issue.key)) : teamIssues.value)
watch([selectedTeam, data], () => { flowSelection.value = null })
const { sortColumn, sortDirection, sortedRows: sortedIssues, toggleSort } = useSortableRows(tableIssues, sortValue, { column: 'updated', direction: 'desc' })
const stages = computed(() => {
  const summary = summarize(teamIssues.value)
  return [
    { key: 'refined', label: 'Refined bugs', value: summary.refined, detail: 'OCPBUGS issues' },
    ...[...EXIT_OUTCOMES, SOLVE_OUTCOME].map(counter => ({
      key: counter.key,
      label: counter.label,
      value: rate(summary.outcomes[counter.key], summary.refined),
      detail: `${summary.outcomes[counter.key]} of ${summary.refined} refined bugs`
    })),
    { key: 'merged', label: 'Solve merged', value: trackedRate(summary.merged, summary.solve), detail: tracked.value ? `${summary.merged} of ${summary.solve} sent to solve` : 'Refresh needed' },
    { key: 'backports', label: 'Backports merged', value: trackedRate(summary.backportsMerged, summary.backports), detail: tracked.value ? `${summary.backportsMerged} of ${summary.backports} linked backports` : 'Refresh needed' }
  ]
})

function summarize(teamIssues) {
  const sent = teamIssues.filter(issue => dispositionValue(issue) === 'SOLVE')
  const backports = sent.flatMap(issue => issue.backports || [])
  return {
    refined: teamIssues.length,
    outcomes: Object.fromEntries(DISPOSITION_COUNTERS.map(({ key }) => [key, teamIssues.filter(issue => dispositionValue(issue) === key).length])),
    solve: sent.length,
    merged: sent.filter(issue => issue.merged === true).length,
    backports: backports.length,
    backportsMerged: backports.filter(backport => backport.merged === true).length
  }
}

function counterRows(summary) {
  return [
    [
      { key: 'refined', label: 'Refined', value: summary.refined, color: COUNT_COLOR },
      ...EXIT_OUTCOMES.map(counter => ({ ...counter, value: rate(summary.outcomes[counter.key], summary.refined) }))
    ],
    [
      { ...SOLVE_OUTCOME, value: rate(summary.solve, summary.refined) },
      { key: 'merged', label: 'Solve merged', value: trackedRate(summary.merged, summary.solve), color: MERGED_COLOR },
      { key: 'backports-merged', label: 'Backports merged', value: trackedRate(summary.backportsMerged, summary.backports), color: MERGED_COLOR }
    ]
  ]
}

function rate(count, total) {
  return total ? `${Math.round((count / total) * 100)}%` : '—'
}

function trackedRate(count, total) {
  return tracked.value ? rate(count, total) : '—'
}

function sortValue(issue, column) {
  if (column === 'components') return componentsForIssue(issue).join(', ') || null
  if (column === 'disposition') {
    const disposition = dispositionValue(issue)
    if (!disposition) return null
    return disposition === 'SOLVE' ? `SOLVE ${SOLVE_PROGRESS[solveOutcome(issue)] || 0}` : disposition
  }
  if (column === 'backports') return issue.backports?.length || null
  if (column === 'updated') {
    const timestamp = Date.parse(issue.updated)
    return Number.isNaN(timestamp) ? null : timestamp
  }
  const value = issue[column]
  return !value || value === 'Unknown' ? null : value
}

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function pullRequestLabel(pullRequest) {
  return `${pullRequest.repo.split('/').pop()}#${pullRequest.number}`
}

function solveOutcome(issue) {
  if (typeof issue.merged !== 'boolean') return 'Unknown'
  if (issue.merged) return 'Merged'
  return issue.prPosted ? 'PR posted' : 'No PR yet'
}

function backportLabel(backport) {
  return backport.merged === true ? 'Merged' : backport.status || 'Unknown'
}

function outcomeClasses(label) {
  return {
    Merged: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    'PR posted': 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    POST: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
  }[label] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
}
</script>
