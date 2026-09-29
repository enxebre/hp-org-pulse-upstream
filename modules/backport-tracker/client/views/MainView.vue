<template>
  <div>
    <h2 class="mb-1 px-6 pt-6 text-xl font-bold text-gray-900 dark:text-gray-100">Agentic Backports</h2>
    <p class="mb-4 px-6 text-sm text-gray-500 dark:text-gray-400">Track Jira backports driven by Chai and their merge outcomes.</p>

    <div v-if="loading" class="py-12 text-center text-gray-500 dark:text-gray-400">Loading backport data...</div>
    <div v-else-if="error" class="py-12 text-center">
      <p class="mb-4 text-red-600 dark:text-red-400">{{ error }}</p>
      <button class="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700" @click="load">Retry</button>
    </div>
    <template v-else>
      <div class="grid grid-cols-1 gap-3 px-6 pt-6 sm:grid-cols-3">
        <div class="rounded-lg border border-gray-300 bg-white px-5 py-5 dark:border-gray-600 dark:bg-gray-800">
          <div class="text-3xl font-bold text-amber-600 dark:text-amber-400">{{ metrics.total }}</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</div>
        </div>
        <div class="rounded-lg border border-gray-300 bg-white px-5 py-5 dark:border-gray-600 dark:bg-gray-800">
          <div class="text-3xl font-bold text-purple-600 dark:text-purple-400">{{ metrics.merged }}</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Merged</div>
        </div>
        <div class="rounded-lg border border-gray-300 bg-white px-5 py-5 dark:border-gray-600 dark:bg-gray-800" :title="mergeRateTitle">
          <div class="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{{ formattedMergeRate }}</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Merge rate</div>
        </div>
      </div>

      <div class="mx-6 mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Chai-driven backports ({{ issues.length }})</h3>
        </div>
        <div v-if="issues.length === 0" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No Jira issues with the chai-backport label were found.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-900/30">
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Key</th>
                <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Summary</th>
                <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Jira status</th>
                <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Merge outcome</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="issue in issues" :key="issue.key" class="border-b border-gray-100 last:border-0 dark:border-gray-700/50">
                <td class="px-4 py-2"><a :href="`${data.jiraHost}/browse/${issue.key}`" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 hover:underline dark:text-primary-400">{{ issue.key }}</a></td>
                <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{{ issue.summary }}</td>
                <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ issue.status }}</td>
                <td class="px-4 py-2"><span :class="issue.merged ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'" class="rounded-full px-2 py-1 text-xs font-medium">{{ issue.merged ? 'Merged' : 'In progress' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useBackports } from '../composables/useBackports.js'

const { data, loading, error, load } = useBackports()
const metrics = computed(() => data.value?.metrics || { total: 0, merged: 0, mergeRate: null })
const issues = computed(() => data.value?.issues || [])
const formattedMergeRate = computed(() => metrics.value.mergeRate === null ? '—' : `${metrics.value.mergeRate}%`)
const mergeRateTitle = computed(() => metrics.value.total ? `${metrics.value.merged} of ${metrics.value.total} Chai-driven backports merged` : 'No Chai-driven backports yet')
</script>
