<template>
  <div class="p-6" data-testid="bug-refinement">
    <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Agentic Bug Refinement</h2>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      Track OCPBUGS and CNTRLPLANE issues labeled refined-by-agent by Chai.
      Refinement includes all saved assessments, including deferrals and requests for more information.
    </p>
    <p v-if="data?.demo" role="status" class="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      Demo data — these are fictional examples, not results from Jira. Open the Jira search below to see real matching issues.
    </p>
    <a v-if="data?.jiraSearchUrl" :href="data.jiraSearchUrl" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">View matching issues in Jira</a>

    <p v-if="loading" class="py-12 text-center text-gray-500 dark:text-gray-400" role="status">Loading refined bugs...</p>
    <div v-else-if="error" class="py-12 text-center" role="alert">
      <p class="mb-4 text-red-600 dark:text-red-400">{{ error }}</p>
      <button class="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700" @click="load">Retry</button>
    </div>
    <template v-else>
      <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="refinement-project-totals">
        <div v-for="metric in metrics" :key="metric.label" class="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">{{ metric.value }}</p>
          <p class="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ metric.label }}</p>
        </div>
      </div>

      <p class="mt-6 text-xs text-gray-500 dark:text-gray-400">Boxes follow Jira components across OCPBUGS and CNTRLPLANE. Bugs with multiple components appear in each matching box. Totals include deferred and unknown assessments.</p>
      <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2" role="group" aria-label="Filter by component">
        <button
          v-for="team in teamCards"
          :key="team.key"
          type="button"
          :data-testid="`refinement-team-${team.key}`"
          :aria-label="team.label"
          :aria-pressed="selectedTeam === team.key"
          :aria-describedby="`refinement-counts-${team.key}`"
          :title="team.key === 'all' ? 'All refined bugs' : team.key === 'none' ? 'Issues without a Jira component' : `Jira component: ${team.label}`"
          class="rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          :class="selectedTeam === team.key
            ? 'border-primary-600 bg-primary-600 text-white shadow-md'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
          @click="selectedTeam = team.key"
        >
          <span class="mb-3 block break-words text-sm font-semibold">{{ team.label }}</span>
          <span :id="`refinement-counts-${team.key}`" class="grid grid-cols-5 divide-x" :class="selectedTeam === team.key ? 'divide-white/20' : 'divide-gray-200 dark:divide-gray-700'">
            <span v-for="counter in team.counters" :key="counter.key" class="min-w-0 px-2 text-center first:pl-0 last:pr-0">
              <span :data-testid="`count-${counter.key}`" :title="counter.key === 'CLOSE' ? 'Saved CLOSE assessments and Jira-closed tickets without a saved assessment' : undefined" class="block text-xl font-bold" :class="selectedTeam === team.key ? 'text-white' : counter.color">{{ counter.value }}</span>
              <span class="mt-1 block break-words text-[10px] uppercase tracking-wider" :class="selectedTeam === team.key ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'">{{ counter.label }}</span>
            </span>
          </span>
        </button>
      </div>

      <div class="my-6 flex flex-wrap items-end gap-4">
        <div class="text-sm text-gray-600 dark:text-gray-300">
          <label for="refinement-project">Project</label>
          <select id="refinement-project" v-model="project" class="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
            <option value="">All projects</option>
            <option value="OCPBUGS">OCPBUGS</option>
            <option value="CNTRLPLANE">CNTRLPLANE</option>
          </select>
        </div>
        <label class="min-w-0 text-sm text-gray-600 dark:text-gray-300">
          Search refined bugs
          <input v-model="search" type="search" placeholder="Key, summary, component, assignee…" class="mt-1 block w-72 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
        </label>
        <p v-if="data?.fetchedAt" class="text-xs text-gray-500 dark:text-gray-400">{{ data.demo ? 'Example snapshot' : 'Last refreshed' }}: {{ formatDate(data.fetchedAt) }}</p>
      </div>

      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">Refined bugs ({{ filteredIssues.length }})</h3>
        <p v-if="issues.length === 0" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No issues with the refined-by-agent label were found in OCPBUGS or CNTRLPLANE.</p>
        <p v-else-if="filteredIssues.length === 0" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No refined bugs match your filters.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
              <tr>
                <th
                  v-for="column in columns"
                  :key="column.key"
                  scope="col"
                  :aria-sort="sortColumn === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
                  class="px-4 py-3 font-medium"
                >
                  <button type="button" :title="`Sort by ${column.label}`" class="inline-flex items-center gap-1 rounded font-medium hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-gray-100" @click="toggleSort(column.key)">
                    {{ column.label }}
                    <span aria-hidden="true" class="w-2 text-[10px]">{{ sortColumn === column.key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕' }}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="issue in sortedIssues" :key="issue.key" class="border-t border-gray-100 text-gray-600 dark:border-gray-700/50 dark:text-gray-300">
                <td class="whitespace-nowrap px-4 py-3">
                  <span v-if="data.demo" class="font-medium">{{ issue.key }} (example)</span>
                  <a v-else :href="`${data.jiraHost}/browse/${issue.key}`" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 hover:underline dark:text-primary-400">{{ issue.key }}</a>
                </td>
                <td class="min-w-64 px-4 py-3 text-gray-900 dark:text-gray-100">{{ issue.summary }}</td>
                <td class="min-w-40 px-4 py-3">{{ componentsForIssue(issue).join(', ') || '—' }}</td>
                <td class="whitespace-nowrap px-4 py-3">
                  <a v-if="!data.demo && issue.dispositionCommentId" :href="`${data.jiraHost}/browse/${issue.key}?focusedCommentId=${encodeURIComponent(issue.dispositionCommentId)}`" target="_blank" rel="noopener noreferrer" :title="dispositionTitle(issue)" class="inline-block rounded-full px-2 py-1 text-xs font-medium hover:underline" :class="dispositionClasses(dispositionValue(issue))">{{ dispositionLabel(issue) }}</a>
                  <span v-else :title="dispositionTitle(issue)" class="inline-block rounded-full px-2 py-1 text-xs font-medium" :class="dispositionClasses(dispositionValue(issue))">{{ dispositionLabel(issue) }}</span>
                </td>
                <td class="px-4 py-3">{{ issue.status }}</td>
                <td class="px-4 py-3">{{ issue.priority }}</td>
                <td class="px-4 py-3">{{ issue.assignee || 'Unassigned' }}</td>
                <td class="px-4 py-3">{{ waitingLabels(issue).join(', ') || '—' }}</td>
                <td class="whitespace-nowrap px-4 py-3">{{ formatDate(issue.updated) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRefinement } from '../composables/useRefinement.js'

const { data, loading, error, load } = useRefinement()
const DISPOSITION_COUNTERS = [
  { key: 'SOLVE', label: 'Solve', color: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'CLOSE', label: 'Close', color: 'text-slate-700 dark:text-slate-200' },
  { key: 'NEED_HUMAN_ANALYSIS', label: 'Need human analysis', color: 'text-purple-600 dark:text-purple-400' },
  { key: 'NEEDS_INFO', label: 'Needs info', color: 'text-amber-600 dark:text-amber-400' }
]
const selectedTeam = ref('all')
const project = ref('')
const search = ref('')
const sortColumn = ref(null)
const sortDirection = ref('asc')
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const columns = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'components', label: 'Components' },
  { key: 'disposition', label: 'Disposition' },
  { key: 'status', label: 'Jira status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'labels', label: 'Waiting labels' },
  { key: 'updated', label: 'Updated' }
]
const PRIORITY_RANK = { blocker: 0, highest: 0, critical: 1, high: 1, major: 2, medium: 2, normal: 2, minor: 3, low: 3, trivial: 4, lowest: 4 }
const issues = computed(() => data.value?.issues || [])
const teamOptions = computed(() => {
  const components = [...new Set(issues.value.flatMap(componentsForIssue))].sort(collator.compare)
  return [
    { key: 'all', label: 'All Teams' },
    ...components.map(component => ({ key: `component-${encodeURIComponent(component)}`, label: component, component })),
    ...(issues.value.some(issue => componentsForIssue(issue).length === 0) ? [{ key: 'none', label: 'No component' }] : [])
  ]
})
watch(teamOptions, options => {
  if (!options.some(option => option.key === selectedTeam.value)) selectedTeam.value = 'all'
})
const teamCards = computed(() => teamOptions.value.map(team => {
  const teamIssues = issuesForTeam(team.key)
  return {
    ...team,
    counters: [
      { key: 'total', label: 'Total', value: teamIssues.length, color: 'text-gray-900 dark:text-gray-100' },
      ...DISPOSITION_COUNTERS.map(counter => ({ ...counter, value: teamIssues.filter(issue => dispositionValue(issue) === counter.key).length }))
    ]
  }
}))
const teamIssues = computed(() => issuesForTeam(selectedTeam.value))
const metrics = computed(() => [
  { label: 'Total refined', value: teamIssues.value.length },
  { label: 'OCPBUGS', value: teamIssues.value.filter(issue => issue.project === 'OCPBUGS').length },
  { label: 'CNTRLPLANE', value: teamIssues.value.filter(issue => issue.project === 'CNTRLPLANE').length }
])
const filteredIssues = computed(() => {
  const query = search.value.trim().toLowerCase()
  return teamIssues.value.filter(issue => (!project.value || issue.project === project.value) &&
    (!query || [issue.key, issue.summary, issue.assignee, ...(issue.components || [])].filter(Boolean).join(' ').toLowerCase().includes(query)))
})
const sortedIssues = computed(() => {
  if (!sortColumn.value) return filteredIssues.value
  const direction = sortDirection.value === 'asc' ? 1 : -1
  return [...filteredIssues.value].sort((left, right) => {
    const leftValue = sortValue(left, sortColumn.value)
    const rightValue = sortValue(right, sortColumn.value)
    const tieBreak = () => collator.compare(left.key || '', right.key || '')
    if (leftValue === null || rightValue === null) return Number(leftValue === null) - Number(rightValue === null) || tieBreak()
    const comparison = typeof leftValue === 'number' ? leftValue - rightValue : collator.compare(leftValue, rightValue)
    return comparison * direction || tieBreak()
  })
})

function componentsForIssue(issue) {
  return [...new Set((issue.components || []).filter(component => typeof component === 'string' && component.trim()))].sort(collator.compare)
}

function issuesForTeam(teamKey) {
  if (teamKey === 'all') return issues.value
  if (teamKey === 'none') return issues.value.filter(issue => componentsForIssue(issue).length === 0)
  const component = teamOptions.value.find(option => option.key === teamKey)?.component
  return issues.value.filter(issue => componentsForIssue(issue).includes(component))
}

function sortValue(issue, column) {
  if (column === 'components') return componentsForIssue(issue).join(', ') || null
  if (column === 'disposition') return dispositionValue(issue) || null
  if (column === 'labels') return waitingLabels(issue).join(', ') || null
  if (column === 'updated') {
    const timestamp = Date.parse(issue.updated)
    return Number.isNaN(timestamp) ? null : timestamp
  }
  const value = issue[column]
  if (!value || value === 'Unknown') return null
  return column === 'priority' ? (PRIORITY_RANK[value.toLowerCase()] ?? 99) : value
}

function toggleSort(column) {
  sortDirection.value = sortColumn.value === column && sortDirection.value === 'asc' ? 'desc' : 'asc'
  sortColumn.value = column
}

function waitingLabels(issue) {
  return (issue.labels || []).filter(label => ['needs-info', 'need-human-analysis'].includes(label)).sort(collator.compare)
}

function dispositionTitle(issue) {
  if (isJiraClosure(issue)) return 'Closed in Jira; no saved refinement assessment is available in this snapshot. Closure does not confirm a verified fix.'
  return issue.disposition ? `Saved assessment${issue.dispositionAt ? `: ${formatDate(issue.dispositionAt)}` : ''}` : 'No recognized saved assessment is visible in Jira comments'
}

function isJiraClosure(issue) {
  return !issue.disposition && !issue.dispositionCommentId && !issue.dispositionAt && issue.status?.toLowerCase() === 'closed'
}

function dispositionValue(issue) {
  return isJiraClosure(issue) ? 'CLOSE' : issue.disposition
}

function dispositionLabel(issue) {
  return isJiraClosure(issue) ? 'CLOSE (Jira)' : issue.disposition || 'Unknown'
}

function dispositionClasses(disposition) {
  return {
    SOLVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    CLOSE: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    DEFER: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    NEEDS_INFO: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    NEED_HUMAN_ANALYSIS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200'
  }[disposition] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}
</script>
