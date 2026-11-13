<template>
  <div>
    <h2 class="mb-1 px-6 pt-6 text-xl font-bold text-gray-900 dark:text-gray-100">CVE Triage</h2>
    <p class="mb-4 px-6 text-sm text-gray-500 dark:text-gray-400">Track CVE triaging and resolution by solution.</p>

    <div v-if="loading" class="py-12 text-center text-gray-500 dark:text-gray-400">Loading CVE triage data...</div>
    <div v-else-if="error" class="py-12 text-center">
      <p class="mb-4 text-red-600 dark:text-red-400">{{ error }}</p>
      <button class="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700" @click="load">Retry</button>
    </div>
    <template v-else>
      <div class="grid grid-cols-1 gap-3 px-6 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        <button
          v-for="solution in solutionCards"
          :key="solution.key"
          type="button"
          class="rounded-lg border px-4 py-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          :class="selectedSolution === solution.key ? 'border-primary-600 bg-primary-600 text-white shadow-md' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
          :aria-pressed="selectedSolution === solution.key"
          @click="selectedSolution = solution.key"
        >
          <div>
            <h3 class="text-lg font-semibold">{{ solution.title }}</h3>
          </div>
          <p :class="selectedSolution === solution.key ? 'text-white/75' : 'text-gray-500 dark:text-gray-400'" class="mt-2 text-sm">{{ solution.description }}</p>
          <div class="mt-5 grid grid-cols-3 gap-4">
            <div>
              <div :class="selectedSolution === solution.key ? 'text-white' : 'text-amber-600 dark:text-amber-400'" class="text-2xl font-bold">{{ solution.data.metrics.triaged }}</div>
              <div :class="selectedSolution === solution.key ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'" class="text-[10px] font-semibold uppercase tracking-wider">Triaged</div>
            </div>
            <div>
              <div :class="selectedSolution === solution.key ? 'text-white' : 'text-purple-600 dark:text-purple-400'" class="text-2xl font-bold">{{ solution.data.metrics.resolved }}</div>
              <div :class="selectedSolution === solution.key ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'" class="text-[10px] font-semibold uppercase tracking-wider">Resolved</div>
            </div>
            <div :title="resolutionRateTitle(solution.data.metrics)">
              <div :class="selectedSolution === solution.key ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'" class="text-2xl font-bold">{{ formatResolutionRate(solution.data.metrics) }}</div>
              <div :class="selectedSolution === solution.key ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'" class="text-[10px] font-semibold uppercase tracking-wider">Resolve rate</div>
            </div>
          </div>
        </button>
      </div>

      <div class="mx-6 mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ activeSolution.title }} CVEs ({{ activeSolution.data.issues.length }})</h3>
        </div>
        <div v-if="activeSolution.data.issues.length === 0" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No {{ activeSolution.title }}-triaged CVEs were found in Jira.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-900/30">
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th
                  v-for="column in columns"
                  :key="column.key"
                  :aria-sort="ariaSort(column.key)"
                  class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400"
                >
                  <button
                    type="button"
                    :title="`Sort by ${column.label}`"
                    class="inline-flex items-center gap-1 font-medium transition-colors hover:text-gray-900 dark:hover:text-gray-100"
                    :class="sortColumn === column.key ? 'text-gray-900 dark:text-gray-100' : ''"
                    @click="toggleSort(column.key)"
                  >
                    {{ column.label }}
                    <span class="w-2 text-[10px] leading-none" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="issue in sortedIssues" :key="issue.key" class="border-b border-gray-100 last:border-0 dark:border-gray-700/50">
                <td class="px-4 py-2"><a :href="`${data.jiraHost}/browse/${issue.key}`" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 hover:underline dark:text-primary-400">{{ issue.key }}</a></td>
                <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{{ issue.summary }}</td>
                <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ issue.status }}</td>
                <td class="px-4 py-2"><span :class="issue.resolved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'" class="rounded-full px-2 py-1 text-xs font-medium">{{ issue.resolved ? 'Resolved' : 'Triaged' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useCveTriage } from '../composables/useCveTriage.js'

const { data, loading, error, load } = useCveTriage()
const selectedSolution = ref('arc')
const emptySolution = { metrics: { triaged: 0, resolved: 0, resolutionRate: null }, issues: [] }
const solutionCards = computed(() => [
  {
    key: 'arc',
    title: 'ARC',
    description: 'CVE issues handled through ARC.',
    data: data.value?.solutions?.arc || emptySolution
  },
  {
    key: 'chai',
    title: 'Sustaining Engineer CHAI',
    description: 'CVE issues analyzed by the CHAI bot.',
    data: data.value?.solutions?.chai || emptySolution
  },
  {
    key: 'oapeChai',
    title: 'OAPE CHAI',
    description: 'CVE issues analyzed by OAPE CHAI.',
    data: data.value?.solutions?.oapeChai || emptySolution
  }
])
const activeSolution = computed(() => solutionCards.value.find(solution => solution.key === selectedSolution.value) || solutionCards.value[0])
const columns = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'status', label: 'Status' },
  { key: 'resolved', label: 'Resolution' }
]
const sortColumn = ref('key')
const sortDirection = ref('asc')
const keyPattern = /^([A-Z][A-Z0-9]*)-(\d+)$/

function compareKeys(left, right) {
  const leftMatch = keyPattern.exec(left.key || '')
  const rightMatch = keyPattern.exec(right.key || '')
  if (leftMatch && rightMatch) {
    if (leftMatch[1] !== rightMatch[1]) return leftMatch[1].localeCompare(rightMatch[1])
    return Number(leftMatch[2]) - Number(rightMatch[2])
  }
  return (left.key || '').localeCompare(right.key || '')
}

function compareText(left, right) {
  return String(left || '').localeCompare(String(right || ''), undefined, { sensitivity: 'base' })
}

const sorters = {
  key: compareKeys,
  summary: (left, right) => compareText(left.summary, right.summary),
  status: (left, right) => compareText(left.status, right.status),
  resolved: (left, right) => Number(left.resolved) - Number(right.resolved)
}

const sortedIssues = computed(() => [...activeSolution.value.data.issues].sort((left, right) => {
  const comparison = sorters[sortColumn.value](left, right)
  if (comparison !== 0) return comparison * (sortDirection.value === 'asc' ? 1 : -1)
  return compareKeys(left, right)
}))

function toggleSort(column) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

function sortIndicator(column) {
  if (sortColumn.value !== column) return ''
  return sortDirection.value === 'asc' ? '▲' : '▼'
}

function ariaSort(column) {
  if (sortColumn.value !== column) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function resolutionRate(metrics) {
  if (!metrics.triaged) return null
  if (metrics.resolutionRate !== null && metrics.resolutionRate !== undefined) return metrics.resolutionRate
  return Math.round((metrics.resolved / metrics.triaged) * 100)
}

function formatResolutionRate(metrics) {
  const rate = resolutionRate(metrics)
  return rate === null ? '—' : `${rate}%`
}

function resolutionRateTitle(metrics) {
  if (!metrics.triaged) return 'No triaged CVEs yet'
  return `${metrics.resolved} of ${metrics.triaged} triaged CVEs resolved`
}
</script>
