<template>
  <div data-testid="risk-assessment">
    <h2 class="mb-1 px-6 pt-6 text-xl font-bold text-gray-900 dark:text-gray-100">Agentic Risk Assessment</h2>
    <p class="mb-4 px-6 text-sm text-gray-500 dark:text-gray-400">
      Pull requests Chai has labeled by the risk of their latest commit, grouped by repository.
      <span v-if="fetchedAt" :title="data.fetchedAt">Updated {{ fetchedAt }}.</span>
    </p>

    <div v-if="loading" class="py-12 text-center text-gray-500 dark:text-gray-400">Loading risk assessment data...</div>
    <div v-else-if="error" class="py-12 text-center">
      <p class="mb-4 text-red-600 dark:text-red-400">{{ error }}</p>
      <button class="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700" @click="load">Retry</button>
    </div>
    <template v-else>
      <div data-testid="risk-summary" class="grid grid-cols-2 gap-3 px-6 pt-2 lg:grid-cols-4">
        <div class="rounded-lg border border-gray-300 bg-white px-5 py-5 dark:border-gray-600 dark:bg-gray-800">
          <div class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ totals.total }}</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Assessed PRs</div>
        </div>
        <div
          v-for="level in LEVELS"
          :key="level.key"
          class="rounded-lg border border-gray-300 bg-white px-5 py-5 dark:border-gray-600 dark:bg-gray-800"
          :title="level.description"
        >
          <div class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ formatPercent(totals.percentages[level.key]) }}</div>
          <div class="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: level.color }" aria-hidden="true" />
            {{ level.label }}
          </div>
          <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ totals.counts[level.key] }} of {{ totals.total }} PRs</div>
        </div>
      </div>

      <div class="mx-6 mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">By repository ({{ repos.length }})</h3>
          <ul class="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300" aria-label="Risk levels">
            <li v-for="level in LEVELS" :key="level.key" class="flex items-center gap-1.5" :title="level.description">
              <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: level.color }" aria-hidden="true" />
              {{ level.label }}
            </li>
          </ul>
        </div>
        <div v-if="repos.length === 0" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No risk assessment data yet.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-900/30">
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Repository</th>
                <th class="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Assessed PRs</th>
                <th v-for="level in LEVELS" :key="level.key" class="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">{{ level.label }}</th>
                <th class="w-1/4 min-w-[10rem] px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Distribution</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in repos" :key="row.repo" data-testid="risk-repo-row" class="border-b border-gray-100 last:border-0 dark:border-gray-700/50">
                <td class="px-4 py-2">
                  <a :href="repoUrl(row.repo)" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 hover:underline dark:text-primary-400">{{ row.repo }}</a>
                </td>
                <td class="px-4 py-2 text-right tabular-nums">
                  <a v-if="row.total" :href="searchUrl(row.repo)" target="_blank" rel="noopener noreferrer" class="font-semibold text-gray-900 hover:underline dark:text-gray-100">{{ row.total }}</a>
                  <span v-else class="text-gray-400 dark:text-gray-500">0</span>
                </td>
                <td v-for="level in LEVELS" :key="level.key" class="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                  <span class="text-gray-900 dark:text-gray-100">{{ formatPercent(row.percentages[level.key]) }}</span>
                  <a
                    v-if="row.counts[level.key]"
                    :href="searchUrl(row.repo, level.key)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="ml-1.5 text-xs text-gray-500 hover:underline dark:text-gray-400"
                    :title="`Open ${level.label.toLowerCase()} risk PRs in ${row.repo}`"
                  >{{ row.counts[level.key] }}</a>
                  <span v-else class="ml-1.5 text-xs text-gray-400 dark:text-gray-500">0</span>
                </td>
                <td class="px-4 py-2">
                  <RiskBar :counts="row.counts" :total="row.total" :percentages="row.percentages" />
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-gray-50 dark:bg-gray-900/30">
              <tr data-testid="risk-totals-row" class="border-t border-gray-200 font-semibold dark:border-gray-700">
                <td class="px-4 py-2 text-gray-900 dark:text-gray-100">All repositories</td>
                <td class="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{{ totals.total }}</td>
                <td v-for="level in LEVELS" :key="level.key" class="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                  <span class="text-gray-900 dark:text-gray-100">{{ formatPercent(totals.percentages[level.key]) }}</span>
                  <span class="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">{{ totals.counts[level.key] }}</span>
                </td>
                <td class="px-4 py-2">
                  <RiskBar :counts="totals.counts" :total="totals.total" :percentages="totals.percentages" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, h } from 'vue'
import { useRiskAssessment } from '../composables/useRiskAssessment.js'

// Status colors (good / warning / critical) — the same in light and dark mode.
// Every swatch sits beside its text label, so color never carries meaning alone.
const LEVELS = [
  { key: 'low', label: 'Low', color: '#0ca30c', description: 'No product behaviour change' },
  { key: 'moderate', label: 'Moderate', color: '#fab219', description: 'May change product behaviour' },
  { key: 'critical', label: 'Critical', color: '#d03b3b', description: 'May disrupt clusters if wrong' }
]

const EMPTY_SUMMARY = {
  total: 0,
  counts: { low: 0, moderate: 0, critical: 0 },
  percentages: { low: null, moderate: null, critical: null }
}

const { data, loading, error, load } = useRiskAssessment()
const repos = computed(() => data.value?.repos || [])
const totals = computed(() => data.value?.totals || EMPTY_SUMMARY)
const labelPrefix = computed(() => data.value?.labelPrefix || 'chai-risk-assessment/')
const fetchedAt = computed(() => data.value?.fetchedAt ? new Date(data.value.fetchedAt).toLocaleString() : null)

function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${value}%`
}

function repoUrl(repo) {
  return `https://github.com/${repo}`
}

function searchUrl(repo, level) {
  const labels = level ? `${labelPrefix.value}${level}` : LEVELS.map(l => `${labelPrefix.value}${l.key}`).join(',')
  return `https://github.com/${repo}/pulls?q=${encodeURIComponent(`is:pr label:${labels}`)}`
}

// Thin segmented bar: one whole split into risk shares, 2px surface gaps between
// parts, a part at zero draws nothing. The table row beside it carries the numbers.
const RiskBar = (props) => {
  if (!props.total) {
    return h('span', { class: 'text-xs text-gray-400 dark:text-gray-500' }, 'No assessed PRs')
  }
  const parts = LEVELS.filter(level => props.counts[level.key] > 0)
  const name = parts.map(level => `${level.label} ${props.percentages[level.key]}%`).join(', ')
  return h('div', { class: 'flex h-2 w-full gap-[2px]', role: 'img', 'aria-label': name }, parts.map(level => h('span', {
    key: level.key,
    class: 'h-full rounded-full',
    // flex-grow by count (not width %) so the 2px gaps never push the bar past 100%.
    style: { flex: `${props.counts[level.key]} 1 0%`, backgroundColor: level.color },
    title: `${level.label}: ${props.counts[level.key]} of ${props.total} PRs (${props.percentages[level.key]}%)`
  })))
}
RiskBar.props = ['counts', 'total', 'percentages']
</script>
